import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Notification } from "electron";
import path from "node:path";
import fs from "node:fs";
import { autoUpdater } from "electron-updater";
import { setupTray } from "./tray";
import { getConfig, config } from "./config";
import { convertToWav } from "./audio-converter";
import { transcribe, startWhisperServer, stopWhisperServer } from "./transcriber";
import { injectText } from "./injector";
import { getActiveModelPath, isAnyModelDownloaded } from "./model-manager";
import { getWhisperPath, getFfmpegPath } from "./bin-resolver";

let recordingWindow: BrowserWindow | null = null;
let isRecording = false;
let isQuitting = false;

// Safe IPC send - won't crash if window is destroyed
function send(channel: string, ...args: any[]) {
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.webContents.send(channel, ...args);
  }
}

function createRecordingWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 180,
    useContentSize: true, // Size = content area, not window frame
    show: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    backgroundColor: "#18181b",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Hide instead of destroy when user closes window
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // Save position when dragged
  win.on("moved", () => {
    const [x, y] = win.getPosition();
    config.set("windowPosition", { x, y });
  });

  return win;
}

function toggleRecording() {
  if (!recordingWindow || recordingWindow.isDestroyed()) {
    recordingWindow = createRecordingWindow();
  }

  isRecording = !isRecording;

  if (isRecording) {
    // Recording widget - saved position or bottom center
    recordingWindow.setContentSize(480, 180);
    const savedPos = getConfig("windowPosition");
    if (savedPos) {
      recordingWindow.setPosition(savedPos.x, savedPos.y);
    } else {
      const { width: screenW, height: screenH } = require("electron").screen.getPrimaryDisplay().workAreaSize;
      recordingWindow.setPosition(Math.round((screenW - 480) / 2), screenH - 200);
    }
    recordingWindow.showInactive();
    send("recording:start");
  } else {
    send("recording:stop");
  }
}

app.whenReady().then(async () => {
  // Hide dock icon on macOS
  if (process.platform === "darwin") {
    app.dock?.hide();
  }

  // Create recording window
  recordingWindow = createRecordingWindow();

  // Setup system tray
  setupTray(app, toggleRecording, () => {
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      recordingWindow.setContentSize(520, 600);
      recordingWindow.center();
      recordingWindow.show();
      send("show:settings");
    }
  });

  // Register global hotkey
  globalShortcut.unregisterAll();
  const hotkey = getConfig("hotkey");
  const success = globalShortcut.register(hotkey, toggleRecording);
  console.log(success ? `Hotkey registered: ${hotkey}` : `Hotkey FAILED: ${hotkey}`);

  // === IPC Handlers (register BEFORE server start so they're ready immediately) ===

  // Process recorded audio (full pipeline)
  ipcMain.handle("audio:process", async (_event, buffer: ArrayBuffer) => {
    const pipelineStart = Date.now();

    try {
      send("status:update", "transcribing");

      // 1. Save audio to temp file
      const tempDir = app.getPath("temp");
      const ts = Date.now();
      const webmPath = path.join(tempDir, `vf-${ts}.webm`);
      fs.writeFileSync(webmPath, Buffer.from(buffer));

      // 2. Convert WebM → WAV 16kHz mono (+ VAD silence removal)
      const wavPath = path.join(tempDir, `vf-${ts}.wav`);
      await convertToWav(webmPath, wavPath);

      // 3. Transcribe (server if available, CLI fallback)
      const modelPath = getActiveModelPath();
      const text = await transcribe({
        wavPath,
        modelPath,
        language: getConfig("language"),
      });

      // 4. Cleanup
      try { fs.unlinkSync(webmPath); fs.unlinkSync(wavPath); } catch {}

      const totalMs = Date.now() - pipelineStart;
      console.log(`[pipeline] "${text?.slice(0, 60)}" (${totalMs}ms)`);

      if (!text?.trim()) {
        send("status:update", "empty");
        setTimeout(() => {
          if (recordingWindow && !recordingWindow.isDestroyed()) recordingWindow.hide();
        }, 1200);
        return { success: true, text: "" };
      }

      // 5. Hide window + inject immediately
      if (recordingWindow && !recordingWindow.isDestroyed()) {
        recordingWindow.hide();
      }
      await new Promise((r) => setTimeout(r, 100));
      await injectText(text.trim());

      isRecording = false;
      return { success: true, text: text.trim() };
    } catch (err: any) {
      console.error("[pipeline] Error:", err.message);
      send("status:update", "error");
      setTimeout(() => {
        if (recordingWindow && !recordingWindow.isDestroyed()) recordingWindow.hide();
      }, 2000);
      isRecording = false;
      return { success: false, error: err.message };
    }
  });

  // Settings
  ipcMain.handle("settings:get", () => config.store);
  ipcMain.handle("settings:set", (_event, key: string, value: any) => {
    config.set(key as any, value);
    if (key === "hotkey") {
      globalShortcut.unregisterAll();
      globalShortcut.register(value, toggleRecording);
    }
    if (key === "launchAtStartup") {
      app.setLoginItemSettings({ openAtLogin: value as boolean, openAsHidden: true });
    }
  });

  // Window control
  ipcMain.handle("window:resize", (_event, width: number, height: number) => {
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      recordingWindow.setContentSize(width, height);
    }
  });

  ipcMain.handle("window:center", () => {
    if (recordingWindow && !recordingWindow.isDestroyed()) {
      recordingWindow.center();
    }
  });

  // App status
  ipcMain.handle("app:status", () => ({
    hasModel: isAnyModelDownloaded(),
    hasWhisper: fs.existsSync(getWhisperPath()),
    hasFfmpeg: fs.existsSync(getFfmpegPath()),
    platform: process.platform,
  }));

  // Model management
  ipcMain.handle("model:list", () => {
    const { MODELS, isModelDownloaded } = require("./model-manager");
    return Object.entries(MODELS).map(([id, info]: [string, any]) => ({
      id,
      ...info,
      downloaded: isModelDownloaded(id),
    }));
  });

  ipcMain.handle("model:download", async (event, name: string) => {
    const { downloadModel } = require("./model-manager");
    try {
      await downloadModel(name, (downloaded: number, total: number) => {
        send("model:progress", { name, downloaded, total });
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("model:switch", async (_event, name: string) => {
    config.set("model", name as any);
    // Restart whisper-server with new model
    const modelPath = getActiveModelPath();
    if (fs.existsSync(modelPath)) {
      console.log(`[model] Switching to ${name}, restarting server...`);
      stopWhisperServer();
      try {
        await startWhisperServer(modelPath);
        console.log(`[model] Server restarted with ${name}`);
        return { success: true };
      } catch (err: any) {
        console.warn(`[model] Server restart failed: ${err.message}`);
        return { success: true }; // CLI fallback still works
      }
    }
    return { success: false, error: "Model not found" };
  });

  // Start whisper-server in background AFTER all handlers are registered
  if (isAnyModelDownloaded()) {
    const modelPath = getActiveModelPath();
    if (fs.existsSync(modelPath)) {
      console.log("[startup] Starting whisper-server in background...");
      startWhisperServer(modelPath)
        .then(() => console.log("[startup] Whisper server ready!"))
        .catch((err: any) => console.warn("[startup] Server failed, using CLI:", err.message));
    }
  }

  // Auto-updater - check for updates silently
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null; // Silence logs

  autoUpdater.on("update-available", (info) => {
    console.log(`[update] New version available: ${info.version}`);
    new Notification({
      title: "VoiceForge - Mise à jour disponible",
      body: `Version ${info.version} en cours de téléchargement...`,
    }).show();
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log(`[update] Update downloaded: ${info.version}`);
    new Notification({
      title: "VoiceForge - Mise à jour prête",
      body: `Version ${info.version} sera installée au prochain redémarrage.`,
    }).show();
  });

  autoUpdater.on("error", (err) => {
    console.warn("[update] Auto-update error:", err.message);
  });

  // Check for updates 5 seconds after launch, then every 4 hours
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
});

// Keep app alive in tray
app.on("window-all-closed", (e: Event) => e.preventDefault());

app.on("before-quit", () => {
  isQuitting = true;
  stopWhisperServer();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
