const { createClient } = require("@supabase/supabase-js");

let client = null;
function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY; // service role key — server only, never VITE_-prefixed
    if (!url || !key) throw new Error("Supabase env vars not set (SUPABASE_URL, SUPABASE_SERVICE_KEY)");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

module.exports = { getSupabase };
