// Typed wrapper for window.electronAPI exposed by preload

interface ElectronAPI {
  sendAudio: (buffer: ArrayBuffer) => Promise<{ success: boolean; text?: string; error?: string }>;
  getSettings: () => Promise<Record<string, any>>;
  setSetting: (key: string, value: any) => Promise<void>;
  getAppStatus: () => Promise<{
    hasModel: boolean;
    hasWhisper: boolean;
    hasFfmpeg: boolean;
    platform: string;
  }>;
  onStartRecording: (cb: () => void) => () => void;
  onStopRecording: (cb: () => void) => () => void;
  onStatusUpdate: (cb: (status: string) => void) => () => void;
  onShowSettings: (cb: () => void) => () => void;
  onShowOnboarding: (cb: () => void) => () => void;
  onModelProgress: (cb: (data: { name: string; downloaded: number; total: number }) => void) => () => void;
  listModels: () => Promise<any[]>;
  downloadModel: (name: string) => Promise<{ success: boolean; error?: string }>;
  switchModel: (name: string) => Promise<{ success: boolean; error?: string }>;
  resizeWindow: (width: number, height: number) => Promise<void>;
  centerWindow: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export const api = typeof window !== "undefined" ? window.electronAPI : null;
