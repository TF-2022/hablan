import { Tray, Menu, nativeImage, App } from "electron";
import path from "node:path";

let tray: Tray | null = null;

export function setupTray(
  app: App,
  onToggleRecording: () => void,
  onOpenSettings: () => void
) {
  // Simple 16x16 tray icon - will be replaced with real icon later
  const iconPath = path.join(__dirname, "../../resources/icons/tray-icon.png");
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("VoiceForge - Voice Dictation");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Record",
      click: onToggleRecording,
      accelerator: "CommandOrControl+Shift+Space",
    },
    { type: "separator" },
    { label: "Settings", click: onOpenSettings },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);

  // Click on tray icon = toggle recording
  tray.on("click", onToggleRecording);

  return tray;
}
