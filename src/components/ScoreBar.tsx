import { motion } from "framer-motion";

interface Props {
  score: number;
  maxScore: number;
  color?: string;
  label?: string;
  reason?: string;
  showNumbers?: boolean;
}

function colorFromScore(pct: number): string {
  if (pct >= 0.85) return "#5fb97a";
  if (pct >= 0.70) return "#7ac4a8";
  if (pct >= 0.55) return "#e8b84d";
  if (pct >= 0.40) return "#e8843a";
  return "#e86d7a";
}

export function ScoreBar({ score, maxScore, color, label, reason, showNumbers = true }: Props) {
  const pct = maxScore > 0 ? score / maxScore : 0;
  const barColor = color ?? colorFromScore(pct);

  return (
    <div className="space-y-1">
      {(label || showNumbers) && (
        <div className="flex justify-between items-baseline">
          {label && <span className="text-sm text-[var(--muted)]">{label}</span>}
          {showNumbers && (
            <span className="text-sm font-semibold tabular-nums mono text-[var(--ink-2)]">
              {score}/{maxScore}
            </span>
          )}
        </div>
      )}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {reason && (
        <p className="text-xs text-[var(--subtle)] leading-snug">{reason}</p>
      )}
    </div>
  );
}
