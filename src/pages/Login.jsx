import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "../lib/auth.js";

export default function Login() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const data = await signUp(email, password);
        if (!data.session) {
          setNotice("Check your email to confirm your account, then come back and sign in.");
          setMode("signin");
        } else {
          navigate("/");
        }
      } else {
        await signIn(email, password);
        navigate("/");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page login-page">
      <div className="login-card">
        <h1 className="login-title">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
        <p className="login-sub">
          {mode === "signup"
            ? "One free account gets you 5 debates a month, 15 minutes total."
            : "Welcome back — pick up where you left off."}
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="settings-label">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="settings-input" placeholder="you@example.com" />

          <label className="settings-label">Password</label>
          <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="settings-input" placeholder="At least 6 characters" />

          {error && <p className="hero-warning">{error}</p>}
          {notice && <p className="login-notice">{notice}</p>}

          <button type="submit" className="start-btn login-submit" disabled={busy}>
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button className="login-switch" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); setNotice(null); }}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
