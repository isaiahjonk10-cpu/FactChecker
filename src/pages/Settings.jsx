import { useState, useEffect } from "react";
import { loadSettings, saveSettings } from "../lib/storage.js";
import { THEMES, fetchUsage, themeAllowed } from "../lib/plans.js";

const SENSITIVITY_LABELS = { 1: "React fast — check short fragments", 2: "Balanced (default)", 3: "Wait for fuller statements" };

export default function Settings() {
  const [settings, setSettings] = useState(loadSettings());
  const [savedFlash, setSavedFlash] = useState(false);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    fetchUsage().then(d => setPlan(d.plan)).catch(() => setPlan("free"));
  }, []);

  function update(patch) {
    const next = saveSettings(patch);
    setSettings(next);
    if (patch.theme) document.documentElement.setAttribute("data-theme", next.theme);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 900);
  }

  function selectTheme(id) {
    if (plan && !themeAllowed(id, plan)) return;
    update({ theme: id });
  }

  return (
    <div className="page settings-page">
      <h1 className="page-title">Settings</h1>

      <div className="settings-block">
        <p className="settings-hint hosted-note">
          This is a hosted app — checking runs on our shared service, no API key needed from you. Your plan and
          usage limits are tracked securely on our end, not something that can be edited from your browser.
        </p>
      </div>

      <div className="settings-block settings-row">
        <div>
          <label className="settings-label">Sound effects</label>
          <p className="settings-hint">Clicks, verdict dings and buzzes.</p>
        </div>
        <Toggle checked={settings.soundEffects} onChange={v => update({ soundEffects: v })} />
      </div>

      <div className="settings-block settings-row">
        <div>
          <label className="settings-label">Voice narration</label>
          <p className="settings-hint">Speak each verdict and explanation out loud.</p>
        </div>
        <Toggle checked={settings.voiceNarration} onChange={v => update({ voiceNarration: v })} />
      </div>

      <div className="settings-block">
        <label className="settings-label">Mic sensitivity</label>
        <input
          type="range" min="1" max="3" step="1"
          value={settings.sensitivity}
          onChange={e => update({ sensitivity: Number(e.target.value) })}
          className="settings-slider"
        />
        <p className="settings-hint">{SENSITIVITY_LABELS[settings.sensitivity]}</p>
      </div>

      <div className="settings-block">
        <label className="settings-label">Theme</label>
        <div className="theme-options">
          {THEMES.map(t => {
            const allowed = !plan || themeAllowed(t.id, plan);
            return (
              <button
                key={t.id}
                className={"theme-opt" + (settings.theme === t.id ? " selected" : "") + (!allowed ? " locked" : "")}
                onClick={() => selectTheme(t.id)}
                title={!allowed ? "Pro and up — upgrade to unlock" : ""}
              >
                {t.label}{!allowed && <span className="theme-lock">🔒</span>}
              </button>
            );
          })}
        </div>
        {plan === "free" && (
          <p className="settings-hint">
            Midnight, Newsroom, Frost, and Sepia are Pro+ themes. <a href="/#/upgrade">Upgrade</a> to unlock them.
          </p>
        )}
      </div>

      {savedFlash && <div className="settings-saved">Saved</div>}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button className={"toggle" + (checked ? " on" : "")} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span className="toggle-knob" />
    </button>
  );
}
