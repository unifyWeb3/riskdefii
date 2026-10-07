// ===== DeFi Risk Rating — Express Backend =====

import express from "express";
import { CURATED_PROTOCOLS, CURATED_MAP } from "./curated-data.js";
import { buildRawData, fetchDLProtocols } from "./data-ingestion.js";
import { computeRating } from "./scoring.js";
import type { RatingResult } from "./types.js";

const app = express();
app.use(express.json());

// ---- In-memory rating cache ----
interface RatingCacheEntry {
  result: RatingResult;
  computedAt: number;
}
const ratingCache = new Map<string, RatingCacheEntry>();
const RATING_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function getCachedRating(id: string): RatingResult | null {
  const entry = ratingCache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.computedAt > RATING_TTL_MS) {
    ratingCache.delete(id);
    return null;
  }
  return entry.result;
}

async function getRating(slug: string): Promise<RatingResult | null> {
  const cached = getCachedRating(slug);
  if (cached) return cached;

  const curated = CURATED_MAP.get(slug);
  if (!curated) return null;

  const rawData = await buildRawData(curated);
  const result = computeRating(rawData, {
    category: curated.category,
    chains: curated.chains,
    description: curated.description,
    website: curated.website,
    logoUrl: curated.logoUrl,
  });

  ratingCache.set(slug, { result, computedAt: Date.now() });
  return result;
}

// ---- Routes ----

// GET /api/health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// GET /api/protocols — list all curated protocols with minimal info (for leaderboard)
app.get("/api/protocols", async (_req, res) => {
  try {
    const results = await Promise.all(
      CURATED_PROTOCOLS.map((p) => getRating(p.defillamaSlug))
    );

    const list = results
      .filter((r): r is RatingResult => r !== null)
      .sort((a, b) => b.score - a.score)
      .map((r) => ({
        id: r.protocolId,
        name: r.protocolName,
        category: r.category,
        chains: r.chains,
        grade: r.grade,
        score: r.score,
        confidence: r.confidence,
        tvlUSD: r.tvlUSD,
        redFlagCount: r.redFlags.length,
        hardCapCount: r.hardCapsTriggered.length,
        logoUrl: r.logoUrl,
        computedAt: r.computedAt,
      }));

    res.json({ protocols: list });
  } catch (err) {
    console.error("GET /api/protocols error:", err);
    res.status(500).json({ error: "Failed to fetch protocols" });
  }
});

// GET /api/rating/:slug — full rating for a protocol
app.get("/api/rating/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const result = await getRating(slug);
    if (!result) {
      return res.status(404).json({ error: `Protocol '${slug}' not found in our database.` });
    }
    res.json(result);
  } catch (err) {
    console.error(`GET /api/rating/${req.params.slug} error:`, err);
    res.status(500).json({ error: "Failed to compute rating" });
  }
});

// GET /api/search?q=... — search by name across curated + DefiLlama
app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q as string ?? "").toLowerCase().trim();
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    // Search curated protocols first
    const curatedMatches = CURATED_PROTOCOLS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.defillamaSlug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    ).map((p) => ({
      id: p.defillamaSlug,
      name: p.name,
      category: p.category,
      isRated: true,
    }));

    // Search DefiLlama for unrated protocols
    const dlProtocols = await fetchDLProtocols();
    const dlMatches = dlProtocols
      .filter(
        (p) =>
          (p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)) &&
          !CURATED_MAP.has(p.slug)
      )
      .slice(0, 10)
      .map((p) => ({
        id: p.slug,
        name: p.name,
        category: p.category ?? "other",
        isRated: false,
        tvlUSD: p.tvl,
      }));

    res.json({ results: [...curatedMatches, ...dlMatches].slice(0, 20) });
  } catch (err) {
    console.error("GET /api/search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/compare?ids=aave-v3,uniswap-v3 — compare up to 3 protocols
app.get("/api/compare", async (req, res) => {
  try {
    const ids = (req.query.ids as string ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (ids.length < 2) {
      return res.status(400).json({ error: "Provide at least 2 protocol IDs to compare" });
    }

    const results = await Promise.all(ids.map((id) => getRating(id)));
    const ratings = results.filter((r): r is RatingResult => r !== null);

    res.json({ ratings });
  } catch (err) {
    console.error("GET /api/compare error:", err);
    res.status(500).json({ error: "Comparison failed" });
  }
});

// ---- Start server ----
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`DeFi Risk Rating API running on port ${PORT}`);
});
