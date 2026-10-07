import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, BarChart2, GitCompare, BookOpen, ExternalLink, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchProtocols, fetchRating, compareProtocols } from "./api";
import type { ProtocolListItem, RatingResult } from "./types";
import { SearchBar } from "./components/SearchBar";
import { Leaderboard } from "./components/Leaderboard";
import { RatingPage } from "./components/RatingPage";
import { CompareView } from "./components/CompareView";
import { MethodologyPage } from "./components/MethodologyPage";


type View = "leaderboard" | "rating" | "compare" | "methodology";

export default function App() {
  const [view, setView] = useState<View>("leaderboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  // On Vercel the API routes are always available — no warmup polling needed.
  // We do a single health check; if it fails after a short grace period we show an error.
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setBackendError(true), 12000);
    fetch("/api/health")
      .then((r) => { if (r.ok) { clearTimeout(timeout); setBackendReady(true); } })
      .catch(() => { /* timeout will handle it */ });
    return () => clearTimeout(timeout);
  }, []);

  // Fetch leaderboard
  const {
    data: protocols,
    isLoading: loadingProtocols,
  } = useQuery<ProtocolListItem[]>({
    queryKey: ["protocols"],
    queryFn: fetchProtocols,
    enabled: backendReady,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch individual rating
  const {
    data: rating,
    isLoading: loadingRating,
    error: ratingError,
  } = useQuery<RatingResult, Error>({
    queryKey: ["rating", selectedId],
    queryFn: () => fetchRating(selectedId!),
    enabled: backendReady && selectedId !== null,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  // Fetch compare ratings
  const {
    data: compareRatings,
    isLoading: loadingCompare,
  } = useQuery<RatingResult[]>({
    queryKey: ["compare", compareIds],
    queryFn: () => compareProtocols(compareIds),
    enabled: backendReady && compareIds.length >= 2 && view === "compare",
    staleTime: 30 * 60 * 1000,
  });

  const handleSelectProtocol = useCallback((id: string) => {
    setSelectedId(id);
    setView("rating");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleToggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }, []);

  // Stats from leaderboard
  const stats = protocols ? {
    total: protocols.length,
    gradeA: protocols.filter((p) => p.grade === "A").length,
    gradeF: protocols.filter((p) => p.grade === "F").length,
    avgScore: Math.round(protocols.reduce((s, p) => s + p.score, 0) / protocols.length),
  } : null;

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg-gradient)" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0d1b2f]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <button
            onClick={() => { setView("leaderboard"); setSelectedId(null); }}
            className="flex items-center gap-2.5 font-semibold display text-[var(--ink)]"
          >
            <Shield size={18} className="text-[var(--accent)]" />
            <span className="hidden sm:inline">DeFi Risk</span>
            <span className="sm:hidden">Risk</span>
          </button>

          <div className="flex items-center gap-1">
            <NavButton active={view === "leaderboard"} onClick={() => { setView("leaderboard"); setSelectedId(null); }} icon={<BarChart2 size={14} />} label="Ratings" />
            <NavButton
              active={view === "compare"}
              onClick={() => setView("compare")}
              icon={<GitCompare size={14} />}
              label={compareIds.length > 0 ? `Compare (${compareIds.length})` : "Compare"}
              badge={compareIds.length > 0}
            />
            <NavButton active={view === "methodology"} onClick={() => setView("methodology")} icon={<BookOpen size={14} />} label="How It Works" />
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-16">
        {/* Backend loading / error */}
        {!backendReady && !backendError && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[var(--accent)] rounded-full animate-spin" />
            <p className="text-[var(--subtle)] text-sm">Starting scoring engine…</p>
          </div>
        )}
        {backendError && (
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/[0.06] p-6 text-center">
            <AlertTriangle size={20} className="text-[var(--danger)] mx-auto mb-2" />
            <p className="text-[var(--ink-2)] font-medium">Backend unavailable</p>
            <p className="text-sm text-[var(--muted)] mt-1">The scoring engine didn't start. Please refresh the page.</p>
          </div>
        )}

        {backendReady && (
          <AnimatePresence mode="wait">
            {/* Leaderboard view */}
            {view === "leaderboard" && (
              <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                {/* Hero */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-bold display text-balance" style={{ letterSpacing: "-0.03em" }}>
                      <span className="text-[var(--ink)]">DeFi</span>{" "}
                      <span className="text-[var(--accent)]">Risk Ratings</span>
                    </h1>
                    <p className="text-[var(--muted)] text-pretty max-w-xl">
                      Independent risk grades for DeFi protocols. Know the risk before you commit your money.
                    </p>
                  </div>

                  {/* Search */}
                  <div className="max-w-xl">
                    <SearchBar onSelect={handleSelectProtocol} autoFocus={false} />
                  </div>

                  {/* Stats strip */}
                  {stats && (
                    <div className="flex flex-wrap gap-4">
                      <StatChip label="Protocols rated" value={String(stats.total)} />
                      <StatChip label="Grade A" value={String(stats.gradeA)} color="text-[#5fb97a]" />
                      <StatChip label="Grade F" value={String(stats.gradeF)} color="text-[#e86d7a]" />
                      <StatChip label="Avg score" value={String(stats.avgScore)} />
                    </div>
                  )}
                </div>

                <Leaderboard
                  protocols={protocols ?? []}
                  onSelect={handleSelectProtocol}
                  compareIds={compareIds}
                  onToggleCompare={handleToggleCompare}
                  loading={loadingProtocols}
                />

                {/* Compare CTA if items selected */}
                {compareIds.length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
                  >
                    <button
                      onClick={() => setView("compare")}
                      className="flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--accent)] text-[#0d1b2f] font-semibold text-sm shadow-2xl hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      <GitCompare size={15} />
                      Compare {compareIds.length} protocols
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Rating view */}
            {view === "rating" && (
              <motion.div key="rating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {ratingError && !loadingRating ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => { setView("leaderboard"); setSelectedId(null); }}
                      className="flex items-center gap-2 text-sm text-[var(--subtle)] hover:text-[var(--muted)] transition-colors"
                    >
                      ← All protocols
                    </button>
                    <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/[0.06] p-6 text-center space-y-2">
                      <AlertTriangle size={20} className="text-[var(--danger)] mx-auto" />
                      <p className="text-[var(--ink-2)] font-medium">Protocol not found</p>
                      <p className="text-sm text-[var(--muted)]">{ratingError.message}</p>
                    </div>
                  </div>
                ) : (
                  <RatingPage
                    rating={rating!}
                    onBack={() => { setView("leaderboard"); setSelectedId(null); }}
                    loading={loadingRating || !rating}
                  />
                )}
              </motion.div>
            )}

            {/* Compare view */}
            {view === "compare" && (
              <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold display text-[var(--ink)]">Compare Protocols</h1>
                  <p className="text-sm text-[var(--muted)] mt-1">Side-by-side risk factor breakdown</p>
                </div>
                {compareIds.length < 2 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center text-[var(--subtle)] text-sm">
                    Go to the <button onClick={() => setView("leaderboard")} className="text-[var(--accent)] hover:underline">ratings list</button> and click "+" on 2–3 protocols to compare them here.
                  </div>
                ) : loadingCompare ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-[var(--accent)] rounded-full animate-spin" />
                    <p className="text-[var(--subtle)] text-sm">Loading comparison…</p>
                  </div>
                ) : (
                  <CompareView
                    ratings={compareRatings ?? []}
                    onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
                    onSelectProtocol={handleSelectProtocol}
                  />
                )}
              </motion.div>
            )}

            {/* Methodology view */}
            {view === "methodology" && (
              <motion.div key="methodology" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <MethodologyPage onBack={() => setView("leaderboard")} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] bg-[#0a1628]/80">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--subtle)]">
          <div className="flex items-center gap-2">
            <Shield size={12} className="text-[var(--accent)]" />
            <span>DeFi Risk Ratings — independent, data-driven, no paid placement</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setView("methodology")} className="hover:text-[var(--muted)] transition-colors">Methodology</button>
            <a href="https://defillama.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--muted)] transition-colors">
              Data: DefiLlama <ExternalLink size={10} />
            </a>
          </div>
          <p className="text-center sm:text-right max-w-xs">
            This is informational data, not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-white/10 text-[var(--ink)]"
          : "text-[var(--subtle)] hover:text-[var(--muted)] hover:bg-white/[0.05]"
      }`}
    >
      <span className="relative">
        {icon}
        {badge && (
          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        )}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatChip({ label, value, color = "text-[var(--ink-2)]" }: { label: string; value: string; color?: string }) {
  return (
    <div className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08]">
      <span className={`font-bold tabular-nums display text-sm ${color}`}>{value}</span>
      <span className="text-xs text-[var(--subtle)] ml-1.5">{label}</span>
    </div>
  );
}
