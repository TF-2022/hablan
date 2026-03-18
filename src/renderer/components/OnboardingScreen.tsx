import { useState, useEffect } from "react";
import { Mic, Keyboard, Clipboard, Check, AlertCircle } from "lucide-react";
import { api, ModelProgress } from "../lib/ipc";

interface Props {
  onComplete: () => void;
  onMount?: () => void;
}

type Step = "welcome" | "model" | "downloading" | "ready";

interface ModelInfo {
  id: string;
  label: string;
  desc: string;
  size: string;
  speedLabel: string;
  recommended: boolean;
  downloaded: boolean;
}

export default function OnboardingScreen({ onComplete, onMount }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => { onMount?.(); }, []);

  useEffect(() => {
    api?.listModels().then((m) => {
      const list = m as ModelInfo[];
      setModels(list);
      const rec = list.find((x) => x.recommended);
      setSelectedModel(rec?.id || list[0]?.id || "");
    });
  }, []);

  return (
    <div className="screen">
      {step === "welcome" && <WelcomeStep onNext={() => setStep("model")} />}
      {step === "model" && models.length > 0 && (
        <ModelStep models={models} selected={selectedModel} onSelect={setSelectedModel} onNext={() => setStep("downloading")} />
      )}
      {step === "downloading" && <DownloadStep model={selectedModel} onComplete={() => setStep("ready")} onBack={() => setStep("model")} />}
      {step === "ready" && <ReadyStep onComplete={onComplete} />}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 32px 24px", textAlign: "center" }}>
        <div className="onboard-logo">
          <Mic size={26} style={{ color: "var(--blue)" }} />
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Bienvenue sur CursorVoice</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 28, maxWidth: 280 }}>
          Dictez du texte, il apparaît directement à votre curseur. Dans n'importe quelle app.
        </p>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
          <div className="feature-row">
            <div className="feature-icon"><Keyboard size={16} /></div>
            <div><div className="feature-title">Raccourci global</div><div className="feature-desc">Ctrl+Shift+H depuis n'importe quelle app</div></div>
          </div>
          <div className="feature-row">
            <div className="feature-icon"><Mic size={16} /></div>
            <div><div className="feature-title">Transcription locale</div><div className="feature-desc">100% hors-ligne, rien n'est envoyé</div></div>
          </div>
          <div className="feature-row">
            <div className="feature-icon"><Clipboard size={16} /></div>
            <div><div className="feature-title">Collage automatique</div><div className="feature-desc">Le texte apparaît à votre curseur</div></div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        <button className="btn-primary" onClick={onNext}>Commencer la configuration</button>
      </div>
    </>
  );
}

function ModelStep({ models, selected, onSelect, onNext }: { models: ModelInfo[]; selected: string; onSelect: (id: string) => void; onNext: () => void }) {
  return (
    <>
      <div style={{ flex: 1, padding: "32px 32px 24px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Choisir le modèle</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>Téléchargé une seule fois, utilisé localement.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {models.map((m) => {
            const active = selected === m.id;
            return (
              <button key={m.id} className={`select-btn ${active ? "active" : ""}`} onClick={() => onSelect(m.id)}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: active ? "var(--blue)" : "var(--fg)" }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.size}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.desc}</div>
                </div>
                {m.recommended && <span className="badge" style={{ marginLeft: 12 }}>Recommandé</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        <button className="btn-primary" onClick={onNext}>Télécharger et installer</button>
      </div>
    </>
  );
}

function DownloadStep({ model, onComplete, onBack }: { model: string; onComplete: () => void; onBack: () => void }) {
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState("Préparation...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function startDownload() {
      cleanup = api?.onModelProgress((data: ModelProgress) => {
        if (data.total > 0) {
          setPct(Math.round((data.downloaded / data.total) * 100));
          setStatus("Téléchargement du modèle...");
        }
      });

      const result = await api?.downloadModel(model);

      if (result?.success) {
        setPct(100);
        setStatus("Installation terminée");
        await api?.switchModel(model);
        setTimeout(onComplete, 600);
      } else {
        setError(result?.error || "Échec du téléchargement");
      }
    }

    startDownload();
    return () => cleanup?.();
  }, [model, onComplete]);

  const d = Math.min(100, pct);

  if (error) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "hsla(0, 84%, 60%, 0.1)", border: "1px solid hsla(0, 84%, 60%, 0.15)", marginBottom: 20 }}>
          <AlertCircle size={26} style={{ color: "var(--red)" }} />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Erreur de téléchargement</h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>{error}</p>
        <button className="btn-primary" onClick={onBack}>Réessayer</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
      <div className="progress-ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${d * 2.64} ${264 - d * 2.64}`} style={{ transition: "stroke-dasharray 0.3s" }} />
        </svg>
        <div className="progress-ring-value">{d}%</div>
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{status}</h2>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>Cette opération est unique</p>
    </div>
  );
}

function ReadyStep({ onComplete }: { onComplete: () => void }) {
  return (
    <>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 32px 24px", textAlign: "center" }}>
        <div className="onboard-check">
          <Check size={26} style={{ color: "var(--green)" }} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Tout est prêt !</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, maxWidth: 280 }}>
          CursorVoice fonctionne dans votre barre système.
          Utilisez <kbd>Ctrl+Shift+H</kbd> pour dicter.
        </p>
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        <button className="btn-primary" onClick={onComplete}>C'est parti</button>
      </div>
    </>
  );
}
