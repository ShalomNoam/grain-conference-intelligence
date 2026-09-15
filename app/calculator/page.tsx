"use client";

import { useEffect, useMemo, useState } from "react";

const CURRENCY_PAIRS = ["USD/EUR", "USD/GBP", "EUR/GBP", "USD/BRL", "USD/MXN", "USD/INR", "EUR/PLN", "USD/THB", "GBP/AED"];

function formatMoney(n: number): string {
  if (!isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface RateState {
  rate: number | null;
  date: string | null;
  loading: boolean;
  error: string | null;
}

export default function CalculatorPage() {
  const [volume, setVolume] = useState(5_000_000);
  const [pair, setPair] = useState(CURRENCY_PAIRS[0]);
  const [currentSpread, setCurrentSpread] = useState(2.5);
  const [grainSpread, setGrainSpread] = useState(0.6);
  const [rateState, setRateState] = useState<RateState>({ rate: null, date: null, loading: true, error: null });

  const [base, quote] = pair.split("/");

  // The core $-savings math below is currency-agnostic (spread % × volume
  // in USD, regardless of the pair) and stays correct even if this fetch
  // fails — the live rate is added context for the rep to show a prospect
  // a concrete "here's the real rate, here's what the spread costs you" a
  // real number gives an abstract % that it doesn't replace or gate.
  useEffect(() => {
    let cancelled = false;
    setRateState((s) => ({ ...s, loading: true, error: null }));
    fetch(`/api/fx-rate?base=${encodeURIComponent(base)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setRateState({ rate: null, date: null, loading: false, error: d.error });
          return;
        }
        const r = d.rates?.[quote];
        if (typeof r !== "number") {
          setRateState({ rate: null, date: null, loading: false, error: `No live rate available for ${base}/${quote}.` });
          return;
        }
        setRateState({ rate: r, date: d.date, loading: false, error: null });
      })
      .catch(() => {
        if (!cancelled) setRateState({ rate: null, date: null, loading: false, error: "Couldn't reach the live rate feed." });
      });
    return () => {
      cancelled = true;
    };
  }, [base, quote]);

  const { annualSavings, monthlySavings, pctReduction } = useMemo(() => {
    const currentCost = volume * (currentSpread / 100);
    const grainCost = volume * (grainSpread / 100);
    const savings = Math.max(0, currentCost - grainCost);
    return {
      annualSavings: savings,
      monthlySavings: savings / 12,
      pctReduction: currentSpread > 0 ? (savings / currentCost) * 100 : 0,
    };
  }, [volume, currentSpread, grainSpread]);

  const effectiveCurrentRate = rateState.rate !== null ? rateState.rate * (1 - currentSpread / 100) : null;
  const effectiveGrainRate = rateState.rate !== null ? rateState.rate * (1 - grainSpread / 100) : null;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <span className="inline-block text-[10.5px] font-mono uppercase tracking-wide bg-warn-bg text-warn-ink rounded-full px-2.5 py-1 mb-2">
          Bonus tool — not one of the 7 core requirements
        </span>
        <h1 className="text-[26px] font-extrabold bg-grain-headline bg-clip-text text-transparent">FX savings, on the spot</h1>
        <p className="text-ink-dim text-[14px] max-w-[65ch] mt-1">
          Something a rep can pull up mid-conversation on the show floor — plug in a prospect&apos;s volume and current FX cost, and show
          them what Grain&apos;s guaranteed rate is worth in dollars, not abstractly.
        </p>
      </div>

      <div className="bg-white/85 backdrop-blur-sm border border-blue-50/80 shadow-[0_4px_24px_-4px_rgba(20,40,90,0.04)] rounded-2xl p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-ink-dim">Annual cross-border transaction volume (USD)</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={100000}
              max={100_000_000}
              step={100000}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value) || 0)}
              className="w-32 border border-line rounded-md px-2 py-1.5 text-[13.5px] tabular"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-ink-dim">Primary currency pair</span>
          <select value={pair} onChange={(e) => setPair(e.target.value)} className="border border-line rounded-md px-3 py-2 text-[13.5px]">
            {CURRENCY_PAIRS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>

        {/* Live rate panel — real data, fetched per pair. Never blocks the
            savings math below if it fails to load. */}
        <div className="border border-line rounded-lg p-3 flex flex-col gap-1.5 bg-paper-alt/60">
          {rateState.loading ? (
            <p className="text-[12.5px] text-ink-faint">Loading live rate for {base}/{quote}…</p>
          ) : rateState.error ? (
            <p className="text-[12.5px] text-ink-faint">Live rate unavailable ({rateState.error}) — savings math below is unaffected.</p>
          ) : rateState.rate !== null ? (
            <>
              <p className="text-[12.5px] text-ink-dim">
                Live mid-market rate: <span className="font-semibold text-ink tabular">1 {base} = {rateState.rate.toFixed(4)} {quote}</span>
                {rateState.date && <span className="text-ink-faint"> · updated {new Date(rateState.date).toLocaleDateString()}</span>}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-0.5">
                <p className="text-[12px] text-ink-dim">
                  At their spread: <span className="font-semibold text-ink tabular">{effectiveCurrentRate?.toFixed(4)} {quote}</span>
                </p>
                <p className="text-[12px] text-teal">
                  With Grain: <span className="font-semibold tabular">{effectiveGrainRate?.toFixed(4)} {quote}</span>
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-ink-dim">Current bank/provider spread</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.2}
                max={5}
                step={0.1}
                value={currentSpread}
                onChange={(e) => setCurrentSpread(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-14 text-right font-mono text-[13.5px] tabular">{currentSpread.toFixed(1)}%</span>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-ink-dim">Grain guaranteed spread</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.1}
                max={2}
                step={0.05}
                value={grainSpread}
                onChange={(e) => setGrainSpread(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-14 text-right font-mono text-[13.5px] tabular">{grainSpread.toFixed(2)}%</span>
            </div>
          </label>
        </div>
      </div>

      <div className="relative overflow-hidden bg-gradient-to-br from-[#E0ECFD] via-white to-[#D4E6FA] border border-blue-100 rounded-2xl p-6 flex flex-col gap-4 shadow-[0_4px_30px_-6px_rgba(37,99,235,0.12)]">
        <div>
          <p className="text-[12px] text-[#2563EB] uppercase tracking-wide font-semibold">Estimated annual savings</p>
          <p className="text-[56px] font-extrabold tabular leading-none mt-1 text-[#111A3A] drop-shadow-[0_2px_18px_rgba(37,99,235,0.25)]">
            {formatMoney(annualSavings)}
          </p>
          <p className="text-[15px] font-semibold text-[#2563EB] mt-2">✓ Reduces FX spread by {pctReduction.toFixed(0)}%</p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-blue-100 pt-3">
          <div>
            <p className="text-[11px] text-ink-dim">Per month</p>
            <p className="text-[18px] font-semibold tabular text-ink">{formatMoney(monthlySavings)}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-dim">FX cost reduction</p>
            <p className="text-[18px] font-semibold tabular text-ink">{pctReduction.toFixed(0)}%</p>
          </div>
        </div>
      </div>

      <p className="text-[11.5px] text-ink-faint">
        Exchange rate is live (updated daily, source: exchangerate-api.com). Savings estimate is illustrative — based on the spread
        percentages entered above, not a formal quote.
      </p>
    </div>
  );
}
