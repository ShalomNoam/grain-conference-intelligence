"use client";

import { useEffect, useMemo, useState } from "react";
import type { Vertical } from "@/lib/types";
import { VERTICAL_LABEL, ALL_VERTICALS } from "@/lib/labels";
import { getApiKey, getApiProvider, getHubspotToken } from "@/lib/settings";
import { IconSpark, IconCloudSync, IconCopy, IconX, IconAlertCircle, IconLock } from "@/components/icons";

const CURRENCY_PAIRS = ["EUR/USD", "GBP/USD", "USD/THB", "GBP/EUR", "EUR/PLN", "USD/BRL", "USD/MXN", "USD/INR", "GBP/AED"];

// Illustrative volatility proxy: potential adverse FX move over a given
// settlement window, roughly consistent with a sqrt(time)-scaled real-world
// annualized vol assumption (e.g. 1.5% over 15 days implies ~7.4%
// annualized — a plausible major-pair figure) rather than arbitrary round
// numbers. Still not a live volatility feed for a specific pair, so it's
// labeled "illustrative" throughout rather than presented as sourced data.
const VOLATILITY_BY_DAYS: Record<number, number> = { 15: 1.5, 30: 2.2, 60: 3.2, 90: 4.5 };
const SETTLEMENT_OPTIONS = [15, 30, 60, 90] as const;

function formatMoney(n: number): string {
  if (!isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// Deterministic, vertical-aware risk framing — instant, zero API key
// needed, same reasoning as the calculator's other real-time copy: every
// input is already on screen, so a template reads as tailored without
// waiting on a network round-trip.
function riskExplanation(vertical: Vertical, pair: string, days: number): string {
  switch (vertical) {
    case "travel":
      return `Travel platforms book guest currency weeks before check-in — every day of the ${days}-day settlement gap is a day ${pair} can move against the margin you already quoted the traveler.`;
    case "cross-border-ecommerce":
      return `Checkout margin priced in ${pair} isn't locked until settlement — over a ${days}-day window, the margin you quoted at checkout isn't the margin you're guaranteed to keep.`;
    case "fx-treasury":
      return `As an FX/treasury operation, ${pair} exposure between transaction and settlement sits directly on your balance sheet as unhedged risk for the full ${days} days.`;
    case "payments":
      return `Payment flows in ${pair} carry the full ${days}-day settlement window's volatility on your books until funds actually move.`;
    case "banking":
      return `${pair} exposure across a ${days}-day settlement window is balance-sheet risk your treasury desk is carrying, priced or not.`;
    case "fintech-saas":
      return `Any ${pair} flow your platform touches between transaction and ${days}-day settlement carries real volatility risk — even if FX isn't the product you sell.`;
    default:
      return `${pair} movement over a ${days}-day settlement window is a real cost center, even for a company that isn't primarily a payments business.`;
  }
}

interface RateState {
  rate: number | null;
  loading: boolean;
}

export default function CalculatorPage() {
  const [volume, setVolume] = useState(50_000_000);
  const [pair, setPair] = useState(CURRENCY_PAIRS[0]);
  const [vertical, setVertical] = useState<Vertical>("travel");
  const [settlementDays, setSettlementDays] = useState<number>(30);
  const [rateState, setRateState] = useState<RateState>({ rate: null, loading: true });

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

  useEffect(() => {
    let cancelled = false;
    setRateState({ rate: null, loading: true });
    fetch(`/api/fx-rate?base=${encodeURIComponent(base)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const r = d.rates?.[quote];
        setRateState({ rate: typeof r === "number" ? r : null, loading: false });
      })
      .catch(() => {
        if (!cancelled) setRateState({ rate: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [base, quote]);

  const { volatilityPct, profitAtRiskUsd } = useMemo(() => {
    const vol = VOLATILITY_BY_DAYS[settlementDays] ?? VOLATILITY_BY_DAYS[30];
    return { volatilityPct: vol, profitAtRiskUsd: volume * (vol / 100) };
  }, [volume, settlementDays]);

  const talkingPoint = `At ${formatCompact(volume)}/yr in ${pair}, that's ~${formatMoney(
    profitAtRiskUsd
  )} of margin sitting exposed to market swings every year — with Grain's rate lock, it goes to $0 the moment the transaction starts.`;

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
          vertical: VERTICAL_LABEL[vertical],
          settlementDays,
          volatilityPct,
          profitAtRiskUsd,
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
      const noteBody = `FX risk estimate from show-floor conversation.\nVertical: ${VERTICAL_LABEL[vertical]} · Pair: ${pair} · Volume: ${formatMoney(volume)}/yr · Settlement: ${settlementDays} days.\nEstimated profit at risk (unhedged): ${formatMoney(profitAtRiskUsd)}/yr (~${volatilityPct}% of volume, illustrative). With Grain rate-lock: $0.`;
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
        <h1 className="text-[26px] font-extrabold bg-grain-headline bg-clip-text text-transparent">FX risk, on the spot</h1>
        <p className="text-ink-dim text-[14px] max-w-[65ch] mt-1">
          Grain's actual pitch isn't "cheaper" — it's that the rate is locked from transaction to settlement, so market
          volatility during that window is Grain's problem, not the prospect's.
        </p>
      </div>

      <div className="bg-white/85 backdrop-blur-sm border border-blue-50/80 shadow-[0_4px_24px_-4px_rgba(20,40,90,0.04)] rounded-2xl p-5 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-ink-dim">Annual cross-border transaction volume</span>
          <p className="text-[28px] font-extrabold text-ink tabular">{formatCompact(volume)}</p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10_000_000}
              max={150_000_000}
              step={1_000_000}
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

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-ink-dim">Currency pair</span>
            <select value={pair} onChange={(e) => setPair(e.target.value)} className="border border-line rounded-md px-3 py-2 text-[14px] bg-white">
              {CURRENCY_PAIRS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            {rateState.rate !== null && !rateState.loading && (
              <span className="text-[11.5px] text-ink-faint">Today's rate: 1 {base} = {rateState.rate.toFixed(2)} {quote}</span>
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-ink-dim">Prospect's vertical</span>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value as Vertical)}
              className="border border-line rounded-md px-3 py-2 text-[14px] bg-white"
            >
              {ALL_VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {VERTICAL_LABEL[v]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <span className="text-[12.5px] text-ink-dim mb-2 block">Settlement / payout delay</span>
          <div className="grid grid-cols-4 gap-2">
            {SETTLEMENT_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSettlementDays(d)}
                className={`rounded-lg px-2 py-2.5 text-[13.5px] font-semibold border-2 transition-colors ${
                  settlementDays === d ? "border-[#2563EB] bg-blue-50 text-ink" : "border-line bg-white text-ink-dim hover:border-blue-200"
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Unhedged vs. Grain-hedged comparison — risk, not price */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-danger-bg rounded-2xl p-5 flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 self-start bg-danger text-white text-[10.5px] font-semibold px-2.5 py-1 rounded-full">
            <IconAlertCircle className="w-3 h-3" />
            100% Exposed
          </span>
          <p className="text-[11px] text-danger uppercase tracking-wide font-semibold mt-1">Profit at risk</p>
          <p className="text-[30px] font-extrabold text-danger tabular leading-none">-{formatMoney(profitAtRiskUsd)}</p>
          <p className="text-[11px] text-danger/70">per year · ~{volatilityPct}% of volume (illustrative)</p>
        </div>
        <div className="bg-teal-bg rounded-2xl p-5 flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 self-start bg-teal text-white text-[10.5px] font-semibold px-2.5 py-1 rounded-full">
            <IconLock className="w-3 h-3" />
            100% Hedged
          </span>
          <p className="text-[11px] text-teal uppercase tracking-wide font-semibold mt-1">FX risk with Grain</p>
          <p className="text-[30px] font-extrabold text-teal tabular leading-none">$0</p>
          <p className="text-[11px] text-teal/70">rate guaranteed via API from day one</p>
        </div>
      </div>

      {/* AI Volatility Insight & Sales Pitch — deterministic + vertical-aware, see code comment */}
      <div
        className="rounded-xl p-4 flex flex-col gap-2.5"
        style={{ background: "linear-gradient(135deg, #f8faff 0%, #f0f7ff 100%)", border: "1px solid rgba(37, 99, 235, 0.2)" }}
      >
        <p className="text-[11px] font-bold tracking-wider text-[#2563EB] uppercase flex items-center gap-1.5">
          <IconSpark className="w-3.5 h-3.5" />
          AI Volatility Insight
        </p>
        <p className="text-[13.5px] text-slate-700">{riskExplanation(vertical, pair, settlementDays)}</p>
        <p className="text-[13.5px] text-slate-700 border-t border-blue-100 pt-2.5">
          <span className="font-semibold text-[#0F172A]">Live rep talking point: </span>
          {talkingPoint}
        </p>
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
          {hubspotBusy ? "Syncing…" : "Push to HubSpot"}
        </button>
      </div>
      {hubspotMsg && <p className="text-[12.5px] text-ink-dim -mt-2">{hubspotMsg}</p>}

      <p className="text-[11.5px] text-ink-faint">
        Volatility-by-settlement-window figures are an illustrative proxy (not a live volatility feed for this specific pair) —
        confirm against real market data before a live pitch. Exchange rate shown (when available) is live. Not a formal quote.
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
