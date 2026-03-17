import { spawn, ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import { getWhisperServerPath, getWhisperPath } from "./bin-resolver";

let serverProcess: ChildProcess | null = null;
let serverReady = false;
const SERVER_PORT = 58432; // Random high port to avoid conflicts

interface TranscribeOptions {
  wavPath: string;
  modelPath: string;
  language?: string;
  timeout?: number;
}

/**
 * Start whisper-server as a background daemon.
 * Model stays loaded in RAM - subsequent transcriptions are instant.
 */
export function startWhisperServer(modelPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (serverProcess && serverReady) {
      resolve();
      return;
    }

    // Kill any existing server
    stopWhisperServer();

    const threads = Math.max(1, Math.min(8, (os.cpus().length || 4) - 1));

    console.log(`[whisper-server] Starting with ${threads} threads, model: ${modelPath}`);

    serverProcess = spawn(getWhisperServerPath(), [
      "--model", modelPath,
      "--host", "127.0.0.1",
      "--port", String(SERVER_PORT),
      "--threads", String(threads),
      "--beam-size", "1",
      "--best-of", "1",
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let started = false;

    serverProcess.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (!started && (msg.includes("listening") || msg.includes("running"))) {
        started = true;
        serverReady = true;
        console.log(`[whisper-server] Ready on port ${SERVER_PORT}`);
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      // whisper-server logs to stderr
      if (!started && (msg.includes("listening") || msg.includes("running") || msg.includes("model loaded"))) {
        started = true;
        serverReady = true;
        console.log(`[whisper-server] Ready on port ${SERVER_PORT}`);
        resolve();
      }
    });

    serverProcess.on("error", (err) => {
      console.error("[whisper-server] Failed to start:", err.message);
      serverReady = false;
      reject(err);
    });

    serverProcess.on("exit", (code) => {
      console.log(`[whisper-server] Exited with code ${code}`);
      serverReady = false;
      serverProcess = null;
    });

    // Timeout: if server doesn't start in 30s, resolve anyway and try
    setTimeout(() => {
      if (!started) {
        console.log("[whisper-server] Startup timeout - trying anyway");
        serverReady = true;
        resolve();
      }
    }, 30000);
  });
}

export function stopWhisperServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    serverReady = false;
  }
}

export function isServerRunning(): boolean {
  return serverReady && serverProcess !== null;
}

/**
 * Transcribe via whisper-server HTTP API (model already in RAM = fast).
 */
function transcribeViaServer(options: TranscribeOptions): Promise<string> {
  const { wavPath, language = "fr", timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(wavPath);
    const boundary = "----VoiceForgeBoundary" + Date.now();

    // Build multipart form data manually (no external dep needed)
    const fileContent = fs.readFileSync(wavPath);
    const fileName = "audio.wav";

    const bodyParts: Buffer[] = [];

    // File field
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: audio/wav\r\n\r\n`
    ));
    bodyParts.push(fileContent);
    bodyParts.push(Buffer.from("\r\n"));

    // Language field
    if (language !== "auto") {
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`
      ));
    }

    // Response format
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\ntext\r\n`
    ));

    bodyParts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(bodyParts);

    const req = http.request({
      hostname: "127.0.0.1",
      port: SERVER_PORT,
      path: "/inference",
      method: "POST",
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
          // Parse response - might be JSON or plain text
          try {
            const json = JSON.parse(data);
            resolve(json.text?.trim() || "");
          } catch {
            resolve(data.trim());
          }
        } else {
          reject(new Error(`Server returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`Server request failed: ${err.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Server request timed out"));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Transcribe via CLI (fallback if server is not running).
 */
function transcribeViaCLI(options: TranscribeOptions): Promise<string> {
  const { wavPath, modelPath, language = "fr", timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const threads = Math.max(1, Math.min(8, (os.cpus().length || 4) - 1));

    const args = [
      "--model", modelPath,
      "--file", wavPath,
      "--threads", String(threads),
      "--beam-size", "1",
      "--best-of", "1",
      "--no-timestamps",
      "--no-prints",
    ];

    if (language !== "auto") {
      args.push("--language", language);
    }

    const proc = spawn(getWhisperPath(), args);
    let output = "";
    let error = "";

    proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
    proc.stderr.on("data", (data: Buffer) => { error += data.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("Transcription timed out"));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        const text = output.replace(/\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/g, "").trim();
        resolve(text);
      } else {
        reject(new Error(`whisper-cli exited with code ${code}: ${error.slice(-200)}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`whisper-cli error: ${err.message}`));
    });
  });
}

/**
 * Main transcribe function - uses server if available, falls back to CLI.
 */
export async function transcribe(options: TranscribeOptions): Promise<string> {
  if (isServerRunning()) {
    try {
      console.log("[transcribe] Using whisper-server (model in RAM)");
      const start = Date.now();
      const text = await transcribeViaServer(options);
      console.log(`[transcribe] Server response in ${Date.now() - start}ms`);
      return text;
    } catch (err: any) {
      console.warn("[transcribe] Server failed, falling back to CLI:", err.message);
    }
  }

  console.log("[transcribe] Using whisper-cli (standalone)");
  const start = Date.now();
  const text = await transcribeViaCLI(options);
  console.log(`[transcribe] CLI response in ${Date.now() - start}ms`);
  return text;
}
