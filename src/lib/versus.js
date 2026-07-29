const VERDICT_WEIGHT = {
  TRUE: 2,
  MOSTLY_TRUE: 1,
  MISLEADING: 0,
  FALSE: -1,
  VERY_FALSE: -2,
  ABSURD: -3
};

const STRONG_VERDICTS = new Set(["TRUE", "MOSTLY_TRUE"]);
const MISTAKE_VERDICTS = new Set(["FALSE", "VERY_FALSE", "ABSURD"]);

export function scorePlayers(players, claimsBySpeaker) {
  const scores = players.map(p => {
    const claims = claimsBySpeaker[p.id] || [];
    const total = claims.length;
    const strong = claims.filter(c => STRONG_VERDICTS.has(c.verdict)).length;
    const mistakes = claims.filter(c => MISTAKE_VERDICTS.has(c.verdict)).length;
    const factsPct = total ? Math.round((strong / total) * 100) : 0;
    const weightedScore = claims.reduce((sum, c) => sum + (VERDICT_WEIGHT[c.verdict] ?? 0), 0);
    return { ...p, totalClaims: total, factsPct, strongArguments: strong, mistakes, weightedScore };
  });

  const withClaims = scores.filter(s => s.totalClaims > 0);
  let winnerId = null;
  if (withClaims.length >= 2) {
    const sorted = [...withClaims].sort((a, b) => b.weightedScore - a.weightedScore);
    if (sorted[0].weightedScore !== sorted[1].weightedScore) winnerId = sorted[0].id;
  }

  return { scores, winnerId };
}

export const PLAYER_COLORS = ["#4FD8E8", "#E0A93A", "#D9534F", "#3FAE6B", "#9B6DE8", "#E85D8A"];
