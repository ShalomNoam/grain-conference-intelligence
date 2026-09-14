"use client";

import { useEffect, useMemo, useState } from "react";
import type { Contact, Conference, Interaction, PendingMatch } from "@/lib/types";
import type { RelationshipArc } from "@/lib/nudge";
import { ArcBadge, TemperatureBadge } from "@/components/Badges";
import { getGeminiKey, getHubspotToken } from "@/lib/settings";

interface EnrichedContact {
  contact: Contact;
  interactions: Interaction[];
  arc: RelationshipArc;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<EnrichedContact[]>([]);
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, { summary?: string; error?: string }>>({});
  const [hubspotBusy, setHubspotBusy] = useState<string | null>(null);
  const [hubspotMsg, setHubspotMsg] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setContacts(data.contacts ?? []);
    setPendingMatches(data.pendingMatches ?? []);
    setConferences(data.conferences ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const confName = (id: string) => conferences.find((c) => c.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.trim().toLowerCase();
    return contacts.filter(
      (c) => c.contact.displayName.toLowerCase().includes(q) || c.interactions.some((i) => i.company.toLowerCase().includes(q))
    );
  }, [contacts, query]);

  async function resolvePending(id: string, decision: "merge" | "new") {
    setResolvingId(id);
    try {
      await fetch("/api/pending-matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      await load();
    } finally {
      setResolvingId(null);
    }
  }

  async function getAiSummary(contactId: string) {
    const key = getGeminiKey();
    setAiLoading(contactId);
    setAiResult((r) => ({ ...r, [contactId]: {} }));
    try {
      const res = await fetch("/api/ai/relationship-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gemini-key": key },
        body: JSON.stringify({ contactId }),
      });
      const data = await res.json();
      if (!res.ok) setAiResult((r) => ({ ...r, [contactId]: { error: data.error } }));
      else setAiResult((r) => ({ ...r, [contactId]: { summary: data.summary } }));
    } catch {
      setAiResult((r) => ({ ...r, [contactId]: { error: "Network error reaching the AI summary endpoint." } }));
    } finally {
      setAiLoading(null);
    }
  }

  async function pushToHubspot(interactionId: string) {
    const token = getHubspotToken();
    setHubspotBusy(interactionId);
    try {
      const res = await fetch("/api/hubspot/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hubspot-token": token },
        body: JSON.stringify({ interactionId }),
      });
      const data = await res.json();
      setHubspotMsg((m) => ({ ...m, [interactionId]: res.ok ? "Synced to HubSpot" : data.error }));
      if (res.ok) await load();
    } catch {
      setHubspotMsg((m) => ({ ...m, [interactionId]: "Network error reaching HubSpot proxy." }));
    } finally {
      setHubspotBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-gold-ink mb-1">Cross-Conference Contacts</p>
        <h1 className="text-[26px] font-bold">Same person, different show — is it warming up?</h1>
        <p className="text-ink-dim text-[14.5px] max-w-[70ch] mt-1">
          Every contact met at more than one conference gets a relationship arc: a rule-based read (instant, always on) plus an optional
          AI narrative that reads between the notes.
        </p>
      </div>

      {pendingMatches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold font-serif text-warn-ink">Possible matches awaiting your review ({pendingMatches.length})</h2>
          {pendingMatches.map((pm) => (
            <div key={pm.id} className="bg-warn-bg border border-warn-ink/30 rounded-DEFAULT p-4 flex flex-col gap-2">
              <p className="text-[13.5px]">
                <span className="font-semibold">{pm.capturedName}</span> ({pm.newInteractionDraft.company || "no company given"}) looks like it
                might be <span className="font-semibold">{pm.candidateContactName}</span> — {(pm.score * 100).toFixed(0)}% match.
              </p>
              <ul className="text-[12px] text-warn-ink/90 list-disc list-inside">
                {pm.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <div className="flex gap-2 mt-1">
                <button
                  disabled={resolvingId === pm.id}
                  onClick={() => resolvePending(pm.id, "merge")}
                  className="bg-teal text-white text-[12.5px] font-medium rounded-full px-3.5 py-1.5 disabled:opacity-50"
                >
                  Yes, same person — merge
                </button>
                <button
                  disabled={resolvingId === pm.id}
                  onClick={() => resolvePending(pm.id, "new")}
                  className="border border-line text-[12.5px] font-medium rounded-full px-3.5 py-1.5 disabled:opacity-50"
                >
                  No, different person
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search contacts by name or company…"
        className="border border-line rounded-lg px-3 py-2.5 text-[14px] bg-paper-surface"
      />

      {loading ? (
        <p className="text-ink-faint text-[13.5px]">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-ink-faint text-[13.5px]">No contacts yet — log a lead on the Capture page.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(({ contact, interactions, arc }) => {
            const latest = interactions[interactions.length - 1];
            const isOpen = expanded === contact.id;
            const ai = aiResult[contact.id];
            return (
              <div key={contact.id} className="bg-paper-surface border border-line rounded-DEFAULT p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-serif font-semibold text-[16px]">{contact.displayName}</p>
                    <p className="text-[13px] text-ink-dim">
                      {latest.title || "—"} at {latest.company || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-mono text-ink-faint">{interactions.length} touch{interactions.length === 1 ? "" : "es"}</span>
                    <ArcBadge label={arc.label} tone={arc.tone} />
                  </div>
                </div>

                <p className="text-[13px] text-ink-dim border-l-2 border-line pl-3">{arc.nudge}</p>

                <div className="flex flex-wrap gap-1.5">
                  {interactions.map((i) => (
                    <span key={i.id} className="text-[11px] border border-line rounded-full px-2 py-0.5 text-ink-faint">
                      {confName(i.conferenceId)}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button onClick={() => setExpanded(isOpen ? null : contact.id)} className="text-[12.5px] text-teal underline underline-offset-2">
                    {isOpen ? "Hide timeline" : "View timeline"}
                  </button>
                  <button
                    onClick={() => getAiSummary(contact.id)}
                    disabled={aiLoading === contact.id}
                    className="text-[12.5px] font-medium border border-gold text-gold-ink rounded-full px-3 py-1 disabled:opacity-50"
                  >
                    {aiLoading === contact.id ? "Thinking…" : "AI relationship summary"}
                  </button>
                </div>

                {ai?.summary && <p className="text-[13px] bg-gold-light/40 border border-gold/30 rounded-lg p-3 whitespace-pre-line">{ai.summary}</p>}
                {ai?.error && <p className="text-[12.5px] text-danger">{ai.error}</p>}

                {isOpen && (
                  <div className="flex flex-col gap-2 mt-1 border-t border-line pt-3">
                    {interactions.map((i) => (
                      <div key={i.id} className="flex flex-col gap-1 text-[12.5px] border-b border-line/60 pb-2 last:border-none">
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          <span className="font-medium">
                            {confName(i.conferenceId)} · {new Date(i.timestamp).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <TemperatureBadge temperature={i.temperature} />
                            <HubspotStatus status={i.hubspotStatus} />
                          </div>
                        </div>
                        <p className="text-ink-dim">
                          {i.title || "—"} · {i.company || "—"} · rep: {i.repName}
                        </p>
                        {i.notes && <p className="text-ink-dim italic">&quot;{i.notes}&quot;</p>}
                        {i.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {i.tags.map((t) => (
                              <span key={t} className="text-[10.5px] bg-paper-alt rounded-full px-2 py-0.5 text-ink-dim">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <button
                            onClick={() => pushToHubspot(i.id)}
                            disabled={hubspotBusy === i.id || i.hubspotStatus === "synced"}
                            className="text-[11.5px] font-medium border border-line rounded-full px-2.5 py-1 disabled:opacity-40"
                          >
                            {i.hubspotStatus === "synced" ? "Synced" : hubspotBusy === i.id ? "Syncing…" : "Push to HubSpot"}
                          </button>
                          {hubspotMsg[i.id] && <span className="text-[11px] text-ink-faint">{hubspotMsg[i.id]}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HubspotStatus({ status }: { status: Interaction["hubspotStatus"] }) {
  const style =
    status === "synced" ? "bg-teal-bg text-teal" : status === "failed" ? "bg-danger-bg text-danger" : "bg-paper-alt text-ink-faint";
  const label = status === "synced" ? "HubSpot ✓" : status === "failed" ? "HubSpot failed" : "Not synced";
  return <span className={`text-[10.5px] rounded-full px-2 py-0.5 whitespace-nowrap ${style}`}>{label}</span>;
}
