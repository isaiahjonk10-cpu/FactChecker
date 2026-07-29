const VERDICT_LABEL = {
  TRUE: "TRUE",
  MOSTLY_TRUE: "MOSTLY TRUE",
  MISLEADING: "MISLEADING",
  FALSE: "FALSE",
  VERY_FALSE: "VERY FALSE",
  ABSURD: "ABSURD"
};

export default function ClaimCard({ index, claim, verdict, explanation, truth, isNew, speaker, speakerColor, sources }) {
  const verdictClass = "verdict-" + (verdict || "").toLowerCase().replace(/_/g, "-");
  return (
    <article className={`claim-card ${isNew ? "claim-card-enter" : ""}`}>
      <div className="claim-index">
        EXHIBIT {String(index).padStart(2, "0")}
        {speaker && <span className="claim-speaker" style={{ "--speaker-color": speakerColor }}>· {speaker}</span>}
      </div>
      <p className="claim-text">&ldquo;{claim}&rdquo;</p>
      <div className={`verdict-stamp ${verdictClass}`}>
        {VERDICT_LABEL[verdict] || verdict}
      </div>
      <div className="claim-body">
        <p className="claim-explanation">{explanation}</p>
        <p className="claim-truth"><span>The record:</span> {truth}</p>
        {sources && sources.length > 0 && (
          <div className="claim-sources">
            <span className="claim-sources-label">Check it yourself:</span>
            {sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="source-chip">{s.name} ↗</a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
