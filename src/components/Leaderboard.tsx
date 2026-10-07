import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import type { ProtocolListItem, Grade, ProtocolCategory } from "../types";
import { GradeBadge } from "./GradeBadge";
import { ConfidencePill } from "./ConfidencePill";

const CATEGORIES: Array<{ id: ProtocolCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "lending", label: "Lending" },
  { id: "dex", label: "DEX" },
  { id: "yield", label: "Yield" },
  { id: "staking", label: "Staking" },
  { id: "cdp", label: "CDP" },
  { id: "bridge", label: "Bridge" },
];

const GRADES: Array<Grade | "all"> = ["all", "A", "B", "C", "D", "F"];

function formatTvl(v?: number): string {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

// Declared outside the component so it is not re-created during render
function SortIndicator({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <ChevronUp size={12} className="opacity-20" />;
  return asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

type SortKey = "score" | "name" | "tvlUSD";

interface Props {
  protocols: ProtocolListItem[];
  onSelect: (id: string) => void;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  loading?: boolean;
}

export function Leaderboard({ protocols, onSelect, compareIds, onToggleCompare, loading }: Props) {
  const [category, setCategory] = useState<ProtocolCategory | "all">("all");
  const [grade, setGrade] = useState<Grade | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const filtered = [...protocols]
    .filter((p) => category === "all" || p.category === category)
    .filter((p) => grade === "all" || p.grade === grade)
    .sort((a, b) => {
      const aVal = sortKey === "name" ? a.name : sortKey === "tvlUSD" ? (a.tvlUSD ?? 0) : a.score;
      const bVal = sortKey === "name" ? b.name : sortKey === "tvlUSD" ? (b.tvlUSD ?? 0) : b.score;
      if (typeof aVal === "string") return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortAsc ? (aVal) - (bVal as number) : (bVal as number) - (aVal);
    });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                category === c.id
                  ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40"
                  : "bg-white/[0.05] text-[var(--subtle)] border border-white/10 hover:bg-white/10"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-[var(--subtle)]">Grade:</span>
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all display ${
                grade === g
                  ? "bg-white/15 text-[var(--ink)]"
                  : "bg-white/[0.04] text-[var(--subtle)] hover:bg-white/10"
              }`}
            >
              {g === "all" ? "All" : g}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-white/[0.04] border-b border-white/[0.08] text-xs font-medium text-[var(--subtle)] uppercase tracking-wider">
          <button className="text-left flex items-center gap-1 hover:text-[var(--muted)] transition-colors" onClick={() => toggleSort("name")}>
            Protocol <SortIndicator active={sortKey === "name"} asc={sortAsc} />
          </button>
          <button className="flex items-center gap-1 hover:text-[var(--muted)] transition-colors" onClick={() => toggleSort("score")}>
            Score <SortIndicator active={sortKey === "score"} asc={sortAsc} />
          </button>
          <button className="hidden sm:flex items-center gap-1 hover:text-[var(--muted)] transition-colors" onClick={() => toggleSort("tvlUSD")}>
            TVL <SortIndicator active={sortKey === "tvlUSD"} asc={sortAsc} />
          </button>
          <span className="hidden md:block">Confidence</span>
          <span>Compare</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 text-center text-[var(--subtle)] text-sm">
            <div className="inline-block w-5 h-5 border-2 border-white/20 border-t-[var(--accent)] rounded-full animate-spin mb-3" />
            <p>Loading ratings…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[var(--subtle)] text-sm">No protocols match these filters</div>
        ) : (
          filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.2 }}
              className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 items-center cursor-pointer transition-colors hover:bg-white/[0.04] ${
                i > 0 ? "border-t border-white/[0.05]" : ""
              } ${compareIds.includes(p.id) ? "bg-[var(--accent)]/[0.04]" : ""}`}
              onClick={() => onSelect(p.id)}
            >
              {/* Name */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--ink)] truncate">{p.name}</span>
                  {p.hardCapCount > 0 && (
                    <AlertTriangle size={13} className="text-[#e86d7a] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-[var(--subtle)] capitalize">{p.category}</span>
                  {p.chains.slice(0, 2).map((c) => (
                    <span key={c} className="text-[10px] text-[var(--subtle)] bg-white/[0.05] px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>

              {/* Score + Grade */}
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-semibold text-sm text-[var(--ink-2)]">{p.score}</span>
                <GradeBadge grade={p.grade} size="sm" />
              </div>

              {/* TVL */}
              <div className="hidden sm:block tabular-nums text-sm text-[var(--muted)]">
                {formatTvl(p.tvlUSD)}
              </div>

              {/* Confidence */}
              <div className="hidden md:block">
                <ConfidencePill level={p.confidence} />
              </div>

              {/* Compare toggle */}
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onToggleCompare(p.id)}
                  disabled={!compareIds.includes(p.id) && compareIds.length >= 3}
                  className={`w-7 h-7 rounded-md border text-xs font-semibold transition-all ${
                    compareIds.includes(p.id)
                      ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-[var(--accent)]"
                      : compareIds.length >= 3
                      ? "border-white/10 text-white/20 cursor-not-allowed"
                      : "border-white/20 text-[var(--subtle)] hover:border-white/40 hover:text-[var(--muted)]"
                  }`}
                  aria-label={compareIds.includes(p.id) ? "Remove from comparison" : "Add to comparison"}
                  title={compareIds.includes(p.id) ? "Remove from comparison" : "Add to comparison"}
                >
                  {compareIds.includes(p.id) ? "✓" : "+"}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-[var(--subtle)] text-center">{filtered.length} protocol{filtered.length !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
