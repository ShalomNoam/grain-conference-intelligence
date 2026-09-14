import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeRelationshipArc } from "@/lib/nudge";
import { buildRelationshipSummaryPrompt } from "@/lib/ai-prompt";

export const dynamic = "force-dynamic";

// Proxies to Google's Gemini API. The key is never read from an env var on
// the server by default — it comes from the request header, which the
// client fills in from whatever the rep typed into Settings (localStorage).
// This keeps the key "configurable by the user, not hardcoded" per the
// assignment's constraint, and avoids the CORS/exposure problems of
// calling Gemini directly from the browser. Falls back to GEMINI_API_KEY
// from the server environment only if no per-request key was supplied —
// useful if a team wants to bake in one shared key as a deployment default.
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-gemini-key") || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Gemini API key configured. Add one in Settings to enable AI summaries." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const contactId: string | undefined = body.contactId;
  if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 });

  const db = await getDb();
  const contact = db.contacts.find((c) => c.id === contactId);
  if (!contact) return NextResponse.json({ error: "contact not found" }, { status: 404 });

  const interactions = db.interactions
    .filter((i) => i.contactId === contactId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (interactions.length === 0) {
    return NextResponse.json({ error: "no interactions logged for this contact yet" }, { status: 400 });
  }

  const arc = computeRelationshipArc(interactions);
  const conferenceNameById = Object.fromEntries(db.conferences.map((c) => [c.id, c.name]));
  const prompt = buildRelationshipSummaryPrompt(contact, interactions, arc, conferenceNameById);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 220 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Gemini API error (${res.status}). Check the key in Settings. ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json({ error: "Gemini returned no content (it may have blocked the prompt)." }, { status: 502 });
    }

    return NextResponse.json({ summary: text.trim(), arc });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach Gemini: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
