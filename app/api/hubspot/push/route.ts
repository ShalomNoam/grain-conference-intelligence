import { NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const HUBSPOT_BASE = "https://api.hubapi.com";

async function describeError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return `HubSpot API error (${res.status}): ${text.slice(0, 300)}`;
}

// Proxies to the HubSpot CRM v3 API: find-or-create the Contact, then
// attach a Note with the conference context. The private-app token comes
// from the request header (rep-entered in Settings, kept in the browser)
// — never hardcoded, never persisted server-side.
export async function POST(req: Request) {
  const token = req.headers.get("x-hubspot-token") || process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "No HubSpot token configured. Add a private-app token in Settings to enable sync." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const interactionId: string | undefined = body.interactionId;
  if (!interactionId) return NextResponse.json({ error: "interactionId is required" }, { status: 400 });

  const db = await getDb();
  const interaction = db.interactions.find((i) => i.id === interactionId);
  if (!interaction) return NextResponse.json({ error: "interaction not found" }, { status: 404 });
  const contact = db.contacts.find((c) => c.id === interaction.contactId);
  if (!contact) return NextResponse.json({ error: "contact not found" }, { status: 404 });
  const conference = db.conferences.find((c) => c.id === interaction.conferenceId);

  const hsHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [firstname, ...rest] = contact.displayName.split(" ");
  const lastname = rest.join(" ") || "-";
  const email = contact.emails[0];

  try {
    let hubspotContactId: string | undefined;

    if (email) {
      const searchRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
        method: "POST",
        headers: hsHeaders,
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
          limit: 1,
        }),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        hubspotContactId = searchData?.results?.[0]?.id;
      }
    }

    const properties: Record<string, string> = {
      firstname,
      lastname,
      company: interaction.company,
      jobtitle: interaction.title,
    };
    if (email) properties.email = email;

    if (hubspotContactId) {
      const updateRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/${hubspotContactId}`, {
        method: "PATCH",
        headers: hsHeaders,
        body: JSON.stringify({ properties }),
      });
      if (!updateRes.ok) throw new Error(await describeError(updateRes));
    } else {
      const createRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: hsHeaders,
        body: JSON.stringify({ properties }),
      });
      if (!createRes.ok) throw new Error(await describeError(createRes));
      const created = await createRes.json();
      hubspotContactId = created.id;
    }

    const noteBody = `Met at ${conference?.name ?? interaction.conferenceId} — logged by ${interaction.repName} on ${new Date(
      interaction.timestamp
    ).toLocaleDateString()}.\nTemperature: ${interaction.temperature}\n\n${interaction.notes}`;

    const noteRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/notes`, {
      method: "POST",
      headers: hsHeaders,
      body: JSON.stringify({
        properties: { hs_note_body: noteBody, hs_timestamp: interaction.timestamp },
        associations: hubspotContactId
          ? [
              {
                to: { id: hubspotContactId },
                types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
              },
            ]
          : [],
      }),
    });

    interaction.hubspotContactId = hubspotContactId;
    if (!noteRes.ok) {
      interaction.hubspotStatus = "synced";
      await saveDb(db);
      return NextResponse.json({ status: "synced_no_note", hubspotContactId, warning: await describeError(noteRes) });
    }

    interaction.hubspotStatus = "synced";
    interaction.hubspotError = undefined;
    await saveDb(db);
    return NextResponse.json({ status: "synced", hubspotContactId });
  } catch (err) {
    interaction.hubspotStatus = "failed";
    interaction.hubspotError = err instanceof Error ? err.message : String(err);
    await saveDb(db);
    return NextResponse.json({ error: interaction.hubspotError }, { status: 502 });
  }
}
