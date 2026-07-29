import { getToken } from "./auth.js";

// Display metadata only — mirrors api/_lib/usage.js's PLANS, which is the
// actual source of truth. This copy exists so pricing/feature text can
// render instantly without waiting on a network call; real enforcement and
// real remaining-time numbers always come from the server.
export const PLANS = {
  free: {
    id: "free", label: "Free", price: 0,
    debateSeconds: 15 * 60, videoSeconds: 5 * 60, maxPlayers: 3,
    features: ["5 debates/month, 15 min total", "5 min/month of video timestamp checks", "Up to 3 players in Versus Mode", "3 base themes"]
  },
  pro: {
    id: "pro", label: "Pro", price: 19.99,
    debateSeconds: 5 * 60 * 60, videoSeconds: 30 * 60, maxPlayers: 4,
    features: ["5 hours/month of live debate", "30 min/month of video timestamp checks", "Up to 4 players in Versus Mode", "4 extra themes", "Priority processing"]
  },
  max: {
    id: "max", label: "Max", price: 49.99,
    debateSeconds: 12 * 60 * 60, videoSeconds: 2 * 60 * 60, maxPlayers: 6,
    features: ["12 hours/month of live debate", "2 hours/month of video timestamp checks", "Up to 6 players in Versus Mode", "4 extra themes", "Priority processing"]
  },
  party: {
    id: "party", label: "Party", price: 79.99,
    debateSeconds: 20 * 60 * 60, videoSeconds: 3 * 60 * 60, maxPlayers: 8,
    features: ["20 hours/month of live debate", "3 hours/month of video timestamp checks", "Up to 8 players in Versus Mode — built for game night", "4 extra themes", "Priority processing"]
  }
};

export const PLAN_ORDER = ["free", "pro", "max", "party"];

export const THEMES = [
  { id: "paper", label: "Paper", tier: "free" },
  { id: "ink", label: "Ink", tier: "free" },
  { id: "signal", label: "Signal", tier: "free" },
  { id: "midnight", label: "Midnight", tier: "pro" },
  { id: "newsroom", label: "Newsroom", tier: "pro" },
  { id: "frost", label: "Frost", tier: "pro" },
  { id: "sepia", label: "Sepia", tier: "pro" }
];

export function themeAllowed(themeId, plan) {
  const theme = THEMES.find(t => t.id === themeId);
  if (!theme || theme.tier === "free") return true;
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf("pro");
}

export function fmtMinutes(seconds) {
  if (seconds === Infinity) return "Unlimited";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${Math.round(seconds % 60)}s`;
}

/**
 * The real, server-verified plan and usage for the signed-in user. Returns
 * null if nobody's signed in — always call this rather than trusting
 * anything cached locally, which can be edited by anyone.
 */
export async function fetchUsage() {
  const token = await getToken();
  if (!token) return null;
  const res = await fetch("/api/get-usage", { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load usage from server");
  return res.json();
}
