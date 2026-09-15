import type { Contact, Interaction } from "./types";
import type { RelationshipArc } from "./nudge";

// Kept separate from the API route so the prompt itself is easy to read,
// review, and change without touching request/response plumbing.
export function buildRelationshipSummaryPrompt(
  contact: Contact,
  interactions: Interaction[],
  arc: RelationshipArc,
  conferenceNameById: Record<string, string>
): string {
  const latest = interactions[interactions.length - 1];
  const history = interactions
    .map((i) => {
      const date = new Date(i.timestamp).toISOString().slice(0, 10);
      const conf = conferenceNameById[i.conferenceId] ?? i.conferenceId;
      return `- [${date}] ${conf}: title="${i.title}", company="${i.company}", rep-rated temperature=${i.temperature}. Notes: "${i.notes || "(no notes)"}"`;
    })
    .join("\n");

  return `You are a sales-relationship analyst supporting a conference sales rep at Grain, an embedded FX-hedging fintech whose buyers are payment service providers, cross-border payment companies, travel wholesalers, and other businesses with real currency exposure. Grain's core value prop: embedded FX hedging that locks in margins on cross-border transactions without requiring collateral or credit lines.

You're given one contact's full history of being met at different industry conferences over time. Your job is NOT to repeat the notes back — it's to read between the touchpoints and produce a rep-ready follow-up package.

Contact: ${contact.displayName}
Most recent known role: ${latest.title} at ${latest.company}
A rule-based signal has already classified this relationship as: "${arc.classification}" (${arc.nudge})

Full history, oldest to newest:
${history}

Respond with EXACTLY these three labeled sections, in this order, each starting on its own line with the label shown (including the colon), and nothing before the first label or after the email draft:

DIAGNOSIS: One sentence assessing how this relationship has actually evolved — call out anything the rule-based signal alone wouldn't catch (what changed in their language/context between meetings, whether objections are consistent or shifting, whether they read as a real buyer or a professional attendee). If the notes are too thin to say anything beyond the rule-based signal, say that plainly instead of inventing detail.

PITCH ANGLE: One sentence naming the single most relevant Grain value prop for this specific contact's role and what they've said, not a generic pitch.

EMAIL DRAFT: A short, specific follow-up email (60-110 words) referencing something concrete from their actual history, ending with one clear call to action. No subject line, no markdown, no placeholder brackets — write it as ready to send from the rep.`;
}

export interface FollowUpDraft {
  diagnosis: string;
  pitchAngle: string;
  emailDraft: string;
}

// The model is instructed to always return these three labeled sections,
// but LLM output formatting still varies slightly — parse defensively and
// fall back to showing the raw text rather than a blank UI if a label is
// ever missing or reordered.
export function parseFollowUpDraft(raw: string): FollowUpDraft | null {
  const diagnosisMatch = raw.match(/DIAGNOSIS:\s*([\s\S]*?)(?=\n\s*PITCH ANGLE:|$)/i);
  const pitchMatch = raw.match(/PITCH ANGLE:\s*([\s\S]*?)(?=\n\s*EMAIL DRAFT:|$)/i);
  const emailMatch = raw.match(/EMAIL DRAFT:\s*([\s\S]*)$/i);

  const diagnosis = diagnosisMatch?.[1]?.trim();
  const pitchAngle = pitchMatch?.[1]?.trim();
  const emailDraft = emailMatch?.[1]?.trim();

  if (!diagnosis || !pitchAngle || !emailDraft) return null;
  return { diagnosis, pitchAngle, emailDraft };
}

export interface FxFollowUpInput {
  volume: number;
  pair: string;
  providerLabel: string;
  currentSpreadPct: number;
  grainSpreadPct: number;
  annualSavingsUsd: number;
  monthlySavingsUsd: number;
  prospectName?: string;
}

// Same "read a concrete number, don't invent one" contract as the
// relationship-summary prompt — every figure the model is given here is
// already computed by the calculator's own math, so the email should
// quote them back, not estimate its own.
export function buildFxFollowUpPrompt(input: FxFollowUpInput): string {
  const {
    volume, pair, providerLabel, currentSpreadPct, grainSpreadPct,
    annualSavingsUsd, monthlySavingsUsd, prospectName,
  } = input;

  return `You are drafting a short follow-up email for a Grain sales rep to send after a conference-floor conversation. Grain is an embedded FX-hedging fintech whose buyers are payment service providers, cross-border payment companies, and travel wholesalers with real currency exposure. Grain's core value prop: embedded FX hedging that locks in margins on cross-border transactions without requiring collateral or credit lines.

The rep just ran a live savings estimate with this prospect on the show floor, using numbers the prospect gave in the conversation:

- Currency pair: ${pair}
- Annual cross-border volume: $${volume.toLocaleString("en-US")}
- Prospect's current provider type: ${providerLabel}, spread ≈ ${currentSpreadPct}%
- Grain's guaranteed spread: ${grainSpreadPct}%
- Estimated annual savings: $${Math.round(annualSavingsUsd).toLocaleString("en-US")} (≈ $${Math.round(monthlySavingsUsd).toLocaleString("en-US")}/month)
${prospectName ? `- Prospect's name: ${prospectName}` : ""}

Write a short follow-up email (70-110 words) that:
1. References the specific numbers above (the exact dollar savings and the pair) — this must read as tailored to this exact conversation, not generic.
2. States the Grain value prop in one line, relevant to a company with this profile.
3. Ends with one clear, low-friction call to action (e.g. a 15-minute call, or sending a formal quote).

No subject line, no markdown, no placeholder brackets like [Name] — write it ready to send. If no prospect name was given, open with a neutral greeting instead of guessing one.`;
}
