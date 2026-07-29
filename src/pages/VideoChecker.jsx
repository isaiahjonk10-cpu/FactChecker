import { useState, useRef, useEffect, useCallback } from "react";
import {
  extractYouTubeId, isYouTubeUrl, detectPlatform, loadYouTubeIframeAPI,
  tryFetchCaptions, segmentsInRange, fmtTimestamp
} from "../lib/youtube.js";
import { analyzeChunk, LimitError, AuthRequiredError } from "../lib/claude.js";
import { loadSettings } from "../lib/storage.js";
import { PLANS, fetchUsage, fmtMinutes } from "../lib/plans.js";
import ClaimCard from "../components/ClaimCard.jsx";

const PROBLEM_VERDICTS = new Set(["FALSE", "VERY_FALSE", "ABSURD"]);

export default function VideoChecker() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState(null);
  const [otherPlatform, setOtherPlatform] = useState(null);
  const [duration, setDuration] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(30);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [captionSegments, setCaptionSegments] = useState(null);
  const [captionStatus, setCaptionStatus] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [claims, setClaims] = useState([]);
  const [filterProblems, setFilterProblems] = useState(false);
  const [checking, setChecking] = useState(false);
  const [livePlaying, setLivePlaying] = useState(false);
  const [limitWarning, setLimitWarning] = useState(null);
  const [usageInfo, setUsageInfo] = useState(undefined); // undefined = loading, null = signed out

  const playerRef = useRef(null);
  const playerObjRef = useRef(null);
  const liveRafRef = useRef(null);
  const revealedRef = useRef(new Set());
  const pollRef = useRef(null);

  const settings = loadSettings();
  const plan = PLANS[usageInfo?.plan] || PLANS.free;

  const refreshUsage = useCallback(() => { fetchUsage().then(setUsageInfo).catch(() => setUsageInfo(null)); }, []);
  useEffect(() => { refreshUsage(); }, [refreshUsage]);

  function handleLoadVideo(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setClaims([]);
    setCaptionSegments(null);
    setCaptionStatus("idle");
    setTranscript("");
    if (isYouTubeUrl(url)) {
      const id = extractYouTubeId(url);
      if (!id) return;
      setOtherPlatform(null);
      setVideoId(id);
    } else {
      setOtherPlatform(detectPlatform(url));
      setVideoId(null);
    }
  }

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    if (playerObjRef.current?.destroy) {
      try { playerObjRef.current.destroy(); } catch {}
      playerObjRef.current = null;
    }
    loadYouTubeIframeAPI().then(YT => {
      if (cancelled || !playerRef.current) return;
      playerObjRef.current = new YT.Player(playerRef.current, {
        videoId,
        events: {
          onReady: e => {
            const dur = e.target.getDuration();
            setDuration(dur);
            setStartSec(0);
            setEndSec(Math.min(30, dur));
          },
          onStateChange: e => setIsPlaying(e.data === 1)
        }
      });
    });
    return () => { cancelled = true; };
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;
    pollRef.current = setInterval(() => {
      const t = playerObjRef.current?.getCurrentTime?.();
      if (t != null) setCurrentTime(t);
    }, 200);
    return () => clearInterval(pollRef.current);
  }, [videoId]);

  function togglePlay() {
    if (isPlaying) playerObjRef.current?.pauseVideo();
    else playerObjRef.current?.playVideo();
  }

  function updateTranscriptFromRange(s, e) {
    if (!captionSegments) return;
    const inRange = segmentsInRange(captionSegments, s, e);
    setTranscript(inRange.map(seg => seg.text).join(" "));
  }

  function handleStartChange(v) {
    const clamped = Math.min(v, endSec - 1);
    setStartSec(clamped);
    updateTranscriptFromRange(clamped, endSec);
  }
  function handleEndChange(v) {
    const clamped = Math.max(v, startSec + 1);
    setEndSec(clamped);
    updateTranscriptFromRange(startSec, clamped);
  }

  function seekToPlayhead(v) {
    playerObjRef.current?.seekTo(v, true);
    setCurrentTime(v);
  }

  function markHereAs(which) {
    const t = currentTime;
    if (which === "start") handleStartChange(Math.min(t, endSec - 1));
    else handleEndChange(Math.max(t, startSec + 1));
  }

  async function handleAutoFetchCaptions() {
    setCaptionStatus("fetching");
    const segments = await tryFetchCaptions(videoId);
    if (!segments) { setCaptionStatus("unavailable"); return; }
    setCaptionSegments(segments);
    setCaptionStatus("found");
    const inRange = segmentsInRange(segments, startSec, endSec);
    setTranscript(inRange.map(s => s.text).join(" "));
  }

  const runCheck = useCallback(async (problemsOnly) => {
    if (!transcript.trim()) return;
    setChecking(true);
    setFilterProblems(problemsOnly);
    setLimitWarning(null);
    try {
      const found = await analyzeChunk(transcript, "", "video");
      setClaims(found.map(f => ({ ...f, ts: Date.now() })));
    } catch (err) {
      setLimitWarning(err.message || "Something went wrong checking that — try again.");
      console.error(err);
    } finally {
      setChecking(false);
      refreshUsage();
    }
  }, [transcript, refreshUsage]);

  async function handlePlayAndCheckLive() {
    if (!transcript.trim() || !videoId) return;
    setChecking(true);
    setClaims([]);
    setLimitWarning(null);
    revealedRef.current = new Set();

    let found;
    try {
      found = await analyzeChunk(transcript, "", "video");
    } catch (err) {
      setChecking(false);
      refreshUsage();
      setLimitWarning(err.message || "Something went wrong checking that — try again.");
      return;
    }
    setChecking(false);
    refreshUsage();

    const withTimes = found.map((f, i) => {
      let atSeconds = startSec + ((i + 1) / (found.length + 1)) * (endSec - startSec);
      if (captionSegments) {
        const hit = segmentsInRange(captionSegments, startSec, endSec).find(s => f.claim && s.text.includes(f.claim.slice(0, 12)));
        if (hit) atSeconds = hit.start;
      }
      return { ...f, ts: Date.now() + i, atSeconds };
    });

    playerObjRef.current?.seekTo(startSec, true);
    playerObjRef.current?.playVideo();
    setLivePlaying(true);

    const tick = () => {
      const now = playerObjRef.current?.getCurrentTime?.() ?? 0;
      withTimes.forEach(c => {
        if (now >= c.atSeconds && !revealedRef.current.has(c.ts)) {
          revealedRef.current.add(c.ts);
          setClaims(prev => [...prev, c]);
        }
      });
      if (now >= endSec) {
        playerObjRef.current?.pauseVideo();
        setLivePlaying(false);
        return;
      }
      liveRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  useEffect(() => () => { if (liveRafRef.current) cancelAnimationFrame(liveRafRef.current); }, []);

  const visibleClaims = filterProblems ? claims.filter(c => PROBLEM_VERDICTS.has(c.verdict)) : claims;
  const remainingVideo = usageInfo?.remaining?.videoSeconds ?? PLANS.free.videoSeconds;
  const rangePct = duration ? { left: (startSec / duration) * 100, width: ((endSec - startSec) / duration) * 100, play: (currentTime / duration) * 100 } : { left: 0, width: 0, play: 0 };

  return (
    <div className="page video-page">
      <h1 className="page-title">Video Check</h1>
      <p className="page-sub">Paste a link from anywhere — YouTube, TikTok, Instagram, X, and more.</p>
      <div className="usage-note">{fmtMinutes(remainingVideo)} of video-checking left this month on {plan.label}.</div>

      <form className="video-url-row" onSubmit={handleLoadVideo}>
        <input
          type="text" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="Paste a video link…" className="video-url-input"
        />
        <button type="submit" className="ctrl-btn ctrl-primary">Load</button>
      </form>

      {otherPlatform && (
        <div className="platform-note">
          <p>
            Got it — a {otherPlatform} link. Full timestamp scrubbing (watching the video right here while marking
            a clip) currently only works for YouTube, since that's the only platform that lets an app like this
            control playback directly. For {otherPlatform}, just paste the transcript or a specific quote/section
            you want checked into the box below — Instant Fact-Check and Find Incorrect Claims both work the same
            either way.
          </p>
        </div>
      )}

      {videoId && (
        <>
          <div className="yt-embed-wrap" key={videoId}><div ref={playerRef} className="yt-embed" /></div>

          <div className="scrubber-block">
            <div className="scrubber-labels">
              <span>{fmtTimestamp(startSec)}</span>
              <span className="scrubber-span">{fmtTimestamp(endSec - startSec)} marked</span>
              <span>{fmtTimestamp(endSec)}</span>
            </div>

            <div className="scrubber-track-wrap">
              <div className="scrubber-track">
                <div className="scrubber-range" style={{ left: `${rangePct.left}%`, width: `${rangePct.width}%` }} />
                <div className="scrubber-playhead" style={{ left: `${rangePct.play}%` }} />
              </div>
              <input
                type="range" className="range-input range-start" min={0} max={duration || 0} step={0.5}
                value={startSec} onChange={e => handleStartChange(Number(e.target.value))}
              />
              <input
                type="range" className="range-input range-end" min={0} max={duration || 0} step={0.5}
                value={endSec} onChange={e => handleEndChange(Number(e.target.value))}
              />
            </div>
            <p className="field-hint" style={{ margin: "6px 0 0" }}>Drag either handle to set your clip — the highlighted band is what gets checked.</p>

            <div className="scrubber-controls">
              <button type="button" className="ctrl-btn ctrl-primary" onClick={togglePlay}>{isPlaying ? "⏸ Pause" : "▶ Play"}</button>
              <input
                type="range" className="seek-input" min={0} max={duration || 0} step={0.5}
                value={currentTime} onChange={e => seekToPlayhead(Number(e.target.value))}
              />
              <span className="seek-time">{fmtTimestamp(currentTime)}</span>
            </div>
            <div className="scrubber-controls">
              <button type="button" className="ctrl-btn" onClick={() => markHereAs("start")}>Mark current spot as Start</button>
              <button type="button" className="ctrl-btn" onClick={() => markHereAs("end")}>Mark current spot as End</button>
            </div>
          </div>

          <div className="caption-block">
            {captionStatus === "idle" && (
              <button className="ctrl-btn" onClick={handleAutoFetchCaptions}>Try Auto-Fetch Captions</button>
            )}
            {captionStatus === "fetching" && <span className="live-checking">Fetching captions…</span>}
            {captionStatus === "found" && <span className="caption-found">✓ Captions loaded for this range — edit below if needed.</span>}
            {captionStatus === "unavailable" && (
              <span className="hero-warning" style={{ margin: 0 }}>
                Couldn't auto-fetch captions for this video (this doesn't always work — YouTube doesn't reliably
                allow it from a browser-only app). Paste the transcript for this time range manually below.
              </span>
            )}
          </div>
        </>
      )}

      {(videoId || otherPlatform) && (
        <>
          <textarea
            className="transcript-textarea"
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Transcript for the marked time range goes here — auto-fetched captions will fill this in, or paste it yourself."
          />

          {limitWarning && <p className="hero-warning">{limitWarning} <a href="/#/upgrade">Upgrade</a> for more.</p>}

          {usageInfo === null ? (
            <div className="setup-needed">
              <p>Sign in to run a fact-check.</p>
              <a href="/#/login" className="ctrl-btn ctrl-primary">Sign In →</a>
            </div>
          ) : (
            <div className="action-row">
              <button className="ctrl-btn ctrl-primary" disabled={checking || !transcript.trim()} onClick={() => runCheck(false)}>
                ⚡ Instant Fact-Check
              </button>
              <button className="ctrl-btn" disabled={checking || !transcript.trim()} onClick={() => runCheck(true)}>
                🚩 Find Incorrect Claims
              </button>
              <button className="ctrl-btn" disabled={checking || livePlaying || !transcript.trim() || !videoId} onClick={handlePlayAndCheckLive} title={!videoId ? "Play & Check Live needs a YouTube link" : ""}>
                ▶ Play &amp; Check Live
              </button>
            </div>
          )}
          {checking && <p className="live-checking">Checking…</p>}
          {livePlaying && <p className="live-checking">Playing — claims will appear as their moment comes up…</p>}
        </>
      )}

      <section className="claim-feed">
        {visibleClaims.length === 0 && claims.length > 0 && filterProblems && (
          <div className="empty-note">No incorrect claims found in this range — nice.</div>
        )}
        {[...visibleClaims].reverse().map((c, i) => (
          <ClaimCard
            key={c.ts + "-" + i}
            index={visibleClaims.length - i}
            claim={c.claim} verdict={c.verdict} explanation={c.explanation} truth={c.truth} sources={c.sources}
            isNew={i === 0}
          />
        ))}
      </section>
    </div>
  );
}
