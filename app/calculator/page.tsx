"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Vertical } from "@/lib/types";
import { VERTICAL_LABEL, ALL_VERTICALS } from "@/lib/labels";
import { getApiKey, getApiProvider, getHubspotToken } from "@/lib/settings";
import { IconSpark, IconCloudSync, IconCopy, IconX, IconAlertCircle, IconLock, IconDownload } from "@/components/icons";

// Frankfurter (ECB reference rates) doesn't cover pegged currencies like AED,
// so the pair list here is the set it can actually give real history for —
// this replaced an earlier 9-pair list that included GBP/AED, which worked
// for a live spot rate but can't produce a real historical chart.
const CCY_CODES = ["EUR", "USD", "GBP", "JPY", "BRL", "MXN", "INR", "THB", "PLN"] as const;
type CcyCode = (typeof CCY_CODES)[number];
const CCY_NAME: Record<CcyCode, string> = {
  EUR: "Euro",
  USD: "US Dollar",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  BRL: "Brazilian Real",
  MXN: "Mexican Peso",
  INR: "Indian Rupee",
  THB: "Thai Baht",
  PLN: "Polish Zloty",
};

type Horizon = "3m" | "6m" | "12m" | "stress";
const HORIZON_PILLS: { key: Horizon; label: string }[] = [
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "12m", label: "12M" },
  { key: "stress", label: "2022–23" },
];
const HORIZON_LONG: Record<Horizon, string> = {
  "3m": "trailing 3-month",
  "6m": "trailing 6-month",
  "12m": "trailing 12-month",
  stress: "Jan 2022–Dec 2023 stress-period",
};

const SETTLEMENT_OPTIONS = [30, 60, 90] as const;
const BPS_TIERS = [20, 25, 35] as const;

interface RatePoint {
  date: string;
  rate: number;
}

interface SwingResult {
  worstAbsPct: number;
  worstStart: string | null;
  worstEnd: string | null;
  direction: "weakened" | "strengthened" | null;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function horizonToDates(horizon: Horizon): { start: string; end: string } {
  const end = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (horizon === "stress") return { start: "2022-01-01", end: "2023-12-31" };
  const start = new Date(end);
  if (horizon === "3m") start.setMonth(start.getMonth() - 3);
  if (horizon === "6m") start.setMonth(start.getMonth() - 6);
  if (horizon === "12m") start.setFullYear(start.getFullYear() - 1);
  return { start: fmt(start), end: fmt(end) };
}

// Direct client-side fetch, no server proxy — Frankfurter needs no key and
// already sends real CORS headers from api.frankfurter.dev (confirmed: the
// older api.frankfurter.app 301-redirects here, and that redirect response
// itself has no CORS header, which breaks a browser fetch even though curl
// follows it fine — hitting .dev directly avoids that entirely).
async function fetchSeries(base: string, quote: string, horizon: Horizon): Promise<RatePoint[]> {
  const { start, end } = horizonToDates(horizon);
  const url = `https://api.frankfurter.dev/v1/${start}..${end}?from=${base}&to=${quote}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter API returned HTTP ${res.status}`);
  const data = await res.json();
  const entries: RatePoint[] = Object.entries(data.rates ?? {})
    .map(([date, obj]) => ({ date, rate: (obj as Record<string, number>)[quote] }))
    .filter((e) => typeof e.rate === "number")
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length < 2) throw new Error(`Not enough historical data for ${base}/${quote} in this window.`);
  return entries;
}

// The real stress test: the worst rolling N-trading-day swing actually
// observed in the fetched series, not an assumed volatility constant. N
// calendar settlement days is approximated as N*5/7 trading days (ECB
// publishes on business days only).
function worstRollingSwing(series: RatePoint[], settlementDays: number): SwingResult {
  const offset = Math.max(1, Math.round((settlementDays * 5) / 7));
  let worstAbsPct = 0;
  let worstStart: string | null = null;
  let worstEnd: string | null = null;
  let direction: SwingResult["direction"] = null;
  for (let i = 0; i + offset < series.length; i++) {
    const a = series[i].rate;
    const b = series[i + offset].rate;
    const pct = (b - a) / a;
    if (Math.abs(pct) > worstAbsPct) {
      worstAbsPct = Math.abs(pct);
      worstStart = series[i].date;
      worstEnd = series[i + offset].date;
      direction = pct < 0 ? "weakened" : "strengthened";
    }
  }
  return { worstAbsPct, worstStart, worstEnd, direction };
}

// Deterministic, vertical-aware framing — instant, zero API key needed.
function verticalFraming(vertical: Vertical, pair: string, days: number): string {
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

export default function CalculatorPage() {
  const [baseCcy, setBaseCcy] = useState<CcyCode>("EUR");
  const [quoteCcy, setQuoteCcy] = useState<CcyCode>("USD");
  const [volume, setVolume] = useState(50_000_000);
  const [vertical, setVertical] = useState<Vertical>("travel");
  const [horizon, setHorizon] = useState<Horizon>("6m");
  const [settlementDays, setSettlementDays] = useState<number>(60);
  const [bpsTier, setBpsTier] = useState<number>(25);

  const [series, setSeries] = useState<RatePoint[] | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  const [chartReady, setChartReady] = useState(false);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<{ destroy: () => void } | null>(null);

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

  const pair = `${baseCcy}/${quoteCcy}`;

  useEffect(() => {
    let cancelled = false;
    setSeriesLoading(true);
    setSeriesError(null);
    fetchSeries(baseCcy, quoteCcy, horizon)
      .then((s) => {
        if (cancelled) return;
        setSeries(s);
        setSeriesLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setSeriesError(err instanceof Error ? err.message : "Couldn't load historical rates.");
        setSeries(null);
        setSeriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseCcy, quoteCcy, horizon]);

  function onBaseChange(v: CcyCode) {
    setBaseCcy(v);
    if (v === quoteCcy) setQuoteCcy(CCY_CODES.find((c) => c !== v) ?? "USD");
  }
  function onQuoteChange(v: CcyCode) {
    setQuoteCcy(v);
    if (v === baseCcy) setBaseCcy(CCY_CODES.find((c) => c !== v) ?? "EUR");
  }

  const swing = useMemo<SwingResult | null>(
    () => (series ? worstRollingSwing(series, settlementDays) : null),
    [series, settlementDays]
  );

  const exposure = swing ? volume * swing.worstAbsPct : 0;
  const fee = volume * (bpsTier / 10_000);
  const net = Math.max(0, exposure - fee);

  // Render/update the historical-rate chart whenever the Chart.js UMD bundle
  // has loaded and the series changes. cdnjs's default chart.min.js build is
  // an ES module and silently fails in a plain <script> tag — chart.umd.min.js
  // is the compatible build (verified directly against the file contents).
  useEffect(() => {
    if (!chartReady || !series || !chartCanvasRef.current) return;
    const ChartCtor = (window as unknown as { Chart?: any }).Chart;
    if (!ChartCtor) return;
    chartInstanceRef.current?.destroy();
    const ctx = chartCanvasRef.current.getContext("2d");
    chartInstanceRef.current = new ChartCtor(ctx, {
      type: "line",
      data: {
        labels: series.map((e) => e.date),
        datasets: [
          {
            data: series.map((e) => e.rate),
            borderColor: "#2563EB",
            backgroundColor: (context: any) => {
              const { ctx: c, chartArea } = context.chart;
              if (!chartArea) return "rgba(37,99,235,0.08)";
              const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0, "rgba(37,99,235,0.18)");
              g.addColorStop(1, "rgba(37,99,235,0.0)");
              return g;
            },
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: "#94A3B8", font: { size: 11 } } },
          y: { grid: { color: "#F1F5F9" }, ticks: { color: "#94A3B8", font: { size: 11 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0F172A",
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 11 },
            bodyFont: { size: 12, weight: "600" },
            callbacks: { label: (item: any) => `1 ${baseCcy} = ${item.parsed.y.toFixed(4)} ${quoteCcy}` },
          },
        },
      },
    });
  }, [chartReady, series, baseCcy, quoteCcy]);

  useEffect(
    () => () => {
      chartInstanceRef.current?.destroy();
    },
    []
  );

  const narrative = useMemo(() => {
    if (!swing || !swing.worstStart) return null;
    const pct = (swing.worstAbsPct * 100).toFixed(1);
    const vertLine = verticalFraming(vertical, pair, settlementDays);
    const dataLine = `Over the ${HORIZON_LONG[horizon]} window, ${pair} moved ${pct}% during its worst ${settlementDays}-day stretch on record — the pair ${swing.direction} between ${swing.worstStart} and ${swing.worstEnd}. Left unhedged, that's ${formatMoney(
      exposure
    )} of margin exposed on ${formatCompact(volume)} in annual volume.`;
    return `${vertLine} ${dataLine}`;
  }, [swing, vertical, pair, settlementDays, horizon, exposure, volume]);

  async function generateEmail() {
    if (!swing) return;
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
          volatilityPct: Math.round(swing.worstAbsPct * 1000) / 10,
          profitAtRiskUsd: exposure,
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
      const swingLine = swing?.worstStart
        ? `Worst observed ${settlementDays}-day swing over the ${HORIZON_LONG[horizon]} window: ${(swing.worstAbsPct * 100).toFixed(
            1
          )}% (${swing.worstStart} → ${swing.worstEnd}).`
        : "";
      const noteBody = `FX risk estimate from show-floor conversation.\nVertical: ${VERTICAL_LABEL[vertical]} · Pair: ${pair} · Volume: ${formatMoney(
        volume
      )}/yr · Settlement: Net ${settlementDays}.\n${swingLine}\nUnhedged exposure risk: ${formatMoney(exposure)}/yr. Grain platform cost (${bpsTier} bps): ${formatMoney(
        fee
      )}/yr. Net protected profit with Grain: ${formatMoney(net)}/yr.`;
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

  const latestPoint = series?.[series.length - 1];

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.1/chart.umd.min.js"
        strategy="afterInteractive"
        onLoad={() => setChartReady(true)}
      />

      <div>
        <h1 className="text-[26px] font-extrabold bg-grain-headline bg-clip-text text-transparent">FX risk, on the spot</h1>
        <p className="text-ink-dim text-[14px] max-w-[75ch] mt-1">
          Grain's actual pitch isn't "cheaper" — it's that the rate is locked from transaction to settlement. This isn't an
          illustrative estimate: it's live ECB reference-rate history, run through the actual worst settlement-window swing
          that pair has made historically — a real number, not a hypothetical one.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr] items-start">
        {/* Parameters */}
        <div className="print:hidden bg-white/85 backdrop-blur-sm border border-blue-50/80 shadow-[0_4px_24px_-4px_rgba(20,40,90,0.04)] rounded-2xl p-5 flex flex-col gap-5 lg:sticky lg:top-5">
          <div>
            <span className="text-[12.5px] text-ink-dim mb-1.5 block">Currency direction</span>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <label className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] text-ink-faint">Sell in</span>
                <select
                  value={baseCcy}
                  onChange={(e) => onBaseChange(e.target.value as CcyCode)}
                  className="w-full min-w-0 border border-line rounded-md px-2 py-2 text-[13px] bg-white"
                >
                  {CCY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c} — {CCY_NAME[c]}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-ink-faint pb-2">→</span>
              <label className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] text-ink-faint">Settle in</span>
                <select
                  value={quoteCcy}
                  onChange={(e) => onQuoteChange(e.target.value as CcyCode)}
                  className="w-full min-w-0 border border-line rounded-md px-2 py-2 text-[13px] bg-white"
                >
                  {CCY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c} — {CCY_NAME[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {latestPoint && (
              <span className="text-[11.5px] text-ink-faint mt-1.5 block">
                As of {latestPoint.date}: 1 {baseCcy} = {latestPoint.rate.toFixed(4)} {quoteCcy}
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-ink-dim">Annual cross-border transaction volume</span>
            <p className="text-[26px] font-extrabold text-ink tabular">{formatCompact(volume)}</p>
            <input
              type="range"
              min={1_000_000}
              max={200_000_000}
              step={1_000_000}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full"
            />
            <input
              type="text"
              inputMode="numeric"
              value={volume.toLocaleString("en-US")}
              onChange={(e) => setVolume(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
              className="border border-line rounded-md px-2 py-1.5 text-[13px] tabular text-right"
            />
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

          <div>
            <span className="text-[12.5px] text-ink-dim mb-2 block">Historical window</span>
            <div className="grid grid-cols-2 gap-2">
              {HORIZON_PILLS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHorizon(key)}
                  className={`rounded-lg px-2 py-2.5 text-[13.5px] font-semibold border-2 transition-colors ${
                    horizon === key ? "border-[#2563EB] bg-blue-50 text-ink" : "border-line bg-white text-ink-dim hover:border-blue-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[12.5px] text-ink-dim mb-2 block">Settlement terms</span>
            <div className="grid grid-cols-3 gap-2">
              {SETTLEMENT_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSettlementDays(d)}
                  className={`rounded-lg px-2 py-2.5 text-[13px] font-semibold border-2 transition-colors ${
                    settlementDays === d ? "border-[#2563EB] bg-blue-50 text-ink" : "border-line bg-white text-ink-dim hover:border-blue-200"
                  }`}
                >
                  Net {d}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-ink-dim">Grain platform tier</span>
            <select
              value={bpsTier}
              onChange={(e) => setBpsTier(Number(e.target.value))}
              className="border border-line rounded-md px-3 py-2 text-[14px] bg-white"
            >
              {BPS_TIERS.map((b) => (
                <option key={b} value={b}>
                  {b} bps
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-danger-bg rounded-2xl p-4 flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 self-start bg-danger text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <IconAlertCircle className="w-3 h-3" />
                Unhedged
              </span>
              <p className="text-[10.5px] text-danger uppercase tracking-wide font-semibold mt-1">Exposure Risk</p>
              <p className="text-[24px] font-extrabold text-danger tabular leading-none">-{formatMoney(exposure)}</p>
              <p className="text-[10.5px] text-danger/70">
                {swing?.worstStart ? `worst ${settlementDays}-day swing: ${(swing.worstAbsPct * 100).toFixed(1)}%` : "loading history…"}
              </p>
            </div>
            <div className="bg-paper-alt rounded-2xl p-4 flex flex-col gap-1.5">
              <span className="text-[10.5px] text-ink-dim uppercase tracking-wide font-semibold">Grain Platform Cost</span>
              <p className="text-[24px] font-extrabold text-ink tabular leading-none">{formatMoney(fee)}</p>
              <p className="text-[10.5px] text-ink-faint">{bpsTier} bps on {formatCompact(volume)} volume</p>
            </div>
            <div className="bg-teal-bg rounded-2xl p-4 flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 self-start bg-teal text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <IconLock className="w-3 h-3" />
                Hedged
              </span>
              <p className="text-[10.5px] text-teal uppercase tracking-wide font-semibold mt-1">Net Protected Profit</p>
              <p className="text-[24px] font-extrabold text-teal tabular leading-none">{formatMoney(net)}</p>
              <p className="text-[10.5px] text-teal/70">exposure avoided minus platform cost</p>
            </div>
          </div>

          <div className="bg-white border border-line rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 className="text-[14px] font-bold text-ink">
                {pair} — daily ECB reference rate
              </h3>
              {series && (
                <span className="text-[11.5px] text-ink-faint">
                  {series[0].date} → {series[series.length - 1].date}
                </span>
              )}
            </div>
            <div className="relative h-[240px]">
              {(seriesLoading || seriesError) && (
                <div className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-faint gap-2">
                  {seriesError ? (
                    <span className="text-danger">{seriesError}</span>
                  ) : (
                    <span>Fetching live ECB history…</span>
                  )}
                </div>
              )}
              <canvas ref={chartCanvasRef} className={seriesLoading || seriesError ? "invisible" : ""} />
            </div>
            {series && (
              <div className="flex flex-wrap gap-4 mt-2 text-[11.5px] text-ink-faint">
                <span>
                  Window low: <b className="text-ink">{Math.min(...series.map((s) => s.rate)).toFixed(4)} {quoteCcy}</b>
                </span>
                <span>
                  Window high: <b className="text-ink">{Math.max(...series.map((s) => s.rate)).toFixed(4)} {quoteCcy}</b>
                </span>
                <span>{series.length} trading days</span>
              </div>
            )}
          </div>

          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "linear-gradient(135deg, #f8faff 0%, #f0f7ff 100%)", border: "1px solid rgba(37, 99, 235, 0.2)" }}
          >
            <p className="text-[11px] font-bold tracking-wider text-[#2563EB] uppercase flex items-center gap-1.5">
              <IconSpark className="w-3.5 h-3.5" />
              Risk Read
            </p>
            <p className="text-[13.5px] text-slate-700">
              {narrative ?? "Loading real historical FX data to compute this pair's worst observed settlement-window swing…"}
            </p>
          </div>

          {/* Prospect details — minimal, only what HubSpot needs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 print:hidden">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 print:hidden">
            <button
              onClick={generateEmail}
              disabled={!swing}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white font-semibold text-[13.5px] px-4 py-3 rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              <IconSpark className="w-4 h-4" />
              Generate AI Follow-Up Email
            </button>
            <button
              onClick={syncToHubspot}
              disabled={hubspotBusy}
              className="flex items-center justify-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-[13.5px] px-4 py-3 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <IconCloudSync className="w-4 h-4" />
              {hubspotBusy ? "Syncing…" : "Push to HubSpot"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-white border border-[#93C5FD] text-[#2563EB] hover:bg-blue-50/50 font-semibold text-[13.5px] px-4 py-3 rounded-xl transition-all"
            >
              <IconDownload className="w-4 h-4" />
              Export as PDF
            </button>
          </div>
          {hubspotMsg && <p className="text-[12.5px] text-ink-dim -mt-2 print:hidden">{hubspotMsg}</p>}

          <p className="text-[11.5px] text-ink-faint">
            Historical rates: live ECB reference data via Frankfurter (no key required). Exposure risk uses the actual worst
            rolling settlement-window swing observed in the selected historical window — a real, computed figure, not an
            assumed constant, so it will change if you re-run this later as the window moves. Exchange rate shown is live.
            Not a formal quote or financial advice.
          </p>
        </div>
      </div>

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
