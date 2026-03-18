import { Tray, Menu, nativeImage, App } from "electron";
import path from "node:path";

let tray: Tray | null = null;

function createTrayIcon(): Electron.NativeImage {
  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  const basePath = isDev
    ? path.join(__dirname, "../../resources/icons")
    : path.join(process.resourcesPath, "icons");

  // Try real PNG icons first, fallback to programmatic
  const candidates = [
    path.join(basePath, "tray-icon.png"),
    path.join(__dirname, "../../resources/icons/tray-icon.png"),
  ];

  for (const p of candidates) {
    try {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    } catch {}
  }

  // Fallback: programmatic 16x16 mic icon
  return createFallbackIcon();
}

function createFallbackIcon(): Electron.NativeImage {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);

  function px(x: number, y: number, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = a;
  }
  function col(x: number, y1: number, y2: number, a = 255) { for (let y = y1; y <= y2; y++) px(x, y, a); }
  function row(y: number, x1: number, x2: number, a = 255) { for (let x = x1; x <= x2; x++) px(x, y, a); }

  col(6, 3, 8); col(7, 2, 9); col(8, 2, 9); col(9, 3, 8);
  px(4, 6, 180); col(4, 7, 9, 200); px(4, 10, 160);
  px(11, 6, 180); col(11, 7, 9, 200); px(11, 10, 160);
  px(5, 10, 200); px(10, 10, 200);
  row(11, 6, 9, 180);
  col(7, 12, 13, 160); col(8, 12, 13, 160);
  row(14, 5, 10, 140);

  const zlib = require("node:zlib");
  function crc32(d: Buffer) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) { c ^= d[i]; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0); } return (c ^ 0xFFFFFFFF) >>> 0; }
  function chunk(t: string, d: Buffer) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const tb = Buffer.from(t); const cm = Buffer.concat([tb, d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(cm)); return Buffer.concat([l, cm, cr]); }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) { rows.push(Buffer.from([0])); rows.push(buf.subarray(y * size * 4, (y + 1) * size * 4)); }
  const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);

  return nativeImage.createFromBuffer(png, { width: size, height: size });
}

export function setupTray(app: App, onToggleRecording: () => void, onOpenSettings: () => void) {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("CursorVoice");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Dicter", click: onToggleRecording, accelerator: "CommandOrControl+Shift+H" },
    { type: "separator" },
    { label: "Paramètres", click: onOpenSettings },
    { type: "separator" },
    { label: "Quitter", click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", onToggleRecording);

  return tray;
}
