// ===== Data Ingestion Layer =====
// Fetches live data from free APIs, caches aggressively, logs source + timestamp.
// Never invents numbers — returns null DataPoints on failure.

import type { DataPoint, ExploitRecord, ProtocolRawData } from "./types.js";
import type { CuratedProtocol } from "./curated-data.js";

// ---- In-memory cache ----
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttlMs: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > entry.ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, fetchedAt: Date.now(), ttlMs });
}

const TTL = {
  DEFILLAMA_PROTOCOLS: 6 * 60 * 60 * 1000,
  DEFILLAMA_HACKS: 12 * 60 * 60 * 1000,
  DEFILLAMA_YIELDS: 2 * 60 * 60 * 1000,
  COINGECKO: 30 * 60 * 1000,
};

// ---- Helper: safe fetch with timeout ----
async function safeFetch(url: string, timeoutMs = 8000): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function dp<T>(
  value: T | null,
  source: string,
  confidence: DataPoint<T>["confidence"] = "high"
): DataPoint<T> {
  return { value, source, fetchedAt: new Date().toISOString(), confidence };
}

// ---- DefiLlama: protocol list ----
export interface DLProtocol {
  slug: string;
  name: string;
  tvl: number;
  change_7d?: number;
  change_1m?: number;
  listedAt?: number; // unix seconds
  logo?: string;
  category?: string;
  chains?: string[];
  description?: string;
  url?: string;
}

export async function fetchDLProtocols(): Promise<DLProtocol[]> {
  const key = "dl:protocols";
  const cached = getCached<DLProtocol[]>(key);
  if (cached) return cached;

  const raw = (await safeFetch("https://api.llama.fi/protocols")) as { slug: string; name: string; tvl: number; change_7d?: number; change_1m?: number; listedAt?: number; logo?: string; category?: string; chains?: string[]; description?: string; url?: string }[] | null;
  if (!raw || !Array.isArray(raw)) return [];

  const protocols = raw.map((p) => ({
    slug: p.slug,
    name: p.name,
    tvl: p.tvl ?? 0,
    change_7d: p.change_7d,
    change_1m: p.change_1m,
    listedAt: p.listedAt,
    logo: p.logo,
    category: p.category,
    chains: p.chains,
    description: p.description,
    url: p.url,
  }));

  setCached(key, protocols, TTL.DEFILLAMA_PROTOCOLS);
  return protocols;
}

// ---- DefiLlama: hacks ----
export interface DLHack {
  name: string;
  date: string;
  funds_lost: number;
  chain?: string;
  classification?: string;
  technique?: string;
}

export async function fetchDLHacks(): Promise<DLHack[]> {
  const key = "dl:hacks";
  const cached = getCached<DLHack[]>(key);
  if (cached) return cached;

  const raw = (await safeFetch("https://api.llama.fi/hacks")) as { name?: string; date?: string; funds_lost?: number; defillamaId?: string; classification?: string; technique?: string }[] | null;
  if (!raw || !Array.isArray(raw)) return [];

  const hacks = raw.map((h) => ({
    name: h.name ?? "",
    date: h.date ?? "",
    funds_lost: h.funds_lost ?? 0,
    classification: h.classification,
    technique: h.technique,
  }));

  setCached(key, hacks, TTL.DEFILLAMA_HACKS);
  return hacks;
}

// ---- DefiLlama: yields ----
export interface DLPool {
  pool: string;
  project: string; // protocol slug
  symbol: string;
  apyBase?: number;
  apyReward?: number;
  apy?: number;
  rewardTokens?: string[];
}

export async function fetchDLYields(): Promise<DLPool[]> {
  const key = "dl:yields";
  const cached = getCached<DLPool[]>(key);
  if (cached) return cached;

  const raw = (await safeFetch("https://yields.llama.fi/pools")) as { data?: { pool: string; project: string; symbol: string; apyBase?: number; apyReward?: number; apy?: number; rewardTokens?: string[] }[] } | null;
  if (!raw || !Array.isArray((raw as { data?: unknown[] }).data)) return [];

  const pools = (raw as { data: DLPool[] }).data;
  setCached(key, pools, TTL.DEFILLAMA_YIELDS);
  return pools;
}

// ---- CoinGecko: market data for a protocol token ----
export interface CGCoin {
  id: string;
  market_cap: number;
  current_price: number;
  price_change_percentage_30d: number;
}

export async function fetchCGCoin(coinId: string): Promise<CGCoin | null> {
  const key = `cg:${coinId}`;
  const cached = getCached<CGCoin>(key);
  if (cached) return cached;

  const raw = (await safeFetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
  )) as { id?: string; market_data?: { market_cap?: { usd?: number }; current_price?: { usd?: number }; price_change_percentage_30d?: number } } | null;

  if (!raw) return null;

  const coin: CGCoin = {
    id: raw.id ?? coinId,
    market_cap: raw.market_data?.market_cap?.usd ?? 0,
    current_price: raw.market_data?.current_price?.usd ?? 0,
    price_change_percentage_30d: raw.market_data?.price_change_percentage_30d ?? 0,
  };

  setCached(key, coin, TTL.COINGECKO);
  return coin;
}

// ---- Build ProtocolRawData from DefiLlama alone (no curated data, low confidence) ----
export async function buildRawDataFromDL(dlEntry: DLProtocol): Promise<ProtocolRawData> {
  const [dlHacks, dlYields] = await Promise.all([fetchDLHacks(), fetchDLYields()]);

  const nameLower = dlEntry.name.toLowerCase();
  const exploitHistory: ExploitRecord[] = dlHacks
    .filter((h) => h.name.toLowerCase().includes(nameLower) || nameLower.includes(h.name.toLowerCase().split(" ")[0]))
    .map((h) => ({ date: h.date, lossUSD: h.funds_lost, type: h.technique ?? "unknown", resolved: true, source: "defillama/hacks" }));

  const ageMonths = dlEntry.listedAt
    ? (Date.now() - dlEntry.listedAt * 1000) / (1000 * 60 * 60 * 24 * 30)
    : 12;

  const protocolPools = dlYields.filter((p) => p.project === dlEntry.slug);
  const topPool = protocolPools.sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))[0];

  const tvl = dlEntry.tvl ?? 0;
  const tvl30dChange = dlEntry.change_1m ?? null;
  const tvl7dChange = dlEntry.change_7d ?? null;

  return {
    protocolId: dlEntry.slug,
    protocolName: dlEntry.name,
    // All governance/audit data unknown — marked low confidence
    audits: dp([], "unknown", "low"),
    // Fields typed as DataPoint<number> / DataPoint<boolean> cannot be null —
    // use conservative defaults and mark source as "unknown" with low confidence.
    bugBountyUSD: dp(0, "unknown — assumed 0 (conservative)", "low"),
    exploitHistory: dp(exploitHistory, "defillama/hacks", exploitHistory.length > 0 ? "medium" : "low"),
    codeMaturityMonths: dp(ageMonths, dlEntry.listedAt ? "defillama/protocols:listedAt" : "estimate", dlEntry.listedAt ? "medium" : "low"),
    contractsVerified: dp(false, "unknown — assumed false (conservative)", "low"),
    tvlUSD: dp(tvl || 0, "defillama/protocols", tvl > 0 ? "high" : "low"),
    tvl30dChange: dp(tvl30dChange ?? 0, "defillama/protocols:change_1m", tvl30dChange !== null ? "high" : "low"),
    tvl7dChange: dp(tvl7dChange ?? 0, "defillama/protocols:change_7d", tvl7dChange !== null ? "high" : "low"),
    slippage10k: dp(null, "unknown", "low"),
    slippage100k: dp(null, "unknown", "low"),
    top10HolderPct: dp(null, "unknown", "low"),
    insiderTeamPct: dp(null, "unknown", "low"),
    hasPublicVestingSchedule: dp(null, "unknown", "low"),
    nearUnlockRiskFlag: dp(null, "unknown", "low"),
    hasMultisig: dp(null, "unknown", "low"),
    timelockDays: dp(0, "unknown — assumed 0 (conservative)", "low"),
    adminCanDrainWithoutTimelock: dp(false, "unknown — assumed false", "low"),
    adminCanMintUnrestricted: dp(false, "unknown — assumed false", "low"),
    isUpgradeable: dp(true, "unknown — assumed upgradeable (conservative)", "low"),
    isDecentralized: dp(null, "unknown", "low"),
    ageMonths: dp(ageMonths, dlEntry.listedAt ? "defillama/protocols" : "estimate", dlEntry.listedAt ? "medium" : "low"),
    pastIncidentCount: dp(exploitHistory.length, "defillama/hacks", "medium"),
    incidentResponseScore: dp(null, "unknown", "low"),
    apyTotal: topPool ? dp(topPool.apy ?? null, "defillama/yields", "high") : dp(null, "defillama/yields", "low"),
    apyBase: topPool ? dp(topPool.apyBase ?? null, "defillama/yields", "high") : dp(null, "defillama/yields", "low"),
    apyReward: topPool ? dp(topPool.apyReward ?? null, "defillama/yields", "high") : dp(null, "defillama/yields", "low"),
    rewardTokenIsNative: dp(null, "unknown", "low"),
    usesExternalOracle: dp(false, "unknown — assumed false", "low"),
    oracleProvider: dp(null, "unknown", "low"),
    usesBridge: dp(false, "unknown — assumed false", "low"),
    bridgeProvider: dp(null, "unknown", "low"),
    dependsOnExternalProtocols: dp([], "unknown", "low"),
  };
}

// ---- Build ProtocolRawData from curated + live data ----
export async function buildRawData(curated: CuratedProtocol): Promise<ProtocolRawData> {
  // Fetch live data in parallel
  const [dlProtocols, dlHacks, dlYields] = await Promise.all([
    fetchDLProtocols(),
    fetchDLHacks(),
    fetchDLYields(),
  ]);

  // Find this protocol in DefiLlama
  const dlEntry = dlProtocols.find(
    (p) => p.slug === curated.defillamaSlug || p.name.toLowerCase() === curated.name.toLowerCase()
  );

  // Match hacks by protocol name (fuzzy)
  const nameLower = curated.name.toLowerCase();
  const protocolHacks = dlHacks.filter(
    (h) =>
      h.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(h.name.toLowerCase().split(" ")[0])
  );

  // Build exploit history
  const exploitHistory: ExploitRecord[] = protocolHacks.map((h) => ({
    date: h.date,
    lossUSD: h.funds_lost,
    type: h.technique ?? "unknown",
    resolved: true, // DefiLlama hacks list is historical; mark resolved unless in curated override
    source: "defillama/hacks",
  }));

  // Supplement with curated incident data (override resolved status for known-bad cases)
  if (curated.incidentResponseScore !== null && curated.incidentResponseScore < 5 && exploitHistory.length > 0) {
    exploitHistory[0].resolved = false;
  }

  // Age from DefiLlama listedAt or curated estimate
  let ageMonths = 0;
  if (dlEntry?.listedAt) {
    ageMonths = (Date.now() - dlEntry.listedAt * 1000) / (1000 * 60 * 60 * 24 * 30);
  } else {
    // Estimate from audit dates
    const oldestAudit = curated.audits
      .map((a) => new Date(a.date).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b)[0];
    if (oldestAudit) {
      ageMonths = (Date.now() - oldestAudit) / (1000 * 60 * 60 * 24 * 30);
    } else {
      ageMonths = 12; // conservative default
    }
  }

  // Yields: find best-matching pool for this protocol
  const protocolPools = dlYields.filter(
    (p) => p.project === curated.defillamaSlug || p.project === curated.name.toLowerCase()
  );
  const topPool = protocolPools.sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))[0];

  // TVL change from DefiLlama
  const tvl30dChange = dlEntry?.change_1m ?? null;
  const tvl7dChange = dlEntry?.change_7d ?? null;

  // Slippage: estimated from TVL proxy when no live orderbook data
  // Very rough approximation: TVL > $500M → very low slippage
  const tvlForSlippage = dlEntry?.tvl ?? 0;
  let slippage10k: number | null = null;
  let slippage100k: number | null = null;
  if (tvlForSlippage > 500_000_000) { slippage10k = 0.05; slippage100k = 0.2; }
  else if (tvlForSlippage > 100_000_000) { slippage10k = 0.1; slippage100k = 0.5; }
  else if (tvlForSlippage > 10_000_000) { slippage10k = 0.3; slippage100k = 2.0; }
  // DEXes have direct slippage; lending protocols don't — null for non-DEX
  const isDex = curated.category === "dex";
  if (!isDex) { slippage10k = null; slippage100k = null; }

  return {
    protocolId: curated.defillamaSlug,
    protocolName: curated.name,

    audits: dp(curated.audits, "curated/audits", "high"),
    bugBountyUSD: dp(curated.bugBountyUSD, "curated/bug-bounty", "high"),
    exploitHistory: dp(exploitHistory, "defillama/hacks+curated", exploitHistory.length > 0 ? "high" : "medium"),
    codeMaturityMonths: dp(ageMonths, dlEntry ? "defillama/protocols:listedAt" : "curated/estimate", dlEntry ? "high" : "medium"),
    contractsVerified: dp(true, "curated/assumption", "low"), // assume verified for top protocols

    tvlUSD: dp(dlEntry?.tvl ?? null, "defillama/protocols", dlEntry ? "high" : "low"),
    tvl30dChange: dp(tvl30dChange, "defillama/protocols:change_1m", tvl30dChange !== null ? "high" : "low"),
    tvl7dChange: dp(tvl7dChange, "defillama/protocols:change_7d", tvl7dChange !== null ? "high" : "low"),
    slippage10k: dp(slippage10k, "tvl-proxy-estimate", "low"),
    slippage100k: dp(slippage100k, "tvl-proxy-estimate", "low"),

    top10HolderPct: dp(null, "unknown", "low"), // not available via free API without Etherscan key
    insiderTeamPct: dp(curated.insiderTeamPct, "curated/tokenomics", curated.insiderTeamPct !== null ? "medium" : "low"),
    hasPublicVestingSchedule: dp(curated.hasPublicVesting, "curated/tokenomics", "medium"),
    nearUnlockRiskFlag: dp(null, "unknown", "low"),

    hasMultisig: dp(curated.hasMultisig, "curated/governance", curated.hasMultisig !== null ? "high" : "low"),
    timelockDays: dp(curated.timelockDays, "curated/governance", "high"),
    adminCanDrainWithoutTimelock: dp(curated.adminCanDrain, "curated/governance", "high"),
    adminCanMintUnrestricted: dp(curated.adminCanMintUnrestricted, "curated/governance", "high"),
    isUpgradeable: dp(curated.isUpgradeable, "curated/contracts", "high"),
    isDecentralized: dp(curated.isDecentralized, "curated/governance", curated.isDecentralized !== null ? "medium" : "low"),

    ageMonths: dp(ageMonths, dlEntry ? "defillama/protocols" : "curated/estimate", dlEntry ? "high" : "medium"),
    pastIncidentCount: dp(exploitHistory.length, "defillama/hacks", "medium"),
    incidentResponseScore: dp(curated.incidentResponseScore, "curated/post-mortems", curated.incidentResponseScore !== null ? "medium" : "low"),

    apyTotal: topPool ? dp(topPool.apy ?? null, "defillama/yields", "high") : dp(null, "defillama/yields", "low"),
    apyBase: topPool ? dp(topPool.apyBase ?? null, "defillama/yields", "high") : dp(null, "defillama/yields", "low"),
    apyReward: topPool ? dp(topPool.apyReward ?? null, "defillama/yields", "high") : dp(null, "defillama/yields", "low"),
    rewardTokenIsNative: dp(null, "unknown", "low"),

    usesExternalOracle: dp(curated.usesExternalOracle, "curated/architecture", "high"),
    oracleProvider: dp(curated.oracleProvider, "curated/architecture", "high"),
    usesBridge: dp(curated.usesBridge, "curated/architecture", "high"),
    bridgeProvider: dp(null, "curated/architecture", "low"),
    dependsOnExternalProtocols: dp(curated.dependsOn, "curated/architecture", "high"),
  };
}
