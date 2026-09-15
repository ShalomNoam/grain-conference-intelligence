import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Free, no-API-key exchange-rate feed (exchangerate-api.com's open tier).
// Verified directly against the two common free options before picking this
// one: the ECB-based alternative (frankfurter.app) doesn't carry AED at all
// (it's a pegged currency the ECB doesn't reference), which would silently
// break the GBP/AED pair already in CURRENCY_PAIRS. This endpoint returned
// every currency the calculator needs.
const FX_BASE = "https://open.er-api.com/v6/latest";

// Rates update once a day upstream — no reason to hit the free API on every
// keystroke in the calculator. Keyed by base currency; a serverless cold
// start just refetches, which is fine for a low-traffic sales tool.
const cache = new Map<string, { rates: Record<string, number>; date: string; fetchedAt: number }>();
const CACHE_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") || "USD").toUpperCase();

  const cached = cache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return NextResponse.json({ base, rates: cached.rates, date: cached.date, cached: true });
  }

  try {
    const res = await fetch(`${FX_BASE}/${encodeURIComponent(base)}`);
    if (!res.ok) {
      return NextResponse.json({ error: `Rate provider returned HTTP ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    if (data.result !== "success" || !data.rates) {
      return NextResponse.json({ error: "Rate provider returned no data for this currency." }, { status: 502 });
    }
    const date: string = data.time_last_update_utc ?? new Date().toISOString();
    cache.set(base, { rates: data.rates, date, fetchedAt: Date.now() });
    return NextResponse.json({ base, rates: data.rates, date, cached: false });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the rate provider: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
