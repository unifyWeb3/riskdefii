import type { VercelRequest, VercelResponse } from "@vercel/node";

// Instant health check — no dependencies, responds immediately on Vercel.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, ts: Date.now() });
}
