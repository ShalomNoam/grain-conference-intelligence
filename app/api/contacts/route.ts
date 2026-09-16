import { NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { computeRelationshipArc } from "@/lib/nudge";

export const dynamic = "force-dynamic";

// Deletes a contact and cascades to its interactions (an interaction
// orphaned from its contact would break every enrichment in GET above).
// Does NOT touch HubSpot — a contact synced there stays there; removing it
// from this app's own data is a separate decision from removing it from a
// connected third-party CRM.
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param is required" }, { status: 400 });

  const db = await getDb();
  const before = db.contacts.length;
  db.contacts = db.contacts.filter((c) => c.id !== id);
  if (db.contacts.length === before) {
    return NextResponse.json({ error: "contact not found" }, { status: 404 });
  }
  db.interactions = db.interactions.filter((i) => i.contactId !== id);
  db.pendingMatches = db.pendingMatches.filter((p) => p.candidateContactId !== id);
  await saveDb(db);
  return NextResponse.json({ status: "deleted", id });
}

export async function GET() {
  const db = await getDb();
  const enriched = db.contacts
    .map((contact) => {
      const interactions = db.interactions
        .filter((i) => i.contactId === contact.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const arc = computeRelationshipArc(interactions);
      return { contact, interactions, arc };
    })
    // most-recently-touched first
    .sort((a, b) => {
      const at = a.interactions[a.interactions.length - 1]?.timestamp ?? a.contact.createdAt;
      const bt = b.interactions[b.interactions.length - 1]?.timestamp ?? b.contact.createdAt;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

  return NextResponse.json({
    contacts: enriched,
    pendingMatches: db.pendingMatches,
    conferences: db.conferences,
  });
}
