import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeRelationshipArc } from "@/lib/nudge";
import { buildRelationshipSummaryPrompt } from "@/lib/ai-prompt";
import { callAiProvider, isAiProvider } from "@/lib/ai-provider";

export const dynamic = "force-dynamic";

// Proxies to whichever LLM vendor the rep's pasted key belongs to (see
// lib/ai-provider.ts for the detection + per-vendor request logic). The key
// is never read from an env var on the server by default — it comes from
// the request header, filled in from whatever the rep typed into Settings
// (localStorage). This keeps the key "configurable by the user, not
// hardcoded" per the assignment's constraint, and avoids the CORS/exposure
// problems of calling the vendor API directly from the browser. Falls back
// to GEMINI_API_KEY from the server environment only if no per-request key
// was supplied — useful if a team wants to bake in one shared key as a
// deployment default.
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-ai-key") || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key configured. Add one in Settings to enable AI summaries." },
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

  const providerHeader = req.headers.get("x-ai-provider") ?? "";
  const result = await callAiProvider(apiKey, prompt, { provider: isAiProvider(providerHeader) ? providerHeader : undefined });
  if (!result.text) {
    return NextResponse.json({ error: result.error ?? "The AI provider returned no content." }, { status: 502 });
  }

  return NextResponse.json({ summary: result.text, arc, provider: result.provider });
}
