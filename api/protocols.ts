import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRating, CURATED_PROTOCOLS, cors } from "./_lib/handler.js";
import type { RatingResult } from "../server/types.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  cors(res);
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
    console.error("/api/protocols error:", err);
    res.status(500).json({ error: "Failed to fetch protocols" });
  }
}
