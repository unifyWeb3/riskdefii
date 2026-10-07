// API client (talks to backend via Vite proxy)

import type { RatingResult, ProtocolListItem, SearchResult } from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}: request failed`);
  }
  return res.json() as Promise<T>;
}

export async function fetchProtocols(): Promise<ProtocolListItem[]> {
  const data = await get<{ protocols: ProtocolListItem[] }>("/api/protocols");
  return data.protocols;
}

export async function fetchRating(slug: string): Promise<RatingResult> {
  return get<RatingResult>(`/api/rating/${slug}`);
}

export async function searchProtocols(q: string): Promise<SearchResult[]> {
  if (!q || q.length < 2) return [];
  const data = await get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`);
  return data.results;
}

export async function compareProtocols(ids: string[]): Promise<RatingResult[]> {
  const data = await get<{ ratings: RatingResult[] }>(`/api/compare?ids=${ids.join(",")}`);
  return data.ratings;
}
