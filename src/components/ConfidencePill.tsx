import type { ConfidenceLevel } from "../types";

const CONFIG: Record<ConfidenceLevel, { label: string; classes: string }> = {
  high: { label: "High confidence", classes: "bg-[#5fb97a]/10 text-[#5fb97a] border border-[#5fb97a]/25" },
  medium: { label: "Medium confidence", classes: "bg-[#e8b84d]/10 text-[#e8b84d] border border-[#e8b84d]/25" },
  low: { label: "Low confidence", classes: "bg-[#94a3b8]/10 text-[#94a3b8] border border-[#94a3b8]/25" },
};

export function ConfidencePill({ level }: { level: ConfidenceLevel }) {
  const cfg = CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.classes}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
}
