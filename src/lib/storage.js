const SETTINGS_KEY = "fc_settings";
const HISTORY_KEY = "fc_history";

const DEFAULT_SETTINGS = {
  soundEffects: true,
  voiceNarration: false,
  sensitivity: 2, // 1 = trigger on short fragments, 3 = wait for longer chunks
  theme: "paper"
};

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveSession(session) {
  const list = loadHistory();
  const idx = list.findIndex(s => s.id === session.id);
  if (idx >= 0) list[idx] = session;
  else list.unshift(session);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 200)));
  return list;
}

export function deleteSession(id) {
  const list = loadHistory().filter(s => s.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  return list;
}

export function newSessionId() {
  return "sess-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
