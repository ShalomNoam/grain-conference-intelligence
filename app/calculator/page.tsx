"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiKey, getApiProvider, getHubspotToken } from "@/lib/settings";
import { IconSpark, IconCloudSync, IconCopy, IconX } from "@/components/icons";

const CURRENCY_PAIRS = ["USD/EUR", "USD/GBP", "EUR/GBP", "USD/BRL", "USD/MXN", "USD/INR", "EUR/PLN", "USD/THB", "GBP/AED"];

// Ballpark benchmark spreads for a segmented preset picker instead of a raw
// slider — much faster to tap on a noisy show floor than dialing in a
// precise percentage. These are illustrative reference points (same
// "illustrative, not a quote" status as the rest of this calculator), not
// figures independently verified against real market data — worth
// confirming against Grain's actual competitive positioning before using
// this live in front of a prospect.
const PROVIDER_PRESETS = [
  { key: "bank", label: "Traditional Bank", spread: 0.4 },
  { key: "broker", label: "Typical FX Broker", spread: 0.25 },
  { key: "fintech", label: "Other Fintech", spread: 0.18 },
] as const;
type ProviderKey = (typeof PROVIDER_PRESETS)[number]["key"];
const GRAIN_SPREAD = 0.1;

function formatMoney(n: number): string {
  if (!isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

interface RateState {
  rate: number | null;
  loading: boolean;
  error: string | null;
}

export default function CalculatorPage() {
  const [volume, setVolume] = useState(5_000_000);
  const [pair, setPair] = useState(CURRENCY_PAIRS[0]);
  const [providerKey, setProviderKey] = useState<ProviderKey>("bank");
  const [rateState, setRateState] = useState<RateState>({ rate: null, loading: true, error: null });

  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectCompany, setProspectCompany] = useState("");

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const [hubspotBusy, setHubspotBusy] = useState(false);
  const [hubspotMsg, setHubspotMsg] = useState<string | null>(null);

  const [base, quote] = pair.split("/");
  const providerPreset = PROVIDER_PRESETS.find((p) => p.key === providerKey)!;

  // Kept simple on purpose — one live number, not a 4-decimal breakdown.
  // The savings math below never depends on this; a failed fetch just
  // means the line doesn't render.
  useEffect(() => {
    let cancelled = false;
    setRateState({ rate: null, loading: true, error: null });
    fetch(`/api/fx-rate?base=${encodeURIComponent(base)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const r = d.rates?.[quote];
        setRateState(typeof r === "number" ? { rate: r, loading: false, error: null } : { rate: null, loading: false, error: "unavailable" });
      })
      .catch(() => {
        if (!cancelled) setRateState({ rate: null, loading: false, error: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [base, quote]);

  const { currentCost, grainCost, annualSavings, monthlySavings, pctReduction } = useMemo(() => {
    const cCost = volume * (providerPreset.spread / 100);
    const gCost = volume * (GRAIN_SPREAD / 100);
    const savings = Math.max(0, cCost - gCost);
    return {
      currentCost: cCost,
      grainCost: gCost,
      annualSavings: savings,
      monthlySavings: savings / 12,
      pctReduction: cCost > 0 ? (savings / cCost) * 100 : 0,
    };
  }, [volume, providerPreset]);

  // Real-time, deterministic — not routed through an LLM. Every number in
  // it is already computed above, so a template sentence is instant, free,
  // and works with zero API key configured, matching this tool's
  // show-floor "always works" design. The AI call below (email draft) is
  // where an actual LLM adds value: varied phrasing and tone, not just
  // filling in numbers.
  const pitchSentence = `At ${formatCompact(volume)} annual volume in ${pair}, you're currently paying ~${formatMoney(
    annualSavings
  )} extra per year in hidden ${providerPreset.label.toLowerCase()} spreads. Grain locks your rate via API and puts that margin straight back onto your bottom line.`;

  async function generateEmail() {
    setEmailModalOpen(true);
    setEmailLoading(true);
    setEmailError(null);
    setEmailDraft(null);
    try {
      const res = await fetch("/api/ai/fx-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-key": getApiKey(),
          "x-ai-provider": getApiProvider(),
        },
        body: JSON.stringify({
          volume,
          pair,
          providerLabel: providerPreset.label,
          currentSpreadPct: providerPreset.spread,
          grainSpreadPct: GRAIN_SPREAD,
          annualSavingsUsd: annualSavings,
          monthlySavingsUsd: monthlySavings,
          prospectName: prospectName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setEmailError(data.error ?? "Something went wrong.");
      else setEmailDraft(data.email);
    } catch {
      setEmailError("Network error reaching the AI endpoint.");
    } finally {
      setEmailLoading(false);
    }
  }

  function copyEmail() {
    if (!emailDraft) return;
    navigator.clipboard.writeText(emailDraft).then(
      () => {
        setCopyMsg("Copied");
        setTimeout(() => setCopyMsg(null), 1500);
      },
      () => {
        setCopyMsg("Couldn't copy — select manually");
        setTimeout(() => setCopyMsg(null), 2500);
      }
    );
  }

  async function syncToHubspot() {
    if (!prospectName.trim()) {
      setHubspotMsg("Add the prospect's name above first.");
      return;
    }
    const token = getHubspotToken();
    if (!token) {
      setHubspotMsg("Add a HubSpot token in Settings to sync — showing what would be sent instead.");
      return;
    }
    setHubspotBusy(true);
    setHubspotMsg(null);
    try {
      const noteBody = `FX savings estimate from show-floor conversation.\nPair: ${pair} · Volume: ${formatMoney(volume)}/yr · ${providerPreset.label} spread ${providerPreset.spread}% vs Grain ${GRAIN_SPREAD}%.\nEstimated annual savings: ${formatMoney(annualSavings)} (${pctReduction.toFixed(0)}% reduction).`;
      const res = await fetch("/api/hubspot/push-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hubspot-token": token },
        body: JSON.stringify({ name: prospectName, email: prospectEmail || undefined, company: prospectCompany || undefined, noteBody }),
      });
      const data = await res.json();
      setHubspotMsg(res.ok ? "Synced to HubSpot." : data.error ?? "Failed to sync.");
    } catch {
      setHubspotMsg("Network error reaching HubSpot proxy.");
    } finally {
      setHubspotBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <span className="inline-block text-[10.5px] font-mono uppercase tracking-wide bg-warn-bg text-warn-ink rounded-full px-2.5 py-1 mb-2">
          Bonus tool — not one of the 7 core requirements
        </span>
        <h1 className="text-[26px] font-extrabold bg-grain-headline bg-clip-text text-transparent">FX savings, on the spot</h1>
        <p className="text-ink-dim text-[14px] max-w-[65ch] mt-1">
          Built for a noisy conference floor: pick a provider type, drag one slider, and show the dollar number — not a spreadsheet.
        </p>
      </div>

      <div className="bg-white/85 backdrop-blur-sm border border-blue-50/80 shadow-[0_4px_24px_-4px_rgba(20,40,90,0.04)] rounded-2xl p-5 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-ink-dim">Annual cross-border transaction volume</span>
          <p className="text-[28px] font-extrabold text-ink tabular">{formatCompact(volume)}</p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={100000}
              max={200_000_000}
              step={100000}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="text"
              inputMode="numeric"
              value={volume.toLocaleString("en-US")}
              onChange={(e) => setVolume(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
              className="w-28 border border-line rounded-md px-2 py-1.5 text-[13px] tabular text-right"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-ink-dim">Currency pair</span>
          <select value={pair} onChange={(e) => setPair(e.target.value)} className="border border-line rounded-md px-3 py-2 text-[14px] bg-white">
            {CURRENCY_PAIRS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          {rateState.rate !== null && !rateState.loading && (
            <span className="text-[11.5px] text-ink-faint">
              Live rate: 1 {base} = {rateState.rate.toFixed(2)} {quote}
            </span>
          )}
        </label>

        <div>
          <span className="text-[12.5px] text-ink-dim mb-2 block">Prospect&apos;s current provider</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PROVIDER_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setProviderKey(p.key)}
                className={`rounded-lg px-3 py-3 text-left border-2 transition-colors ${
                  providerKey === p.key ? "border-[#2563EB] bg-blue-50" : "border-line bg-white hover:border-blue-200"
                }`}
              >
                <p className="text-[13.5px] font-semibold text-ink">{p.label}</p>
                <p className="text-[12px] text-ink-dim">~{p.spread}% spread</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side-by-side cost comparison — the core "so what" of the tool */}
      <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-danger-bg rounded-xl p-4">
            <p className="text-[11px] text-danger uppercase tracking-wide font-semibold">{providerPreset.label} cost</p>
            <p className="text-[24px] font-bold text-danger tabular mt-1">{formatMoney(currentCost)}</p>
            <p className="text-[11px] text-danger/70">per year</p>
          </div>
          <div className="bg-teal-bg rounded-xl p-4">
            <p className="text-[11px] text-teal uppercase tracking-wide font-semibold">With Grain</p>
            <p className="text-[24px] font-bold text-teal tabular mt-1">{formatMoney(grainCost)}</p>
            <p className="text-[11px] text-teal/70">per year</p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#E0ECFD] via-white to-[#D4E6FA] border border-blue-100 rounded-2xl p-5 text-center">
          <p className="text-[12px] text-[#2563EB] uppercase tracking-wide font-semibold">Estimated annual savings</p>
          <p className="text-[48px] font-extrabold tabular leading-none mt-1 text-[#111A3A]">{formatMoney(annualSavings)}</p>
          <p className="text-[14px] font-semibold text-[#2563EB] mt-1">
            {formatMoney(monthlySavings)}/month · {pctReduction.toFixed(0)}% reduction
          </p>
        </div>
      </div>

      {/* AI talking point — real-time, deterministic (see comment in code) */}
      <div
        className="rounded-xl p-4 flex items-start gap-2.5"
        style={{ background: "linear-gradient(135deg, #f8faff 0%, #f0f7ff 100%)", border: "1px solid rgba(37, 99, 235, 0.2)" }}
      >
        <IconSpark className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
        <p className="text-[13.5px] text-slate-700">{pitchSentence}</p>
      </div>

      {/* Prospect details — minimal, only what HubSpot needs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          value={prospectName}
          onChange={(e) => setProspectName(e.target.value)}
          placeholder="Prospect name"
          className="border border-line rounded-lg px-3 py-2 text-[13.5px]"
        />
        <input
          value={prospectEmail}
          onChange={(e) => setProspectEmail(e.target.value)}
          placeholder="Email (optional)"
          className="border border-line rounded-lg px-3 py-2 text-[13.5px]"
        />
        <input
          value={prospectCompany}
          onChange={(e) => setProspectCompany(e.target.value)}
          placeholder="Company (optional)"
          className="border border-line rounded-lg px-3 py-2 text-[13.5px]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={generateEmail}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white font-semibold text-[14px] px-4 py-3 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <IconSpark className="w-4 h-4" />
          Generate AI Follow-Up Email
        </button>
        <button
          onClick={syncToHubspot}
          disabled={hubspotBusy}
          className="flex items-center justify-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-[14px] px-4 py-3 rounded-xl shadow-sm transition-all disabled:opacity-50"
        >
          <IconCloudSync className="w-4 h-4" />
          {hubspotBusy ? "Syncing…" : "Sync to HubSpot"}
        </button>
      </div>
      {hubspotMsg && <p className="text-[12.5px] text-ink-dim -mt-2">{hubspotMsg}</p>}

      <p className="text-[11.5px] text-ink-faint">
        Provider spreads are illustrative benchmark ranges, not verified market data — confirm against real positioning before a live
        pitch. Exchange rate (when shown) is live. Savings figure is an estimate, not a formal quote.
      </p>

      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEmailModalOpen(false)} />
          <div className="relative bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-semibold text-[#0F172A]">AI Follow-Up Email</p>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50"
                aria-label="Close"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            {emailLoading ? (
              <p className="text-sm text-slate-400 py-6 text-center">Thinking…</p>
            ) : emailError ? (
              <p className="text-sm text-rose-600">{emailError}</p>
            ) : emailDraft ? (
              <>
                <p className="text-[13.5px] text-slate-700 whitespace-pre-line bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {emailDraft}
                </p>
                <button
                  onClick={copyEmail}
                  className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <IconCopy className="w-3.5 h-3.5" />
                  {copyMsg ?? "Copy Draft"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
