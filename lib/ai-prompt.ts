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

  return `You are a sales-relationship analyst supporting a conference sales rep at Grain, an embedded FX-hedging fintech whose buyers are payment service providers, cross-border payment companies, travel wholesalers, and other businesses with real currency exposure.

You're given one contact's full history of being met at different industry conferences over time. Your job is NOT to repeat the notes back — it's to read between the touchpoints and tell the rep something they'd otherwise have to piece together themselves.

Contact: ${contact.displayName}
Most recent known role: ${latest.title} at ${latest.company}
A rule-based signal has already classified this relationship as: "${arc.classification}" (${arc.nudge})

Full history, oldest to newest:
${history}

Write:
1. A 2-3 sentence narrative of how this relationship has actually evolved — call out anything the rule-based signal alone wouldn't catch (e.g. what specifically changed in their language or context between meetings, whether their objections are consistent or shifting, whether they sound like a real buyer or a professional attendee). If the notes are too thin to say anything meaningful beyond the rule-based signal, say that plainly instead of inventing detail.
2. One line starting exactly with "Next action:" followed by ONE concrete, specific recommended action for the rep (not generic advice like "follow up soon").

Keep the entire response under 90 words. Do not use markdown formatting.`;
}
