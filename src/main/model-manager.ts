import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { app } from "electron";
import { getConfig } from "./config";

export const MODELS = {
  tiny: {
    label: "Rapide",
    desc: "Transcription basique, très rapide",
    size: "75 Mo",
    speedLabel: "Ultra rapide",
    recommended: false,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
  },
  base: {
    label: "Standard",
    desc: "Bon compromis vitesse/qualité",
    size: "142 Mo",
    speedLabel: "Rapide",
    recommended: false,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
  },
  small: {
    label: "Précis",
    desc: "Meilleur compromis vitesse/qualité",
    size: "466 Mo",
    speedLabel: "Rapide",
    recommended: true,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
  },
  medium: {
    label: "Avancé",
    desc: "Excellente qualité",
    size: "1.5 Go",
    speedLabel: "Lent",
    recommended: false,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
  },
  "large-v3-turbo": {
    label: "Turbo",
    desc: "Meilleure précision, nécessite GPU",
    size: "1.6 Go",
    speedLabel: "Lent (CPU) / Rapide (GPU)",
    recommended: false,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
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

  // Check configured model in both locations
  const userPath = path.join(getModelsDir(), `ggml-${name}.bin`);
  if (fs.existsSync(userPath)) return userPath;
  const localPath = path.join(getLocalModelsDir(), `ggml-${name}.bin`);
  if (fs.existsSync(localPath)) return localPath;

  // Configured model not found — fallback to any available model
  for (const fallback of Object.keys(MODELS) as ModelName[]) {
    const fbUser = path.join(getModelsDir(), `ggml-${fallback}.bin`);
    if (fs.existsSync(fbUser)) {
      return fbUser;
    }
    const fbLocal = path.join(getLocalModelsDir(), `ggml-${fallback}.bin`);
    if (fs.existsSync(fbLocal)) {
      return fbLocal;
    }
  }

  return userPath;
}

export function downloadModel(
  name: ModelName,
  onProgress: (downloaded: number, total: number) => void
): Promise<string> {
  const model = MODELS[name];
  const destPath = path.join(getModelsDir(), `ggml-${name}.bin`);

  fs.mkdirSync(getModelsDir(), { recursive: true });

  return new Promise((resolve, reject) => {
    function doRequest(url: string, redirects = 0) {
      if (redirects > 5) {
        reject(new Error("Too many redirects"));
        return;
      }
      https
        .get(url, (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            doRequest(response.headers.location, redirects + 1);
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
