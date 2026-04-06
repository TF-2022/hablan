import { clipboard } from "electron";
import { execSync } from "node:child_process";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Inject text at the current cursor position.
 * Strategy: save clipboard → write text → simulate Ctrl+V → restore clipboard.
 */
export async function injectText(text: string): Promise<void> {
  const previousClipboard = clipboard.readText();

  clipboard.writeText(text);
  await sleep(80);

  try {
    await simulatePaste();
  } catch {
    // Text is in clipboard - user can Ctrl+V manually
    return;
  }

  await sleep(400);
  clipboard.writeText(previousClipboard);
}

async function simulatePaste(): Promise<void> {
  // Try nut-js first (works on all platforms when permissions are granted)
  try {
    const { keyboard, Key } = await import("@nut-tree-fork/nut-js");

    if (process.platform === "darwin") {
      await keyboard.pressKey(Key.LeftSuper, Key.V);
      await keyboard.releaseKey(Key.LeftSuper, Key.V);
    } else {
      await keyboard.pressKey(Key.LeftControl, Key.V);
      await keyboard.releaseKey(Key.LeftControl, Key.V);
    }
    return;
  } catch {
    // nut-js failed — try platform fallback
  }

  // macOS fallback: AppleScript via System Events (uses AppleEvents permission, not Accessibility)
  if (process.platform === "darwin") {
    try {
      execSync('osascript -e \'tell application "System Events" to keystroke "v" using command down\'', { timeout: 3000 });
      return;
    } catch {
      console.warn("[injector] Both nut-js and osascript paste failed on macOS");
    }
  }
}
