const { getSupabase } = require("./supabase.js");

const PLANS = {
  free:  { debateSeconds: 15 * 60,        videoSeconds: 5 * 60,          maxPlayers: 3, maxDebatesPerMonth: 5 },
  pro:   { debateSeconds: 5 * 60 * 60,    videoSeconds: 30 * 60,         maxPlayers: 4, maxDebatesPerMonth: Infinity },
  max:   { debateSeconds: 12 * 60 * 60,   videoSeconds: 2 * 60 * 60,     maxPlayers: 6, maxDebatesPerMonth: Infinity },
  party: { debateSeconds: 20 * 60 * 60,   videoSeconds: 3 * 60 * 60,     maxPlayers: 8, maxDebatesPerMonth: Infinity }
};

const RATE_PER_M_INPUT = 3;
const RATE_PER_M_OUTPUT = 15;
const BASELINE_DOLLARS_PER_SECOND = 0.041 / 60;

function tokensToEquivalentSeconds(inputTokens, outputTokens) {
  const cost = (inputTokens / 1e6) * RATE_PER_M_INPUT + (outputTokens / 1e6) * RATE_PER_M_OUTPUT;
  return cost / BASELINE_DOLLARS_PER_SECOND;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function getOrCreateProfile(userId) {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (existing) return existing;
  const { data: created, error } = await supabase.from("profiles").insert({ user_id: userId, plan: "free" }).select().single();
  if (error) throw error;
  return created;
}

async function getMonthlyUsage(userId) {
  const supabase = getSupabase();
  const month = currentMonthKey();
  const { data } = await supabase.from("usage_monthly").select("*").eq("user_id", userId).eq("month", month).single();
  return data || { user_id: userId, month, debate_seconds: 0, video_seconds: 0, debate_count: 0 };
}

async function assertWithinLimit(userId, kind) {
  const profile = await getOrCreateProfile(userId);
  const plan = PLANS[profile.plan] || PLANS.free;
  const usage = await getMonthlyUsage(userId);

  if (kind === "debate") {
    if (profile.plan === "free" && usage.debate_count >= plan.maxDebatesPerMonth) {
      throw Object.assign(new Error(`You've used all ${plan.maxDebatesPerMonth} free debates this month.`), { code: "LIMIT" });
    }
    if (usage.debate_seconds >= plan.debateSeconds) {
      throw Object.assign(new Error(`You're out of debate time this month on your ${profile.plan} plan.`), { code: "LIMIT" });
    }
  }
  if (kind === "video") {
    if (usage.video_seconds >= plan.videoSeconds) {
      throw Object.assign(new Error(`You're out of video-checking time this month on your ${profile.plan} plan.`), { code: "LIMIT" });
    }
  }
  return { profile, plan, usage };
}

async function recordUsage(userId, kind, inputTokens, outputTokens) {
  const supabase = getSupabase();
  const month = currentMonthKey();
  const seconds = tokensToEquivalentSeconds(inputTokens, outputTokens);
  const current = await getMonthlyUsage(userId);

  const next = {
    user_id: userId,
    month,
    debate_seconds: current.debate_seconds + (kind === "debate" ? seconds : 0),
    video_seconds: current.video_seconds + (kind === "video" ? seconds : 0),
    debate_count: current.debate_count + (kind === "debate_start" ? 1 : 0)
  };
  await supabase.from("usage_monthly").upsert(next, { onConflict: "user_id,month" });
  return next;
}

async function incrementDebateCount(userId) {
  return recordUsage(userId, "debate_start", 0, 0);
}

module.exports = { PLANS, getOrCreateProfile, getMonthlyUsage, assertWithinLimit, recordUsage, incrementDebateCount, currentMonthKey };
