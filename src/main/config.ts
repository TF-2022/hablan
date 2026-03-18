import Store from "electron-store";

export type WhisperModel = "tiny" | "base" | "small" | "medium" | "large-v3-turbo";

export interface AppConfig {
  hotkey: string;
  model: WhisperModel;
  language: string;
  inputDevice: string;
  launchAtStartup: boolean;
  pasteMethod: "clipboard" | "keystroke";
  windowPosition: { x: number; y: number } | null;
  onboardingDone: boolean;
}

const DEFAULTS: AppConfig = {
  hotkey: "CommandOrControl+Shift+H",
  model: "small",
  language: "fr",
  inputDevice: "default",
  launchAtStartup: false,
  pasteMethod: "clipboard",
  windowPosition: null,
  onboardingDone: false,
};

export const config = new Store<AppConfig>({ defaults: DEFAULTS });

export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return config.get(key);
}
