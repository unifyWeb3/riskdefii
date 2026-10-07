import { motion } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import type { RatingResult } from "../types";
import { GradeBadge, gradeColor } from "./GradeBadge";

const FACTOR_LABELS = [
  { key: "smartContractSecurity" as const, label: "Smart Contract Security", max: 25 },
  { key: "liquidity" as const, label: "Liquidity", max: 15 },
  { key: "tokenConcentration" as const, label: "Token Concentration", max: 15 },
  { key: "governanceAdmin" as const, label: "Governance & Admin", max: 10 },
  { key: "audits" as const, label: "Audits", max: 10 },
  { key: "protocolHistory" as const, label: "Protocol History", max: 10 },
  { key: "yieldSustainability" as const, label: "Yield Sustainability", max: 10 },
  { key: "dependencies" as const, label: "Dependencies", max: 5 },
];

function formatTvl(v?: number): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return "—";
}

interface Props {
  ratings: RatingResult[];
  onRemove: (id: string) => void;
  onSelectProtocol: (id: string) => void;
}

export function CompareView({ ratings, onRemove, onSelectProtocol }: Props) {
  if (ratings.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center text-[var(--subtle)] text-sm">
        Select 2–3 protocols from the leaderboard to compare them side by side.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${ratings.length === 1 ? "grid-cols-1" : ratings.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {/* Protocol headers */}
        {ratings.map((r) => (
          <motion.div
            key={r.protocolId}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-white/10 bg-white/[0.05] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => onSelectProtocol(r.protocolId)}
                className="font-semibold text-[var(--ink)] hover:text-[var(--accent)] transition-colors text-left display text-sm leading-tight"
              >
                {r.protocolName}
              </button>
              <button
                onClick={() => onRemove(r.protocolId)}
                className="text-[var(--subtle)] hover:text-[var(--danger)] transition-colors shrink-0 mt-0.5"
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <GradeBadge grade={r.grade} size="lg" />
              <span className="text-xl font-bold tabular-nums display" style={{ color: gradeColor(r.grade) }}>
                {r.score}
              </span>
            </div>

            <div className="space-y-1 text-xs text-[var(--subtle)]">
              <div className="flex justify-between">
                <span>TVL</span>
                <span className="tabular-nums text-[var(--muted)]">{formatTvl(r.tvlUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span>Category</span>
                <span className="text-[var(--muted)] capitalize">{r.category}</span>
              </div>
              <div className="flex justify-between">
                <span>Red flags</span>
                <span className={r.redFlags.length > 0 ? "text-[var(--danger)]" : "text-[var(--muted)]"}>
                  {r.redFlags.length > 0 ? `${r.redFlags.length} flag${r.redFlags.length !== 1 ? "s" : ""}` : "None"}
                </span>
              </div>
            </div>

            <a
              href={r.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              Website <ExternalLink size={10} />
            </a>
          </motion.div>
        ))}
      </div>

      {/* Factor comparison rows */}
      {ratings.length >= 2 && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-white/[0.04] border-b border-white/[0.07]">
            <h3 className="text-xs font-medium text-[var(--subtle)] uppercase tracking-wider">Factor Comparison</h3>
          </div>

          {FACTOR_LABELS.map((f, i) => (
            <div
              key={f.key}
              className={`px-4 py-3 grid gap-3 items-center ${
                ratings.length === 2 ? "grid-cols-[140px_1fr_1fr]" : "grid-cols-[140px_1fr_1fr_1fr]"
              } ${i > 0 ? "border-t border-white/[0.05]" : ""}`}
            >
              <span className="text-xs text-[var(--subtle)]">{f.label}</span>
              {ratings.map((r) => {
                const factor = r.factorScores[f.key];
                const pct = factor.score / factor.maxScore;
                const color = pct >= 0.85 ? "#5fb97a" : pct >= 0.70 ? "#7ac4a8" : pct >= 0.55 ? "#e8b84d" : pct >= 0.40 ? "#e8843a" : "#e86d7a";
                const winner = ratings.every((other) =>
                  other.protocolId === r.protocolId || other.factorScores[f.key].score <= factor.score
                );
                return (
                  <div key={r.protocolId} className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span
                        className={`text-xs font-semibold tabular-nums mono ${winner && ratings.length > 1 ? "" : ""}`}
                        style={{ color }}
                      >
                        {factor.score}/{factor.maxScore}
                        {winner && ratings.length > 1 && <span className="text-[10px] ml-1 opacity-70">best</span>}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct * 100}%` }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--subtle)] leading-tight line-clamp-2">{factor.plainEnglishReason}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--subtle)] text-center">
        This is informational data, not financial advice.
      </p>
    </div>
  );
}
