import { useState, useEffect } from "react";
import { PLANS, PLAN_ORDER, fetchUsage } from "../lib/plans.js";
import { getCurrentUser } from "../lib/auth.js";

// Fill these in once you've created Payment Links in your Stripe dashboard
// (Products → your product → Payment Links). No backend code needed for
// checkout itself — see the README for wiring up automatic activation via
// a Stripe webhook, which is the piece that makes upgrades apply instantly.
const PAYMENT_LINKS = {
  pro: "",
  max: "",
  party: ""
};

export default function Upgrade() {
  const [plan, setPlan] = useState(undefined); // undefined = loading, null = signed out
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    fetchUsage().then(d => setPlan(d?.plan ?? null)).catch(() => setPlan(null));
    getCurrentUser().then(u => setUserId(u?.id || null));
  }, []);

  const signedOut = plan === null;

  return (
    <div className="page upgrade-page">
      <h1 className="page-title">Plans</h1>
      <p className="page-sub">Pick the tier that matches how much you actually check.</p>

      {signedOut && (
        <div className="setup-needed">
          <p>Sign in first — your plan is tied to your account.</p>
          <a href="/#/login" className="ctrl-btn ctrl-primary">Sign In →</a>
        </div>
      )}

      <div className="plan-grid">
        {PLAN_ORDER.map(id => {
          const p = PLANS[id];
          const isCurrent = plan === id;
          return (
            <div key={id} className={"plan-card" + (isCurrent ? " plan-current" : "") + (id === "pro" ? " plan-highlight" : "")}>
              {id === "pro" && <div className="plan-badge-top">MOST POPULAR</div>}
              {id === "party" && <div className="plan-badge-top plan-badge-niche">FOR GROUPS</div>}
              <div className="plan-name">{p.label}</div>
              <div className="plan-price">{p.price === 0 ? "Free" : `$${p.price}`}<span>{p.price > 0 && "/mo"}</span></div>
              <ul className="plan-features">{p.features.map(f => <li key={f}>{f}</li>)}</ul>
              {isCurrent ? (
                <button className="ctrl-btn plan-current-btn" disabled>Current Plan</button>
              ) : id === "free" ? (
                <span className="plan-hint-text">Default plan</span>
              ) : signedOut ? (
                <span className="plan-hint-text">Sign in to upgrade</span>
              ) : PAYMENT_LINKS[id] ? (
                <a className="ctrl-btn ctrl-primary plan-cta" href={`${PAYMENT_LINKS[id]}?client_reference_id=${userId}`} target="_blank" rel="noreferrer">
                  Upgrade to {p.label}
                </a>
              ) : (
                <span className="plan-hint-text">Checkout coming soon</span>
              )}
            </div>
          );
        })}
      </div>

      {!signedOut && (
        <p className="settings-hint upgrade-note">
          Your account is attached to checkout automatically so your upgrade can be linked to you. Once payment
          goes through, your plan updates on our end — this can take a few minutes if activation isn't fully
          automated yet.
        </p>
      )}
    </div>
  );
}
