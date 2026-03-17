import { useWaveform } from "../hooks/useWaveform";

type Status = "idle" | "recording" | "transcribing" | "injecting" | "done" | "empty" | "error";

interface Props {
  status: Status;
  stream: MediaStream | null;
  onOpenSettings?: () => void;
}

export default function RecordingWindow({ status, stream, onOpenSettings }: Props) {
  const canvasRef = useWaveform(stream);
  const isActive = status === "recording";
  const isProcessing = status === "transcribing" || status === "injecting";

  return (
    <div className="w-screen h-screen bg-[#18181b] flex flex-col">
      {/* Top accent bar */}
      <div
        className="h-[2px] shrink-0 transition-colors duration-500"
        style={{
          background: isActive
            ? "#ef4444"
            : isProcessing
              ? "#3b82f6"
              : status === "done"
                ? "#22c55e"
                : "#27272a",
        }}
      />

      {/* Header */}
      <div className="drag-region flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <StatusDot status={status} />
          <span
            className="text-[13px] font-semibold tracking-wide"
            style={{ color: getColor(status) }}
          >
            {getLabel(status)}
          </span>
        </div>
        {onOpenSettings && !isProcessing && (
          <button
            onClick={onOpenSettings}
            className="no-drag w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        )}
      </div>

      {/* Waveform / Status - takes remaining space */}
      <div className="flex-1 mx-4 mb-2 rounded-lg overflow-hidden" style={{ background: "#1f1f23" }}>
        {isActive ? (
          <canvas ref={canvasRef} className="block w-full h-full" />
        ) : isProcessing ? (
          <div className="w-full h-full flex items-center justify-center gap-3">
            <LoadingDots />
            <span className="text-xs text-zinc-500">Analyse en cours...</span>
          </div>
        ) : status === "done" ? (
          <div className="w-full h-full flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>
            <span className="text-sm font-medium text-emerald-500">Texte collé</span>
          </div>
        ) : status === "empty" ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs text-zinc-600">Aucune parole détectée</span>
          </div>
        ) : status === "error" ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs text-red-500/70">Erreur - réessayez</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xs text-zinc-600">Ctrl+Shift+H pour dicter</span>
          </div>
        )}
      </div>

      {/* Footer hint during recording */}
      {isActive && (
        <div className="text-center pb-2 shrink-0">
          <span className="text-[10px] text-zinc-600">Ctrl+Shift+H pour arrêter</span>
        </div>
      )}
    </div>
  );
}

function getColor(s: Status) {
  return { idle: "#52525b", recording: "#ef4444", transcribing: "#60a5fa", injecting: "#60a5fa", done: "#22c55e", empty: "#52525b", error: "#ef4444" }[s];
}

function getLabel(s: Status) {
  return { idle: "VoiceForge", recording: "Enregistrement", transcribing: "Transcription...", injecting: "Insertion...", done: "Terminé", empty: "Vide", error: "Erreur" }[s];
}

function StatusDot({ status }: { status: Status }) {
  const color = getColor(status);
  return (
    <div className="relative w-2 h-2">
      {status === "recording" && <div className="absolute inset-[-3px] rounded-full animate-ping opacity-30" style={{ background: color }} />}
      <div className="w-full h-full rounded-full" style={{ background: color }} />
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ animation: `dot 1.2s ease ${i * 0.15}s infinite` }} />
      ))}
      <style>{`@keyframes dot { 0%,80%,100% { opacity:.15; transform:scale(.7) } 40% { opacity:1; transform:scale(1.2) } }`}</style>
    </div>
  );
}
