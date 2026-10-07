import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, AlertTriangle, CheckCircle, ArrowLeft, Clock, RefreshCw } from "lucide-react";
import type { RatingResult } from "../types";
import { GradeBadge } from "./GradeBadge";
import { ConfidencePill } from "./ConfidencePill";
import { ScoreBar } from "./ScoreBar";

const FACTOR_LABELS: Record<keyof RatingResult["factorScores"], string> = {
  smartContractSecurity: "Smart Contract Security",
  liquidity: "Liquidity",
  tokenConcentration: "Token Concentration",
  governanceAdmin: "Governance & Admin",
  audits: "Audits",
  protocolHistory: "Protocol History",
  yieldSustainability: "Yield Sustainability",
  dependencies: "Dependencies",
};

interface Props {
  rating: RatingResult;
  onBack: () => void;
  loading?: boolean;
}

function formatTvl(v?: number): string {
  if (!v) return "Unknown";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RatingPage({ rating, onBack, loading }: Props) {
  const [showSources, setShowSources] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-[var(--accent)] rounded-full animate-spin" />
        <p className="text-[var(--subtle)] text-sm">Computing risk rating…</p>
      </div>
    );
  }

  const score = rating.score;
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-[var(--subtle)] hover:text-[var(--muted)] transition-colors"
      >
        <ArrowLeft size={15} />
        All protocols
      </button>

      {/* Hard Caps (top prominence) */}
      {rating.hardCapsTriggered.length > 0 && (
        <div className="rounded-xl border border-[#e86d7a]/40 bg-[#e86d7a]/8 p-4 space-y-2">
          <div className="flex items-center gap-2 text-[#e86d7a] font-semibold text-sm">
            <AlertTriangle size={16} />
            Risk Override Active
          </div>
          {rating.hardCapsTriggered.map((cap) => (
            <p key={cap.type} className="text-sm text-[#e86d7a]/90">{cap.label}</p>
          ))}
        </div>
      )}

      {/* Hero card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Score ring */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <motion.circle
                cx="48" cy="48" r="38"
                fill="none"
                stroke={rating.grade === "A" ? "#5fb97a" : rating.grade === "B" ? "#7ac4a8" : rating.grade === "C" ? "#e8b84d" : rating.grade === "D" ? "#e8843a" : "#e86d7a"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div className="text-center -mt-14">
              <div className="text-3xl font-bold tabular-nums display text-[var(--ink)]">{score}</div>
              <div className="text-xs text-[var(--subtle)]">out of 100</div>
            </div>
            <div className="mt-8" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <h1 className="text-2xl font-bold display text-[var(--ink)] text-balance">{rating.protocolName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <GradeBadge grade={rating.grade} size="md" showLabel />
                <ConfidencePill level={rating.confidence} />
              </div>
            </div>
            <p className="text-sm text-[var(--muted)] text-pretty leading-relaxed">{rating.description}</p>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--subtle)]">
              <span className="capitalize px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08]">{rating.category}</span>
              {rating.chains.map((c) => (
                <span key={c} className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08]">{c}</span>
              ))}
              {rating.tvlUSD && (
                <span className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] tabular-nums">TVL: {formatTvl(rating.tvlUSD)}</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={rating.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Website <ExternalLink size={12} />
              </a>
              <div className="flex items-center gap-1 text-xs text-[var(--subtle)]">
                <Clock size={11} />
                Updated {timeAgo(rating.computedAt)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Red flags */}
      {rating.redFlags.length > 0 && (
        <div className="rounded-xl border border-[#e86d7a]/25 bg-[#e86d7a]/[0.06] p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[#e86d7a] flex items-center gap-2">
            <AlertTriangle size={14} />
            Red Flags
          </h3>
          <ul className="space-y-1.5">
            {rating.redFlags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#e86d7a]/90">
                <span className="shrink-0 mt-0.5">•</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top reasons */}
      {rating.topReasons.length > 0 && (
        <div className="rounded-xl border border-[#5fb97a]/25 bg-[#5fb97a]/[0.05] p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[#5fb97a] flex items-center gap-2">
            <CheckCircle size={14} />
            Top Reasons for This Grade
          </h3>
          <ul className="space-y-1.5">
            {rating.topReasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#5fb97a]/90">
                <span className="shrink-0 mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Factor breakdown */}
      <div className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.08]">
          <h2 className="font-semibold text-[var(--ink)] text-sm">Score Breakdown</h2>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {(Object.entries(rating.factorScores) as [keyof RatingResult["factorScores"], (typeof rating.factorScores)[keyof typeof rating.factorScores]][]).map(([key, factor]) => (
            <div key={key} className="px-5 py-4">
              <ScoreBar
                score={factor.score}
                maxScore={factor.maxScore}
                label={FACTOR_LABELS[key]}
                reason={factor.dataAvailable ? factor.plainEnglishReason : `No data — ${factor.plainEnglishReason}`}
                showNumbers
              />
            </div>
          ))}
        </div>
      </div>

      {/* What would change rating */}
      {rating.whatWouldChangeRating.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
          <h2 className="font-semibold text-[var(--ink-2)] text-sm flex items-center gap-2">
            <RefreshCw size={13} />
            What Would Change This Rating
          </h2>
          <ul className="space-y-2">
            {rating.whatWouldChangeRating.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                <span className="text-[var(--subtle)] shrink-0 mt-0.5">→</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => setShowSources((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left"
        >
          <span className="text-xs font-medium text-[var(--subtle)] uppercase tracking-wider">Data Sources</span>
          <span className="text-xs text-[var(--subtle)]">{showSources ? "Hide" : `Show ${rating.sources.length}`}</span>
        </button>
        {showSources && (
          <div className="divide-y divide-white/[0.05]">
            {rating.sources.map((s) => (
              <div key={s.field} className="px-4 py-2.5 flex items-center justify-between gap-4">
                <span className="mono text-xs text-[var(--subtle)]">{s.field}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-[var(--subtle)]">{s.source}</span>
                  <span className="mono text-xs text-[var(--subtle)] opacity-60">{new Date(s.fetchedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-[var(--subtle)] text-center leading-relaxed px-4">
        This is informational data, not financial advice. Risk ratings are based on publicly available data and may be incomplete. Always do your own research before investing.
      </p>
    </motion.div>
  );
}
