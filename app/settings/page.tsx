"use client";

import { useEffect, useState } from "react";
import {
  getRepName,
  setRepName as saveRepName,
  getGeminiKey,
  setGeminiKey as saveGeminiKey,
  getHubspotToken,
  setHubspotToken as saveHubspotToken,
} from "@/lib/settings";

export default function SettingsPage() {
  const [rep, setRep] = useState("");
  const [geminiKey, setGeminiKeyState] = useState("");
  const [hubspotToken, setHubspotTokenState] = useState("");
  const [sharedStorage, setSharedStorage] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRep(getRepName());
    setGeminiKeyState(getGeminiKey());
    setHubspotTokenState(getHubspotToken());
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((d) => setSharedStorage(Boolean(d.sharedStorage)));
  }, []);

  function save() {
    saveRepName(rep);
    saveGeminiKey(geminiKey);
    saveHubspotToken(hubspotToken);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-gold-ink mb-1">Settings</p>
        <h1 className="text-[24px] font-bold">Your keys, your browser, your control</h1>
        <p className="text-ink-dim text-[13.5px] mt-1">
          Everything below is stored only in this browser (localStorage) and sent per-request to this app&apos;s own server proxy — never
          written to a database, never hardcoded in source. Clearing your browser data clears these too.
        </p>
      </div>

      <div className="bg-paper-surface border border-line rounded-DEFAULT p-4 flex flex-col gap-1.5">
        <p className="text-[13px] font-medium">Team data storage</p>
        <p className="text-[12.5px] text-ink-dim">
          {sharedStorage === null
            ? "Checking…"
            : sharedStorage
            ? "Shared storage connected (Upstash Redis) — every rep on every device sees the same conferences and leads."
            : "Local demo mode — conferences/leads persist on this deployed instance but aren't guaranteed to sync across reps yet. Add a free Upstash Redis database (2 minutes, see README) for real shared, persistent team data."}
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Your name</span>
        <input value={rep} onChange={(e) => setRep(e.target.value)} placeholder="e.g. Noa Peretz" className="border border-line rounded-lg px-3 py-2.5 text-[14px]" />
        <span className="text-[12px] text-ink-faint">Used to attribute leads you capture and coverage you sign up for.</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Gemini API key</span>
        <input
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKeyState(e.target.value)}
          placeholder="AIza…"
          className="border border-line rounded-lg px-3 py-2.5 text-[14px] font-mono"
        />
        <span className="text-[12px] text-ink-faint">
          Powers the AI relationship-arc summary on the Contacts page. Get a free key at{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-teal underline">
            aistudio.google.com/apikey
          </a>
          .
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">HubSpot private-app token</span>
        <input
          type="password"
          value={hubspotToken}
          onChange={(e) => setHubspotTokenState(e.target.value)}
          placeholder="pat-…"
          className="border border-line rounded-lg px-3 py-2.5 text-[14px] font-mono"
        />
        <span className="text-[12px] text-ink-faint">
          Needs the crm.objects.contacts.write and crm.objects.notes.write scopes. Create one under your HubSpot account → Settings →
          Integrations → Private Apps.
        </span>
      </label>

      <button onClick={save} className="bg-ink text-white rounded-full py-3 text-[14px] font-semibold self-start px-6">
        {saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
