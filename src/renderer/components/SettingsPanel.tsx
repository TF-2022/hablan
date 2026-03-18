import { useState, useEffect } from "react";
import { X, RotateCcw, Download, Check, Loader2 } from "lucide-react";
import { api, ModelProgress } from "../lib/ipc";

interface Settings {
  hotkey: string;
  model: string;
  language: string;
  launchAtStartup: boolean;
}

interface ModelInfo {
  id: string;
  label: string;
  desc: string;
  size: string;
  speedLabel: string;
  recommended: boolean;
  downloaded: boolean;
}

const LANGUAGES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "de", label: "Deutsch" },
  { id: "auto", label: "Auto" },
];

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState(0);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    api?.getSettings().then((s) => setSettings(s as Settings));
    api?.listModels().then((m) => setModels(m as ModelInfo[]));
    api?.getAppStatus().then((s) => setAppVersion((s as any).version || ""));
  }, []);

  useEffect(() => {
    const cleanup = api?.onModelProgress((data: ModelProgress) => {
      if (data.total > 0) setDownloadPct(Math.round((data.downloaded / data.total) * 100));
    });
    return () => cleanup?.();
  }, []);

  const update = (key: string, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    api?.setSetting(key, value);
  };

  const handleModelSelect = async (id: string) => {
    const model = models.find((m) => m.id === id);
    if (!model) return;

    if (model.downloaded) {
      await api?.switchModel(id);
      setSettings((s) => s ? { ...s, model: id } : s);
    } else {
      setDownloading(id);
      setDownloadPct(0);
      const result = await api?.downloadModel(id);
      if (result?.success) {
        await api?.switchModel(id);
        setSettings((s) => s ? { ...s, model: id } : s);
        setModels((prev) => prev.map((m) => m.id === id ? { ...m, downloaded: true } : m));
      }
      setDownloading(null);
    }
  };

  if (!settings) return null;

  return (
    <div className="screen">
      <div className="header">
        <span className="header-title">Paramètres</span>
        <button className="icon-btn" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="overflow-y-auto" style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <div className="section-title">Raccourci clavier</div>
          <HotkeyInput value={settings.hotkey} onChange={(v) => update("hotkey", v)} />
        </div>

        <div>
          <div className="section-title">Langue de transcription</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                className={`chip ${settings.language === lang.id ? "active" : ""}`}
                onClick={() => update("language", lang.id)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title">Modèle Whisper</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {models.map((m) => {
              const active = settings.model === m.id;
              const isDownloading = downloading === m.id;

              return (
                <button
                  key={m.id}
                  className={`select-btn ${active ? "active" : ""}`}
                  onClick={() => !isDownloading && handleModelSelect(m.id)}
                  style={{ opacity: isDownloading ? 0.7 : 1, cursor: isDownloading ? "wait" : "pointer" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--blue)" : "var(--fg)" }}>
                        {m.label}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.size}</span>
                      {m.downloaded && active && <Check size={12} style={{ color: "var(--green)" }} />}
                    </div>
                    {isDownloading && (
                      <div style={{ height: 3, borderRadius: 2, background: "var(--border)", marginTop: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${downloadPct}%`, background: "var(--blue)", borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.speedLabel}</span>
                    {!m.downloaded && !isDownloading && <Download size={12} style={{ color: "var(--muted)" }} />}
                    {isDownloading && <Loader2 size={12} style={{ color: "var(--blue)", animation: "spin 1s linear infinite" }} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="section-title">Système</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="card-row">
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Lancer au démarrage</span>
              <button className={`toggle ${settings.launchAtStartup ? "on" : ""}`} onClick={() => update("launchAtStartup", !settings.launchAtStartup)}>
                <div className="toggle-knob" />
              </button>
            </div>
            <button className="select-btn" onClick={() => update("windowPosition", null)}>
              <span style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
                <RotateCcw size={14} /> Réinitialiser la position
              </span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 16px", textAlign: "center", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "var(--muted)", opacity: 0.5 }}>CursorVoice {appVersion ? `v${appVersion}` : ""}</span>
      </div>
    </div>
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
      className={`select-btn ${listening ? "active" : ""}`}
      onClick={() => setListening(true)}
      style={{ fontFamily: "monospace", ...(listening ? { boxShadow: "0 0 0 2px hsla(217, 91%, 60%, 0.15)" } : {}) }}
    >
      <span style={{ color: listening ? "var(--blue)" : "var(--muted)" }}>
        {listening ? "Appuyez sur votre raccourci..." : display}
      </span>
    </button>
  );
}
