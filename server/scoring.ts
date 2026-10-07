// ===== DeFi Risk Rating — Scoring Engine =====
// Deterministic. Every output traces to a data point.

import type {
  ProtocolRawData,
  RatingResult,
  Grade,
  ConfidenceLevel,
  FactorScore,
  HardCap,
  SourceRecord,
} from "./types.js";

// ---- Auditor tiers ----
const TIER1_AUDITORS = new Set([
  "trail of bits", "trailofbits", "openZeppelin", "openzeppelin", "spearbit",
  "chainsecurity", "decurity", "zellic", "consensys diligence", "consensys",
]);
const TIER2_AUDITORS = new Set([
  "sigma prime", "sigmaprime", "peckshield", "certik", "quantstamp",
  "halborn", "sherlock", "cure53", "slowmist",
]);

function auditorTier(name: string): 1 | 2 | 3 {
  const lower = name.toLowerCase();
  for (const t1 of TIER1_AUDITORS) if (lower.includes(t1)) return 1;
  for (const t2 of TIER2_AUDITORS) if (lower.includes(t2)) return 2;
  return 3;
}

// ---- Factor 1: Smart Contract Security (0-25) ----
function scoreSmartContractSecurity(data: ProtocolRawData): FactorScore {
  let score = 0;
  const notes: string[] = [];
  let dataAvailable = false;

  // Time in production
  const maturity = data.codeMaturityMonths.value;
  if (maturity !== null) {
    dataAvailable = true;
    const matRounded = Math.floor(maturity);
    const matLabel = matRounded >= 24 ? `${Math.floor(matRounded / 12)}yr` : `${matRounded}mo`;
    if (maturity >= 36) { score += 8; notes.push(`${matLabel} in production`); }
    else if (maturity >= 18) { score += 6; notes.push(`${matLabel} in production`); }
    else if (maturity >= 6) { score += 4; notes.push(`${matLabel} in production`); }
    else { score += 2; notes.push(`only ${matLabel} in production`); }
  }

  // Contract verification
  if (data.contractsVerified.value === true) { score += 2; dataAvailable = true; }

  // Exploit history
  const exploits = data.exploitHistory.value;
  if (exploits !== null) {
    dataAvailable = true;
    if (exploits.length === 0) {
      score += 6;
      notes.push("no exploits on record");
    } else {
      for (const e of exploits) {
        if (e.resolved) score -= 3;
        else score -= 6;
      }
      const unresolved = exploits.filter((e) => !e.resolved).length;
      notes.push(`${exploits.length} exploit(s)${unresolved > 0 ? `, ${unresolved} unresolved` : " (resolved)"}`);
    }
  }

  // Bug bounty
  const bounty = data.bugBountyUSD.value;
  if (bounty !== null) {
    dataAvailable = true;
    if (bounty >= 1_000_000) { score += 5; notes.push(`$${(bounty / 1e6).toFixed(1)}M bug bounty`); }
    else if (bounty >= 250_000) { score += 3; }
    else if (bounty >= 50_000) { score += 2; }
    else if (bounty > 0) { score += 1; }
    // 0 = none, +0
  }

  score = Math.max(0, Math.min(25, score));
  const reason = notes.length > 0 ? notes.join("; ") : "limited data available";
  return { score, maxScore: 25, plainEnglishReason: reason, dataAvailable };
}

// ---- Factor 2: Liquidity (0-15) ----
function scoreLiquidity(data: ProtocolRawData): FactorScore {
  let score = 0;
  let dataAvailable = false;
  const notes: string[] = [];

  const tvl = data.tvlUSD.value;
  if (tvl !== null) {
    dataAvailable = true;
    if (tvl >= 1_000_000_000) { score += 5; notes.push(`$${(tvl / 1e9).toFixed(1)}B TVL`); }
    else if (tvl >= 100_000_000) { score += 4; notes.push(`$${(tvl / 1e6).toFixed(0)}M TVL`); }
    else if (tvl >= 10_000_000) { score += 3; }
    else if (tvl >= 1_000_000) { score += 2; }
    else { score += 1; notes.push("low TVL"); }
  }

  const change30d = data.tvl30dChange.value;
  if (change30d !== null) {
    dataAvailable = true;
    if (change30d > -10) { score += 3; }
    else if (change30d > -30) { score += 1; notes.push(`TVL ${change30d.toFixed(0)}% in 30d`); }
    else { notes.push(`TVL dropped ${Math.abs(change30d).toFixed(0)}% in 30d`); }
  }

  const s10k = data.slippage10k.value;
  if (s10k !== null) {
    dataAvailable = true;
    if (s10k < 0.1) { score += 4; }
    else if (s10k < 0.5) { score += 3; }
    else if (s10k < 1) { score += 2; }
    else if (s10k < 2) { score += 1; }
    else { notes.push(`high slippage at $10k`); }
  } else {
    score += 2; // neutral
  }

  const s100k = data.slippage100k.value;
  if (s100k !== null) {
    dataAvailable = true;
    if (s100k < 0.5) { score += 3; }
    else if (s100k < 1) { score += 2; }
    else if (s100k < 2) { score += 1; }
    else { notes.push(`high slippage at $100k`); }
  } else {
    score += 1; // neutral
  }

  score = Math.max(0, Math.min(15, score));
  const reason = notes.length > 0 ? notes.join("; ") : (tvl ? `$${(tvl / 1e6).toFixed(0)}M TVL, stable` : "no liquidity data");
  return { score, maxScore: 15, plainEnglishReason: reason, dataAvailable };
}

// ---- Factor 3: Token Concentration (0-15) ----
function scoreTokenConcentration(data: ProtocolRawData): FactorScore {
  let score = 15;
  let dataAvailable = false;
  const notes: string[] = [];

  const top10 = data.top10HolderPct.value;
  if (top10 !== null) {
    dataAvailable = true;
    if (top10 > 80) { score -= 8; notes.push(`top 10 wallets hold ${top10.toFixed(0)}% of supply`); }
    else if (top10 > 60) { score -= 5; notes.push(`top 10 wallets hold ${top10.toFixed(0)}%`); }
    else if (top10 > 40) { score -= 3; }
    else if (top10 > 20) { score -= 1; }
  }

  const insider = data.insiderTeamPct.value;
  if (insider !== null) {
    dataAvailable = true;
    if (insider > 40) { score -= 4; notes.push(`${insider.toFixed(0)}% team/insider allocation`); }
    else if (insider > 25) { score -= 2; }
    else if (insider > 10) { score -= 1; }
  }

  if (data.nearUnlockRiskFlag.value === true) {
    score -= 3;
    notes.push("large token unlock coming within 90 days");
    dataAvailable = true;
  }

  if (data.hasPublicVestingSchedule.value === false) {
    score -= 1;
    notes.push("no public vesting schedule");
  }

  // No token = neutral score of 10 (unknown concentration; not risky but not verified)
  if (top10 === null && insider === null) {
    score = 10;
    notes.push("no token or holder data unavailable");
  }

  score = Math.max(0, Math.min(15, score));
  const reason = notes.length > 0 ? notes.join("; ") : "token distribution appears healthy";
  return { score, maxScore: 15, plainEnglishReason: reason, dataAvailable };
}

// ---- Factor 4: Governance & Admin Control (0-10) ----
function scoreGovernanceAdmin(data: ProtocolRawData): FactorScore {
  let score = 0;
  let dataAvailable = false;
  const notes: string[] = [];

  if (data.hasMultisig.value !== null) {
    dataAvailable = true;
    if (data.hasMultisig.value) { score += 3; }
    else { notes.push("no multisig"); }
  }

  const tl = data.timelockDays.value;
  if (tl !== null) {
    dataAvailable = true;
    if (tl >= 7) { score += 4; notes.push(`${tl}-day timelock`); }
    else if (tl >= 2) { score += 3; notes.push(`${tl}-day timelock`); }
    else if (tl >= 1) { score += 2; }
    else { notes.push("no timelock"); }
  }

  if (data.isDecentralized.value === true) {
    score += 2;
    notes.push("DAO-governed");
    dataAvailable = true;
  }

  if (data.isUpgradeable.value && (tl === null || tl === 0)) {
    score -= 2;
  }

  score = Math.max(0, Math.min(10, score));
  const reason = notes.length > 0 ? notes.join("; ") : "governance structure unknown";
  return { score, maxScore: 10, plainEnglishReason: reason, dataAvailable };
}

// ---- Factor 5: Audits Quality (0-10) ----
function scoreAudits(data: ProtocolRawData): FactorScore {
  let score = 0;
  let dataAvailable = false;
  const notes: string[] = [];

  const audits = data.audits.value;
  if (audits !== null) {
    dataAvailable = true;
    if (audits.length === 0) {
      return { score: 0, maxScore: 10, plainEnglishReason: "no security audits found", dataAvailable: true };
    }

    // Credit up to 3 auditors
    const counted = audits.slice(0, 3);
    for (const a of counted) {
      const tier = auditorTier(a.auditor);
      if (tier === 1) score += 3;
      else if (tier === 2) score += 2;
      else score += 1;
    }
    notes.push(`${audits.length} audit(s) by ${audits.map((a) => a.auditor).join(", ")}`);

    // Recency bonus
    const now = Date.now();
    const mostRecent = audits
      .map((a) => new Date(a.date).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => b - a)[0];
    if (mostRecent) {
      const monthsAgo = (now - mostRecent) / (1000 * 60 * 60 * 24 * 30);
      if (monthsAgo < 12) { score += 1; }
    }

    // Unresolved criticals
    const totalUnresolved = audits.reduce((s, a) => s + a.unresolvedCritical, 0);
    if (totalUnresolved > 0) {
      score -= 5 * totalUnresolved;
      notes.push(`${totalUnresolved} unresolved critical finding(s)`);
    }
  }

  score = Math.max(0, Math.min(10, score));
  const reason = notes.length > 0 ? notes.join("; ") : "no audit data";
  return { score, maxScore: 10, plainEnglishReason: reason, dataAvailable };
}

// ---- Factor 6: Protocol History (0-10) ----
function scoreProtocolHistory(data: ProtocolRawData): FactorScore {
  let score = 0;
  let dataAvailable = false;
  const notes: string[] = [];

  const age = data.ageMonths.value;
  if (age !== null) {
    dataAvailable = true;
    if (age >= 48) { score += 4; notes.push(`${Math.floor(age / 12)}yr old protocol`); }
    else if (age >= 24) { score += 3; }
    else if (age >= 12) { score += 2; }
    else if (age >= 6) { score += 1; }
  }

  const incidents = data.pastIncidentCount.value;
  const responseScore = data.incidentResponseScore.value;
  if (incidents !== null) {
    dataAvailable = true;
    if (incidents === 0) {
      score += 4;
      notes.push("no past incidents");
    } else if (responseScore !== null && responseScore >= 7) {
      score += 3;
      notes.push(`${incidents} incident(s), handled well`);
    } else if (responseScore !== null && responseScore >= 4) {
      score += 2;
      notes.push(`${incidents} incident(s), response was mixed`);
    } else if (responseScore !== null) {
      score += 1;
      notes.push(`${incidents} incident(s), poor response`);
    } else {
      // Incidents recorded but no curated response score — give neutral credit
      score += 2;
      notes.push(`${incidents} incident(s), response not assessed`);
    }
  }

  score = Math.max(0, Math.min(10, score));
  const reason = notes.length > 0 ? notes.join("; ") : "protocol history unknown";
  return { score, maxScore: 10, plainEnglishReason: reason, dataAvailable };
}

// ---- Factor 7: Yield Sustainability (0-10) ----
function scoreYieldSustainability(data: ProtocolRawData): FactorScore {
  let score = 5; // neutral default
  let dataAvailable = false;
  const notes: string[] = [];

  const apyBase = data.apyBase.value;
  const apyReward = data.apyReward.value;
  const apyTotal = data.apyTotal.value;

  // Non-yield protocol: DEX / infra scores 7 by default
  const isYieldProtocol = apyTotal !== null && apyTotal > 0;

  if (!isYieldProtocol) {
    return {
      score: 7,
      maxScore: 10,
      plainEnglishReason: "no yield product — yield risk does not apply",
      dataAvailable: false,
    };
  }

  dataAvailable = true;

  if (apyBase !== null && apyReward !== null && (apyBase + apyReward) > 0) {
    const realFraction = apyBase / (apyBase + apyReward);
    if (realFraction >= 0.8) { score = 10; notes.push(`${(realFraction * 100).toFixed(0)}% real yield`); }
    else if (realFraction >= 0.5) { score = 8; notes.push(`${(realFraction * 100).toFixed(0)}% real yield`); }
    else if (realFraction >= 0.3) { score = 6; }
    else if (realFraction >= 0.1) { score = 4; notes.push("heavy token emission reliance"); }
    else { score = 2; notes.push("almost entirely token emissions"); }
  } else if (apyTotal !== null) {
    // Only total APY available
    notes.push(`${apyTotal.toFixed(1)}% APY, breakdown unknown`);
    score = 5;
  }

  if (data.rewardTokenIsNative.value === true) {
    score -= 1;
    notes.push("rewards paid in own token (circular risk)");
  }
  if (apyTotal !== null && apyTotal > 100) {
    score -= 2;
    notes.push(`${apyTotal.toFixed(0)}% APY is unsustainably high`);
  }

  score = Math.max(0, Math.min(10, score));
  const reason = notes.length > 0 ? notes.join("; ") : `${apyTotal?.toFixed(1) ?? "?"}% APY`;
  return { score, maxScore: 10, plainEnglishReason: reason, dataAvailable };
}

// ---- Factor 8: Dependencies (0-5) ----
function scoreDependencies(data: ProtocolRawData): FactorScore {
  let score = 5;
  let dataAvailable = false;
  const notes: string[] = [];

  if (data.usesExternalOracle.value) {
    dataAvailable = true;
    const oracle = (data.oracleProvider.value ?? "").toLowerCase();
    if (oracle === "custom" || oracle === "unknown") {
      score -= 2;
      notes.push("custom/unknown oracle (higher manipulation risk)");
    } else if (oracle === "uniswap-twap" || oracle === "twap") {
      score -= 1;
      notes.push("TWAP oracle (flash-loan risk in thin markets)");
    } else if (oracle === "chainlink" || oracle === "pyth") {
      notes.push(`uses ${oracle} oracle`);
    }
  }

  if (data.usesBridge.value) {
    score -= 1;
    notes.push("relies on a cross-chain bridge");
    dataAvailable = true;
  }

  const deps = data.dependsOnExternalProtocols.value;
  if (deps !== null) {
    dataAvailable = true;
    if (deps.length >= 3) { score -= 2; notes.push(`depends on ${deps.length} external protocols`); }
    else if (deps.length === 2) { score -= 1; }
  }

  score = Math.max(0, Math.min(5, score));
  const reason = notes.length > 0 ? notes.join("; ") : "minimal external dependencies";
  return { score, maxScore: 5, plainEnglishReason: reason, dataAvailable };
}

// ---- Hard Caps ----
function applyHardCaps(
  data: ProtocolRawData,
  rawScore: number,
  _factorAudits: FactorScore
): { finalScore: number; caps: HardCap[] } {
  const caps: HardCap[] = [];
  let finalScore = rawScore;

  // Honeypot or unrestricted mint by single EOA
  if (data.adminCanMintUnrestricted.value === true) {
    caps.push({
      type: "UNRESTRICTED_MINT",
      label: "Admin can mint tokens without restriction",
      effectiveGrade: "F",
    });
    finalScore = Math.min(finalScore, 30);
  }

  // Unresolved critical exploit
  const unresolvedExploit = (data.exploitHistory.value ?? []).some((e) => !e.resolved);
  if (unresolvedExploit) {
    caps.push({
      type: "UNRESOLVED_EXPLOIT",
      label: "Active unresolved exploit",
      effectiveGrade: "F",
    });
    finalScore = Math.min(finalScore, 30);
  }

  // Admin key can upgrade/drain with no timelock
  if (data.adminCanDrainWithoutTimelock.value === true) {
    caps.push({
      type: "ADMIN_KEY_NO_TIMELOCK",
      label: "Admin key can upgrade or drain funds with no timelock",
      effectiveGrade: "C",
    });
    finalScore = Math.min(finalScore, 69);
  } else if (
    data.isUpgradeable.value === true &&
    (data.timelockDays.value === null || data.timelockDays.value === 0)
  ) {
    caps.push({
      type: "UPGRADEABLE_NO_TIMELOCK",
      label: "Contract is upgradeable with no timelock protection",
      effectiveGrade: "C",
    });
    finalScore = Math.min(finalScore, 69);
  }

  // No audit and under 6 months old
  const noAudit = data.audits.value !== null && data.audits.value.length === 0;
  const isNew =
    data.codeMaturityMonths.value !== null && data.codeMaturityMonths.value < 6;
  if (noAudit && isNew) {
    caps.push({
      type: "UNAUDITED_AND_NEW",
      label: "No audit and less than 6 months old",
      effectiveGrade: "D",
    });
    finalScore = Math.min(finalScore, 54);
  }

  return { finalScore, caps };
}

// ---- Grade from score ----
function gradeFromScore(score: number): Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

// ---- Confidence from data coverage ----
function computeConfidence(data: ProtocolRawData): ConfidenceLevel {
  const checks = [
    data.audits.value !== null,
    data.exploitHistory.value !== null,
    data.tvlUSD.value !== null,
    data.top10HolderPct.value !== null,
    data.hasMultisig.value !== null,
    data.ageMonths.value !== null,
    data.apyTotal.value !== null || data.apyBase.value !== null,
    data.usesExternalOracle.value !== undefined,
  ];
  const count = checks.filter(Boolean).length;
  if (count >= 6) return "high";
  if (count >= 4) return "medium";
  return "low";
}

// ---- Top reasons / red flags generator ----
function generateNarrative(
  data: ProtocolRawData,
  factorScores: RatingResult["factorScores"],
  caps: HardCap[]
): { topReasons: string[]; redFlags: string[]; whatWouldChangeRating: string[] } {
  const topReasons: string[] = [];
  const redFlags: string[] = [];
  const whatWould: string[] = [];

  // Positive signals
  if (factorScores.smartContractSecurity.score >= 20)
    topReasons.push("Long track record with no unresolved exploits");
  if (factorScores.audits.score >= 8)
    topReasons.push("Multiple reputable security audits completed");
  if (factorScores.liquidity.score >= 12)
    topReasons.push("Deep liquidity makes it easy to enter and exit");
  if (factorScores.governanceAdmin.score >= 8)
    topReasons.push("Strong governance with multisig and timelock protections");

  // Negative signals → red flags
  caps.forEach((c) => redFlags.push(c.label));

  const exploits = data.exploitHistory.value ?? [];
  if (exploits.length > 0) {
    const unresolved = exploits.filter((e) => !e.resolved);
    if (unresolved.length > 0)
      redFlags.push(`${unresolved.length} unresolved exploit(s) on record`);
    else
      redFlags.push(`${exploits.length} past exploit(s) — marked resolved`);
  }

  if ((data.top10HolderPct.value ?? 0) > 60)
    redFlags.push("Token heavily concentrated in a small number of wallets");

  if (data.timelockDays.value === 0 && data.isUpgradeable.value)
    redFlags.push("Contracts can be upgraded with no delay or community vote");

  if (factorScores.yieldSustainability.score <= 3)
    redFlags.push("Yields are mostly paid in the protocol's own token (inflation risk)");

  if ((data.apyTotal.value ?? 0) > 100)
    redFlags.push(`Advertised APY of ${data.apyTotal.value?.toFixed(0)}% is unsustainably high`);

  if (factorScores.audits.score === 0 && data.audits.value?.length === 0)
    redFlags.push("No independent security audit found");

  // What would change the rating
  if (data.timelockDays.value === 0)
    whatWould.push("Add a 2–7 day timelock on admin functions");
  if (!data.hasMultisig.value)
    whatWould.push("Move admin key to a multisig wallet");
  if (!data.bugBountyUSD.value)
    whatWould.push("Launch a public bug bounty program");
  if (data.audits.value?.length === 0)
    whatWould.push("Complete an audit by a tier-1 security firm");
  if (exploits.some((e) => !e.resolved))
    whatWould.push("Fully resolve open exploits and publish a post-mortem");
  if ((data.apyTotal.value ?? 0) > 100)
    whatWould.push("Reduce token emission rate to a sustainable level");

  // Trim and de-dup
  const dedup = (arr: string[]) => [...new Set(arr)];

  return {
    topReasons: dedup(topReasons).slice(0, 3),
    redFlags: dedup(redFlags),
    whatWouldChangeRating: dedup(whatWould).slice(0, 4),
  };
}

// ---- Collect all sources ----
function collectSources(data: ProtocolRawData): SourceRecord[] {
  const fields: [string, { source: string; fetchedAt: string; confidence: string }][] = [
    ["audits", data.audits],
    ["bugBountyUSD", data.bugBountyUSD],
    ["exploitHistory", data.exploitHistory],
    ["codeMaturityMonths", data.codeMaturityMonths],
    ["tvlUSD", data.tvlUSD],
    ["tvl30dChange", data.tvl30dChange],
    ["top10HolderPct", data.top10HolderPct],
    ["hasMultisig", data.hasMultisig],
    ["timelockDays", data.timelockDays],
    ["ageMonths", data.ageMonths],
    ["apyTotal", data.apyTotal],
    ["apyBase", data.apyBase],
    ["usesExternalOracle", data.usesExternalOracle],
  ];
  return fields.map(([field, dp]) => ({
    field,
    source: dp.source,
    fetchedAt: dp.fetchedAt,
    confidence: dp.confidence as "high" | "medium" | "low",
  }));
}

// ===== MAIN EXPORT =====
export function computeRating(
  data: ProtocolRawData,
  meta: {
    category: string;
    chains: string[];
    description: string;
    website: string;
    logoUrl?: string;
  }
): RatingResult {
  const f1 = scoreSmartContractSecurity(data);
  const f2 = scoreLiquidity(data);
  const f3 = scoreTokenConcentration(data);
  const f4 = scoreGovernanceAdmin(data);
  const f5 = scoreAudits(data);
  const f6 = scoreProtocolHistory(data);
  const f7 = scoreYieldSustainability(data);
  const f8 = scoreDependencies(data);

  const rawScore = f1.score + f2.score + f3.score + f4.score + f5.score + f6.score + f7.score + f8.score;

  const { finalScore, caps } = applyHardCaps(data, rawScore, f5);

  const factorScores = {
    smartContractSecurity: f1,
    liquidity: f2,
    tokenConcentration: f3,
    governanceAdmin: f4,
    audits: f5,
    protocolHistory: f6,
    yieldSustainability: f7,
    dependencies: f8,
  };

  const { topReasons, redFlags, whatWouldChangeRating } = generateNarrative(data, factorScores, caps);

  return {
    protocolId: data.protocolId,
    protocolName: data.protocolName,
    category: meta.category as RatingResult["category"],
    chains: meta.chains,
    description: meta.description,
    website: meta.website,
    logoUrl: meta.logoUrl,
    computedAt: new Date().toISOString(),
    grade: gradeFromScore(finalScore),
    score: Math.round(finalScore),
    confidence: computeConfidence(data),
    hardCapsTriggered: caps,
    factorScores,
    topReasons,
    redFlags,
    whatWouldChangeRating,
    sources: collectSources(data),
    tvlUSD: data.tvlUSD.value ?? undefined,
  };
}
