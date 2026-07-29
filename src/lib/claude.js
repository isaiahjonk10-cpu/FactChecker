// Every call here goes to OUR OWN backend (/api/*), authenticated with the
// visitor's real login session — never a client-chosen ID, and never
// Anthropic directly. The real API key lives only on the server.

import { getToken } from "./auth.js";

export class LimitError extends Error {
  constructor(message) { super(message); this.code = "LIMIT"; }
}
export class AuthRequiredError extends Error {
  constructor(message) { super(message); this.code = "AUTH"; }
}

async function authedFetch(path, options = {}) {
  const token = await getToken();
  if (!token) throw new AuthRequiredError("Please sign in to use FactChecker Live.");
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new AuthRequiredError(data.error || "Please sign in again.");
  if (res.status === 403 && data.code === "LIMIT") throw new LimitError(data.error);
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function startDebate() {
  return authedFetch("/api/start-debate", { method: "POST", body: "{}" });
}

export async function analyzeChunk(chunk, priorContext, kind = "debate") {
  const data = await authedFetch("/api/analyze-chunk", { method: "POST", body: JSON.stringify({ chunk, priorContext, kind }) });
  return data.claims || [];
}

export async function generateTitle(claims) {
  const data = await authedFetch("/api/generate-title", { method: "POST", body: JSON.stringify({ claims }) });
  return data.title || "Untitled Session";
}

export async function generatePlayerSummaries(playersWithClaims) {
  const data = await authedFetch("/api/generate-summaries", { method: "POST", body: JSON.stringify({ players: playersWithClaims }) });
  return data.summaries || {};
}
