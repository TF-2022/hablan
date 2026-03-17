import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Audio
  sendAudio: (buffer: ArrayBuffer) => ipcRenderer.invoke("audio:process", buffer),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSetting: (key: string, value: any) =>
    ipcRenderer.invoke("settings:set", key, value),

  // App status
  getAppStatus: () => ipcRenderer.invoke("app:status"),

  // Models
  listModels: () => ipcRenderer.invoke("model:list"),
  downloadModel: (name: string) => ipcRenderer.invoke("model:download", name),
  switchModel: (name: string) => ipcRenderer.invoke("model:switch", name),

  // Listeners
  onStartRecording: (cb: () => void) => {
    ipcRenderer.on("recording:start", () => cb());
    return () => ipcRenderer.removeAllListeners("recording:start");
  },
  onStopRecording: (cb: () => void) => {
    ipcRenderer.on("recording:stop", () => cb());
    return () => ipcRenderer.removeAllListeners("recording:stop");
  },
  onStatusUpdate: (cb: (status: string) => void) => {
    ipcRenderer.on("status:update", (_event, status) => cb(status));
    return () => ipcRenderer.removeAllListeners("status:update");
  },
  onShowSettings: (cb: () => void) => {
    ipcRenderer.on("show:settings", () => cb());
    return () => ipcRenderer.removeAllListeners("show:settings");
  },
  onShowOnboarding: (cb: () => void) => {
    ipcRenderer.on("show:onboarding", () => cb());
    return () => ipcRenderer.removeAllListeners("show:onboarding");
  },
  onModelProgress: (cb: (data: { name: string; downloaded: number; total: number }) => void) => {
    ipcRenderer.on("model:progress", (_event, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("model:progress");
  },

  // Window control
  resizeWindow: (width: number, height: number) =>
    ipcRenderer.invoke("window:resize", width, height),
  centerWindow: () => ipcRenderer.invoke("window:center"),
});
