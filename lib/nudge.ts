import type { Interaction, Temperature } from "./types";

// ── Relationship-arc classification (rule-based half of "nudge") ───────
// The AI summarizer (lib/ai-prompt.ts + app/api/ai/relationship-summary)
// handles the qualitative read of free-text notes. This file handles the
// quantitative, deterministic half — touch count, time span, temperature
// trend, company changes — so the nudge is instant, free, and doesn't
// depend on an API key being configured. The two are shown together in
// the UI: a rep gets the reliable signal even with no AI key set, and a
// richer narrative when one is.
//
// The brief's own framing is the design brief here: "help the rep judge
// whether a repeat contact is a warming relationship worth closing, or a
// polite tire-kicker who's been listening for a year and never buying."
// That means the signal can't just be a count — it has to carry direction
// (temperature trend) and context (did their role/company change?).

export type ArcClassification =
  | "insufficient-data"
  | "warming"
  | "steady"
  | "stagnant"
  | "reengage-role-change"
  | "cooling";

export type ArcTone = "positive" | "neutral" | "caution";

export interface RelationshipArc {
  classification: ArcClassification;
  tone: ArcTone;
  label: string;
  touchCount: number;
  spanMonths: number;
  temperatureTrend: "rising" | "flat" | "falling";
  companyChanged: boolean;
  nudge: string;
}

const TEMP_VALUE: Record<Temperature, number> = { cold: 0, warm: 1, hot: 2 };

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

export function computeRelationshipArc(interactions: Interaction[]): RelationshipArc {
  const sorted = [...interactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const touchCount = sorted.length;

  if (touchCount <= 1) {
    return {
      classification: "insufficient-data",
      tone: "neutral",
      label: touchCount === 0 ? "No touches yet" : "First touch",
      touchCount,
      spanMonths: 0,
      temperatureTrend: "flat",
      companyChanged: false,
      nudge:
        touchCount === 0
          ? "No interactions logged yet."
          : "First touch — not enough history to judge a pattern yet. The arc lights up once you've met them at a second conference.",
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanMonths = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / MONTH_MS;

  const firstTemp = TEMP_VALUE[first.temperature];
  const lastTemp = TEMP_VALUE[last.temperature];
  const temperatureTrend: "rising" | "flat" | "falling" =
    lastTemp > firstTemp ? "rising" : lastTemp < firstTemp ? "falling" : "flat";

  const companyChanged = first.company.trim().toLowerCase() !== last.company.trim().toLowerCase();

  let classification: ArcClassification;
  let tone: ArcTone;
  let label: string;
  let nudge: string;

  if (companyChanged) {
    classification = "reengage-role-change";
    tone = "positive";
    label = "Role changed — re-qualify";
    nudge = `They moved since you last spoke: "${first.company}" → "${last.company}". Treat this as a fresh opportunity, not a continuation — new company can mean new budget, new pain, or (if it's the same buyer type) a warm door into a brand-new account.`;
  } else if (temperatureTrend === "falling") {
    classification = "cooling";
    tone = "caution";
    label = "Cooling";
    nudge = `Engagement dropped between meetings (${first.temperature} → ${last.temperature}). Worth a direct check-in to find out why before spending more booth time here — budget cut, lost champion, or chose a competitor are all more likely than "just busy."`;
  } else if (spanMonths >= 12 && temperatureTrend !== "rising") {
    classification = "stagnant";
    tone = "caution";
    label = "Recurring, not moving";
    nudge = `${touchCount} touches across ${Math.round(spanMonths)} months, temperature never climbed. This has the shape of a polite recurring visitor rather than a live deal — move to a low-touch nurture list rather than booking real booth time on the next pass.`;
  } else if (temperatureTrend === "rising") {
    classification = "warming";
    tone = "positive";
    label = "Warming up";
    nudge = `${touchCount} touches, engagement rising each time, last contact ${Math.round(spanMonths) || "<1"} mo${Math.round(spanMonths) === 1 ? "" : "s"} ago. This is the pattern worth acting on — a specific, direct follow-up now, not another "great meeting you" email.`;
  } else {
    classification = "steady";
    tone = "neutral";
    label = "Steady, too early to call";
    nudge = `${touchCount} touches, holding at ${last.temperature} — not enough signal yet to call it either way. A light-touch check-in keeps it alive without over-investing.`;
  }

  return {
    classification,
    tone,
    label,
    touchCount,
    spanMonths: Math.round(spanMonths * 10) / 10,
    temperatureTrend,
    companyChanged,
    nudge,
  };
}

export const ARC_TONE_CLASS: Record<ArcTone, string> = {
  positive: "bg-teal-bg text-teal",
  neutral: "bg-paper-alt text-ink-dim",
  caution: "bg-warn-bg text-warn-ink",
};

// Collapses the rule-based arc into one of three scannable signals for the
// Contacts card badge: is this worth booth time, or not?
export function signalForArc(arc: RelationshipArc): "closing" | "tireKicker" | "firstTouch" {
  if (arc.touchCount <= 1) return "firstTouch";
  return arc.temperatureTrend === "rising" ? "closing" : "tireKicker";
}
