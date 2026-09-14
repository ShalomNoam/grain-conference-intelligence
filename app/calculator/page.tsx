"use client";

import { useMemo, useState } from "react";

const CURRENCY_PAIRS = ["USD/EUR", "USD/GBP", "EUR/GBP", "USD/BRL", "USD/MXN", "USD/INR", "EUR/PLN", "USD/THB", "GBP/AED"];

function formatMoney(n: number): string {
  if (!isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function CalculatorPage() {
  const [volume, setVolume] = useState(5_000_000);
  const [pair, setPair] = useState(CURRENCY_PAIRS[0]);
  const [currentSpread, setCurrentSpread] = useState(2.5);
  const [grainSpread, setGrainSpread] = useState(0.6);

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

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <span className="inline-block text-[10.5px] font-mono uppercase tracking-wide bg-warn-bg text-warn-ink rounded-full px-2.5 py-1 mb-2">
          Bonus tool — not one of the 7 core requirements
        </span>
        <h1 className="text-[24px] font-bold">FX savings, on the spot</h1>
        <p className="text-ink-dim text-[14px] max-w-[65ch] mt-1">
          Something a rep can pull up mid-conversation on the show floor — plug in a prospect&apos;s volume and current FX cost, and show
          them what Grain&apos;s guaranteed rate is worth in dollars, not abstractly.
        </p>
      </div>

      <div className="bg-paper-surface border border-line rounded-DEFAULT p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-ink-dim">Annual cross-border transaction volume</span>
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
          <span className="text-[12.5px] text-ink-dim">Primary currency pair (context only — doesn&apos;t change the math below)</span>
          <select value={pair} onChange={(e) => setPair(e.target.value)} className="border border-line rounded-md px-3 py-2 text-[13.5px]">
            {CURRENCY_PAIRS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>

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

      <div className="bg-ink text-white rounded-DEFAULT p-6 flex flex-col gap-4">
        <div>
          <p className="text-[12px] text-white/60 font-mono uppercase tracking-wide">Estimated annual savings</p>
          <p className="text-[38px] font-serif font-bold tabular leading-tight">{formatMoney(annualSavings)}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-white/15 pt-3">
          <div>
            <p className="text-[11px] text-white/50">Per month</p>
            <p className="text-[18px] font-semibold tabular">{formatMoney(monthlySavings)}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/50">FX cost reduction</p>
            <p className="text-[18px] font-semibold tabular">{pctReduction.toFixed(0)}%</p>
          </div>
        </div>
      </div>

      <p className="text-[11.5px] text-ink-faint">
        Illustrative only — based on flat spread assumptions entered above, for a live, in-conversation estimate. Not a quote.
      </p>
    </div>
  );
}
