const { requireUser, AuthError } = require("./_lib/auth.js");
const { getOrCreateProfile, getMonthlyUsage, PLANS } = require("./_lib/usage.js");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    const user = await requireUser(req);
    const profile = await getOrCreateProfile(user.id);
    const usage = await getMonthlyUsage(user.id);
    const plan = PLANS[profile.plan] || PLANS.free;

    res.status(200).json({
      plan: profile.plan,
      email: user.email,
      limits: plan,
      usage: {
        debateSecondsUsed: usage.debate_seconds,
        videoSecondsUsed: usage.video_seconds,
        debateCount: usage.debate_count
      },
      remaining: {
        debateSeconds: Math.max(0, plan.debateSeconds - usage.debate_seconds),
        videoSeconds: Math.max(0, plan.videoSeconds - usage.video_seconds),
        debatesThisMonth: plan.maxDebatesPerMonth === Infinity ? Infinity : Math.max(0, plan.maxDebatesPerMonth - usage.debate_count)
      }
    });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message, code: "AUTH" });
    res.status(500).json({ error: err.message });
  }
};
