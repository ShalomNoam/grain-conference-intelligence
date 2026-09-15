import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HUBSPOT_BASE = "https://api.hubapi.com";

async function describeError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return `HubSpot API error (${res.status}): ${text.slice(0, 300)}`;
}

// Companion to /api/hubspot/push, for leads that don't have a local
// Contact/Interaction record yet — the FX Calculator is a spontaneous
// show-floor conversation starter, not something routed through Capture
// first, so there's no local contactId to look up. Takes name/email/notes
// directly and does the same find-or-create-Contact + attach-Note pattern
// straight against HubSpot.
export async function POST(req: Request) {
  const token = req.headers.get("x-hubspot-token") || process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "No HubSpot token configured. Add a private-app token in Settings to enable sync." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const name: string | undefined = body.name?.trim();
  const email: string | undefined = body.email?.trim();
  const company: string = body.company?.trim() ?? "";
  const noteBody: string = body.noteBody ?? "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const hsHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [firstname, ...rest] = name.split(" ");
  const lastname = rest.join(" ") || "-";

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

    const properties: Record<string, string> = { firstname, lastname };
    if (company) properties.company = company;
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

    if (noteBody) {
      const noteRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/notes`, {
        method: "POST",
        headers: hsHeaders,
        body: JSON.stringify({
          properties: { hs_note_body: noteBody, hs_timestamp: new Date().toISOString() },
          associations: hubspotContactId
            ? [{ to: { id: hubspotContactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }]
            : [],
        }),
      });
      if (!noteRes.ok) {
        return NextResponse.json({ status: "synced_no_note", hubspotContactId, warning: await describeError(noteRes) });
      }
    }

    return NextResponse.json({ status: "synced", hubspotContactId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
