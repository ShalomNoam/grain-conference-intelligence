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

const TEMP_STYLE: Record<Temperature, string> = {
  hot: "bg-danger-bg text-danger border-2 border-danger",
  warm: "bg-warn-bg text-warn-ink border-2 border-warn-ink",
  cold: "bg-slate-100 text-slate-600 border-2 border-slate-300",
};

export function TemperatureBadge({ temperature }: { temperature: Temperature }) {
  const labels: Record<Temperature, string> = {
    hot: "🔥 Hot",
    warm: "🔥 Warm",
    cold: "❄️ Cold",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize whitespace-nowrap ${TEMP_STYLE[temperature]}`}>
      {labels[temperature]}
    </span>
  );
}

export type SignalType = "closing" | "tireKicker" | "firstTouch";

export function SignalBadge({ type, count }: { type: SignalType; count?: number }) {
  const signals: Record<SignalType, { emoji: string; label: string; className: string }> = {
    closing: {
      emoji: "🔥",
      label: count ? `Closing Signal (${count}+ shows)` : "Closing Signal",
      className: "bg-green-100 text-green-700 border-green-300",
    },
    tireKicker: {
      emoji: "💤",
      label: "Low Priority / Tire Kicker",
      className: "bg-slate-100 text-slate-600 border-slate-300",
    },
    firstTouch: {
      emoji: "🌱",
      label: "First Touch",
      className: "bg-blue-100 text-blue-700 border-blue-300",
    },
  };

  const signal = signals[type];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold border ${signal.className}`}>
      <span>{signal.emoji}</span>
      {signal.label}
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
