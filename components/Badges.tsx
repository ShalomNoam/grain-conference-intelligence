import { TIER_COLOR, type Tier } from "@/lib/scoring";
import type { Temperature } from "@/lib/types";
import { ARC_TONE_CLASS, type ArcTone } from "@/lib/nudge";

export function TierBadge({ tier, score }: { tier: Tier; score: number }) {
  const tierLabels: Record<Tier, string> = {
    S: "Tier 1: Core ICP",
    A: "Tier 2: Strong Fit",
    B: "Tier 3: Solid Opportunity",
    C: "Tier 4: Monitor",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap ${TIER_COLOR[tier]}`}
    >
      <span className="font-semibold">{tierLabels[tier]}</span>
    </span>
  );
}

// No emoji/sparkles — a clean typographic pill only. Top Fit is the
// dominant solid-indigo treatment; the rest step down in visual weight
// so the eye lands on Top Fit first without the others disappearing.
const ICP_MATCH: Record<Tier, { label: string; className: string }> = {
  S: { label: "Top Fit", className: "bg-brand-dark text-white" },
  A: { label: "Good Fit", className: "bg-blue-50 text-blue-700 border border-blue-200/60" },
  B: { label: "Consider", className: "bg-warn-bg text-warn-ink" },
  C: { label: "Low Fit", className: "bg-paper-alt text-ink-faint" },
};

export function ICPMatchBadge({ tier }: { tier: Tier }) {
  const m = ICP_MATCH[tier];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide whitespace-nowrap ${m.className}`}>
      {m.label}
    </span>
  );
}

// Zero emoji — solid status dot + high-contrast text chip. Exact tokens
// per spec: hot mirrors the reference CSS (#fff1f2/#be123c/#fecdd3,
// #e11d48 dot); warm follows the same bg-100/text-800/border-200/dot-600
// structure since only hot had a literal CSS block to match against.
const TEMP_STYLE: Record<Temperature, { chip: string; dot: string }> = {
  hot: { chip: "bg-[#fff1f2] text-[#be123c] border border-[#fecdd3]", dot: "bg-[#e11d48]" },
  warm: { chip: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]", dot: "bg-[#D97706]" },
  cold: { chip: "bg-slate-100 text-slate-600 border border-slate-200", dot: "bg-slate-400" },
};

export function TemperatureBadge({ temperature }: { temperature: Temperature }) {
  const labels: Record<Temperature, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };
  const s = TEMP_STYLE[temperature];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden />
      {labels[temperature]}
    </span>
  );
}

export function ArcBadge({ label, tone }: { label: string; tone: ArcTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap ${ARC_TONE_CLASS[tone]}`}>
      {label}
    </span>
  );
}

export function VerticalTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-dim font-medium whitespace-nowrap">
      {label}
    </span>
  );
}
