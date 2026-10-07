import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRating, cors } from "./_lib/handler.js";
import type { RatingResult } from "../server/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  const ids = ((req.query.ids as string) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (ids.length < 2) {
    return res.status(400).json({ error: "Provide at least 2 protocol IDs to compare" });
  }

  try {
    const results = await Promise.all(ids.map((id) => getRating(id)));
    const ratings = results.filter((r): r is RatingResult => r !== null);
    res.json({ ratings });
  } catch (err) {
    console.error("/api/compare error:", err);
    res.status(500).json({ error: "Comparison failed" });
  }
}
