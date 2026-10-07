import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRating, cors } from "../_lib/handler.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  const slug = req.query.slug as string;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  try {
    const result = await getRating(slug);
    if (!result) {
      return res.status(404).json({ error: `Protocol '${slug}' not found in our database.` });
    }
    res.json(result);
  } catch (err) {
    console.error(`/api/rating/${slug} error:`, err);
    res.status(500).json({ error: "Failed to compute rating" });
  }
}
