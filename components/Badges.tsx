import { TIER_COLOR, type Tier } from "@/lib/scoring";
import type { Temperature } from "@/lib/types";
import { ARC_TONE_CLASS, type ArcTone } from "@/lib/nudge";

export function TierBadge({ tier, score }: { tier: Tier; score: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-mono font-medium whitespace-nowrap ${TIER_COLOR[tier]}`}
    >
      <span className="font-semibold">{tier}</span>
      <span className="opacity-70 tabular">{score}</span>
    </span>
  );
}

const TEMP_STYLE: Record<Temperature, string> = {
  hot: "bg-danger-bg text-danger",
  warm: "bg-warn-bg text-warn-ink",
  cold: "bg-paper-alt text-ink-faint",
};

export function TemperatureBadge({ temperature }: { temperature: Temperature }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium capitalize whitespace-nowrap ${TEMP_STYLE[temperature]}`}>
      {temperature}
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
    <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-dim whitespace-nowrap">
      {label}
    </span>
  );
}
