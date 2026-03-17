import { useState, useEffect, useCallback } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import RecordingWindow from "./components/RecordingWindow";
import SettingsPanel from "./components/SettingsPanel";
import { api } from "./lib/ipc";

type Status = "idle" | "recording" | "transcribing" | "injecting" | "done" | "empty" | "error";
type View = "recording" | "settings";

const RECORDING_SIZE = { w: 480, h: 180 };
const SETTINGS_SIZE = { w: 520, h: 600 };

export default function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [view, setView] = useState<View>("recording");
  const { stream, startRecording, stopRecording } = useAudioRecorder();

  const openSettings = useCallback(() => {
    setView("settings");
    api?.resizeWindow(SETTINGS_SIZE.w, SETTINGS_SIZE.h);
    api?.centerWindow();
  }, []);

  const closeSettings = useCallback(() => {
    setView("recording");
    api?.resizeWindow(RECORDING_SIZE.w, RECORDING_SIZE.h);
  }, []);

  const handleStartRecording = useCallback(() => {
    if (view === "settings") closeSettings();
    setStatus("recording");
    startRecording();
  }, [startRecording, view, closeSettings]);

  const handleStopRecording = useCallback(() => {
    setStatus("transcribing");
    stopRecording();
  }, [stopRecording]);

  useEffect(() => {
    if (!api) return;

    const cleanups = [
      api.onStartRecording(handleStartRecording),
      api.onStopRecording(handleStopRecording),
      api.onStatusUpdate((s: string) => setStatus(s as Status)),
      api.onShowSettings(openSettings),
      api.onShowOnboarding(() => {}),
    ];

    return () => cleanups.forEach((fn) => fn());
  }, [handleStartRecording, handleStopRecording, openSettings]);

  useEffect(() => {
    if (status === "done") {
      const timer = setTimeout(() => setStatus("idle"), 1000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (view === "settings") {
    return <SettingsPanel onClose={closeSettings} />;
  }

  return (
    <RecordingWindow
      status={status}
      stream={stream}
      onOpenSettings={openSettings}
    />
  );
}
