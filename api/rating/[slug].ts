import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRating, cors, fetchDLProtocols } from "../_lib/handler.js";
import { buildRawDataFromDL } from "../../server/data-ingestion.js";
import { computeRating } from "../../server/scoring.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  const slug = req.query.slug as string;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  try {
    // 1. Try curated first (full data, higher confidence)
    const curated = await getRating(slug);
    if (curated) return res.json(curated);

    // 2. On-demand: attempt scoring from DefiLlama data alone (low confidence)
    const dlProtocols = await fetchDLProtocols();
    const dlEntry = dlProtocols.find(
      (p) => p.slug === slug || p.name.toLowerCase() === slug.toLowerCase()
    );

    if (!dlEntry) {
      return res.status(404).json({
        error: `"${slug}" wasn't found in our database or on DefiLlama. Try searching by the protocol's exact name.`,
        notFound: true,
      });
    }

    // Build minimal raw data from DefiLlama only
    const rawData = await buildRawDataFromDL(dlEntry);
    const result = computeRating(rawData, {
      category: (dlEntry.category?.toLowerCase() ?? "other") as "lending" | "dex" | "yield" | "staking" | "cdp" | "bridge" | "other",
      chains: dlEntry.chains ?? [],
      description: dlEntry.description ?? `${dlEntry.name} is a DeFi protocol. Detailed curated data is not yet available.`,
      website: dlEntry.url ?? "",
      logoUrl: dlEntry.logo,
    });

    return res.json(result);
  } catch (err) {
    console.error(`/api/rating/${slug} error:`, err);
    res.status(500).json({ error: "Failed to compute rating" });
  }
}
