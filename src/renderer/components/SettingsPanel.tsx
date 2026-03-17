import { useState, useEffect } from "react";
import { api } from "../lib/ipc";

interface Settings {
  hotkey: string;
  model: string;
  language: string;
  launchAtStartup: boolean;
}

const MODELS = [
  { id: "tiny", label: "Tiny", size: "75 Mo", speed: "Ultra rapide" },
  { id: "base", label: "Base", size: "142 Mo", speed: "Rapide" },
  { id: "small", label: "Small", size: "466 Mo", speed: "Modéré" },
  { id: "medium", label: "Medium", size: "1.5 Go", speed: "Lent" },
];

const LANGUAGES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "de", label: "Deutsch" },
  { id: "auto", label: "Auto-détection" },
];

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    api?.getSettings().then((s) => setSettings(s as Settings));
  }, []);

  const update = (key: string, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    api?.setSetting(key, value);
  };

  if (!settings) return null;

  return (
    <div className="w-screen h-screen bg-[#18181b] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <h1 className="text-[16px] font-semibold text-white">Paramètres</h1>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 pb-6 space-y-6 overflow-y-auto">

        {/* Raccourci */}
        <Section title="Raccourci clavier">
          <HotkeyInput value={settings.hotkey} onChange={(v) => update("hotkey", v)} />
        </Section>

        {/* Langue */}
        <Section title="Langue de transcription">
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => update("language", lang.id)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all"
                style={{
                  background: settings.language === lang.id ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.03)",
                  color: settings.language === lang.id ? "#60a5fa" : "rgba(255,255,255,0.5)",
                  border: settings.language === lang.id ? "1px solid rgba(96,165,250,0.25)" : "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Modèle */}
        <Section title="Modèle Whisper">
          <div className="space-y-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => update("model", m.id)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all text-left"
                style={{
                  background: settings.model === m.id ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.02)",
                  border: settings.model === m.id ? "1px solid rgba(96,165,250,0.2)" : "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="text-[14px] font-semibold shrink-0"
                    style={{ color: settings.model === m.id ? "#60a5fa" : "rgba(255,255,255,0.75)" }}
                  >
                    {m.label}
                  </span>
                  <span className="text-[12px] shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {m.size}
                  </span>
                </div>
                <span className="text-[12px] shrink-0 ml-4" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {m.speed}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* Système */}
        <Section title="Système">
          <div className="space-y-2">
            <div
              className="flex items-center justify-between px-4 py-3.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                Lancer au démarrage
              </span>
              <Toggle
                checked={settings.launchAtStartup}
                onChange={(v) => update("launchAtStartup", v)}
              />
            </div>
            <button
              onClick={() => update("windowPosition", null)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all text-left hover:bg-white/[0.04]"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
            >
              <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                Réinitialiser la position
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                Centre bas
              </span>
            </button>
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 text-center shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.15)" }}>
          VoiceForge v0.1.0 - Glissez le widget pour le repositionner
        </span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="text-[11px] font-semibold uppercase tracking-wider mb-3"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-11 h-[24px] rounded-full transition-all duration-200"
      style={{ background: checked ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.1)" }}
    >
      <div
        className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all duration-200"
        style={{
          left: checked ? "calc(100% - 21px)" : "3px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

function HotkeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [listening, setListening] = useState(false);
  const display = value.replace("CommandOrControl", "Ctrl").replace("Shift", "Maj");

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      const key = e.key.toUpperCase();
      if (!["CONTROL", "SHIFT", "ALT", "META"].includes(key) && parts.length > 0) {
        parts.push(key);
        onChange(parts.join("+"));
        setListening(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [listening, onChange]);

  return (
    <button
      onClick={() => setListening(true)}
      className="w-full px-4 py-3 rounded-xl text-[13px] font-mono text-left transition-all"
      style={{
        background: listening ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.03)",
        color: listening ? "#60a5fa" : "rgba(255,255,255,0.6)",
        border: listening ? "1px solid rgba(96,165,250,0.25)" : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {listening ? "Appuyez sur votre raccourci..." : display}
    </button>
  );
}
