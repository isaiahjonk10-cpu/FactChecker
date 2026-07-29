const { requireUser, AuthError } = require("./_lib/auth.js");
const { assertWithinLimit, incrementDebateCount } = require("./_lib/usage.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const user = await requireUser(req);
    const { profile, plan } = await assertWithinLimit(user.id, "debate");
    await incrementDebateCount(user.id);
    res.status(200).json({ ok: true, plan: profile.plan, limits: plan });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message, code: "AUTH" });
    if (err.code === "LIMIT") return res.status(403).json({ error: err.message, code: "LIMIT" });
    res.status(500).json({ error: err.message });
  }
};
