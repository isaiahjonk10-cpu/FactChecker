import { useState, useRef, useCallback, useEffect } from "react";
import { useLiveSpeech } from "../lib/speech.js";
import { analyzeChunk, generateTitle, generatePlayerSummaries, startDebate, LimitError, AuthRequiredError } from "../lib/claude.js";
import { loadSettings, saveSession, newSessionId } from "../lib/storage.js";
import { playClick, playStart, playEnd, verdictSound } from "../lib/sound.js";
import { PLANS, fetchUsage, fmtMinutes } from "../lib/plans.js";
import { scorePlayers, PLAYER_COLORS } from "../lib/versus.js";
import ClaimCard from "../components/ClaimCard.jsx";

function fmtElapsed(seconds) {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function VersusMode() {
  const settings = loadSettings();
  const [usageInfo, setUsageInfo] = useState(undefined); // undefined = loading, null = signed out
  const plan = PLANS[usageInfo?.plan] || PLANS.free;

  const [numPlayers, setNumPlayers] = useState(2);
  const [players, setPlayers] = useState([
    { id: "p1", name: "Player 1", color: PLAYER_COLORS[0] },
    { id: "p2", name: "Player 2", color: PLAYER_COLORS[1] }
  ]);
  const [activeId, setActiveId] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [claims, setClaims] = useState([]);
  const [finalScore, setFinalScore] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [limitBlocked, setLimitBlocked] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const bufferRef = useRef("");
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const claimsRef = useRef([]);
  const sessionIdRef = useRef(null);
  const startedAtRef = useRef(null);
  const secondsElapsedRef = useRef(0);
  const tickIntervalRef = useRef(null);

  const refreshUsage = useCallback(() => { fetchUsage().then(setUsageInfo).catch(() => setUsageInfo(null)); }, []);
  useEffect(() => { refreshUsage(); }, [refreshUsage]);
  useEffect(() => { claimsRef.current = claims; }, [claims]);
  useEffect(() => () => clearInterval(tickIntervalRef.current), []);

  function updatePlayerCount(n) {
    n = Math.max(1, Math.min(plan.maxPlayers, n));
    setNumPlayers(n);
    setPlayers(prev => {
      const next = [...prev];
      while (next.length < n) next.push({ id: "p" + (next.length + 1), name: "Player " + (next.length + 1), color: PLAYER_COLORS[next.length % PLAYER_COLORS.length] });
      return next.slice(0, n);
    });
  }

  function renamePlayer(id, name) {
    setPlayers(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  }

  const processBuffer = useCallback(async (speakerId) => {
    const chunk = bufferRef.current.trim();
    bufferRef.current = "";
    if (!chunk || !speakerId) return;
    try {
      const found = await analyzeChunk(chunk, "", "debate");
      const stamped = found.map(f => ({ ...f, ts: Date.now(), speakerId }));
      if (stamped.length) {
        setClaims(prev => [...prev, ...stamped]);
        stamped.forEach(f => { if (settings.soundEffects) verdictSound(f.verdict); });
      }
    } catch (err) {
      setLimitBlocked(err.message || "Something went wrong checking that — try again.");
      if (err instanceof LimitError || err instanceof AuthRequiredError) handlePause();
      console.error(err);
    } finally {
      refreshUsage();
    }
  }, [settings.soundEffects, refreshUsage]);

  const { listening, interimText, start, stop, reset } = useLiveSpeech({
    onFinalChunk: text => {
      if (!activeIdRef.current) return;
      bufferRef.current += (bufferRef.current ? " " : "") + text;
      const words = bufferRef.current.trim().split(/\s+/).filter(Boolean).length;
      if (words >= 10) processBuffer(activeIdRef.current);
    }
  });

  function switchSpeaker(id) {
    if (id === activeId) return;
    if (activeIdRef.current) processBuffer(activeIdRef.current);
    if (settings.soundEffects) playClick();
    setActiveId(id);
  }

  async function handleStart() {
    setLimitBlocked(null);
    try {
      await startDebate();
    } catch (err) {
      setLimitBlocked(err.message || "Couldn't start — try again in a moment.");
      refreshUsage();
      return;
    }
    if (settings.soundEffects) playStart();
    setClaims([]);
    setFinalScore(null);
    setSummaries({});
    setActiveId(null);
    bufferRef.current = "";
    reset();
    sessionIdRef.current = newSessionId();
    startedAtRef.current = Date.now();
    secondsElapsedRef.current = 0;
    setElapsed(0);
    setPhase("listening");
    start();
    tickIntervalRef.current = setInterval(() => {
      secondsElapsedRef.current += 1;
      setElapsed(secondsElapsedRef.current);
    }, 1000);
  }

  function handlePause() {
    if (settings.soundEffects) playClick();
    if (activeIdRef.current) processBuffer(activeIdRef.current);
    stop();
    clearInterval(tickIntervalRef.current);
    setPhase("paused");
  }

  function handleResume() {
    if (settings.soundEffects) playClick();
    setPhase("listening");
    start();
    tickIntervalRef.current = setInterval(() => {
      secondsElapsedRef.current += 1;
      setElapsed(secondsElapsedRef.current);
    }, 1000);
  }

  async function handleEnd() {
    if (settings.soundEffects) playEnd();
    stop();
    clearInterval(tickIntervalRef.current);
    if (activeIdRef.current) await processBuffer(activeIdRef.current);
    setPhase("ended");

    const current = claimsRef.current;
    const byId = {};
    players.forEach(p => { byId[p.id] = current.filter(c => c.speakerId === p.id); });
    const result = scorePlayers(players, byId);
    setFinalScore(result);

    const summaryMap = await generatePlayerSummaries(players.map(p => ({ name: p.name, claims: byId[p.id] })));
    setSummaries(summaryMap);

    const title = await generateTitle(current);
    saveSession({
      id: sessionIdRef.current, title: "Versus: " + title,
      startedAt: startedAtRef.current, endedAt: Date.now(),
      transcript: players.map(p => `${p.name}: ${summaryMap[p.name] || "(no claims detected)"}`).join("\n"),
      claims: current.map(c => ({ ...c, claim: `[${players.find(p => p.id === c.speakerId)?.name || "?"}] ${c.claim}` }))
    });
    refreshUsage();

    setTimeout(() => setPhase("idle"), 300);
  }

  const isActive = phase === "listening";
  const remainingDebate = usageInfo?.remaining?.debateSeconds ?? PLANS.free.debateSeconds;
  const circleSize = 300;
  const radius = 118;

  return (
    <div className="page versus-page">
      <h1 className="page-title">Versus Mode</h1>
      <p className="page-sub">Pass the floor between players — the AI tracks who's actually right.</p>
      <div className="usage-note">{fmtMinutes(remainingDebate)} of debate time left this month on {plan.label} · up to {plan.maxPlayers} players</div>

      <div className="versus-instruction">
        🎙 <strong>Tap a player's button before they start talking.</strong> Whatever's said while a button is
        lit up gets credited to that player — if nobody taps, nothing gets attributed.
      </div>

      {phase === "idle" && (
        <div className="versus-setup">
          <div className="versus-setup-header">
            <h2 className="versus-setup-title">Add Players</h2>
            <p className="versus-setup-sub">We'll track each player's accuracy, strongest arguments, and mistakes live — then call a winner.</p>
          </div>

          <div className="player-count-row">
            {Array.from({ length: plan.maxPlayers }, (_, i) => i + 1).map(n => (
              <button key={n} className={"count-opt" + (numPlayers === n ? " selected" : "")} onClick={() => updatePlayerCount(n)}>{n}</button>
            ))}
          </div>

          <div className="roster-grid">
            {players.map((p, i) => (
              <div key={p.id} className="roster-card" style={{ "--pcolor": p.color }}>
                <div className="roster-avatar">{p.name.trim().charAt(0).toUpperCase() || (i + 1)}</div>
                <input
                  value={p.name} onChange={e => renamePlayer(p.id, e.target.value)}
                  className="roster-name-input" placeholder={`Player ${i + 1}`}
                />
              </div>
            ))}
          </div>

          {limitBlocked && <p className="hero-warning">{limitBlocked} <a href="/#/upgrade">Upgrade</a> for more.</p>}

          <div className="versus-setup-footer">
            {usageInfo === null ? (
              <div className="setup-needed">
                <p>Sign in to start a Versus debate.</p>
                <a href="/#/login" className="ctrl-btn ctrl-primary">Sign In →</a>
              </div>
            ) : (
              <>
                <p className="versus-setup-hint">🎙 Remember — tap a name before speaking, or it won't count.</p>
                <button className="start-btn" onClick={handleStart}><span className="start-btn-dot" /> Start Versus Debate</button>
              </>
            )}
          </div>
        </div>
      )}

      {(phase === "listening" || phase === "paused") && (
        <div className="versus-live">
          <div className="versus-circle" style={{ width: circleSize, height: circleSize }}>
            <div className="versus-timer">
              <div className="versus-timer-value">{fmtElapsed(elapsed)}</div>
              <div className="versus-timer-label">{isActive ? "LIVE" : "PAUSED"}</div>
            </div>
            {players.map((p, i) => {
              const angle = (2 * Math.PI * i) / players.length - Math.PI / 2;
              const x = circleSize / 2 + radius * Math.cos(angle);
              const y = circleSize / 2 + radius * Math.sin(angle);
              return (
                <button
                  key={p.id}
                  className={"speaker-orb" + (activeId === p.id ? " active" : "")}
                  style={{ "--pcolor": p.color, left: x, top: y }}
                  onClick={() => switchSpeaker(p.id)}
                >
                  {activeId === p.id && <span className="orb-mic">🎙</span>}
                  {p.name}
                </button>
              );
            })}
          </div>

          {!activeId && <p className="hero-warning">No one has the floor — tap a player above before speaking.</p>}
          {interimText && <p className="versus-interim">{interimText}</p>}
          {limitBlocked && <p className="hero-warning">{limitBlocked} <a href="/#/upgrade">Upgrade</a> for more.</p>}

          <div className="control-row">
            {isActive
              ? <button className="ctrl-btn" onClick={handlePause}>Pause</button>
              : <button className="ctrl-btn ctrl-primary" onClick={handleResume}>Resume</button>}
            <button className="ctrl-btn ctrl-end" onClick={handleEnd}>End Debate</button>
          </div>
        </div>
      )}

      {finalScore && (
        <div className="score-panel">
          <div className="score-title">Debate Score</div>
          {finalScore.scores.map(s => (
            <div key={s.id} className={"score-row" + (s.id === finalScore.winnerId ? " winner" : "")} style={{ "--pcolor": s.color }}>
              <div className="score-name">{s.name}{s.id === finalScore.winnerId && <span className="winner-tag">WINNER</span>}</div>
              <div className="score-stats">
                <span>Facts: {s.factsPct}%</span>
                <span>Strong arguments: {s.strongArguments}</span>
                <span>Mistakes: {s.mistakes}</span>
              </div>
              {summaries[s.name] && <p className="score-summary">{summaries[s.name]}</p>}
            </div>
          ))}
        </div>
      )}

      <section className="claim-feed">
        {[...claims].reverse().map((c, i) => {
          const speaker = players.find(p => p.id === c.speakerId);
          return (
            <ClaimCard
              key={c.ts + "-" + i} index={claims.length - i}
              claim={c.claim} verdict={c.verdict} explanation={c.explanation} truth={c.truth} sources={c.sources}
              isNew={i === 0} speaker={speaker?.name} speakerColor={speaker?.color}
            />
          );
        })}
      </section>
    </div>
  );
}
