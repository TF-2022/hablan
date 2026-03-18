/**
 * Generate all app icons for CursorVoice
 * - build/icon.png (512x512 — used by electron-builder for all platforms)
 * - build/icon.ico (Windows)
 * - resources/icons/tray-icon.png (16x16 tray)
 */

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BUILD_DIR = path.join(ROOT, "build");
const ICONS_DIR = path.join(ROOT, "resources", "icons");

fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.mkdirSync(ICONS_DIR, { recursive: true });

// App icon SVG — minimal mic in a rounded square
// Gradient blue-violet, white mic silhouette
const APP_ICON_SVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.15"/>
      <stop offset="50%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background rounded square -->
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>

  <!-- Subtle inner shine -->
  <rect width="512" height="256" rx="108" fill="url(#shine)"/>

  <!-- Microphone body -->
  <rect x="216" y="120" width="80" height="160" rx="40" fill="white"/>

  <!-- Capture arc -->
  <path d="M 176 240 Q 176 340 256 340 Q 336 340 336 240"
        stroke="white" stroke-width="24" stroke-linecap="round" fill="none"/>

  <!-- Stem -->
  <line x1="256" y1="340" x2="256" y2="390" stroke="white" stroke-width="20" stroke-linecap="round"/>

  <!-- Base -->
  <line x1="206" y1="390" x2="306" y2="390" stroke="white" stroke-width="20" stroke-linecap="round"/>
</svg>`;

// Tray icon SVG — just the mic, white on transparent, 32x32
const TRAY_ICON_SVG = `
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <!-- Mic body -->
  <rect x="12" y="4" width="8" height="14" rx="4" fill="white"/>

  <!-- Arc -->
  <path d="M 8 14 Q 8 24 16 24 Q 24 24 24 14"
        stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>

  <!-- Stem -->
  <line x1="16" y1="24" x2="16" y2="28" stroke="white" stroke-width="2" stroke-linecap="round"/>

  <!-- Base -->
  <line x1="12" y1="28" x2="20" y2="28" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;

async function generate() {
  console.log("Generating app icons...");

  // 1. App icon 512x512 PNG
  await sharp(Buffer.from(APP_ICON_SVG))
    .resize(512, 512)
    .png()
    .toFile(path.join(BUILD_DIR, "icon.png"));
  console.log("  ✓ build/icon.png (512x512)");

  // 2. App icon 256x256 (fallback for older electron-builder)
  await sharp(Buffer.from(APP_ICON_SVG))
    .resize(256, 256)
    .png()
    .toFile(path.join(BUILD_DIR, "icon-256.png"));
  console.log("  ✓ build/icon-256.png (256x256)");

  // 3. ICO for Windows (256x256 PNG wrapped)
  // electron-builder auto-generates ICO from PNG, but we provide one for safety
  const pngBuf256 = await sharp(Buffer.from(APP_ICON_SVG))
    .resize(256, 256)
    .png()
    .toBuffer();

  // Simple ICO: just embed the 256x256 PNG
  const ico = createIco(pngBuf256);
  fs.writeFileSync(path.join(BUILD_DIR, "icon.ico"), ico);
  console.log("  ✓ build/icon.ico (256x256)");

  // 4. Tray icon 16x16 and 32x32
  await sharp(Buffer.from(TRAY_ICON_SVG))
    .resize(16, 16)
    .png()
    .toFile(path.join(ICONS_DIR, "tray-icon.png"));
  console.log("  ✓ resources/icons/tray-icon.png (16x16)");

  await sharp(Buffer.from(TRAY_ICON_SVG))
    .resize(32, 32)
    .png()
    .toFile(path.join(ICONS_DIR, "tray-icon@2x.png"));
  console.log("  ✓ resources/icons/tray-icon@2x.png (32x32)");

  // 5. macOS template icons
  await sharp(Buffer.from(TRAY_ICON_SVG))
    .resize(18, 18)
    .png()
    .toFile(path.join(ICONS_DIR, "tray-iconTemplate.png"));
  console.log("  ✓ resources/icons/tray-iconTemplate.png (18x18)");

  await sharp(Buffer.from(TRAY_ICON_SVG))
    .resize(36, 36)
    .png()
    .toFile(path.join(ICONS_DIR, "tray-iconTemplate@2x.png"));
  console.log("  ✓ resources/icons/tray-iconTemplate@2x.png (36x36)");

  // 6. Clean up old broken icon
  const oldIcon = path.join(ICONS_DIR, "icon.png");
  if (fs.existsSync(oldIcon)) {
    const stat = fs.statSync(oldIcon);
    if (stat.size < 100) fs.unlinkSync(oldIcon); // Remove if it's the broken text file
  }

  console.log("\nDone! All icons generated.");
}

function createIco(pngBuffer) {
  // ICO format: header + directory entry + PNG data
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type: ICO
  header.writeUInt16LE(1, 4);     // 1 image

  const entry = Buffer.alloc(16);
  entry[0] = 0;                   // width 256 (0 = 256)
  entry[1] = 0;                   // height 256
  entry[2] = 0;                   // color palette
  entry[3] = 0;                   // reserved
  entry.writeUInt16LE(1, 4);      // color planes
  entry.writeUInt16LE(32, 6);     // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);  // size of PNG data
  entry.writeUInt32LE(22, 12);    // offset to PNG data (6 + 16 = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

generate().catch(console.error);
