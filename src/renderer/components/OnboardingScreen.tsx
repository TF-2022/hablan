import { useState, useEffect } from "react";
import { api } from "../lib/ipc";

interface Props {
  onComplete: () => void;
}

type Step = "welcome" | "model" | "downloading" | "test" | "ready";

const MODELS = [
  {
    id: "tiny",
    label: "Rapide",
    desc: "Transcription basique, très rapide",
    size: "75 Mo",
    speed: "~0.3s",
    recommended: false,
  },
  {
    id: "base",
    label: "Équilibré",
    desc: "Bon compromis vitesse/qualité",
    size: "142 Mo",
    speed: "~0.6s",
    recommended: false,
  },
  {
    id: "small",
    label: "Précis",
    desc: "Très bonne qualité, recommandé",
    size: "466 Mo",
    speed: "~2s",
    recommended: true,
  },
];

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [selectedModel, setSelectedModel] = useState("small");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState("");

  return (
    <div className="w-screen h-screen flex items-center justify-center">
      <div
        className="w-[420px] rounded-[24px] overflow-hidden"
        style={{
          background: "linear-gradient(165deg, rgba(16,16,20,0.98), rgba(24,24,30,0.98))",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.06) inset",
        }}
      >
        {step === "welcome" && (
          <WelcomeStep onNext={() => setStep("model")} />
        )}
        {step === "model" && (
          <ModelStep
            selected={selectedModel}
            onSelect={setSelectedModel}
            onNext={() => setStep("downloading")}
          />
        )}
        {step === "downloading" && (
          <DownloadStep
            model={selectedModel}
            progress={downloadProgress}
            speed={downloadSpeed}
            onComplete={() => setStep("ready")}
          />
        )}
        {step === "ready" && (
          <ReadyStep onComplete={onComplete} />
        )}
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="px-8 py-10 text-center">
      {/* Logo */}
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>

      <h1 className="text-[22px] font-bold text-white mb-2">
        Bienvenue sur VoiceForge
      </h1>
      <p className="text-[14px] leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.45)" }}>
        Dictez du texte et injectez-le directement là où se trouve votre curseur. Partout, dans n'importe quelle application.
      </p>

      <div className="space-y-3 text-left mb-8">
        <Feature icon="⌨️" title="Raccourci global" desc="Ctrl+Shift+H depuis n'importe quelle app" />
        <Feature icon="🎤" title="Transcription locale" desc="100% hors-ligne, rien n'est envoyé" />
        <Feature icon="📋" title="Coller automatique" desc="Le texte apparaît à votre curseur" />
      </div>

      <PrimaryButton onClick={onNext}>Commencer la configuration</PrimaryButton>
    </div>
  );
}

function ModelStep({
  selected,
  onSelect,
  onNext,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="px-8 py-8">
      <h2 className="text-[18px] font-bold text-white mb-1">Choisir le modèle</h2>
      <p className="text-[13px] mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>
        Le modèle sera téléchargé une seule fois et utilisé localement.
      </p>

      <div className="space-y-2 mb-8">
        {MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="w-full text-left px-4 py-3.5 rounded-2xl transition-all relative"
            style={{
              background: selected === m.id
                ? "rgba(96,165,250,0.08)"
                : "rgba(255,255,255,0.02)",
              border: selected === m.id
                ? "1px solid rgba(96,165,250,0.2)"
                : "1px solid rgba(255,255,255,0.04)",
            }}
          >
            {m.recommended && (
              <span
                className="absolute top-3 right-3 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
                style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
              >
                Recommandé
              </span>
            )}
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="text-[14px] font-semibold"
                style={{ color: selected === m.id ? "#60a5fa" : "rgba(255,255,255,0.8)" }}
              >
                {m.label}
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                {m.size} · {m.speed}
              </span>
            </div>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {m.desc}
            </p>
          </button>
        ))}
      </div>

      <PrimaryButton onClick={onNext}>Télécharger et installer</PrimaryButton>
    </div>
  );
}

function DownloadStep({
  model,
  progress,
  speed,
  onComplete,
}: {
  model: string;
  progress: number;
  speed: string;
  onComplete: () => void;
}) {
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState("Préparation...");

  useEffect(() => {
    // Simulate progress since we don't have real download IPC yet
    // In production, this would use api.downloadModel() with progress events
    let interval: NodeJS.Timeout;
    const fakeDownload = () => {
      setPct(0);
      setStatus("Téléchargement du modèle...");
      interval = setInterval(() => {
        setPct((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus("Installation terminée");
            setTimeout(onComplete, 800);
            return 100;
          }
          return prev + Math.random() * 3 + 1;
        });
      }, 150);
    };
    fakeDownload();
    return () => clearInterval(interval);
  }, [model, onComplete]);

  const displayPct = Math.min(100, Math.round(pct));

  return (
    <div className="px-8 py-10 text-center">
      {/* Animated circle */}
      <div className="w-24 h-24 mx-auto mb-6 relative">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="4"
          />
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${displayPct * 2.64} ${264 - displayPct * 2.64}`}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[20px] font-bold tabular-nums text-white">
            {displayPct}%
          </span>
        </div>
      </div>

      <h2 className="text-[16px] font-semibold text-white mb-1">{status}</h2>
      <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.25)" }}>
        Modèle {model} · Cette opération est unique
      </p>
    </div>
  );
}

function ReadyStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="px-8 py-10 text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
        style={{ background: "rgba(34,197,94,0.1)" }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-[20px] font-bold text-white mb-2">Tout est prêt !</h2>
      <p className="text-[14px] leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
        VoiceForge est installé et fonctionne dans votre barre système.
        Utilisez <span className="font-mono text-white/60">Ctrl+Shift+H</span> pour dicter.
      </p>

      <PrimaryButton onClick={onComplete}>C'est parti</PrimaryButton>
    </div>
  );
}

// --- Shared components ---

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
      <span className="text-[18px] mt-0.5">{icon}</span>
      <div>
        <div className="text-[13px] font-medium text-white">{title}</div>
        <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>{desc}</div>
      </div>
    </div>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[0.98]"
      style={{
        background: "linear-gradient(135deg, #3b82f6, #6366f1)",
        boxShadow: "0 4px 16px rgba(59,130,246,0.25)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 6px 24px rgba(59,130,246,0.35)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.25)")}
    >
      {children}
    </button>
  );
}
