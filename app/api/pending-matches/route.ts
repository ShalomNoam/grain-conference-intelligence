import { NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { normalizePersonName } from "@/lib/matching";
import type { Contact, Interaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  return NextResponse.json({ pendingMatches: db.pendingMatches });
}

// PATCH — a rep resolves a "possible match" prompt with a yes/no.
// decision: "merge" attaches the captured lead to the candidate contact;
// "new" creates a brand-new contact instead (they were a different person).
export async function PATCH(req: Request) {
  const body = await req.json();
  const id: string | undefined = body.id;
  const decision: "merge" | "new" | undefined = body.decision;
  if (!id || !decision) {
    return NextResponse.json({ error: "id and decision ('merge'|'new') are required" }, { status: 400 });
  }

  const db = await getDb();
  const idx = db.pendingMatches.findIndex((p) => p.id === id);
  if (idx === -1) return NextResponse.json({ error: "pending match not found" }, { status: 404 });
  const [pending] = db.pendingMatches.splice(idx, 1);

  if (decision === "merge") {
    const contact = db.contacts.find((c) => c.id === pending.candidateContactId);
    if (!contact) {
      await saveDb(db);
      return NextResponse.json({ error: "candidate contact no longer exists" }, { status: 409 });
    }
    const { company, title } = pending.newInteractionDraft;
    const lastHist = contact.companyHistory[contact.companyHistory.length - 1];
    if (!lastHist || lastHist.company !== company || lastHist.title !== title) {
      contact.companyHistory.push({ company, title, asOf: pending.newInteractionDraft.timestamp });
    }
    if (pending.capturedEmail && !contact.emails.includes(pending.capturedEmail)) {
      contact.emails.push(pending.capturedEmail);
    }
    const interaction: Interaction = {
      id: newId("int"),
      contactId: contact.id,
      hubspotStatus: "not_synced",
      ...pending.newInteractionDraft,
    };
    db.interactions.push(interaction);
    await saveDb(db);
    return NextResponse.json({ status: "merged", contact, interaction });
  }

  // decision === "new"
  const contact: Contact = {
    id: newId("contact"),
    displayName: pending.capturedName,
    normalizedName: normalizePersonName(pending.capturedName),
    emails: pending.capturedEmail ? [pending.capturedEmail] : [],
    companyHistory: [
      {
        company: pending.newInteractionDraft.company,
        title: pending.newInteractionDraft.title,
        asOf: pending.newInteractionDraft.timestamp,
      },
    ],
    createdAt: pending.newInteractionDraft.timestamp,
  };
  db.contacts.push(contact);
  const interaction: Interaction = {
    id: newId("int"),
    contactId: contact.id,
    hubspotStatus: "not_synced",
    ...pending.newInteractionDraft,
  };
  db.interactions.push(interaction);
  await saveDb(db);
  return NextResponse.json({ status: "created_new", contact, interaction });
}
