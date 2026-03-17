import path from "node:path";
import fs from "node:fs";
import { app } from "electron";

function getBaseBinPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin");
  }
  // Dev: prefer userData/bin (safe path without unicode/emoji)
  const userDataBin = path.join(app.getPath("userData"), "bin");
  if (fs.existsSync(userDataBin)) {
    return userDataBin;
  }
  const platform = process.platform === "darwin" ? "mac" : "win";
  return path.join(app.getAppPath(), "resources", "bin", platform);
}

export function getWhisperPath(): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(getBaseBinPath(), `whisper-cli${ext}`);
}

export function getWhisperServerPath(): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(getBaseBinPath(), `whisper-server${ext}`);
}

export function getFfmpegPath(): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(getBaseBinPath(), `ffmpeg${ext}`);
}
