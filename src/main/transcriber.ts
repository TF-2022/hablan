import { spawn, ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import { getWhisperServerPath, getWhisperPath } from "./bin-resolver";

let serverProcess: ChildProcess | null = null;
let serverReady = false;
let serverFailCount = 0;
let currentModelPath = "";
const SERVER_PORT = 58432;
const MAX_SERVER_FAILURES = 3;
const THREADS = Math.max(1, Math.min(8, (os.cpus().length || 4) - 1));

// Keep-alive agent — reuse TCP connections
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 1 });

interface TranscribeOptions {
  wavPath: string;
  modelPath: string;
  language?: string;
  timeout?: number;
}

export async function startWhisperServer(modelPath: string): Promise<void> {
  // If same model already running, skip
  if (serverProcess && serverReady && currentModelPath === modelPath) return;

  // If different model, restart
  stopWhisperServer();

  const serverPath = getWhisperServerPath();
  if (!fs.existsSync(serverPath)) return;

  currentModelPath = modelPath;
  serverFailCount = 0;

  return new Promise((resolve) => {
    serverProcess = spawn(serverPath, [
      "--model", modelPath,
      "--host", "127.0.0.1",
      "--port", String(SERVER_PORT),
      "--threads", String(THREADS),
      "--beam-size", "1",
      "--best-of", "1",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let started = false;

    const onOutput = (data: Buffer) => {
      if (!started && data.toString().match(/listening|running|model loaded/i)) {
        started = true;
        serverReady = true;
        resolve();
      }
    };

    serverProcess.stdout?.on("data", onOutput);
    serverProcess.stderr?.on("data", onOutput);
    serverProcess.on("error", () => { serverReady = false; resolve(); });
    serverProcess.on("exit", () => { serverReady = false; serverProcess = null; });

    // 15s timeout — if it can't start by then, it won't
    setTimeout(() => {
      if (!started) {
        serverReady = false;
        serverProcess?.kill();
        serverProcess = null;
        resolve();
      }
    }, 15000);
  });
}

export function stopWhisperServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    serverReady = false;
    currentModelPath = "";
  }
}

// Restart server with a new model (called when user switches model)
export async function restartWithModel(modelPath: string): Promise<void> {
  stopWhisperServer();
  if (fs.existsSync(modelPath) && fs.existsSync(getWhisperServerPath())) {
    await startWhisperServer(modelPath);
  }
}

function transcribeViaServer(options: TranscribeOptions): Promise<string> {
  const { wavPath, language = "fr", timeout = 10000 } = options;

  return new Promise((resolve, reject) => {
    const boundary = "----CursorVoice" + Date.now();
    const fileContent = fs.readFileSync(wavPath);

    const parts: Buffer[] = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
      fileContent,
      Buffer.from("\r\n"),
    ];

    if (language !== "auto") {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`));
    }

    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\ntext\r\n`));
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const req = http.request({
      hostname: "127.0.0.1",
      port: SERVER_PORT,
      path: "/inference",
      method: "POST",
      agent: httpAgent,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
      timeout,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data).text?.trim() || ""); }
          catch { resolve(data.trim()); }
        } else {
          reject(new Error(`Server HTTP ${res.statusCode}`));
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

function transcribeViaCLI(options: TranscribeOptions): Promise<string> {
  const { wavPath, modelPath, language = "fr", timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const args = [
      "--model", modelPath,
      "--file", wavPath,
      "--threads", String(THREADS),
      "--beam-size", "1",
      "--best-of", "1",
      "--no-timestamps",
      "--no-prints",
    ];

    if (language !== "auto") args.push("--language", language);

    const proc = spawn(getWhisperPath(), args);
    let output = "";
    let error = "";

    proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { error += d.toString(); });

    const timer = setTimeout(() => { proc.kill(); reject(new Error("CLI timeout")); }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      proc.removeAllListeners("error");
      if (code === 0) {
        resolve(output.replace(/\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/g, "").trim());
      } else {
        reject(new Error(`CLI exit ${code}: ${error.slice(-200)}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`CLI: ${err.message}`));
    });
  });
}

export async function transcribe(options: TranscribeOptions): Promise<string> {
  // Use server if ready and hasn't failed too many times
  if (serverReady && serverProcess && serverFailCount < MAX_SERVER_FAILURES) {
    try {
      const result = await transcribeViaServer(options);
      serverFailCount = 0; // Reset on success
      return result;
    } catch {
      serverFailCount++;
    }
  }

  return await transcribeViaCLI(options);
}
