const { callClaude } = require("./_lib/anthropic.js");
const { requireUser, AuthError } = require("./_lib/auth.js");

const SUMMARY_SYSTEM = `You summarize what each debate participant argued, based only on their fact-checked claims (not a full transcript).
For each player, write one short, neutral 1-2 sentence summary of what they mainly argued and how accurate they generally were.
Respond with ONLY a JSON object mapping player name to summary string, no markdown fences, no preamble.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    await requireUser(req);
    const { players } = req.body;
    const withClaims = (players || []).filter(p => p.claims?.length > 0);
    if (!withClaims.length) return res.status(200).json({ summaries: {} });

    const userContent = withClaims.map(p =>
      `${p.name}'s claims:\n` + p.claims.map(c => `- (${c.verdict}) ${c.claim}`).join("\n")
    ).join("\n\n");

    const { text } = await callClaude(SUMMARY_SYSTEM, userContent, 500);
    let summaries = {};
    try { summaries = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { summaries = {}; }
    res.status(200).json({ summaries });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message, code: "AUTH" });
    res.status(200).json({ summaries: {} });
  }
};
