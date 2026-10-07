import type { Grade } from "../types";

const GRADE_CONFIG: Record<Grade, { bg: string; text: string; label: string }> = {
  A: { bg: "bg-[#5fb97a]/15 border border-[#5fb97a]/40", text: "text-[#5fb97a]", label: "Low Risk" },
  B: { bg: "bg-[#7ac4a8]/15 border border-[#7ac4a8]/40", text: "text-[#7ac4a8]", label: "Moderate-Low Risk" },
  C: { bg: "bg-[#e8b84d]/15 border border-[#e8b84d]/40", text: "text-[#e8b84d]", label: "Moderate Risk" },
  D: { bg: "bg-[#e8843a]/15 border border-[#e8843a]/40", text: "text-[#e8843a]", label: "High Risk" },
  F: { bg: "bg-[#e86d7a]/15 border border-[#e86d7a]/40", text: "text-[#e86d7a]", label: "Very High Risk" },
};

interface Props {
  grade: Grade;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
}

export function GradeBadge({ grade, size = "md", showLabel = false }: Props) {
  const cfg = GRADE_CONFIG[grade];

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 rounded-md",
    md: "text-sm px-2 py-1 rounded-md",
    lg: "text-base px-3 py-1.5 rounded-lg",
    xl: "text-2xl px-4 py-2 rounded-xl",
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums display ${cfg.bg} ${cfg.text} ${sizeClasses}`}>
      {grade}
      {showLabel && (
        <span className="text-[0.7em] font-medium opacity-80 tracking-wider uppercase">
          {cfg.label}
        </span>
      )}
    </span>
  );
}

export function gradeColor(grade: Grade): string {
  return {
    A: "#5fb97a",
    B: "#7ac4a8",
    C: "#e8b84d",
    D: "#e8843a",
    F: "#e86d7a",
  }[grade];
}

export function gradeLabelFull(grade: Grade): string {
  return GRADE_CONFIG[grade].label;
}
