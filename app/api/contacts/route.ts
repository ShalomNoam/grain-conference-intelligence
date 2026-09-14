import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeRelationshipArc } from "@/lib/nudge";

export const dynamic = "force-dynamic";

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
