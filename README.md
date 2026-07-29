# FactChecker Live

A real-time, voice-driven fact checker. Click Start Debate, talk, and claims
get pulled out of what you say and checked live — verdict, explanation,
source, and what's actually true, logged like exhibit evidence as you go.

**This is a hosted service, not a bring-your-own-key tool.** One API key
(yours) serves every visitor, held server-side where nobody can see it, with
real usage limits enforced per plan on the backend. This README walks
through setting that up.

## Architecture, in one paragraph

The frontend (React + Vite) never talks to Anthropic directly. It calls your
own backend (`/api/*`, deployed as Vercel serverless functions), which holds
your `ANTHROPIC_API_KEY` as a server environment variable and is the only
thing that ever sends it anywhere. Visitors sign in with a real account
(email + password via Supabase Auth) — every request to the backend carries
their login session, which is verified server-side against Supabase before
anything runs, so plan and usage are tracked against a real verified
identity, not something a client can fake by sending a different value.

## Setup — three services, all free at small scale

### 1. Supabase (accounts, plans, and usage — one project does all three)

1. Sign up at [supabase.com](https://supabase.com), create a new project.
2. Open the SQL Editor and run everything in `supabase-schema.sql` (in this
   folder) — creates `profiles` and `usage_monthly`, both keyed off Supabase
   Auth's built-in `auth.users` table. Email/password auth is on by default,
   nothing extra to configure to get signup/login working.
3. Go to Project Settings → API. You need **two different keys** from here:
   - The **`anon` / public key** — safe to expose in the browser, used for
     login/signup itself.
   - The **`service_role` key** — server-only, secret, used by your backend
     to read/write usage data past Row Level Security. Never expose this one.

### 2. Anthropic (the actual fact-checking)

Get a key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
if you don't have one. This is the one key that pays for everyone's usage —
guard it like a password, because now it actually is one.

### 3. Vercel (hosting + the backend functions)

1. Push this project to a GitHub repo.
2. Sign up at [vercel.com](https://vercel.com) with your GitHub account,
   import the repo, click Deploy — Vercel auto-detects the Vite frontend
   *and* turns everything in `/api` into live serverless functions with zero
   config.
3. In the Vercel project → Settings → Environment Variables, add:
   - `ANTHROPIC_API_KEY` — your Anthropic key
   - `SUPABASE_URL` — from step 1
   - `SUPABASE_SERVICE_KEY` — from step 1 (the secret one)
   - `VITE_SUPABASE_URL` — same URL as above, but this copy needs the
     `VITE_` prefix so the browser code can use it for login
   - `VITE_SUPABASE_ANON_KEY` — the public anon key from step 1
4. Redeploy (Vercel → Deployments → ⋯ → Redeploy) so the new env vars take
   effect.

That's it — your live URL now requires a real account and enforces real limits.

## Local development

Plain `npm run dev` (just Vite) will *not* run the `/api` functions — you'll
get network errors on anything that hits the backend. For local development
with working API routes:

```
npm install -g vercel   # one-time
vercel link              # one-time, connects this folder to your Vercel project
vercel env pull .env.local
npm run dev:full          # runs `vercel dev` — Vite + working /api routes together
```

## Real vs. not-yet-automatic

- ✅ **Real and enforced**: accounts, login sessions verified server-side on
  every request, usage tracking, monthly limits, the API key staying
  server-side.
- ⚠️ **Manual for now**: when someone upgrades via a Stripe Payment Link,
  their `plan` in the `profiles` table needs to be updated by you (or by a
  webhook you haven't built yet) — it doesn't happen automatically the
  instant they pay. Their account ID is attached to checkout
  (`client_reference_id`) specifically so a webhook can match the payment
  back to the right account once you're ready to automate this — ask if you
  want that built.
- ⚠️ **Not built**: IP-based throttling on account creation, as a deterrent
  against someone scripting up many free accounts. A real enhancement if you
  see abuse, not built in this pass.

## Fixed: failures were being swallowed silently

If a check against the backend failed for any reason other than a known
limit or auth error, the app used to just log it to the browser console and
show nothing — no error, no claims, no explanation. That's exactly what
"wrote out what I said but didn't do anything" looks like from the outside.
Every failure now surfaces a real message in the UI across all three modes.
If something still looks broken after this, the error text itself should
say what actually happened — that's the thing to send over if it's unclear.

## Everything else

- **Video Check** accepts links from YouTube, TikTok, Instagram, X,
  Facebook, Reddit, Twitch, or anywhere else. Full timestamp scrubbing
  (dragging real start/end handles on a live-playing embed) only works for
  YouTube — the only platform that exposes the playback control this needs.
  Other platforms: paste the transcript and check it the same way.
- **Sources** — each verdict includes 1-2 real, well-known domains you can
  check it against, never a fabricated deep link to a specific article.
- **Versus Mode** — up to 8 players (Party tier), manual tap-to-speak
  attribution (voice diarization isn't reliable enough to trust for
  scoring), live circular layout with an elapsed timer, ends with a Debate
  Score and an AI-written summary of each player's arguments.
- **Themes** — Paper/Ink/Signal are free; Midnight/Newsroom/Frost/Sepia are
  Pro and up.
- **Billing accuracy** — every check is metered by real token usage from the
  Anthropic API response, converted to plan-time at standard Sonnet 5 rates,
  not a flat per-second guess. Denser debates (more claims returned) cost
  more from the monthly allowance than quiet stretches — same logic
  everywhere: solo mode, Video Check, and Versus Mode.

## Project structure

```
src/
  lib/
    claude.js      — calls YOUR backend (/api/*), never Anthropic directly
    deviceId.js     — anonymous per-browser ID used to track plan/usage
    speech.js       — Web Speech API wrapper
    sound.js        — synthesized sound effects
    storage.js      — local settings (theme, sound, sensitivity) — no key, no plan
    plans.js        — plan display metadata + fetchUsage() for real server data
    youtube.js       — YouTube embed control + platform detection
    versus.js         — deterministic debate scoring
  components/, pages/  — same as before
api/
  _lib/
    supabase.js      — server-only Supabase client (service role key)
    anthropic.js      — server-only Anthropic client (your API key)
    usage.js            — plan limits + real usage enforcement logic
  register-device.js, get-usage.js, start-debate.js,
  analyze-chunk.js, generate-title.js, generate-summaries.js
supabase-schema.sql  — run once in Supabase's SQL editor
```

## Known limitations

- Anonymous device IDs mean someone determined to dodge the free-tier limit
  could clear their browser storage for a "new" free allowance — this is
  inherent to not having real accounts yet. Paid tiers are the actually
  durable limit, since they're tied to a real payment.
- Web Speech API reliability varies by browser/OS/mic.
- Claim detection quality depends on speech recognition accuracy.
