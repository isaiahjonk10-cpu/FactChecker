import { useState, useEffect } from "react";
import { loadHistory, deleteSession } from "../lib/storage.js";
import ClaimCard from "../components/ClaimCard.jsx";

function fmtDate(ts) {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(start, end) {
  if (!start || !end) return "";
  const mins = Math.round((end - start) / 60000);
  return mins < 1 ? "under a minute" : `${mins} min`;
}

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => { setSessions(loadHistory()); }, []);

  function handleDelete(id, e) {
    e.stopPropagation();
    setSessions(deleteSession(id));
    if (openId === id) setOpenId(null);
  }

  if (!sessions.length) {
    return (
      <div className="page history-page">
        <div className="empty-note">No sessions yet. Start a debate and it'll show up here once you end it.</div>
      </div>
    );
  }

  return (
    <div className="page history-page">
      <h1 className="page-title">Debate History</h1>
      <div className="session-list">
        {sessions.map(s => {
          const trueCt = s.claims.filter(c => c.verdict === "TRUE").length;
          const falseCt = s.claims.filter(c => c.verdict === "FALSE").length;
          const misCt = s.claims.filter(c => c.verdict === "MISLEADING").length;
          const isOpen = openId === s.id;
          return (
            <div key={s.id} className="session-block">
              <button className="session-row" onClick={() => setOpenId(isOpen ? null : s.id)}>
                <div className="session-row-main">
                  <div className="session-title">{s.title}</div>
                  <div className="session-meta">
                    {fmtDate(s.startedAt)} · {fmtDuration(s.startedAt, s.endedAt)} · {s.claims.length} claim{s.claims.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="session-tally">
                  {trueCt > 0 && <span className="tally-chip tally-true">{trueCt} true</span>}
                  {falseCt > 0 && <span className="tally-chip tally-false">{falseCt} false</span>}
                  {misCt > 0 && <span className="tally-chip tally-misleading">{misCt} misleading</span>}
                  <button className="session-delete" onClick={e => handleDelete(s.id, e)} title="Delete session">✕</button>
                </div>
              </button>

              {isOpen && (
                <div className="session-detail">
                  {s.claims.length === 0
                    ? <div className="empty-note">No claims were detected in this session.</div>
                    : s.claims.map((c, i) => (
                        <ClaimCard key={i} index={i + 1} claim={c.claim} verdict={c.verdict} explanation={c.explanation} truth={c.truth} />
                      ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
