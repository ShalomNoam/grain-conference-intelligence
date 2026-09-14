import type { Conference, Coverage, Region } from "./types";
import { scoreConference } from "./scoring";

// ── Clustering: conferences in the same region within a short window ────
// are a candidate for one combined trip instead of two separate ones.
export interface ConferenceCluster {
  region: Region;
  conferences: Conference[];
  spanDays: number;
}

export function detectClusters(conferences: Conference[], windowDays = 28): ConferenceCluster[] {
  const byRegion = new Map<Region, Conference[]>();
  for (const c of conferences) {
    const list = byRegion.get(c.region) ?? [];
    list.push(c);
    byRegion.set(c.region, list);
  }

  const clusters: ConferenceCluster[] = [];
  for (const [region, list] of byRegion) {
    const sorted = [...list].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    let group: Conference[] = [];
    const flush = () => {
      if (group.length >= 2) {
        const spanDays = Math.round(
          (new Date(group[group.length - 1].startDate).getTime() - new Date(group[0].startDate).getTime()) / 86_400_000
        );
        clusters.push({ region, conferences: group, spanDays });
      }
      group = [];
    };
    for (const conf of sorted) {
      if (group.length === 0) {
        group.push(conf);
        continue;
      }
      const last = group[group.length - 1];
      const gapDays = (new Date(conf.startDate).getTime() - new Date(last.startDate).getTime()) / 86_400_000;
      if (gapDays <= windowDays) {
        group.push(conf);
      } else {
        flush();
        group.push(conf);
      }
    }
    flush();
  }
  return clusters.sort((a, b) => new Date(a.conferences[0].startDate).getTime() - new Date(b.conferences[0].startDate).getTime());
}

// ── Quarter buckets: where are we under-invested relative to ICP fit? ───
export interface QuarterBucket {
  key: string; // e.g. "2026-Q4"
  label: string; // e.g. "Q4 2026"
  conferences: Conference[];
  topTierCount: number; // S or A tier conferences in this quarter
  confirmedTopTierCount: number;
  isGap: boolean; // a top-tier conference exists this quarter with zero confirmed coverage
}

function quarterKey(dateISO: string): { key: string; label: string; sortKey: number } {
  const d = new Date(dateISO);
  const year = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return { key: `${year}-Q${q}`, label: `Q${q} ${year}`, sortKey: year * 4 + q };
}

export function computeQuarterBuckets(conferences: Conference[], coverage: Coverage[]): QuarterBucket[] {
  const buckets = new Map<string, QuarterBucket & { sortKey: number }>();
  for (const conf of conferences) {
    const { key, label, sortKey } = quarterKey(conf.startDate);
    const bucket = buckets.get(key) ?? { key, label, sortKey, conferences: [], topTierCount: 0, confirmedTopTierCount: 0, isGap: false };
    bucket.conferences.push(conf);
    const { tier } = scoreConference(conf);
    if (tier === "S" || tier === "A") {
      bucket.topTierCount += 1;
      const hasConfirmed = coverage.some((c) => c.conferenceId === conf.id && c.status === "confirmed");
      if (hasConfirmed) bucket.confirmedTopTierCount += 1;
    }
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .map((b) => ({ ...b, isGap: b.topTierCount > 0 && b.confirmedTopTierCount === 0 }))
    .sort((a, b) => a.sortKey - b.sortKey);
}
