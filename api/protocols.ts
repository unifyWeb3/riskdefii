import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CURATED_PROTOCOLS, cors } from "./_lib/handler.js";

// Derive a static estimated grade from curated fields alone (no live API calls).
// This makes the leaderboard load instantly. Live scores are shown per-rating-page.
function estimateFromCurated(p: (typeof CURATED_PROTOCOLS)[number]): { grade: string; score: number; redFlagCount: number; hardCapCount: number } {
  let score = 55; // neutral baseline
  let hardCaps = 0;
  const redFlags: string[] = [];

  // Hard caps (override)
  if (p.adminCanMintUnrestricted) { hardCaps++; redFlags.push("unrestricted mint"); }
  if (p.adminCanDrain && p.timelockDays === 0) { hardCaps++; redFlags.push("admin drain no timelock"); }

  // Smart contract security proxy
  const auditCount = p.audits.length;
  const hasUnresolvedCritical = p.audits.some((a) => a.unresolvedCritical > 0);
  if (hasUnresolvedCritical) { hardCaps++; redFlags.push("unresolved critical"); }
  if (auditCount >= 3) score += 12;
  else if (auditCount === 2) score += 8;
  else if (auditCount === 1) score += 3;
  else { score -= 10; redFlags.push("no audits"); }

  // Bug bounty
  if (p.bugBountyUSD >= 1_000_000) score += 6;
  else if (p.bugBountyUSD >= 100_000) score += 3;
  else if (p.bugBountyUSD === 0) { score -= 3; redFlags.push("no bug bounty"); }

  // Governance
  if (p.timelockDays >= 7) score += 8;
  else if (p.timelockDays >= 2) score += 4;
  else if (p.timelockDays === 0 && p.adminCanDrain) { score -= 8; }

  if (p.hasMultisig) score += 3;
  if (p.isDecentralized) score += 4;

  // Token concentration
  if (p.insiderTeamPct !== null) {
    if (p.insiderTeamPct > 40) { score -= 8; redFlags.push("high insider allocation"); }
    else if (p.insiderTeamPct > 25) score -= 4;
    else score += 2;
  }

  // Age / incident history proxy
  if (p.incidentResponseScore !== null) {
    if (p.incidentResponseScore < 4) { score -= 8; redFlags.push("poor incident response"); }
    else if (p.incidentResponseScore >= 7) score += 4;
  }

  // Oracle/bridge dependency risk
  if (p.usesBridge) { score -= 5; redFlags.push("bridge dependency"); }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Hard cap overrides
  let grade: string;
  if (hardCaps > 0 && (p.adminCanMintUnrestricted || hasUnresolvedCritical)) {
    grade = "F"; score = Math.min(score, 30);
  } else if (hardCaps > 0) {
    grade = "C"; score = Math.min(score, 69);
  } else if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";

  return { grade, score, redFlagCount: redFlags.length, hardCapCount: hardCaps };
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  cors(res);

  const list = CURATED_PROTOCOLS.map((p) => {
    const est = estimateFromCurated(p);
    return {
      id: p.defillamaSlug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      grade: est.grade,
      score: est.score,
      confidence: "medium" as const,
      tvlUSD: null as number | null,
      redFlagCount: est.redFlagCount,
      hardCapCount: est.hardCapCount,
      logoUrl: p.logoUrl,
      computedAt: p.curatedAt,
    };
  });

  list.sort((a, b) => b.score - a.score);
  res.json({ protocols: list });
}
