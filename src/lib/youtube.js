export function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function isYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/.test(url);
}

const PLATFORM_PATTERNS = [
  { name: "TikTok", test: /tiktok\.com/ },
  { name: "Instagram", test: /instagram\.com/ },
  { name: "X", test: /(twitter\.com|x\.com)/ },
  { name: "Facebook", test: /facebook\.com|fb\.watch/ },
  { name: "Reddit", test: /reddit\.com/ },
  { name: "Twitch", test: /twitch\.tv/ }
];

export function detectPlatform(url) {
  if (isYouTubeUrl(url)) return "YouTube";
  const hit = PLATFORM_PATTERNS.find(p => p.test.test(url));
  if (hit) return hit.name;
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "that link"; }
}

let apiLoadPromise = null;
export function loadYouTubeIframeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise(resolve => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiLoadPromise;
}

/**
 * Best-effort caption fetch. YouTube does not reliably allow cross-origin
 * requests to its caption endpoints from arbitrary browser pages without a
 * backend proxy — this will work for some videos/setups and fail for
 * others. Callers should always offer a manual paste-transcript fallback
 * rather than depending on this succeeding.
 */
export async function tryFetchCaptions(videoId) {
  try {
    const listRes = await fetch(`https://www.youtube.com/api/timedtext?type=list&v=${videoId}`);
    if (!listRes.ok) throw new Error("caption list unavailable");
    const listText = await listRes.text();
    const langMatch = listText.match(/lang_code="([^"]+)"/);
    if (!langMatch) throw new Error("no caption track found");

    const trackRes = await fetch(`https://www.youtube.com/api/timedtext?lang=${langMatch[1]}&v=${videoId}`);
    if (!trackRes.ok) throw new Error("caption track fetch failed");
    const xml = await trackRes.text();

    const segments = [];
    const re = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(xml))) {
      const text = m[3].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, "").trim();
      if (text) segments.push({ start: parseFloat(m[1]), dur: parseFloat(m[2]), text });
    }
    if (!segments.length) throw new Error("empty captions");
    return segments;
  } catch (err) {
    return null; // caller falls back to manual paste
  }
}

export function segmentsInRange(segments, startSec, endSec) {
  return segments.filter(s => s.start >= startSec && s.start <= endSec);
}

export function fmtTimestamp(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}
