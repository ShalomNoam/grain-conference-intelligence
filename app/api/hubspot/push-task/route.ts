import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const HUBSPOT_BASE = "https://api.hubapi.com";

async function describeError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return `HubSpot API error (${res.status}): ${text.slice(0, 300)}`;
}

// Companion to /api/hubspot/push (which finds-or-creates the Contact and
// attaches a Note). This creates a follow-up Task instead, carrying the
// AI-drafted email as the task body — used by the "Push to HubSpot as
// Task" action in the Contacts AI drawer. Same find-or-create-by-email
// pattern as the Note push, reused rather than duplicated logic drifting
// out of sync.
export async function POST(req: Request) {
  const token = req.headers.get("x-hubspot-token") || process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "No HubSpot token configured. Add a private-app token in Settings to enable sync." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const contactId: string | undefined = body.contactId;
  const taskBody: string | undefined = body.taskBody;
  const taskSubject: string = body.taskSubject || "Follow up (Grain Conference Intel)";
  if (!contactId || !taskBody) return NextResponse.json({ error: "contactId and taskBody are required" }, { status: 400 });

  const db = await getDb();
  const contact = db.contacts.find((c) => c.id === contactId);
  if (!contact) return NextResponse.json({ error: "contact not found" }, { status: 404 });

  const hsHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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

    if (!hubspotContactId) {
      const [firstname, ...rest] = contact.displayName.split(" ");
      const latest = contact.companyHistory[contact.companyHistory.length - 1];
      const createRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: hsHeaders,
        body: JSON.stringify({
          properties: {
            firstname,
            lastname: rest.join(" ") || "-",
            company: latest?.company ?? "",
            jobtitle: latest?.title ?? "",
            ...(email ? { email } : {}),
          },
        }),
      });
      if (!createRes.ok) throw new Error(await describeError(createRes));
      const created = await createRes.json();
      hubspotContactId = created.id;
    }

    const taskRes = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/tasks`, {
      method: "POST",
      headers: hsHeaders,
      body: JSON.stringify({
        properties: {
          hs_task_subject: taskSubject,
          hs_task_body: taskBody,
          hs_timestamp: new Date().toISOString(),
          hs_task_status: "NOT_STARTED",
          hs_task_priority: "MEDIUM",
        },
        associations: hubspotContactId
          ? [
              {
                to: { id: hubspotContactId },
                types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }],
              },
            ]
          : [],
      }),
    });

    if (!taskRes.ok) throw new Error(await describeError(taskRes));
    const task = await taskRes.json();
    return NextResponse.json({ status: "task_created", hubspotContactId, taskId: task.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
