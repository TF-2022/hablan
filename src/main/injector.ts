import { clipboard } from "electron";

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
  try {
    const { keyboard, Key } = await import("@nut-tree-fork/nut-js");

    if (process.platform === "darwin") {
      await keyboard.pressKey(Key.LeftSuper, Key.V);
      await keyboard.releaseKey(Key.LeftSuper, Key.V);
    } else {
      await keyboard.pressKey(Key.LeftControl, Key.V);
      await keyboard.releaseKey(Key.LeftControl, Key.V);
    }
  } catch {
    // nut-js not available - text stays in clipboard
  }
}
