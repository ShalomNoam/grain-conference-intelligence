"use client";

import { useEffect, useState } from "react";
import {
  getRepName,
  setRepName as saveRepName,
  getApiKey,
  setApiKey as saveApiKey,
  getHubspotToken,
  setHubspotToken as saveHubspotToken,
} from "@/lib/settings";
import { detectProvider, PROVIDER_LABEL } from "@/lib/ai-provider";

export default function SettingsPage() {
  const [rep, setRep] = useState("");
  const [apiKey, setApiKeyState] = useState("");
  const [hubspotToken, setHubspotTokenState] = useState("");
  const [sharedStorage, setSharedStorage] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRep(getRepName());
    setApiKeyState(getApiKey());
    setHubspotTokenState(getHubspotToken());
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((d) => setSharedStorage(Boolean(d.sharedStorage)));
  }, []);

  const provider = detectProvider(apiKey);

  function save() {
    saveRepName(rep);
    saveApiKey(apiKey);
    saveHubspotToken(hubspotToken);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-gold-ink mb-1">Settings</p>
        <h1 className="text-[24px] font-bold">Your keys, your browser</h1>
        <p className="text-ink-dim text-[13.5px] mt-1">
          Everything stored locally (browser only) and sent per-request to the server proxy — never hardcoded, never in a database.
        </p>
      </div>

      <div className="bg-paper-surface border border-line rounded-DEFAULT p-4 flex flex-col gap-2">
        <p className="text-[13px] font-semibold">Team data storage</p>
        <p className="text-[12.5px] text-ink-dim leading-relaxed">
          {sharedStorage === null
            ? "Checking…"
            : sharedStorage
            ? "✓ Shared storage enabled (Upstash Redis) — everyone sees the same data."
            : "⚠️ Demo mode — data on this instance only. Add Upstash Redis for team sharing (see README)."}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">Your name</span>
          <input
            value={rep}
            onChange={(e) => setRep(e.target.value)}
            placeholder="e.g. Noa Peretz"
            className="border border-line rounded-lg px-4 min-h-[48px] text-[15px]"
          />
          <span className="text-[12px] text-ink-faint">Attribute your leads and coverage assignments.</span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyState(e.target.value)}
            placeholder="Paste your Gemini, Claude, or OpenAI key…"
            className="border border-line rounded-lg px-4 min-h-[48px] text-[14px] font-mono"
          />
          {apiKey.trim() &&
            (provider ? (
              <span className="text-[12.5px] font-semibold text-teal">✓ Key recognized successfully ({PROVIDER_LABEL[provider]})</span>
            ) : (
              <span className="text-[12.5px] font-semibold text-danger">Key format not recognized — double-check for typos.</span>
            ))}
          <span className="text-[12px] text-ink-faint">
            Powers AI relationship summaries. Paste any Gemini, Claude, or OpenAI key — the provider is detected automatically.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">HubSpot private-app token</span>
          <input
            type="password"
            value={hubspotToken}
            onChange={(e) => setHubspotTokenState(e.target.value)}
            placeholder="pat-…"
            className="border border-line rounded-lg px-4 min-h-[48px] text-[14px] font-mono"
          />
          <span className="text-[12px] text-ink-faint">
            Needs crm.objects.contacts.write scope. Create under HubSpot → Settings → Integrations → Private Apps.
          </span>
        </label>
      </div>

      <button
        onClick={save}
        className="bg-ink text-white rounded-full min-h-[52px] text-[16px] font-bold disabled:opacity-50 transition-opacity"
      >
        {saved ? "✓ Saved" : "Save Settings"}
      </button>
    </div>
  );
}
