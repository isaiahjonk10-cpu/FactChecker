import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { PLANS, fetchUsage } from "../lib/plans.js";
import { onAuthChange, signOut, getCurrentUser } from "../lib/auth.js";

export default function NavBar() {
  const [plan, setPlan] = useState(null);
  const [email, setEmail] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const refresh = () => {
      getCurrentUser().then(u => setEmail(u?.email || null));
      fetchUsage().then(d => setPlan(d?.plan || null)).catch(() => setPlan(null));
    };
    refresh();
    const unsubscribe = onAuthChange(refresh);
    const interval = setInterval(refresh, 20000);
    return () => { unsubscribe(); clearInterval(interval); };
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const planInfo = plan ? PLANS[plan] : null;

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="brand-mark" aria-hidden="true">◉</span>
        <div className="brand-block">
          <span className="brand-text">FactChecker<em>Live</em></span>
          <span className="brand-tagline">Live Debate Fact-Checker</span>
        </div>
      </div>
      <nav className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>Fact Checker</NavLink>
        <NavLink to="/video" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>Video Check</NavLink>
        <NavLink to="/versus" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>Versus Mode</NavLink>
        <NavLink to="/history" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>History</NavLink>
        <NavLink to="/settings" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>Settings</NavLink>
      </nav>
      <div className="navbar-plan">
        {email ? (
          <>
            {planInfo && <span className="plan-pill">{planInfo.label} Plan</span>}
            <NavLink to="/upgrade" className="upgrade-btn">Upgrade</NavLink>
            <button className="nav-signout" onClick={handleSignOut} title={email}>Sign Out</button>
          </>
        ) : (
          <NavLink to="/login" className="upgrade-btn">Sign In</NavLink>
        )}
      </div>
    </header>
  );
}
