"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conference, Coverage } from "@/lib/types";
import { scoreConference, TIER_LABEL, type Tier } from "@/lib/scoring";
import { detectClusters, computeQuarterBuckets, estimateTripSavings, type ConferenceCluster } from "@/lib/planning";
import { formatDateRange } from "@/lib/labels";
import { getRepName } from "@/lib/settings";
import { IconRoute, IconTrendingDown, IconAlertCircle, IconDownload, IconMail, IconUsers, IconCheck } from "@/components/icons";

function currentQuarterKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// No real registration-list data exists per event, so "target accounts" is
// a clearly-labeled derived estimate (2% of audience assumed ICP-qualified)
// rather than a fabricated precise number — same honesty rule as the trip
// savings estimate below.
function estimatedTargetAccounts(conf: Conference): number {
  return Math.max(1, Math.round(conf.audienceSize * 0.02));
}

function downloadItinerary(cluster: ConferenceCluster) {
  const lines = [
    `${cluster.region} trip itinerary — ${cluster.conferences.length} events, ${cluster.spanDays} days`,
    "",
    ...cluster.conferences.map((c) => `${formatDateRange(c.startDate, c.endDate)} — ${c.name} (${c.city}, ${c.country})`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cluster.region.toLowerCase().replace(/\s+/g, "-")}-trip-itinerary.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function budgetRequestMailto(conf: Conference): string {
  const subject = `Travel budget request — ${conf.name}`;
  const body = `Requesting travel budget approval for:\n\n${conf.name}\n${formatDateRange(conf.startDate, conf.endDate)}\n${conf.city}, ${conf.country}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function PlanningPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuarter, setActiveQuarter] = useState<string | null>(null);
  const [showOtherClusters, setShowOtherClusters] = useState(false);
  const [showRepCoverage, setShowRepCoverage] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

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
  const heroSavings = useMemo(() => (heroCluster ? estimateTripSavings(heroCluster) : null), [heroCluster]);

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

  async function assignRep(conferenceId: string) {
    const repName = getRepName() || "Unassigned rep";
    setAssigningId(conferenceId);
    try {
      const res = await fetch("/api/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conferenceId, repName, status: "considering" }),
      });
      const data = await res.json();
      setCoverage(data.coverage ?? []);
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-2">Coverage Planning</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Where is the year covered — and where isn&apos;t it?</h1>
        <p className="text-slate-500 text-[14.5px] max-w-[70ch] mt-1.5">
          Track quarterly coverage, resolve unassigned tier-1 events, and capture multi-conference travel clusters.
        </p>
      </div>

      {loading ? (
        <p className="text-ink-faint text-[13.5px]">Loading…</p>
      ) : (
        <>
          {heroCluster && heroSavings && (
            <section className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm flex flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <span className="inline-flex items-center gap-1.5 self-start bg-blue-50 text-[#2563EB] text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                    <IconRoute className="w-3.5 h-3.5" />
                    Trip Cluster
                  </span>
                  <h2 className="text-xl font-bold text-[#0F172A]">
                    {heroCluster.region} Tour: {heroCluster.conferences.length} Events in {heroCluster.spanDays} Days
                  </h2>
                  <span className="inline-flex items-center gap-1.5 self-start bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <IconTrendingDown className="w-3.5 h-3.5" />
                    Est. travel savings: {formatUsd(heroSavings.estimatedSavingsUsd)} (est.) · {heroSavings.flightsSaved} flights saved
                  </span>
                </div>

                <button
                  onClick={() => downloadItinerary(heroCluster)}
                  className="inline-flex items-center gap-1.5 bg-white/80 border border-[#93C5FD] text-[#2563EB] hover:bg-blue-50/50 px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0"
                >
                  <IconDownload className="w-4 h-4" />
                  Export Itinerary
                </button>
              </div>

              <div className="relative overflow-x-auto no-scrollbar pb-2">
                <div className="flex items-start gap-6 min-w-max px-1 relative">
                  <div className="absolute left-6 right-6 top-6 h-0.5 bg-blue-100" aria-hidden />
                  {heroCluster.conferences.map((c) => {
                    const isCovered = coverage.some((cov) => cov.conferenceId === c.id);
                    return (
                      <div key={c.id} className="relative flex flex-col items-center gap-2 w-[150px] shrink-0">
                        <div
                          className={`w-3 h-3 rounded-full bg-white border-[3px] z-10 ${isCovered ? "border-[#2563EB]" : "border-slate-300"}`}
                        />
                        <div className="text-center">
                          <p className="text-[13px] font-semibold text-[#0F172A] leading-tight">{c.name}</p>
                          <p className="text-[11.5px] text-slate-500 mt-0.5">{c.city}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{formatDateRange(c.startDate, c.endDate)}</p>
                        </div>
                        {isCovered ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <IconCheck className="w-2.5 h-2.5" />
                            Covered
                          </span>
                        ) : (
                          <button
                            onClick={() => assignRep(c.id)}
                            disabled={assigningId === c.id}
                            className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 hover:bg-blue-50 hover:text-[#2563EB] px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                          >
                            {assigningId === c.id ? "Assigning…" : "+ Assign"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-1 bg-slate-100/70 rounded-xl p-1 w-fit">
              {buckets.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setActiveQuarter(b.key)}
                  className={`relative shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                    activeQuarter === b.key ? "bg-[#0F172A] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                >
                  {b.label}
                  {b.isGap && (
                    <span
                      className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                      aria-label="Coverage gap"
                    />
                  )}
                </button>
              ))}
            </div>

            {currentBucket && (
              <>
                {currentBucket.isGap && (
                  <div className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-full">
                    <IconAlertCircle className="w-3.5 h-3.5" />
                    Coverage Gap · {currentBucket.confirmedTopTierCount} Confirmed
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden">
                  {currentBucket.conferences.length === 0 ? (
                    <p className="text-[13px] text-slate-400 p-5">No conferences in this quarter.</p>
                  ) : (
                    currentBucket.conferences.map((c, idx) => {
                      const { tier, score } = scoreConference(c);
                      const covering = coverage.filter((cov) => cov.conferenceId === c.id);
                      const isCovered = covering.length > 0;
                      return (
                        <div
                          key={c.id}
                          className={`flex flex-wrap items-center gap-4 p-4 ${idx > 0 ? "border-t border-slate-100" : ""}`}
                        >
                          <div className="min-w-[180px] flex-1">
                            <p className="text-[14px] font-bold text-[#0F172A]">{c.name}</p>
                            <p className="text-[12.5px] text-slate-500">
                              {formatDateRange(c.startDate, c.endDate)} · {c.city}
                            </p>
                          </div>

                          <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap">
                            Tier {tier as Tier}: {TIER_LABEL[tier]} · {score}
                          </span>

                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 whitespace-nowrap">
                            <IconUsers className="w-3.5 h-3.5" />
                            ~{estimatedTargetAccounts(c)} target accounts (est.)
                          </span>

                          <div className="min-w-[130px]">
                            {isCovered ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-6 h-6 rounded-full bg-blue-100 text-[#2563EB] text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {initials(covering[0].repName)}
                                </span>
                                <span className="text-[12.5px] text-slate-600 truncate">
                                  {covering.map((cov) => cov.repName).join(", ")}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => assignRep(c.id)}
                                disabled={assigningId === c.id}
                                className="text-[12.5px] font-semibold text-[#2563EB] hover:underline disabled:opacity-50"
                              >
                                {assigningId === c.id ? "Assigning…" : "+ Assign Rep"}
                              </button>
                            )}
                          </div>

                          <a
                            href={budgetRequestMailto(c)}
                            className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors ml-auto"
                          >
                            <IconMail className="w-3.5 h-3.5" />
                            Request Travel Budget
                          </a>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </section>

          {otherClusters.length > 0 && (
            <section className="flex flex-col gap-2">
              <button
                onClick={() => setShowOtherClusters((s) => !s)}
                className="self-start text-[13px] font-medium text-[#2563EB] underline underline-offset-2"
              >
                {showOtherClusters ? "Hide" : `Show ${otherClusters.length} other clustering opportunit${otherClusters.length === 1 ? "y" : "ies"}`}
              </button>
              {showOtherClusters && (
                <div className="flex flex-col gap-3">
                  {otherClusters.map((cl, idx) => (
                    <div key={idx} className="bg-white rounded-2xl border border-slate-200/70 p-4 flex flex-col gap-2">
                      <p className="text-[13.5px] font-semibold text-[#0F172A]">
                        {cl.conferences.length} {cl.region} events within {cl.spanDays} days
                      </p>
                      <ul className="flex flex-col gap-1">
                        {cl.conferences.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-2 text-[13px] text-slate-500">
                            <span>
                              {c.name} — {c.city}
                            </span>
                            <span className="text-[11.5px] whitespace-nowrap">{formatDateRange(c.startDate, c.endDate)}</span>
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
              className="self-start text-[13px] font-medium text-[#2563EB] underline underline-offset-2"
            >
              {showRepCoverage ? "Hide coverage by rep" : "Show coverage by rep"}
            </button>
            {showRepCoverage &&
              (repMap.size === 0 ? (
                <p className="text-[13px] text-slate-400">No one has been assigned to any conference yet — use &quot;+ Cover Event&quot; on the Conferences page.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...repMap.entries()].map(([rep, items]) => (
                    <div key={rep} className="bg-white rounded-2xl border border-slate-200/70 p-4">
                      <p className="font-semibold text-[14px] mb-2 text-[#0F172A]">{rep}</p>
                      <ul className="flex flex-col gap-1">
                        {items.map((it) => {
                          const conf = conferences.find((c) => c.id === it.conferenceId);
                          if (!conf) return null;
                          return (
                            <li key={it.id} className="flex items-center justify-between text-[12.5px]">
                              <span className="truncate text-slate-600">{conf.name}</span>
                              <span className={`text-[10.5px] uppercase font-semibold ${it.status === "confirmed" ? "text-[#2563EB]" : "text-slate-400"}`}>
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
