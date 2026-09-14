import type { Contact } from "./types";

// ── Cross-conference identity matching ──────────────────────────────────
// Goal: when a rep logs "Dana Shapiro, PayLane Global" at conference #2,
// recognize she's the same "Dana Shapiro, PayLane Global" logged at
// conference #1 last year — even through nickname variants, typos, and a
// job title/company change — without silently merging two different
// people who happen to share a common name.
//
// Three-tier decision, in order:
//   1. EXACT   — same email address                  → auto-merge, no review
//   2. AUTO    — name + company both clearly match    → auto-merge, no review
//   3. REVIEW  — plausible but not certain            → surfaced to the rep
//                as a yes/no prompt, never merged silently
//   (else)     — NEW contact
//
// This asymmetry is deliberate: false auto-merges are worse than a
// duplicate (they corrupt someone's relationship history and can misfire
// the "tire-kicker" nudge), so anything below the AUTO bar gets a human in
// the loop instead of being merged or dropped.

const TITLE_PREFIXES = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "sir"]);

// Small, deliberately conservative nickname table — first-name variants
// that are extremely likely to refer to the same person, not a
// comprehensive dictionary.
const NICKNAME_TO_CANONICAL: Record<string, string> = {
  mike: "michael",
  mick: "michael",
  micky: "michael",
  bob: "robert",
  bobby: "robert",
  rob: "robert",
  robbie: "robert",
  liz: "elizabeth",
  beth: "elizabeth",
  eliza: "elizabeth",
  dave: "david",
  davey: "david",
  will: "william",
  bill: "william",
  billy: "william",
  tom: "thomas",
  tommy: "thomas",
  jim: "james",
  jimmy: "james",
  alex: "alexander",
  sasha: "alexander",
  dan: "daniel",
  danny: "daniel",
  nick: "nicholas",
  nicky: "nicholas",
  matt: "matthew",
  chris: "christopher",
  steve: "steven",
  tony: "anthony",
  andy: "andrew",
  drew: "andrew",
  ken: "kenneth",
  ron: "ronald",
  sam: "samuel",
  joe: "joseph",
  josh: "joshua",
  ben: "benjamin",
  ed: "edward",
  eddie: "edward",
  meg: "margaret",
  peggy: "margaret",
  cathy: "catherine",
  kate: "catherine",
  katie: "catherine",
  abby: "abigail",
  gil: "gilad",
  noa: "noa",
};

const COMPANY_SUFFIXES = [
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "gmbh",
  "corp",
  "corporation",
  "co",
  "group",
  "global",
  "holdings",
  "plc",
  "sa",
  "bv",
  "ag",
];

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizePersonName(raw: string): string {
  const tokens = stripDiacritics(raw)
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !TITLE_PREFIXES.has(t));

  const canonical = tokens.map((t) => NICKNAME_TO_CANONICAL[t] ?? t);
  return canonical.join(" ").trim();
}

export function normalizeCompanyName(raw: string): string {
  const tokens = stripDiacritics(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !COMPANY_SUFFIXES.includes(t));
  return tokens.join(" ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[n];
}

/** 0..1, 1 = identical. Token-order-insensitive: compares sorted tokens so
 * "Shapiro Dana" and "Dana Shapiro" still score 1.0. */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const ta = a.split(/\s+/).filter(Boolean).sort().join(" ");
  const tb = b.split(/\s+/).filter(Boolean).sort().join(" ");
  const dist = levenshtein(ta, tb);
  const maxLen = Math.max(ta.length, tb.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

export type MatchType = "exact" | "auto" | "review" | "none";

export interface MatchResult {
  type: MatchType;
  contact?: Contact;
  score: number; // 0..1
  reasons: string[];
}

export interface MatchCandidateInput {
  name: string;
  company: string;
  email?: string;
}

const AUTO_NAME_THRESHOLD = 0.93;
const AUTO_NAME_ONLY_THRESHOLD = 0.98; // allow auto-merge on name alone only if it's near-perfect
const AUTO_COMPANY_THRESHOLD = 0.55;
const REVIEW_NAME_THRESHOLD = 0.8;
const REVIEW_NAME_WITH_COMPANY_THRESHOLD = 0.65;
const REVIEW_COMPANY_THRESHOLD = 0.6;

export function findContactMatch(
  input: MatchCandidateInput,
  existingContacts: Contact[]
): MatchResult {
  const email = input.email?.trim().toLowerCase();
  if (email) {
    const exact = existingContacts.find((c) =>
      c.emails.some((e) => e.toLowerCase() === email)
    );
    if (exact) {
      return { type: "exact", contact: exact, score: 1, reasons: ["Exact email match"] };
    }
  }

  const normName = normalizePersonName(input.name);
  const normCompany = normalizeCompanyName(input.company);

  let best: MatchResult = { type: "none", score: 0, reasons: [] };

  for (const contact of existingContacts) {
    const nameSim = stringSimilarity(normName, contact.normalizedName);

    // best similarity against ANY company this person has ever had —
    // this is what lets a job change still resolve to the same person.
    let bestCompanySim = 0;
    let bestCompanyLabel = "";
    for (const hist of contact.companyHistory) {
      const sim = stringSimilarity(normCompany, normalizeCompanyName(hist.company));
      if (sim > bestCompanySim) {
        bestCompanySim = sim;
        bestCompanyLabel = hist.company;
      }
    }
    const companyChanged =
      bestCompanySim < 0.9 &&
      contact.companyHistory.length > 0 &&
      normalizeCompanyName(input.company) !== "";

    let type: MatchType = "none";
    const reasons: string[] = [];

    if (
      nameSim >= AUTO_NAME_ONLY_THRESHOLD ||
      (nameSim >= AUTO_NAME_THRESHOLD && bestCompanySim >= AUTO_COMPANY_THRESHOLD)
    ) {
      type = "auto";
      reasons.push(`Name match ${(nameSim * 100).toFixed(0)}%`);
      if (bestCompanySim >= AUTO_COMPANY_THRESHOLD) {
        reasons.push(`Company match with "${bestCompanyLabel}"`);
      } else {
        reasons.push("Name match alone is near-perfect");
      }
      if (companyChanged) reasons.push(`Company changed since last seen (was "${bestCompanyLabel}")`);
    } else if (
      nameSim >= REVIEW_NAME_THRESHOLD ||
      (nameSim >= REVIEW_NAME_WITH_COMPANY_THRESHOLD && bestCompanySim >= REVIEW_COMPANY_THRESHOLD)
    ) {
      type = "review";
      reasons.push(`Possible name match ${(nameSim * 100).toFixed(0)}%`);
      if (bestCompanySim >= REVIEW_COMPANY_THRESHOLD) {
        reasons.push(`Similar company to "${bestCompanyLabel}"`);
      } else {
        reasons.push("Company doesn't clearly match any prior record — could be a job change or a different person");
      }
    }

    const combinedScore = nameSim * 0.7 + bestCompanySim * 0.3;
    if (type !== "none" && (best.type === "none" || combinedScore > best.score)) {
      best = { type, contact, score: combinedScore, reasons };
    }
  }

  return best;
}
