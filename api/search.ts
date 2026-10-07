import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CURATED_PROTOCOLS, CURATED_MAP, fetchDLProtocols, cors } from "./_lib/handler.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  const q = ((req.query.q as string) ?? "").toLowerCase().trim();
  if (!q || q.length < 2) return res.json({ results: [] });

  try {
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
    console.error("/api/search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
}
