import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { app } from "electron";
import { getConfig } from "./config";

export const MODELS = {
  tiny: {
    size: "75 MB",
    speed: "Ultra fast (~0.3s for 10s audio)",
    accuracy: "Good",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
  },
  base: {
    size: "142 MB",
    speed: "Fast (~0.6s for 10s audio)",
    accuracy: "Better",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
  },
  small: {
    size: "466 MB",
    speed: "Moderate (~1.7s for 10s audio)",
    accuracy: "Best for MVP",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
  },
  medium: {
    size: "1.5 GB",
    speed: "Slow (~5s for 10s audio)",
    accuracy: "Excellent",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
  },
} as const;

export type ModelName = keyof typeof MODELS;

export function getModelsDir(): string {
  return path.join(app.getPath("userData"), "models");
}

export function getLocalModelsDir(): string {
  // Also check project-local models/ dir (for dev)
  return path.join(app.getAppPath(), "models");
}

export function isModelDownloaded(name: ModelName): boolean {
  const userPath = path.join(getModelsDir(), `ggml-${name}.bin`);
  const localPath = path.join(getLocalModelsDir(), `ggml-${name}.bin`);
  return fs.existsSync(userPath) || fs.existsSync(localPath);
}

export function isAnyModelDownloaded(): boolean {
  return (Object.keys(MODELS) as ModelName[]).some(isModelDownloaded);
}

export function getActiveModelPath(): string {
  const name = getConfig("model");
  // Prefer userData, fallback to local project dir
  const userPath = path.join(getModelsDir(), `ggml-${name}.bin`);
  if (fs.existsSync(userPath)) return userPath;
  const localPath = path.join(getLocalModelsDir(), `ggml-${name}.bin`);
  if (fs.existsSync(localPath)) return localPath;
  return userPath; // Will fail gracefully if not found
}

export function downloadModel(
  name: ModelName,
  onProgress: (downloaded: number, total: number) => void
): Promise<string> {
  const model = MODELS[name];
  const destPath = path.join(getModelsDir(), `ggml-${name}.bin`);

  fs.mkdirSync(getModelsDir(), { recursive: true });

  return new Promise((resolve, reject) => {
    function doRequest(url: string) {
      https
        .get(url, (response) => {
          // Handle redirects (HuggingFace uses them)
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            doRequest(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            return;
          }

          const total = parseInt(response.headers["content-length"] || "0", 10);
          let downloaded = 0;

          const file = fs.createWriteStream(destPath);

          response.on("data", (chunk: Buffer) => {
            downloaded += chunk.length;
            onProgress(downloaded, total);
          });

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            resolve(destPath);
          });

          file.on("error", (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        })
        .on("error", (err) => {
          reject(err);
        });
    }

    doRequest(model.url);
  });
}
