import { useState, useRef, useCallback, useEffect } from "react";
import { useLiveSpeech, speak } from "../lib/speech.js";
import { analyzeChunk, generateTitle, startDebate, LimitError, AuthRequiredError } from "../lib/claude.js";
import { loadSettings, saveSession, newSessionId } from "../lib/storage.js";
import { playClick, playStart, playEnd, verdictSound } from "../lib/sound.js";
import { PLANS, fetchUsage, fmtMinutes } from "../lib/plans.js";
import Waveform from "../components/Waveform.jsx";
import ClaimCard from "../components/ClaimCard.jsx";

const SENSITIVITY_WORD_TARGET = { 1: 6, 2: 12, 3: 22 };

export default function FactChecker() {
  const [phase, setPhase] = useState("idle");
  const [claims, setClaims] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [blockReason, setBlockReason] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [usageInfo, setUsageInfo] = useState(undefined); // undefined = loading, null = signed out

  const bufferRef = useRef("");
  const contextRef = useRef("");
  const startedAtRef = useRef(null);

  const settings = loadSettings();

  const refreshUsage = useCallback(() => { fetchUsage().then(setUsageInfo).catch(() => setUsageInfo(null)); }, []);
  useEffect(() => { refreshUsage(); }, [refreshUsage]);

  const processBuffer = useCallback(async (force = false) => {
    const wordTarget = SENSITIVITY_WORD_TARGET[settings.sensitivity] || 12;
    const wordCount = bufferRef.current.trim().split(/\s+/).filter(Boolean).length;
    if (!force && wordCount < wordTarget) return [];
    if (!bufferRef.current.trim()) return [];

    const chunk = bufferRef.current.trim();
    bufferRef.current = "";
    setPendingCount(c => c + 1);

    try {
      const found = await analyzeChunk(chunk, contextRef.current.slice(-600), "debate");
      contextRef.current += " " + chunk;
      const stamped = found.map(f => ({ ...f, ts: Date.now() }));
      if (stamped.length) {
        setClaims(prev => [...prev, ...stamped]);
        stamped.forEach(f => {
          if (settings.soundEffects) verdictSound(f.verdict);
          if (settings.voiceNarration) speak(`${f.verdict.replace("_", " ")}. ${f.explanation}`, true);
        });
      }
      return stamped;
    } catch (err) {
      setBlockReason(err.message || "Something went wrong checking that — try again.");
      if (err instanceof LimitError || err instanceof AuthRequiredError) handlePause();
      console.error("Analysis failed:", err);
      return [];
    } finally {
      setPendingCount(c => Math.max(0, c - 1));
      refreshUsage();
    }
  }, [settings.sensitivity, settings.soundEffects, settings.voiceNarration]);

  const { listening, interimText, fullTranscript, start, stop, reset, error, supported } = useLiveSpeech({
    onFinalChunk: text => {
      bufferRef.current += (bufferRef.current ? " " : "") + text;
      processBuffer(false);
    }
  });

  async function handleStart() {
    setBlockReason(null);
    try {
      await startDebate();
    } catch (err) {
      setBlockReason(err.message || "Couldn't start — try again in a moment.");
      refreshUsage();
      return;
    }
    if (settings.soundEffects) playStart();
    setClaims([]);
    bufferRef.current = "";
    contextRef.current = "";
    reset();
    setSessionId(newSessionId());
    startedAtRef.current = Date.now();
    setPhase("listening");
    start();
  }

  function handlePause() {
    if (settings.soundEffects) playClick();
    stop();
    setPhase("paused");
  }

  function handleResume() {
    if (settings.soundEffects) playClick();
    setPhase("listening");
    start();
  }

  async function handleEnd() {
    if (settings.soundEffects) playEnd();
    stop();
    const finalFound = await processBuffer(true);
    const allClaims = [...claims, ...finalFound];
    setPhase("ended");

    const title = await generateTitle(allClaims).catch(() => "Untitled Session");
    saveSession({
      id: sessionId, title,
      startedAt: startedAtRef.current, endedAt: Date.now(),
      transcript: fullTranscript, claims: allClaims
    });
    refreshUsage();

    setTimeout(() => setPhase("idle"), 1400);
  }

  const isActive = phase === "listening";
  const signedOut = usageInfo === null;
  const remainingDebate = usageInfo?.remaining?.debateSeconds ?? PLANS.free.debateSeconds;
  const planLabel = (PLANS[usageInfo?.plan] || PLANS.free).label;

  return (
    <div className="page fact-checker-page">
      {!signedOut && <div className="usage-note">{fmtMinutes(remainingDebate)} of debate time left this month on {planLabel}</div>}

      <section className="hero">
        <Waveform active={isActive} />

        {phase === "idle" && (
          <div className="hero-idle">
            <h1 className="hero-title">Say something. We'll check it.</h1>
            <p className="hero-sub">Live speech, checked in real time — every claim logged, every verdict explained.</p>

            {signedOut ? (
              <div className="setup-needed">
                <p>Sign in to start checking claims — free accounts get 5 debates a month.</p>
                <a href="/#/login" className="ctrl-btn ctrl-primary">Sign In →</a>
              </div>
            ) : (
              <button className="start-btn" onClick={handleStart}>
                <span className="start-btn-dot" /> Start Debate
              </button>
            )}

            {!supported && <p className="hero-warning">Your browser doesn't support live speech recognition — try Chrome or Edge.</p>}
            {blockReason && <p className="hero-warning">{blockReason} <a href="/#/upgrade">Upgrade</a> for more.</p>}

            <div className="how-it-works">
              <div className="hiw-step"><span className="hiw-num">1</span><span>Hit Start and talk — about anything</span></div>
              <div className="hiw-step"><span className="hiw-num">2</span><span>Factual claims get pulled out as you go</span></div>
              <div className="hiw-step"><span className="hiw-num">3</span><span>Each one gets a verdict, explained</span></div>
            </div>
          </div>
        )}

        {(phase === "listening" || phase === "paused") && (
          <div className="hero-live">
            <div className="live-status">
              <span className={`live-dot ${isActive ? "on" : "off"}`} />
              {isActive ? "LISTENING" : "PAUSED"}
              {pendingCount > 0 && <span className="live-checking">· checking…</span>}
            </div>
            <p className="transcript-line">
              <span className="transcript-final">{fullTranscript.slice(-220)}</span>
              <span className="transcript-interim">{interimText}</span>
            </p>
            <div className="control-row">
              {isActive
                ? <button className="ctrl-btn" onClick={handlePause}>Pause Debate</button>
                : <button className="ctrl-btn ctrl-primary" onClick={handleResume}>Resume Debate</button>}
              <button className="ctrl-btn ctrl-end" onClick={handleEnd}>End Debate</button>
            </div>
            {blockReason && <p className="hero-warning">{blockReason} <a href="/#/upgrade">Upgrade</a> for more.</p>}
          </div>
        )}

        {phase === "ended" && <p className="hero-ended">Session saved to History.</p>}
        {error && <p className="hero-warning">Mic error: {error}</p>}
      </section>

      <section className="claim-feed">
        {claims.length === 0 && phase === "idle" && (
          <div className="empty-note">Claims will appear here as they're detected — nothing to check yet.</div>
        )}
        {[...claims].reverse().map((c, i) => (
          <ClaimCard
            key={c.ts + "-" + i}
            index={claims.length - i}
            claim={c.claim} verdict={c.verdict} explanation={c.explanation} truth={c.truth} sources={c.sources}
            isNew={i === 0}
          />
        ))}
      </section>
    </div>
  );
}
