import Store from "electron-store";

interface AppConfig {
  hotkey: string;
  model: "tiny" | "base" | "small" | "medium" | "large-v3-turbo";
  language: string;
  inputDevice: string;
  launchAtStartup: boolean;
  pasteMethod: "clipboard" | "keystroke";
  windowPosition: { x: number; y: number } | null; // null = auto center bottom
}

export const config = new Store<AppConfig>({
  defaults: {
    hotkey: "CommandOrControl+Shift+H",
    model: "small",
    language: "fr",
    inputDevice: "default",
    launchAtStartup: false,
    pasteMethod: "clipboard",
    windowPosition: null,
  },
});

export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return config.get(key);
}
