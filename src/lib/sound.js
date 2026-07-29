let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone({ freq, duration, type = "sine", gain = 0.15, delay = 0, glideTo = null }) {
  const audio = getCtx();
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + delay);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, audio.currentTime + delay + duration);
  g.gain.setValueAtTime(0, audio.currentTime + delay);
  g.gain.linearRampToValueAtTime(gain, audio.currentTime + delay + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + duration);
  osc.connect(g).connect(audio.destination);
  osc.start(audio.currentTime + delay);
  osc.stop(audio.currentTime + delay + duration + 0.05);
}

export function playClick() {
  tone({ freq: 720, duration: 0.06, type: "sine", gain: 0.08 });
}

export function playTrue() {
  tone({ freq: 660, duration: 0.11, type: "sine", gain: 0.14 });
  tone({ freq: 990, duration: 0.16, type: "sine", gain: 0.12, delay: 0.09 });
}

export function playFalse() {
  tone({ freq: 180, duration: 0.22, type: "sawtooth", gain: 0.1, glideTo: 90 });
}

export function playMisleading() {
  tone({ freq: 420, duration: 0.09, type: "triangle", gain: 0.12 });
  tone({ freq: 340, duration: 0.14, type: "triangle", gain: 0.1, delay: 0.1 });
}

export function playStart() {
  tone({ freq: 440, duration: 0.08, type: "sine", gain: 0.1 });
  tone({ freq: 660, duration: 0.14, type: "sine", gain: 0.1, delay: 0.08 });
}

export function playEnd() {
  tone({ freq: 500, duration: 0.18, type: "sine", gain: 0.1, glideTo: 220 });
}

export function verdictSound(verdict) {
  if (verdict === "TRUE") playTrue();
  else if (verdict === "FALSE") playFalse();
  else playMisleading();
}
