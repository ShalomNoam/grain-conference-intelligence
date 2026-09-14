"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conference, Coverage } from "@/lib/types";
import { scoreConference } from "@/lib/scoring";
import { detectClusters, computeQuarterBuckets } from "@/lib/planning";
import { formatDateRange } from "@/lib/labels";
import { TierBadge } from "@/components/Badges";

export default function PlanningPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((d) => {
        setConferences(d.conferences ?? []);
        setCoverage(d.coverage ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const buckets = useMemo(() => computeQuarterBuckets(conferences, coverage), [conferences, coverage]);
  const clusters = useMemo(() => detectClusters(conferences), [conferences]);

  const repMap = useMemo(() => {
    const m = new Map<string, Coverage[]>();
    for (const c of coverage) {
      const list = m.get(c.repName) ?? [];
      list.push(c);
      m.set(c.repName, list);
    }
    return m;
  }, [coverage]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-gold-ink mb-1">Coverage Planning</p>
        <h1 className="text-[26px] font-bold">Where is the year covered — and where isn&apos;t it?</h1>
        <p className="text-ink-dim text-[14.5px] max-w-[70ch] mt-1">
          Coverage by quarter, gaps against top-tier (S/A) events, and conferences close enough in time and place to combine into one
          trip.
        </p>
      </div>

      {loading ? (
        <p className="text-ink-faint text-[13.5px]">Loading…</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold font-serif">Quarter-by-quarter coverage</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {buckets.map((b) => (
                <div
                  key={b.key}
                  className={`rounded-DEFAULT border p-3.5 flex flex-col gap-2 ${
                    b.isGap ? "border-danger bg-danger-bg" : "border-line bg-paper-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[13px] font-semibold">{b.label}</span>
                    {b.isGap && <span className="text-[10.5px] font-medium text-danger uppercase tracking-wide">Gap</span>}
                  </div>
                  <p className="text-[12px] text-ink-dim">
                    {b.topTierCount} top-tier event{b.topTierCount === 1 ? "" : "s"} · {b.confirmedTopTierCount} confirmed
                  </p>
                  <ul className="text-[12px] text-ink-dim flex flex-col gap-0.5">
                    {b.conferences.slice(0, 4).map((c) => {
                      const { tier, score } = scoreConference(c);
                      return (
                        <li key={c.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{c.name}</span>
                          <TierBadge tier={tier} score={score} />
                        </li>
                      );
                    })}
                    {b.conferences.length > 4 && <li className="text-ink-faint">+{b.conferences.length - 4} more</li>}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-[16px] font-semibold font-serif">Trip clustering opportunities</h2>
              <p className="text-[13px] text-ink-dim">
                Same region, within ~4 weeks of each other — worth one longer trip instead of two flights.
              </p>
            </div>
            {clusters.length === 0 ? (
              <p className="text-[13px] text-ink-faint">No clustering opportunities in the current dataset.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {clusters.map((cl, idx) => (
                  <div key={idx} className="bg-teal-bg border border-teal/30 rounded-DEFAULT p-4 flex flex-col gap-2">
                    <p className="font-mono text-[12px] text-teal font-medium">
                      {cl.region} · {cl.spanDays}-day window
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {cl.conferences.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]">
                          <span>
                            {c.name} <span className="text-ink-faint">— {c.city}</span>
                          </span>
                          <span className="font-mono text-[11.5px] text-ink-dim whitespace-nowrap">{formatDateRange(c.startDate, c.endDate)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold font-serif">Coverage by rep</h2>
            {repMap.size === 0 ? (
              <p className="text-[13px] text-ink-faint">No one has been assigned to any conference yet — use “+ Add me” on the Conferences page.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...repMap.entries()].map(([rep, items]) => (
                  <div key={rep} className="bg-paper-surface border border-line rounded-DEFAULT p-4">
                    <p className="font-semibold text-[14px] mb-2">{rep}</p>
                    <ul className="flex flex-col gap-1">
                      {items.map((it) => {
                        const conf = conferences.find((c) => c.id === it.conferenceId);
                        if (!conf) return null;
                        return (
                          <li key={it.id} className="flex items-center justify-between text-[12.5px]">
                            <span className="truncate">{conf.name}</span>
                            <span className={`font-mono text-[10.5px] uppercase ${it.status === "confirmed" ? "text-teal" : "text-ink-faint"}`}>
                              {it.status}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
