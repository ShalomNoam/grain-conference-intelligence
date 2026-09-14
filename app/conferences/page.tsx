"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conference, Coverage } from "@/lib/types";
import { scoreConference, WEIGHTS, TIER_LABEL, type Tier } from "@/lib/scoring";
import { VERTICAL_LABEL, ALL_VERTICALS, ALL_REGIONS, formatDateRange } from "@/lib/labels";
import { ICPMatchBadge } from "@/components/Badges";
import { getRepName } from "@/lib/settings";

type SortKey = "score" | "date" | "audience";

export default function ConferencesPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [showMethod, setShowMethod] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((d) => {
        setConferences(d.conferences ?? []);
        setCoverage(d.coverage ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const scored = useMemo(
    () => conferences.map((c) => ({ conf: c, ...scoreConference(c) })),
    [conferences]
  );

  const activeFilterCount = [vertical !== "all", region !== "all", tier !== "all"].filter(Boolean).length;

  const filtered = useMemo(() => {
    let rows = scored;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.conf.name.toLowerCase().includes(q) ||
          r.conf.city.toLowerCase().includes(q) ||
          r.conf.country.toLowerCase().includes(q) ||
          r.conf.verticals.some((v) => VERTICAL_LABEL[v].toLowerCase().includes(q))
      );
    }
    if (vertical !== "all") rows = rows.filter((r) => r.conf.verticals.includes(vertical as any));
    if (region !== "all") rows = rows.filter((r) => r.conf.region === region);
    if (tier !== "all") rows = rows.filter((r) => r.tier === tier);

    const sorted = [...rows];
    if (sort === "score") sorted.sort((a, b) => b.score - a.score);
    if (sort === "date") sorted.sort((a, b) => new Date(a.conf.startDate).getTime() - new Date(b.conf.startDate).getTime());
    if (sort === "audience") sorted.sort((a, b) => b.conf.audienceSize - a.conf.audienceSize);
    return sorted;
  }, [scored, query, vertical, region, tier, sort]);

  async function quickCover(conferenceId: string) {
    const repName = getRepName() || "Unassigned rep";
    setBusyId(conferenceId);
    try {
      const res = await fetch("/api/coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conferenceId, repName, status: "considering" }),
      });
      const data = await res.json();
      setCoverage(data.coverage ?? []);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-gold-ink mb-1">Conference List &amp; Scoring</p>
        <h1 className="text-[26px] font-bold">Which shows are actually worth Grain&apos;s time?</h1>
        <p className="text-ink-dim text-[14.5px] max-w-[70ch] mt-1">
          {conferences.length} sample events across payments, FX/treasury, travel and adjacent fintech — ranked against Grain&apos;s ICP,
          not just sorted by headcount.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, or vertical…"
            className="flex-1 border border-line rounded-lg px-4 min-h-[46px] text-[14.5px] bg-paper-surface"
          />
          <button
            onClick={() => setShowMoreFilters((s) => !s)}
            className={`shrink-0 text-[13.5px] font-medium rounded-lg px-4 min-h-[46px] border transition-colors ${
              showMoreFilters || activeFilterCount > 0 ? "border-ink bg-ink text-white" : "border-line text-ink-dim bg-paper-surface"
            }`}
          >
            Filter &amp; Sort{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        {showMoreFilters && (
          <div className="bg-paper-surface border border-line rounded-DEFAULT p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select value={vertical} onChange={(e) => setVertical(e.target.value)} className="border border-line rounded-md px-2 py-2.5 text-[13.5px] bg-transparent">
                <option value="all">All verticals</option>
                {ALL_VERTICALS.map((v) => (
                  <option key={v} value={v}>
                    {VERTICAL_LABEL[v]}
                  </option>
                ))}
              </select>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="border border-line rounded-md px-2 py-2.5 text-[13.5px] bg-transparent">
                <option value="all">All regions</option>
                {ALL_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select value={tier} onChange={(e) => setTier(e.target.value)} className="border border-line rounded-md px-2 py-2.5 text-[13.5px] bg-transparent">
                <option value="all">All tiers</option>
                {(["S", "A", "B", "C"] as Tier[]).map((t) => (
                  <option key={t} value={t}>
                    Tier {t} — {TIER_LABEL[t]}
                  </option>
                ))}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="border border-line rounded-md px-2 py-2.5 text-[13.5px] bg-transparent">
                <option value="score">Sort: ICP score</option>
                <option value="date">Sort: Date</option>
                <option value="audience">Sort: Audience size</option>
              </select>
            </div>
            <button onClick={() => setShowMethod((s) => !s)} className="self-start text-[12.5px] text-teal underline underline-offset-2">
              {showMethod ? "Hide" : "How is the score calculated?"}
            </button>
            {showMethod && (
              <div className="text-[13px] text-ink-dim border-t border-line pt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                <p>ICP Vertical Fit — {WEIGHTS.verticalFit * 100}% · is Grain&apos;s actual buyer in the room?</p>
                <p>Audience Quality — {WEIGHTS.audienceQuality * 100}% · decision-maker density proxy, not raw size</p>
                <p>Deal-Making Format — {WEIGHTS.dealFormat * 100}% · can you book real meetings here?</p>
                <p>Cost / Logistics — {WEIGHTS.costLogistics * 100}% · $ per plausible qualified conversation</p>
                <p>Strategic Signal — {WEIGHTS.strategicSignal * 100}% · is this where the market/competitors gather?</p>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-ink-faint text-[13.5px]">Loading conferences…</p>
      ) : filtered.length === 0 ? (
        <p className="text-ink-faint text-[13.5px]">No conferences match these filters.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ conf, tier: t }) => {
            const covering = coverage.filter((c) => c.conferenceId === conf.id);
            const isCovered = covering.length > 0;
            return (
              <div key={conf.id} className="bg-paper-surface border border-line rounded-DEFAULT p-4 flex flex-col gap-3 h-full">
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif font-bold text-[17px] leading-snug">{conf.name}</h3>
                  <p className="text-[13px] text-ink-dim">
                    {formatDateRange(conf.startDate, conf.endDate)} · {conf.city}, {conf.country}
                  </p>
                </div>

                <ICPMatchBadge tier={t} />

                <div className="mt-auto pt-3 border-t border-line">
                  {isCovered ? (
                    <span className="text-[13px] text-ink-dim font-medium">✓ Covered by {covering.map((c) => c.repName).join(", ")}</span>
                  ) : (
                    <button
                      onClick={() => quickCover(conf.id)}
                      disabled={busyId === conf.id}
                      className="w-full text-[13.5px] font-semibold text-white bg-teal rounded-full px-4 py-2.5 hover:opacity-90 disabled:opacity-50"
                    >
                      + Cover Event
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
