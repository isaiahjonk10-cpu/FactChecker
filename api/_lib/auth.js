const { getSupabase } = require("./supabase.js");

class AuthError extends Error {
  constructor(message) { super(message); this.code = "AUTH"; }
}

/**
 * Verifies the Authorization: Bearer <token> header against Supabase's own
 * auth servers. This cannot be forged by a client — unlike a client-supplied
 * device ID, which is exactly what let people fake a "fresh" free allowance
 * before. If this passes, `user.id` is a real, verified account.
 */
async function requireUser(req) {
  const header = req.headers.authorization || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new AuthError("Please sign in to use FactChecker Live.");

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new AuthError("Your session expired — please sign in again.");
  return data.user;
}

module.exports = { requireUser, AuthError };
