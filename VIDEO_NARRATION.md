# Video narration — speak this, don't just outline it

Companion to `VIDEO_SCRIPT.md` (the structure). This is the actual spoken
version — written in first person, conversational, meant to be read close to
verbatim. `[ACTION: ...]` is a stage direction: what to click/show while
saying that line. Everything factual here is verified against the live code
and seed data, not guessed — see the notes at the bottom for two corrections
against the older outline.

Target: ~9 minutes at a natural pace. Section 7 (Calculator) is the first
thing to cut if you're running long — it's explicitly a bonus.

---

## Before you hit record — a 5-minute checklist

1. **Turn on Upstash** (README → Deploy step 3, ~2 minutes, free). Without it,
   the live app's storage is a per-serverless-instance temp file — fine for
   browsing, but writes during a live demo (assigning coverage, resolving a
   match, capturing a lead) can occasionally read back stale on a cold start.
   Two minutes of setup removes that risk entirely for the recording.
2. **Paste and test your Gemini key in `/settings` on the live URL** — click
   into a contact's AI drawer once before recording to confirm you get a real
   response, not a 400/502. Nothing sinks a demo faster than watching a
   spinner fail live.
3. **Paste and test your HubSpot token**, if you're planning to show a live
   push (Section 4 below assumes you do).
4. **Record from the deployed Vercel URL, not localhost** — this proves it's
   actually shipped, not just running on your machine.
5. Know in advance you'll be typing **"Dana Shapira"** (a deliberate typo) at
   some point in Capture — see Section 3. Verified against the real matching
   code, not a guess (details at the bottom).

---

## 0. Cold open (~20s)

> "Hi, I'm [your name]. This is Grain Conference Intelligence — a tool I built
> for Grain's sales team to decide which conferences are actually worth
> attending, plan coverage across the year, capture leads fast on a show
> floor, and — the hard part — recognize when the same person showing up at
> conference after conference is actually warming up, or just being polite.
> Let me walk through it live."

[ACTION: show the address bar with the real deployed URL, then land on `/conferences`]

## 1. Conferences + scoring (~110s)

> "This is the Conferences page — 22 real fintech, payments, and travel
> events, each scored zero to a hundred against Grain's actual ICP: PSPs,
> cross-border payments, FX and treasury teams.
>
> The scoring isn't 'bigger audience, higher score.'"

[ACTION: click "How is the score calculated?"]

> "Five weighted factors. ICP vertical fit is forty percent — is Grain's real
> buyer even in the room. Audience quality is twenty percent, and it's *not*
> raw headcount — it's a curve, because a tiny show lacks volume and a
> massive consumer show dilutes the B2B buyer down to noise. Then deal
> format — can you actually book a meeting here, or is it a badge-scan expo —
> cost efficiency, and whether named competitors like Airwallex or Wise show
> up, as a signal this is where the market actually gathers.
>
> Here's the proof it's not just sorting by size."

[ACTION: filter or scroll to show Web Summit]

> "Web Summit — seventy thousand attendees — scores a 25, tier C, because
> it's a broad-tech show with almost no FX or payments buyers in it."

[ACTION: show Merchant Payments Ecosystem]

> "Merchant Payments Ecosystem — twenty-eight times smaller, twenty-five
> hundred people — scores an 88, the *highest* in the entire database,
> because it's pure one-to-one meetings, entirely in Grain's core verticals.
> Size isn't the signal. Fit is."

[ACTION: briefly use Filter & Sort to show vertical/region/tier filtering]

## 2. Planning (~75s)

> "Planning answers a different question: where is the year actually
> covered, and where are we exposed."

[ACTION: land on `/planning`]

> "This top card is trip clustering. It automatically detected that Finovate
> Fall in New York, Sibos in Miami, and Money20/20 USA in Las Vegas all fall
> within a 70-day window in the same region, and groups them as one
> combinable trip instead of three separate ones — with a savings estimate
> that's clearly labeled as an estimate, not a real airfare quote."

[ACTION: click a quarter tab that has the amber dot]

> "This dot means a coverage gap — a top-tier conference this quarter with
> nobody confirmed to attend."

[ACTION: scroll to the flagged conference]

> "Right here — a Tier S event, unassigned. One click assigns coverage. This
> is the view a sales lead uses to make sure nothing important falls through
> the cracks."

## 3. Capture (~70s)

> "Capture is the field tool — what a rep actually has in their hand on a
> busy show floor."

[ACTION: land on `/capture`; narrow the window to phone width if you can]

> "Speed was the design constraint here, not completeness. Name and
> company — that's it, that's all you need to save a lead. Everything
> else — title, email, tags, notes — sits behind an optional 'Add more
> details.'"

[ACTION: type a quick real name + company, hit save]

> "Under fifteen seconds.
>
> Now watch this."

[ACTION: type name **"Dana Shapira"** — note the typo — company **"PayLane Global"**]

> "I'm typing a name that's *close* to, but not exactly, someone already in
> the system — a realistic typo, the kind that happens constantly on a show
> floor."

[ACTION: submit]

> "The tool doesn't silently create a duplicate contact, and it doesn't
> silently merge them either — it flags this as a possible match and sends
> it to a human to confirm on the Contacts page. I'll show you why that
> matters in a second."

## 4. Contacts — the core of the assignment (~160s)

> "This is the heart of the assignment: recognizing the same person across
> multiple conferences, and reading whether that relationship is actually
> going somewhere."

[ACTION: land on `/contacts`]

> "Here's that possible match I just created."

[ACTION: point to the amber banner at the top]

> "'Dana Shapira' at PayLane Global looks ninety-two percent like 'Dana
> Shapiro' — someone already in the system. The tool shows me exactly *why*
> it thinks so — the name similarity, the company match — and lets me
> decide."

[ACTION: click "Yes, same person — merge"]

> "Confirmed. That's the review tier in action: anything below a strict
> auto-merge threshold goes to a person, never a silent guess — because a
> wrong auto-merge corrupts someone's entire relationship history, and a
> missed one hides a real pattern.
>
> Now here's Dana's actual card."

[ACTION: open/scroll to Dana Shapiro]

> "Two touchpoints. Met at Finovate Fall as Director of Treasury, temperature
> warm. Then at Merchant Payments Ecosystem, months later — she'd been
> promoted to VP Finance — and this time the note says she's asking for a
> live pricing demo and a pilot proposal. Temperature: hot.
>
> The tool reads that automatically as 'Warming up' —"

[ACTION: point to the badge]

> "— not just because there are two touches, but because the engagement is
> trending *up* between them. If the trend were flat across a year-plus with
> no progression instead, it would call that 'stagnant' — that's the brief's
> own 'polite tire-kicker who's been listening for a year and never buying'
> case, handled by the exact same logic. If temperature had dropped, it
> flags 'cooling.' The point is the signal carries direction, not just a
> count.
>
> On top of that rule-based read — which is instant, free, and needs no API
> key — there's an AI layer."

[ACTION: click "Draft AI Follow-up Pitch"]

> "This reads her full interaction history, including the free-text notes a
> rules engine can't parse, and produces three things: a diagnosis of where
> the relationship actually stands, a tactical pitch angle, and a
> ready-to-send email draft."

[ACTION: wait for the result, read a line or two out loud]

> "I can copy this, or push it straight into HubSpot as a follow-up task for
> whoever owns the account."

[ACTION: click "Push to HubSpot as Task"]

> "That's the two-layer design on purpose: rules for the signal that's
> reliable and cheap, AI for the judgment call rules genuinely can't make."

## 5. How I used AI to build this, honestly (~55s)

**This one is yours to say in your own words — below is a real, accurate
starting draft based on what actually happened while building this, not a
generic answer. Adjust freely; the brief specifically wants something
concrete, not vague.**

> "I built this with Claude Code end to end. It was fast at what you'd
> expect — scaffolding every page, wiring up API routes, Tailwind styling —
> but the real test was the harder integration work.
>
> The most honest example: getting the Gemini integration genuinely working
> wasn't a five-minute API-key paste. My key turned out to be a newer,
> organization-linked key type that rejected the standard `?key=` and
> `Authorization: Bearer` methods every tutorial shows — it needed a
> different header entirely. That took real, iterative debugging against
> actual API responses, not a first-try success, and I made a point of not
> trusting a suspicious-looking error message until I had first-hand,
> verified proof of the real fix. That's the honest picture of building with
> AI tools: fast at the boilerplate, and you still have to be the one who
> verifies the hard parts actually work."

## 6. What I'd build next (~50s)

> "With another week, three things. First, the audience-quality score is
> currently a size proxy — with real registration data or sponsor
> prospectuses, that becomes actual title-mix data, which is the single
> biggest accuracy upgrade available to the scoring model. Second, an
> AI-assisted lead-qualification scorer that reads a rep's raw field notes
> and suggests an ICP tier automatically. And third, a 'find conferences we
> don't know about yet' web-search agent — using AI for discovery, not just
> analysis of what's already in the database."

## 7. Calculator — bonus, cut first if short on time (~30s)

> "One more thing, if there's time — not one of the seven core requirements,
> so I kept it isolated on its own page."

[ACTION: land on `/calculator`]

> "An FX-hedging risk tool a rep can pull up mid-conversation. This chart
> isn't illustrative — it's live ECB rate history for whatever pair you pick,
> and the risk number is the actual worst swing that pair has made over the
> selected window, run through a real stress calculation, not an assumed
> volatility curve. Same as the rest of the app: a real AI-drafted follow-up
> email, and a real push to HubSpot — not a preview, an actual push."

## Close (~10s)

> "That's Grain Conference Intelligence. Thanks for watching."

---

## Notes — what changed vs. the older `VIDEO_SCRIPT.md` outline, and why

1. **Money20/20 USA is Tier A (score 74), not Tier S.** The old outline's
   comparison ("Money20/20 USA scoring S-tier vs. Web Summit C-tier") was
   checked by actually running `scoreConference()` against the real seed
   data — Money20/20 USA lands at 74 (expo format + premium cost tier pull
   it down), which is Tier A, "Strong fit," not S. Saying "S-tier" on camera
   while the live app shows "A" on screen would be a visible, avoidable
   mistake. The script above uses **Web Summit (25, C) vs. Merchant Payments
   Ecosystem (88, S)** instead — verified, and a more dramatic contrast
   (28x smaller audience, highest score in the database).
2. **There is currently only one real multi-touch contact in the seed
   data: Dana Shapiro (2 touches → "Warming up").** Marco Lindqvist, the
   other seeded contact, has only *one* logged interaction — his note text
   describes tire-kicker-ish language ("evaluates every year, never moves"),
   but with a single touch the tool will show "First Touch," not
   "Stagnant." There's no live-clickable "stagnant" or "cooling" example
   right now — the script above describes those states verbally instead of
   pretending to click through them. **If you want a real, live "stagnant"
   example on screen**, say the word and a second seeded contact with 3+
   touches over 12+ months and flat temperature can be added in a couple of
   minutes — that would let you demo all three arc states live instead of
   two, which is a stronger answer to the brief's own framing.
3. **The Contacts AI button is literally labeled "Draft AI Follow-up
   Pitch,"** opening a drawer titled "AI Follow-up Draft" with three
   sections: Diagnosis, Tactical Pitch Angle, Email Draft. The script uses
   this exact on-screen text rather than the more generic "AI relationship
   summary" language used elsewhere (that's the feature's internal/README
   name, not what's printed on the button).
4. **The "Dana Shapira" typo in Section 3 is a deliberately chosen, verified
   example** — run against the actual `findContactMatch()` code, not
   guessed: it scores a 92% name match and lands in the "review" bucket
   (neither silent auto-merge nor silently ignored), which is exactly the
   edge case worth demonstrating live.
5. **Section 7 was rewritten after the Calculator and the separate
   standalone stress-test tool were merged into one page.** `/calculator`
   now does everything the standalone `fx-stress-test.html` used to do
   (live ECB historical chart, real rolling worst-case-window stress math)
   directly, on the app's real server-backed AI and HubSpot integrations —
   there's no second tool to link out to anymore, and no client-exposed key
   or fake HubSpot-preview trade-off to explain. The standalone HTML files
   still exist on disk but are no longer linked from the app; say the word
   if you'd rather they were deleted outright.
