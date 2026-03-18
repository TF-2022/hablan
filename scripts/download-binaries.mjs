/**
 * Download whisper.cpp and ffmpeg binaries for the current platform.
 * Run with: node scripts/download-binaries.mjs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const PLATFORM = process.platform === "darwin" ? "mac" : "win";
const BIN_DIR = path.join("resources", "bin", PLATFORM);

fs.mkdirSync(BIN_DIR, { recursive: true });

async function download(url, dest) {
  console.log(`  Downloading ${path.basename(dest)}...`);
  return new Promise((resolve, reject) => {
    function doGet(url) {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doGet(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
        file.on("error", reject);
      }).on("error", reject);
    }
    doGet(url);
  });
}

console.log(`\n🔧 Downloading binaries for ${PLATFORM}...\n`);

if (PLATFORM === "win") {
  // whisper.cpp — download pre-built Windows binary
  const whisperUrl = "https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-x64.zip";
  const whisperZip = path.join(BIN_DIR, "whisper.zip");

  if (!fs.existsSync(path.join(BIN_DIR, "main.exe"))) {
    console.log("📥 whisper.cpp (Windows x64)");
    await download(whisperUrl, whisperZip);
    console.log("  Extracting...");
    // Use PowerShell to extract (available on all Windows)
    execSync(`powershell -Command "Expand-Archive -Force '${whisperZip}' '${BIN_DIR}'"`, { stdio: "inherit" });
    fs.unlinkSync(whisperZip);
    // Copy essential binaries from Release/ to bin root
    const releaseDir = path.join(BIN_DIR, "Release");
    if (fs.existsSync(releaseDir)) {
      const essentials = ["whisper-cli.exe", "whisper-server.exe", "whisper.dll", "ggml.dll", "ggml-base.dll", "ggml-cpu.dll"];
      for (const file of essentials) {
        const src = path.join(releaseDir, file);
        const dest = path.join(BIN_DIR, file);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          console.log(`  ✅ ${file} copied`);
        }
      }
    }
    console.log("  ✅ whisper.cpp ready\n");
  } else {
    console.log("✅ whisper.cpp already present\n");
  }

  // ffmpeg — download static build
  const ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
  const ffmpegZip = path.join(BIN_DIR, "ffmpeg.zip");

  if (!fs.existsSync(path.join(BIN_DIR, "ffmpeg.exe"))) {
    console.log("📥 ffmpeg (Windows x64)");
    await download(ffmpegUrl, ffmpegZip);
    console.log("  Extracting...");
    execSync(`powershell -Command "Expand-Archive -Force '${ffmpegZip}' '${BIN_DIR}'"`, { stdio: "inherit" });
    // Move ffmpeg.exe from nested dir to BIN_DIR
    const nested = fs.readdirSync(BIN_DIR).find(f => f.startsWith("ffmpeg-") && fs.statSync(path.join(BIN_DIR, f)).isDirectory());
    if (nested) {
      const ffmpegExe = path.join(BIN_DIR, nested, "bin", "ffmpeg.exe");
      if (fs.existsSync(ffmpegExe)) {
        fs.copyFileSync(ffmpegExe, path.join(BIN_DIR, "ffmpeg.exe"));
      }
      fs.rmSync(path.join(BIN_DIR, nested), { recursive: true, force: true });
    }
    fs.unlinkSync(ffmpegZip);
    console.log("  ✅ ffmpeg ready\n");
  } else {
    console.log("✅ ffmpeg already present\n");
  }
} else {
  // macOS
  console.log("📋 macOS: Install via Homebrew");
  console.log("  brew install whisper-cpp ffmpeg");
  console.log("  Then copy binaries:");
  console.log(`  cp $(which whisper-cpp) ${BIN_DIR}/main`);
  console.log(`  cp $(which ffmpeg) ${BIN_DIR}/ffmpeg`);
  console.log("");

  // Try automated brew approach
  try {
    const whisperPath = execSync("which whisper-cpp 2>/dev/null || echo ''").toString().trim();
    const ffmpegPath = execSync("which ffmpeg 2>/dev/null || echo ''").toString().trim();

    if (whisperPath) {
      fs.copyFileSync(whisperPath, path.join(BIN_DIR, "main"));
      fs.chmodSync(path.join(BIN_DIR, "main"), 0o755);
      console.log("  ✅ whisper-cpp copied from Homebrew");
    }
    if (ffmpegPath) {
      fs.copyFileSync(ffmpegPath, path.join(BIN_DIR, "ffmpeg"));
      fs.chmodSync(path.join(BIN_DIR, "ffmpeg"), 0o755);
      console.log("  ✅ ffmpeg copied from Homebrew");
    }
  } catch {
    console.log("  ⚠️  Homebrew not found. Install manually.");
  }
}

console.log("🎉 Setup complete!\n");
