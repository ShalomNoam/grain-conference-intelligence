"use client";

import { useEffect, useState } from "react";
import {
  getRepName,
  setRepName as saveRepName,
  getApiKey,
  setApiKey as saveApiKey,
  getApiProvider,
  setApiProvider as saveApiProvider,
  getHubspotToken,
  setHubspotToken as saveHubspotToken,
} from "@/lib/settings";
import { detectProvider, isAiProvider, ALL_PROVIDERS, PROVIDER_LABEL, type AiProvider } from "@/lib/ai-provider";

export default function SettingsPage() {
  const [rep, setRep] = useState("");
  const [apiKey, setApiKeyState] = useState("");
  const [manualProvider, setManualProvider] = useState<AiProvider | "">("");
  const [showPicker, setShowPicker] = useState(false);
  const [hubspotToken, setHubspotTokenState] = useState("");
  const [sharedStorage, setSharedStorage] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRep(getRepName());
    setApiKeyState(getApiKey());
    const storedProvider = getApiProvider();
    if (isAiProvider(storedProvider)) setManualProvider(storedProvider);
    setHubspotTokenState(getHubspotToken());
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((d) => setSharedStorage(Boolean(d.sharedStorage)));
  }, []);

  const detected = detectProvider(apiKey);
  const effectiveProvider = manualProvider || detected || "";
  const needsManualPick = Boolean(apiKey.trim()) && !effectiveProvider;

  function onApiKeyChange(v: string) {
    setApiKeyState(v);
    // A new key invalidates whatever provider was picked for the old one —
    // re-detect from scratch rather than silently keeping a stale override.
    setManualProvider("");
    setShowPicker(false);
  }

  function save() {
    saveRepName(rep);
    saveApiKey(apiKey);
    saveApiProvider(effectiveProvider);
    saveHubspotToken(hubspotToken);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#2563EB] mb-1">Settings</p>
        <h1 className="text-[26px] font-extrabold bg-grain-headline bg-clip-text text-transparent">Your keys, your browser</h1>
        <p className="text-ink-dim text-[13.5px] mt-1">
          Everything stored locally (browser only) and sent per-request to the server proxy — never hardcoded, never in a database.
        </p>
      </div>

      <div className="bg-white/85 backdrop-blur-sm border border-blue-50/80 shadow-[0_4px_24px_-4px_rgba(20,40,90,0.04)] rounded-2xl p-4 flex flex-col gap-2">
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
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Paste your Gemini, Claude, OpenAI, or OpenRouter key…"
            className="border border-line rounded-lg px-4 min-h-[48px] text-[14px] font-mono"
          />

          {apiKey.trim() !== "" && (
            <div className="flex flex-col gap-1.5">
              {effectiveProvider ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-semibold text-teal">
                    ✓ Key recognized successfully ({PROVIDER_LABEL[effectiveProvider]})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPicker((s) => !s)}
                    className="text-[11.5px] text-ink-faint underline underline-offset-2"
                  >
                    {showPicker ? "Cancel" : "Not right? Change provider"}
                  </button>
                </div>
              ) : (
                <span className="text-[12.5px] font-semibold text-warn-ink">
                  We didn&apos;t auto-detect the provider — please choose one:
                </span>
              )}

              {(needsManualPick || showPicker) && (
                <select
                  value={manualProvider}
                  onChange={(e) => {
                    const v = e.target.value;
                    setManualProvider(isAiProvider(v) ? v : "");
                    setShowPicker(false);
                  }}
                  className="border border-line rounded-lg px-3 min-h-[44px] text-[13.5px] bg-paper-surface"
                >
                  <option value="">Choose provider…</option>
                  {ALL_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABEL[p]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <span className="text-[12px] text-ink-faint">
            Powers AI relationship summaries. Paste any Gemini, Claude, OpenAI, or OpenRouter key — the provider is detected
            automatically, or pick it yourself if we get it wrong.
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
        className="bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white rounded-lg min-h-[52px] text-[16px] font-bold shadow-sm hover:shadow-md hover:from-[#2563EB] hover:to-[#1D4ED8] transition-all"
      >
        {saved ? "✓ Saved" : "Save Settings"}
      </button>
    </div>
  );
}
