"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conference, Coverage } from "@/lib/types";
import { scoreConference } from "@/lib/scoring";
import { detectClusters, computeQuarterBuckets } from "@/lib/planning";
import { formatDateRange } from "@/lib/labels";
import { TierBadge } from "@/components/Badges";

function currentQuarterKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

export default function PlanningPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuarter, setActiveQuarter] = useState<string | null>(null);
  const [heroExpanded, setHeroExpanded] = useState(true);
  const [showOtherClusters, setShowOtherClusters] = useState(false);
  const [showRepCoverage, setShowRepCoverage] = useState(false);

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

  useEffect(() => {
    if (activeQuarter || buckets.length === 0) return;
    const nowKey = currentQuarterKey();
    const defaultBucket = buckets.find((b) => b.key === nowKey) ?? buckets.find((b) => b.key > nowKey) ?? buckets[0];
    setActiveQuarter(defaultBucket.key);
  }, [buckets, activeQuarter]);

  const heroCluster = useMemo(() => {
    if (clusters.length === 0) return null;
    return [...clusters].sort((a, b) => b.conferences.length - a.conferences.length || a.spanDays - b.spanDays)[0];
  }, [clusters]);
  const otherClusters = useMemo(() => clusters.filter((c) => c !== heroCluster), [clusters, heroCluster]);

  const repMap = useMemo(() => {
    const m = new Map<string, Coverage[]>();
    for (const c of coverage) {
      const list = m.get(c.repName) ?? [];
      list.push(c);
      m.set(c.repName, list);
    }
    return m;
  }, [coverage]);

  const currentBucket = buckets.find((b) => b.key === activeQuarter) ?? buckets[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#2563EB] mb-1">Coverage Planning</p>
        <h1 className="text-[28px] font-extrabold bg-grain-headline bg-clip-text text-transparent">Where is the year covered — and where isn&apos;t it?</h1>
        <p className="text-ink-dim text-[14.5px] max-w-[70ch] mt-1">
          Coverage by quarter, gaps against top-tier (S/A) events, and conferences close enough in time and place to combine into one
          trip.
        </p>
      </div>

      {loading ? (
        <p className="text-ink-faint text-[13.5px]">Loading…</p>
      ) : (
        <>
          {heroCluster && (
            <section className="bg-gradient-to-br from-[#111827] to-[#2A4494] text-white rounded-2xl p-5 flex flex-col gap-3 shadow-[0_8px_30px_-8px_rgba(26,35,75,0.35)]">
              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-[#93C5FD] mb-1">Top trip-clustering opportunity</p>
                <p className="text-[17px] font-semibold leading-snug">
                  {heroCluster.conferences.length === 2 ? (
                    <>💡 Combine {heroCluster.conferences.map((c) => c.name).join(" & ")} — one trip instead of two.</>
                  ) : (
                    <>
                      💡 {heroCluster.conferences.length} {heroCluster.region} events in {heroCluster.spanDays} days — one trip instead of{" "}
                      {heroCluster.conferences.length}.
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setHeroExpanded((s) => !s)}
                className="self-start bg-white text-[#2563EB] font-semibold text-[13.5px] rounded-lg px-4 py-2 hover:bg-blue-50/80 transition-colors"
              >
                {heroExpanded ? "Hide Trip Plan" : "Review Trip Plan"}
              </button>
              {heroExpanded && (
                <ul className="flex flex-col gap-1.5 bg-white/10 rounded-lg p-3">
                  {heroCluster.conferences.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                      <span>
                        {c.name} <span className="text-white/70">— {c.city}</span>
                      </span>
                      <span className="font-mono text-[11.5px] text-white/80 whitespace-nowrap">{formatDateRange(c.startDate, c.endDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold font-serif">Quarter-by-quarter coverage</h2>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {buckets.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setActiveQuarter(b.key)}
                  className={`shrink-0 rounded-lg px-4 py-2 text-[13px] font-semibold border transition-colors ${
                    activeQuarter === b.key
                      ? "bg-[#111827] text-white border-[#111827]"
                      : b.isGap
                      ? "border-danger text-danger"
                      : "border-line text-ink-dim bg-white/80"
                  }`}
                >
                  {b.label}
                  {b.isGap && " ⚠"}
                </button>
              ))}
            </div>

            {currentBucket && (
              <div
                className={`rounded-DEFAULT border p-4 flex flex-col gap-2.5 ${
                  currentBucket.isGap ? "border-danger bg-danger-bg" : "border-line bg-paper-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] text-ink-dim">
                    {currentBucket.topTierCount} top-tier event{currentBucket.topTierCount === 1 ? "" : "s"} · {currentBucket.confirmedTopTierCount} confirmed
                  </span>
                  {currentBucket.isGap && <span className="text-[11px] font-semibold text-danger uppercase tracking-wide">Coverage gap</span>}
                </div>
                <ul className="text-[13px] text-ink-dim flex flex-col gap-1.5">
                  {currentBucket.conferences.map((c) => {
                    const { tier, score } = scoreConference(c);
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{c.name}</span>
                        <TierBadge tier={tier} score={score} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {otherClusters.length > 0 && (
            <section className="flex flex-col gap-2">
              <button
                onClick={() => setShowOtherClusters((s) => !s)}
                className="self-start text-[13px] font-medium text-teal underline underline-offset-2"
              >
                {showOtherClusters ? "Hide" : `Show ${otherClusters.length} other clustering opportunit${otherClusters.length === 1 ? "y" : "ies"}`}
              </button>
              {showOtherClusters && (
                <div className="flex flex-col gap-3">
                  {otherClusters.map((cl, idx) => (
                    <div key={idx} className="bg-white/85 backdrop-blur-sm border border-blue-50/80 shadow-[0_4px_24px_-4px_rgba(20,40,90,0.04)] rounded-2xl p-4 flex flex-col gap-2">
                      <p className="text-[13.5px] font-semibold">
                        {cl.conferences.length} {cl.region} events within {cl.spanDays} days
                      </p>
                      <ul className="flex flex-col gap-1">
                        {cl.conferences.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-2 text-[13px] text-ink-dim">
                            <span>
                              {c.name} — {c.city}
                            </span>
                            <span className="font-mono text-[11.5px] whitespace-nowrap">{formatDateRange(c.startDate, c.endDate)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <button
              onClick={() => setShowRepCoverage((s) => !s)}
              className="self-start text-[13px] font-medium text-teal underline underline-offset-2"
            >
              {showRepCoverage ? "Hide coverage by rep" : "Show coverage by rep"}
            </button>
            {showRepCoverage &&
              (repMap.size === 0 ? (
                <p className="text-[13px] text-ink-faint">No one has been assigned to any conference yet — use "+ Cover Event" on the Conferences page.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...repMap.entries()].map(([rep, items]) => (
                    <div key={rep} className="bg-white/85 backdrop-blur-sm border border-blue-50/80 shadow-[0_4px_24px_-4px_rgba(20,40,90,0.04)] rounded-2xl p-4">
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
              ))}
          </section>
        </>
      )}
    </div>
  );
}
