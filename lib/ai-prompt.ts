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
