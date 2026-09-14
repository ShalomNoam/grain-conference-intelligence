import type { Vertical, Region, Format } from "./types";

export const VERTICAL_LABEL: Record<Vertical, string> = {
  payments: "Payments",
  "fx-treasury": "FX / Treasury",
  "cross-border-ecommerce": "Cross-Border eCommerce",
  travel: "Travel",
  banking: "Banking",
  "fintech-saas": "Fintech SaaS",
  "broad-tech": "Broad Tech",
};

export const ALL_VERTICALS = Object.keys(VERTICAL_LABEL) as Vertical[];

export const ALL_REGIONS: Region[] = ["North America", "Europe", "MEA", "APAC", "LATAM"];

export const FORMAT_LABEL: Record<Format, string> = {
  "1:1 meetings": "1:1 Meetings",
  expo: "Expo Floor",
  summit: "Summit / Talks",
  hybrid: "Hybrid",
};

export function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const startStr = start.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const endStr = end.toLocaleDateString("en-US", sameMonth ? { day: "numeric", timeZone: "UTC" } : { ...opts, timeZone: "UTC" });
  const year = end.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
  return `${startStr}–${endStr}, ${year}`;
}
