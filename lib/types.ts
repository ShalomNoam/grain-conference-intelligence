// ── Core domain types ───────────────────────────────────────────────────
// Kept deliberately flat and JSON-serializable so they work identically
// whether the record lives in Vercel KV or the local JSON fallback file.

export type Vertical =
  | "payments"
  | "fx-treasury"
  | "cross-border-ecommerce"
  | "travel"
  | "banking"
  | "fintech-saas"
  | "broad-tech";

export type Region = "North America" | "Europe" | "MEA" | "APAC" | "LATAM";

export type Format = "1:1 meetings" | "expo" | "summit" | "hybrid";

export interface Conference {
  id: string;
  name: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  city: string;
  country: string;
  region: Region;
  verticals: Vertical[];
  audienceSize: number;
  format: Format;
  /** 1 = cheap/local, 2 = moderate, 3 = expensive flagship */
  costTier: 1 | 2 | 3;
  website: string;
  competitorsPresent?: string[];
  /** true if we verified the date via a live source; false = estimated from historical pattern */
  datesConfirmed: boolean;
  notes?: string;
}

export type CoverageStatus = "confirmed" | "considering";

export interface Coverage {
  id: string;
  conferenceId: string;
  repName: string;
  status: CoverageStatus;
}

export type Temperature = "hot" | "warm" | "cold";

export interface Interaction {
  id: string;
  contactId: string;
  conferenceId: string;
  repName: string;
  timestamp: string; // ISO datetime
  /** job title as captured AT THIS conference — may differ from earlier interactions */
  title: string;
  company: string;
  temperature: Temperature;
  notes: string;
  tags: string[];
  hubspotStatus: "not_synced" | "syncing" | "synced" | "failed";
  hubspotContactId?: string;
  hubspotError?: string;
}

export interface CompanyHistoryEntry {
  company: string;
  title: string;
  asOf: string; // ISO datetime of the interaction that recorded this
}

export interface Contact {
  id: string;
  displayName: string;
  normalizedName: string;
  emails: string[];
  companyHistory: CompanyHistoryEntry[];
  createdAt: string;
}

/** A fuzzy match candidate below the auto-merge threshold, awaiting a rep's yes/no. */
export interface PendingMatch {
  id: string;
  capturedName: string;
  capturedEmail?: string;
  newInteractionDraft: Omit<Interaction, "id" | "contactId" | "hubspotStatus">;
  candidateContactId: string;
  candidateContactName: string;
  score: number;
  reasons: string[];
}

export interface Database {
  conferences: Conference[];
  coverage: Coverage[];
  contacts: Contact[];
  interactions: Interaction[];
  pendingMatches: PendingMatch[];
}
