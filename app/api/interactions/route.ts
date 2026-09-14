import { NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { findContactMatch, normalizePersonName } from "@/lib/matching";
import { newId } from "@/lib/id";
import type { Contact, Interaction, PendingMatch, Temperature } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST — the field-capture form hits this once per lead. It runs the
// matching engine synchronously so the rep gets an immediate answer:
// "logged", "linked to Dana Shapiro (2nd touch)", or "possible match —
// confirm on the Contacts page later" (never a silent merge).
export async function POST(req: Request) {
  const body = await req.json();
  const name: string | undefined = body.name?.trim();
  const conferenceId: string | undefined = body.conferenceId;
  const repName: string | undefined = body.repName?.trim();

  if (!name || !conferenceId || !repName) {
    return NextResponse.json({ error: "name, conferenceId and repName are required" }, { status: 400 });
  }

  const company: string = (body.company ?? "").trim();
  const title: string = (body.title ?? "").trim();
  const email: string | undefined = body.email?.trim() || undefined;
  const temperature: Temperature = ["hot", "warm", "cold"].includes(body.temperature) ? body.temperature : "warm";
  const notes: string = body.notes ?? "";
  const tags: string[] = Array.isArray(body.tags) ? body.tags : [];
  const timestamp = new Date().toISOString();

  const db = await getDb();
  const draft = { conferenceId, repName, timestamp, title, company, temperature, notes, tags };

  const match = findContactMatch({ name, company, email }, db.contacts);

  if (match.type === "exact" || match.type === "auto") {
    const contact = db.contacts.find((c) => c.id === match.contact!.id)!;
    const lastHist = contact.companyHistory[contact.companyHistory.length - 1];
    if (!lastHist || lastHist.company !== company || lastHist.title !== title) {
      contact.companyHistory.push({ company, title, asOf: timestamp });
    }
    if (email && !contact.emails.includes(email)) contact.emails.push(email);

    const interaction: Interaction = { id: newId("int"), contactId: contact.id, hubspotStatus: "not_synced", ...draft };
    db.interactions.push(interaction);
    await saveDb(db);
    return NextResponse.json({
      status: match.type === "exact" ? "matched_exact" : "matched_auto",
      contact,
      interaction,
      reasons: match.reasons,
    });
  }

  if (match.type === "review") {
    const pending: PendingMatch = {
      id: newId("pm"),
      capturedName: name,
      capturedEmail: email,
      newInteractionDraft: draft,
      candidateContactId: match.contact!.id,
      candidateContactName: match.contact!.displayName,
      score: match.score,
      reasons: match.reasons,
    };
    db.pendingMatches.push(pending);
    await saveDb(db);
    return NextResponse.json({ status: "pending_review", pendingMatch: pending });
  }

  // No match at all → brand new contact.
  const contact: Contact = {
    id: newId("contact"),
    displayName: name,
    normalizedName: normalizePersonName(name),
    emails: email ? [email] : [],
    companyHistory: [{ company, title, asOf: timestamp }],
    createdAt: timestamp,
  };
  db.contacts.push(contact);
  const interaction: Interaction = { id: newId("int"), contactId: contact.id, hubspotStatus: "not_synced", ...draft };
  db.interactions.push(interaction);
  await saveDb(db);
  return NextResponse.json({ status: "new_contact", contact, interaction });
}
