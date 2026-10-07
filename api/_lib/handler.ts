// Shared logic for all Vercel API routes.
// Vercel functions are stateless; we use a module-level in-memory cache that
// survives within a single lambda warm instance (typically seconds to minutes).

import { CURATED_PROTOCOLS, CURATED_MAP } from "../../server/curated-data.js";
import { buildRawData, fetchDLProtocols } from "../../server/data-ingestion.js";
import { computeRating } from "../../server/scoring.js";
import type { RatingResult } from "../../server/types.js";

// ---- Per-instance warm cache (not persistent across cold starts) ----
interface CacheEntry { result: RatingResult; ts: number }
const cache = new Map<string, CacheEntry>();
const TTL = 30 * 60 * 1000; // 30 min — conservative for serverless warm window

function fromCache(id: string): RatingResult | null {
  const e = cache.get(id);
  if (!e) return null;
  if (Date.now() - e.ts > TTL) { cache.delete(id); return null; }
  return e.result;
}

export async function getRating(slug: string): Promise<RatingResult | null> {
  const hit = fromCache(slug);
  if (hit) return hit;

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

  cache.set(slug, { result, ts: Date.now() });
  return result;
}

export { CURATED_PROTOCOLS, CURATED_MAP, fetchDLProtocols };

export function cors(res: { setHeader: (k: string, v: string) => void }) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  // Tell Vercel's edge cache to cache successful GETs for 10 minutes
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=120");
}
