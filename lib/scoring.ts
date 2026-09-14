import type { Conference, Vertical, Format } from "./types";

// ── ICP scoring methodology ─────────────────────────────────────────────
// Five weighted axes, each normalized to 0–1, summed with fixed weights to
// a 0–100 score, then bucketed into a tier. Every weight and lookup table
// lives in this one file with the reasoning inline, so it's auditable and
// defensible in the video — nothing about this is a black box.
//
//   ICP Vertical Fit ........ 40%  — is this Grain's actual buyer, at all?
//   Audience Quality ........ 20%  — decision-maker density, not raw headcount
//   Deal-Making Format ...... 15%  — can you actually book meetings here?
//   Cost / Logistics ........ 15%  — $ per plausible qualified conversation
//   Strategic Signal ........ 10%  — is this where the market/competition gathers?
//
// Grain's ICP (from the brief): PSPs, cross-border payment companies,
// travel wholesalers, and businesses with real FX exposure — concentrated
// in fintech, payments, and treasury.

export const WEIGHTS = {
  verticalFit: 0.4,
  audienceQuality: 0.2,
  dealFormat: 0.15,
  costLogistics: 0.15,
  strategicSignal: 0.1,
} as const;

// Core = the buyer is very likely in the room. Adjacent = plausible but not
// the bullseye. Broad-tech = general startup/SaaS crowds with little
// FX-exposed-operator density.
const VERTICAL_WEIGHT: Record<Vertical, number> = {
  payments: 1.0,
  "fx-treasury": 1.0,
  "cross-border-ecommerce": 1.0,
  travel: 0.55,
  banking: 0.55,
  "fintech-saas": 0.5,
  "broad-tech": 0.1,
};

const CORE_VERTICALS = new Set<Vertical>(["payments", "fx-treasury", "cross-border-ecommerce"]);

function verticalFitScore(verticals: Vertical[]): number {
  const best = Math.max(0, ...verticals.map((v) => VERTICAL_WEIGHT[v]));
  const coreCount = verticals.filter((v) => CORE_VERTICALS.has(v)).length;
  // Small depth bonus when a show spans 2+ core verticals at once
  // (e.g. payments + fx-treasury) — it's covering more of the ICP in one trip.
  const depthBonus = coreCount >= 2 ? 0.1 : 0;
  return Math.min(1, best + depthBonus);
}

// Audience quality is a proxy for decision-maker density. Without real
// per-attendee title data (not available for a sample database), we use
// event size as the proxy: very small shows often lack volume, very large
// consumer-scale shows dilute the B2B buyer down to noise, and the
// 2,500–10,000 band is where curated-but-substantial fintech/payments
// shows tend to sit. Documented explicitly so it can be replaced with real
// registration-list data later (see README "what I'd build next").
function audienceQualityScore(audienceSize: number): number {
  if (audienceSize < 800) return 0.45;
  if (audienceSize < 2500) return 0.75;
  if (audienceSize <= 10000) return 1.0;
  if (audienceSize <= 20000) return 0.65;
  return 0.35;
}

const FORMAT_SCORE: Record<Format, number> = {
  "1:1 meetings": 1.0,
  summit: 0.65,
  hybrid: 0.5,
  expo: 0.35,
};

function dealFormatScore(format: Format): number {
  return FORMAT_SCORE[format];
}

const COST_SCORE: Record<1 | 2 | 3, number> = { 1: 1.0, 2: 0.65, 3: 0.35 };

function costLogisticsScore(costTier: 1 | 2 | 3): number {
  return COST_SCORE[costTier];
}

// More named competitors on the floor = more confirmation this is where
// the FX/cross-border-payments market actually gathers.
function strategicSignalScore(competitorsPresent: string[] | undefined): number {
  const n = competitorsPresent?.length ?? 0;
  if (n === 0) return 0.3;
  if (n <= 2) return 0.7;
  return 1.0;
}

export type Tier = "S" | "A" | "B" | "C";

export interface ScoreBreakdown {
  verticalFit: number;
  audienceQuality: number;
  dealFormat: number;
  costLogistics: number;
  strategicSignal: number;
}

export interface ConferenceScore {
  score: number; // 0–100
  tier: Tier;
  breakdown: ScoreBreakdown; // each axis 0–1, before weighting
  weightedContribution: ScoreBreakdown; // each axis's actual point contribution to the 0–100 score
}

export function tierFor(score: number): Tier {
  if (score >= 80) return "S";
  if (score >= 65) return "A";
  if (score >= 45) return "B";
  return "C";
}

export function scoreConference(conf: Conference): ConferenceScore {
  const breakdown: ScoreBreakdown = {
    verticalFit: verticalFitScore(conf.verticals),
    audienceQuality: audienceQualityScore(conf.audienceSize),
    dealFormat: dealFormatScore(conf.format),
    costLogistics: costLogisticsScore(conf.costTier),
    strategicSignal: strategicSignalScore(conf.competitorsPresent),
  };

  const weightedContribution: ScoreBreakdown = {
    verticalFit: breakdown.verticalFit * WEIGHTS.verticalFit * 100,
    audienceQuality: breakdown.audienceQuality * WEIGHTS.audienceQuality * 100,
    dealFormat: breakdown.dealFormat * WEIGHTS.dealFormat * 100,
    costLogistics: breakdown.costLogistics * WEIGHTS.costLogistics * 100,
    strategicSignal: breakdown.strategicSignal * WEIGHTS.strategicSignal * 100,
  };

  const score = Math.round(
    Object.values(weightedContribution).reduce((a, b) => a + b, 0)
  );

  return { score, tier: tierFor(score), breakdown, weightedContribution };
}

export const TIER_LABEL: Record<Tier, string> = {
  S: "Must attend",
  A: "Strong fit",
  B: "Opportunistic",
  C: "Skip unless free",
};

export const TIER_COLOR: Record<Tier, string> = {
  S: "bg-teal text-white",
  A: "bg-teal-bg text-teal",
  B: "bg-warn-bg text-warn-ink",
  C: "bg-paper-alt text-ink-faint",
};
