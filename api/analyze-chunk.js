const { callClaude } = require("./_lib/anthropic.js");
const { requireUser, AuthError } = require("./_lib/auth.js");
const { assertWithinLimit, recordUsage } = require("./_lib/usage.js");

const CLAIM_SYSTEM = `You are a real-time fact-checking assistant listening to a live debate or conversation.
You will be given a short new chunk of transcript plus a bit of prior context for continuity.
Extract any CLEAR, checkable factual claims made in the NEW chunk only (ignore the context — it's just for understanding, don't re-report claims from it).
A factual claim is a checkable assertion about reality (a statistic, historical fact, scientific claim, definition, event, etc.) — not an opinion, prediction about the future, or vague statement.
If there are no clear factual claims in the new chunk, return an empty array.

Accuracy matters more than anything else here — people are relying on these verdicts being right, not just fast. Reason carefully before assigning severity.

Use exactly one of these six verdicts, chosen precisely — do not default to the middle of the scale out of caution:
- "TRUE" — accurate as stated
- "MOSTLY_TRUE" — essentially correct but with a minor inaccuracy (wrong date by a bit, slightly off number, etc.)
- "MISLEADING" — technically true but omits crucial context that changes its meaning, or true only under narrow conditions presented as universal
- "FALSE" — plainly incorrect
- "VERY_FALSE" — a significant, clear-cut factual error, not a minor slip
- "ABSURD" — baseless, wildly wrong, or fabricated — no real grounding in reality

For each claim, also list 1-2 real, well-known, authoritative sources someone could check this against — the kind of established organization you're genuinely confident actually exists and covers this topic (e.g. a government agency like CDC.gov or NASA.gov, a major wire service like Reuters or AP, an established scientific/statistical body, a well-known reference like Britannica). Give the source's name and its real top-level domain — NOT a deep link to a specific article, since you can't reliably know if a specific article URL exists. If you're not genuinely confident a relevant, real source exists, return an empty sources array rather than guessing.

Respond with ONLY a JSON array, no markdown fences, no preamble:
[{"claim": "...", "verdict": "TRUE" | "MOSTLY_TRUE" | "MISLEADING" | "FALSE" | "VERY_FALSE" | "ABSURD", "explanation": "one short sentence", "truth": "one short sentence", "sources": [{"name": "Source Name", "url": "https://example.com"}]}]`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const user = await requireUser(req);
    const { chunk, priorContext, kind } = req.body;
    if (!chunk) return res.status(400).json({ error: "chunk required" });
    const usageKind = kind === "video" ? "video" : "debate";

    await assertWithinLimit(user.id, usageKind);

    const userContent = `PRIOR CONTEXT (for understanding only, do not extract claims from this):\n${priorContext || "(none yet)"}\n\nNEW TRANSCRIPT CHUNK (extract claims from this part only):\n${chunk}`;
    const { text, usage } = await callClaude(CLAIM_SYSTEM, userContent, 900);

    await recordUsage(user.id, usageKind, usage.inputTokens, usage.outputTokens);

    let claims = [];
    try { claims = JSON.parse(text.replace(/```json|```/g, "").trim()); if (!Array.isArray(claims)) claims = []; }
    catch { claims = []; }

    res.status(200).json({ claims });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message, code: "AUTH" });
    if (err.code === "LIMIT") return res.status(403).json({ error: err.message, code: "LIMIT" });
    res.status(500).json({ error: err.message });
  }
};
