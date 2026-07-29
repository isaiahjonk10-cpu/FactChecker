const { callClaude } = require("./_lib/anthropic.js");
const { requireUser, AuthError } = require("./_lib/auth.js");

const TITLE_SYSTEM = `Generate a short, descriptive title (under 8 words) for a debate/conversation session based on the claims discussed.
Respond with ONLY the title text, no quotes, no punctuation at the end, nothing else.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    await requireUser(req);
    const { claims } = req.body;
    if (!claims || !claims.length) return res.status(200).json({ title: "Untitled Session" });

    const summary = claims.slice(0, 8).map(c => c.claim).join("; ");
    const { text } = await callClaude(TITLE_SYSTEM, `Claims discussed: ${summary}`, 40);
    const title = text.replace(/^["']|["']$/g, "").trim() || "Untitled Session";
    res.status(200).json({ title });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message, code: "AUTH" });
    res.status(200).json({ title: "Untitled Session" });
  }
};
