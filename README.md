# Grain Conference Intelligence

A working conference-prioritization, coverage-planning, field-lead-capture and
cross-conference relationship-tracking tool for Grain's sales team — built for
the AI Builder home assignment.

**Live demo:** https://grain-conference-intelligence-henna.vercel.app/conferences
**Video walkthrough:** https://drive.google.com/file/d/1NTkivtNT1dbP8QRAWRZEnKEGD8DyehIM/view

---

## What this is, in one screen

| Page | What it does |
|---|---|
| **Conferences** (`/conferences`) | Sample database of 22 real fintech/payments/travel conferences, filterable by vertical/region/tier, each scored 0–100 against Grain's ICP with a visible weighted breakdown. |
| **Planning** (`/planning`) | Coverage by quarter with gaps flagged against top-tier events, geographic/temporal clustering (trip-combining opportunities), and coverage-by-rep. |
| **Capture** (`/capture`) | A mobile-first, thumb-speed lead form for the show floor — name + company is enough to save. |
| **Contacts** (`/contacts`) | Every contact who's been met more than once, with a relationship-arc read (rule-based, instant) and an optional AI narrative summary, plus a HubSpot push per interaction. |
| **Calculator** (`/calculator`) | Bonus, not one of the 7 core requirements: a live FX-hedging risk tool a rep pulls up mid-conversation — real ECB historical-rate chart, a rolling worst-case settlement-window stress calculation, an AI-drafted follow-up email, and a push to HubSpot, all on one page. |
| **Settings** (`/settings`) | Where a rep pastes their own Gemini key and HubSpot token. Stored in the browser only — see [Keys & storage](#keys--storage). |

---

## Requirements → where it's implemented

| Brief requirement | Where |
|---|---|
| Conference list + filtering, with name/date/location/vertical/audience fields | `/conferences`, data in `data/seed.ts`, types in `lib/types.ts` |
| Scoring / tiering system, defensible methodology | `lib/scoring.ts` (5 weighted axes, fully commented), visualized in `/conferences` ("How is the score calculated?") |
| Planning view — coverage, under-investment, clustering | `/planning`, logic in `lib/planning.ts` |
| Field lead-capture interface | `/capture` |
| Cross-conference contact tracking + nudge | `/contacts`, matching in `lib/matching.ts`, arc/nudge in `lib/nudge.ts` |
| At least one meaningful AI feature | Two real integrations, one multi-provider proxy (`lib/ai-provider.ts`): relationship-arc summarizer (`app/api/ai/relationship-summary`, in `/contacts`) and FX follow-up email drafter (`app/api/ai/fx-followup`, in `/calculator`) |
| Path to push leads into HubSpot | Three routes for three entry points: `app/api/hubspot/push` (per-interaction, from `/capture` and `/contacts`), `push-lead` (from `/calculator`), `push-task` (a follow-up Task, from the `/contacts` AI drawer) |
| Deployable without a complex build pipeline | Standard Next.js app, zero required env vars, one-click Vercel deploy — see [Deploy](#deploy-3-minutes-no-coding-required) |
| API keys configurable by the user, not hardcoded | `lib/settings.ts` (localStorage only) — see [Keys & storage](#keys--storage) |

---

## Scoring methodology

Five weighted axes, each normalized 0–1, summed to a 0–100 score, bucketed into
a tier. Every weight and lookup table lives in `lib/scoring.ts` with the
reasoning inline — nothing here is a black box:

- **ICP Vertical Fit — 40%.** Is Grain's actual buyer (PSPs, FX/treasury,
  cross-border commerce) in the room at all, vs. an adjacent (travel, banking,
  general fintech SaaS) or unrelated (broad tech) crowd?
- **Audience Quality — 20%.** A proxy for decision-maker density using event
  size on a bell curve (very small shows lack volume; very large consumer-scale
  shows dilute the B2B buyer to noise; the 2,500–10,000 band is the sweet spot
  for curated fintech/payments shows).
- **Deal-Making Format — 15%.** Does the show's own format let you book real
  meetings (1:1 programs) or is it mostly a badge-scan expo floor?
- **Cost / Logistics — 15%.** Rough $ per plausible qualified conversation via
  a 3-tier cost proxy.
- **Strategic Signal — 10%.** Named competitor presence (Airwallex, Wise
  Platform, Currencycloud, Convera, OpenPayd) as confirmation this is where the
  market actually gathers.

Tiers: **S** (80–100, must attend) · **A** (65–79, strong fit) · **B** (45–64,
opportunistic) · **C** (<45, skip unless clustering makes it nearly free).

The seed dataset deliberately includes a few low-ICP, high-headcount events
(Web Summit, TechCrunch Disrupt, EmTech) specifically to demonstrate that the
model down-ranks scale without fit, rather than just sorting by attendee count.

## Cross-conference matching — approach and edge cases

Goal: recognize the same person across conferences — through typos, nicknames,
and job changes — without silently merging two different people who share a
common name. Full logic and comments in `lib/matching.ts`.

Three-tier decision on every captured lead:

1. **Exact** — same email address → auto-merge.
2. **Auto** — normalized name similarity ≥93% *and* company similarity ≥55%
   (or a near-perfect ≥98% name match alone) → auto-merge.
3. **Review** — plausible but below the auto bar → surfaced to the rep as an
   explicit yes/no prompt on `/contacts`, never merged silently and never
   dropped.

Edge cases handled explicitly:

- **Name variants/typos** — Levenshtein-based token-sort similarity, plus a
  small nickname table (Mike↔Michael, etc.), applied before comparison.
- **Job changes between events** — company similarity is checked against
  *every* company the contact has ever had (`companyHistory[]`), not just the
  most recent one, so "same person, new company" still resolves correctly. A
  changed company is called out as a signal ("Company changed since last
  seen"), not treated as noise.
- **False-merge risk** — the auto-merge bar is deliberately strict; anything
  uncertain goes to human review instead of guessing, because a bad auto-merge
  corrupts relationship history and can misfire the nudge in either direction.
- **The "count vs. signal" problem** — `lib/nudge.ts` classifies each
  relationship by touch count, time span, *and* temperature trend, not just a
  raw count: **warming** (rising engagement), **stagnant** (3+ touches, 12+
  months, flat/no progression — the "polite tire-kicker" case named in the
  brief), **cooling** (engagement dropped), **reengage-role-change** (company
  changed), or **steady/insufficient-data**. Each carries a specific,
  actionable nudge sentence, not just a badge.

## The AI features

Both below share one multi-provider proxy (`lib/ai-provider.ts`): paste a
Gemini, Claude, OpenAI, or OpenRouter key into `/settings` and the provider is
auto-detected from the key's own format — nothing is hardcoded to one vendor.
The Gemini path defaults to `gemini-3.6-flash`.

### 1. Relationship-arc summarizer — the deep one

`/contacts` → "AI relationship summary" sends the contact's full interaction
history and asks for (1) a 2–3 sentence read of how the relationship has
*actually* evolved — including what the rule-based signal alone wouldn't catch
— and (2) one concrete next action.

**Why AI is the right tool here, specifically:** the rule-based nudge
(`lib/nudge.ts`) is fast, free, and reliable for the *quantitative* signal
(count, span, temperature trend) — that part doesn't need AI and shouldn't use
it. What rules can't do is read free-text notes across multiple visits and
notice that someone's *objections changed*, or that their *language* shifts
from curious to urgent — that's a synthesis task over unstructured text, which
is exactly what LLMs are good at and rule-based logic isn't. The two are shown
together deliberately: the rule-based nudge always works (no API key needed),
the AI layer adds judgment on top when a key is configured. **Judge the AI
requirement on this feature** — the other two exist but are lower-stakes.

### 2. FX follow-up email drafter

`/calculator` fetches live ECB historical rates for the selected pair
(`api.frankfurter.dev`, no key needed) and runs a real rolling worst-case
settlement-window stress calculation — the actual worst swing that pair has
made historically over the selected window, not an assumed volatility
constant. "Generate AI Follow-Up Email" turns those real numbers (volume,
pair, vertical, settlement window, the real profit-at-risk figure) into a
short, prospect-ready email framed around rate-lock risk, not price. The
vertical-aware talking point above it is deterministic and instant, grounded
in the same real data — the AI call is reserved for the part a rep actually
needs mid-conversation: a send-ready draft, not another template they'd have
to rewrite by hand.

## Keys & storage

- **Gemini key / HubSpot token** — entered on `/settings`, kept in
  `localStorage` only, sent per-request as a header to this app's own two tiny
  server proxies (`app/api/ai/*`, `app/api/hubspot/*`), never written to a
  database or committed to source. This satisfies the assignment's
  "configurable by the user, not hardcoded" constraint. A team that wants one
  shared key baked in as a deployment default can instead set `GEMINI_API_KEY`
  / `HUBSPOT_PRIVATE_APP_TOKEN` as server env vars — see `.env.example`.
- **Conference / lead data** — see `lib/db.ts`. Works with **zero setup**
  (falls back to a local JSON file, seeded automatically). For a real
  deployment where every rep on every device should see the same data, add a
  free Upstash Redis database (below) — genuinely shared, persistent storage,
  not per-browser.

---

## Deploy (3 minutes, no coding required)

1. **Push this folder to GitHub** (create a new repository, upload these
   files — GitHub's web "upload files" works fine, no git command line
   required).
2. **Go to [vercel.com](https://vercel.com), sign in with GitHub, click "Add
   New → Project"**, and pick the repository. Leave every setting on its
   default — Vercel detects Next.js automatically. Click **Deploy**. You'll
   have a live URL in about a minute.
3. *(Recommended for real team use)* **Add shared storage:** go to
   [upstash.com](https://upstash.com), create a free Redis database (no
   credit card), copy its **REST URL** and **REST Token**, then in your Vercel
   project go to **Settings → Environment Variables** and add:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

   Redeploy (Vercel → Deployments → ⋯ → Redeploy). Without this step the app
   still works fully — it just uses a local fallback file instead of shared
   storage (see `lib/db.ts`).
4. **Give reps their keys:** each rep opens `/settings` in the deployed app
   and pastes their own Gemini key (free at
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) and, if
   syncing to HubSpot, a HubSpot private-app token. No redeploy needed for
   this — it's per-browser.

To update the app later: edit files in GitHub's web editor (or push from your
machine) — Vercel redeploys automatically on every push to the main branch.

## Local development

```bash
npm install
npm run dev
# open http://localhost:3000
```

No environment variables are required to run locally — `lib/db.ts` falls back
to `data/runtime.local.json`, seeded automatically on first run.

---

## Tech stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS, a handful of small Next.js
API routes as thin server proxies, Upstash Redis (optional) for shared
storage. No ORM, no build step beyond `next build`, no separate backend
service to run or pay for.

## Trade-offs & what I'd build next

Being upfront about what was cut for scope, and what real registration/CRM
data would unlock:

- **Audience quality is a size/format proxy, not real attendee-title data.**
  With a real deployment, this axis should pull from actual registration
  lists or sponsor prospectuses (title mix) rather than inferring density from
  headcount — the biggest accuracy upgrade available for the scoring model.
- **Storage defaults to a local JSON fallback** so the app works with zero
  setup; a real team deployment should turn on the two-minute Upstash step
  above. I didn't make it mandatory because the assignment explicitly values
  "deployable without a complex build pipeline," and a working zero-config
  demo beats a blocked setup step.
- **Two AI features shipped, but the relationship-arc summarizer is the one
  built deep** — it maps directly onto the hardest, most-weighted requirement
  in the brief (cross-conference intelligence); the FX follow-up drafter is
  real but lower-stakes. An AI-assisted lead-qualification scorer (reading a
  rep's raw field notes into a suggested ICP tier) is the natural next one.
  Also worth adding: a "find conferences we don't know about yet" web-search
  agent, and OCR-based business-card capture for the field form.
  Cross-conference matching itself could also move from rule-based-plus-review
  to a small embedding-similarity model once there's enough real interaction
  volume to justify it, instead of hand-tuned string thresholds.
- **`npm audit` flags additional Next.js advisories** (beyond the one this
  build already includes the patch for) that are fixed only in the Next 16
  major line. I deliberately didn't do that migration blind inside a
  time-boxed assignment — it's a reasonable next step, called out here rather
  than silently left for someone else to discover.
- **HubSpot contact matching is by email only.** A production version should
  also try phone/company+name fallbacks for leads without a captured email,
  and expose per-field sync conflicts instead of a blind overwrite.
