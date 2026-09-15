"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Contact, Conference, Interaction, PendingMatch } from "@/lib/types";
import { signalForArc, type RelationshipArc } from "@/lib/nudge";
import { TemperatureBadge } from "@/components/Badges";
import { getApiKey, getApiProvider, getHubspotToken } from "@/lib/settings";
import { parseFollowUpDraft, type FollowUpDraft } from "@/lib/ai-prompt";
import {
  IconSearch,
  IconFileText,
  IconX,
  IconCopy,
  IconExternalLink,
  IconSpark,
  IconCheck,
  IconCloudSync,
} from "@/components/icons";

interface EnrichedContact {
  contact: Contact;
  interactions: Interaction[];
  arc: RelationshipArc;
}

type FilterMode = "all" | "multi" | "closing";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '");
}

// A real, computed suggestion (not invented): the nearest upcoming
// conference that shares a vertical with something this contact has
// already been met at, that they haven't attended yet.
function suggestNextConference(interactions: Interaction[], allConferences: Conference[]): Conference | null {
  const attendedIds = new Set(interactions.map((i) => i.conferenceId));
  const attendedVerticals = new Set<string>();
  for (const id of attendedIds) {
    allConferences.find((c) => c.id === id)?.verticals.forEach((v) => attendedVerticals.add(v));
  }
  const now = Date.now();
  return (
    allConferences
      .filter(
        (c) => !attendedIds.has(c.id) && new Date(c.startDate).getTime() > now && c.verticals.some((v) => attendedVerticals.has(v))
      )
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] ?? null
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<EnrichedContact[]>([]);
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, { draft?: FollowUpDraft; raw?: string; error?: string }>>({});
  const [hubspotBusy, setHubspotBusy] = useState<string | null>(null);
  const [hubspotMsg, setHubspotMsg] = useState<Record<string, string>>({});
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // ⌘K / Ctrl+K jumps straight into search — real, not decorative.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const confName = (id: string) => conferences.find((c) => c.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    let rows = contacts;
    if (filterMode === "multi") rows = rows.filter((c) => c.interactions.length >= 2);
    if (filterMode === "closing") rows = rows.filter((c) => c.interactions.length >= 2 && signalForArc(c.arc) === "closing");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (c) =>
          c.contact.displayName.toLowerCase().includes(q) ||
          c.interactions.some((i) => i.company.toLowerCase().includes(q) || confName(i.conferenceId).toLowerCase().includes(q))
      );
    }
    return rows;
  }, [contacts, query, filterMode, conferences]);

  const multiCount = contacts.filter((c) => c.interactions.length >= 2).length;
  const closingCount = contacts.filter((c) => c.interactions.length >= 2 && signalForArc(c.arc) === "closing").length;

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

  async function openDrawer(contactId: string) {
    setDrawerContactId(contactId);
    if (aiResult[contactId]) return; // already generated this session
    const key = getApiKey();
    const provider = getApiProvider();
    setAiLoading(contactId);
    try {
      const res = await fetch("/api/ai/relationship-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ai-key": key, "x-ai-provider": provider },
        body: JSON.stringify({ contactId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiResult((r) => ({ ...r, [contactId]: { error: data.error } }));
      } else {
        const parsed = parseFollowUpDraft(data.summary);
        setAiResult((r) => ({ ...r, [contactId]: parsed ? { draft: parsed } : { raw: data.summary } }));
      }
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

  async function pushTaskToHubspot(contactId: string, taskBody: string) {
    const token = getHubspotToken();
    if (!token) {
      setTaskMsg("Add a HubSpot token in Settings to push tasks.");
      return;
    }
    setTaskBusy(contactId);
    setTaskMsg(null);
    try {
      const res = await fetch("/api/hubspot/push-task", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hubspot-token": token },
        body: JSON.stringify({ contactId, taskBody, taskSubject: "Follow up (Grain Conference Intel)" }),
      });
      const data = await res.json();
      setTaskMsg(res.ok ? "Task created in HubSpot." : data.error ?? "Failed to create task.");
    } catch {
      setTaskMsg("Network error reaching HubSpot proxy.");
    } finally {
      setTaskBusy(null);
    }
  }

  function copyDraft(text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopyMsg("Copied");
        setTimeout(() => setCopyMsg(null), 1500);
      },
      () => {
        setCopyMsg("Couldn't copy — select the text manually");
        setTimeout(() => setCopyMsg(null), 2500);
      }
    );
  }

  const drawerEnriched = drawerContactId ? contacts.find((c) => c.contact.id === drawerContactId) : null;
  const drawerAi = drawerContactId ? aiResult[drawerContactId] : undefined;
  const drawerLoading = drawerContactId ? aiLoading === drawerContactId : false;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Relationship Intelligence</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">Same person, different show — is it warming up?</h1>
        <p className="text-slate-500 text-[14.5px] max-w-[70ch] mt-1.5">
          Cross-event touchpoint tracking, momentum scoring, and automated Grain pitch synthesis.
        </p>
      </div>

      {pendingMatches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold text-amber-700">Possible matches awaiting your review ({pendingMatches.length})</h2>
          {pendingMatches.map((pm) => (
            <div key={pm.id} className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex flex-col gap-2">
              <p className="text-[13.5px] text-amber-900">
                <span className="font-semibold">{pm.capturedName}</span> ({pm.newInteractionDraft.company || "no company given"}) looks
                like it might be <span className="font-semibold">{pm.candidateContactName}</span> — {(pm.score * 100).toFixed(0)}% match.
              </p>
              <ul className="text-[12px] text-amber-800/90 list-disc list-inside">
                {pm.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <div className="flex gap-2 mt-1">
                <button
                  disabled={resolvingId === pm.id}
                  onClick={() => resolvePending(pm.id, "merge")}
                  className="bg-[#0F172A] text-white text-[12.5px] font-medium rounded-full px-3.5 py-1.5 disabled:opacity-50"
                >
                  Yes, same person — merge
                </button>
                <button
                  disabled={resolvingId === pm.id}
                  onClick={() => resolvePending(pm.id, "new")}
                  className="border border-slate-200 text-[12.5px] font-medium rounded-full px-3.5 py-1.5 disabled:opacity-50"
                >
                  No, different person
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <IconSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts by name, company, or event…"
            className="w-full h-11 rounded-lg border border-slate-200 bg-white pl-10 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/10"
          />
          <span className="hidden sm:flex items-center gap-0.5 absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
            ⌘K
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "all", label: "All Contacts" },
              { key: "multi", label: `Multi-Show Leads (${multiCount})` },
              { key: "closing", label: `High Closing Intent (${closingCount})` },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterMode(key)}
              className={`text-[13px] font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
                filterMode === key ? "bg-[#0F172A] text-white border-[#0F172A]" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400 text-[13.5px]">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-400 text-[13.5px]">No contacts match — log a lead on the Capture page.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(({ contact, interactions, arc }) => {
            const latest = interactions[interactions.length - 1];
            const isOpen = expandedId === contact.id;
            const signal = signalForArc(arc);
            const isSingleTouch = interactions.length <= 1;
            const anySynced = interactions.some((i) => i.hubspotStatus === "synced");
            const linkedinHref = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
              `${contact.displayName} ${latest.company}`
            )}`;
            const nextConf = !isSingleTouch ? suggestNextConference(interactions, conferences) : null;

            return (
              <div
                key={contact.id}
                className="bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04),0_2px_6px_-1px_rgba(15,23,42,0.02)] p-5 flex flex-col gap-4"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <span className="w-11 h-11 rounded-full bg-blue-50 text-[#0F172A] font-semibold text-sm border border-blue-100 flex items-center justify-center shrink-0">
                      {initials(contact.displayName)}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-lg font-semibold tracking-tight text-[#0F172A]">{contact.displayName}</p>
                        <span title={anySynced ? "Synced to HubSpot" : "Not synced to HubSpot"}>
                          <IconCheck className={`w-3.5 h-3.5 ${anySynced ? "text-emerald-600" : "text-slate-300"}`} />
                        </span>
                        <a
                          href={linkedinHref}
                          target="_blank"
                          rel="noreferrer"
                          title="Search LinkedIn"
                          className="text-slate-300 hover:text-[#2563EB] transition-colors"
                        >
                          <IconExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-sm text-slate-500 font-medium">
                        {latest.title || "—"} · {latest.company || "—"}
                      </p>
                    </div>
                  </div>

                  {isSingleTouch ? (
                    <span className="bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                      First Touch · Monitoring
                    </span>
                  ) : signal === "closing" ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                      High Closing Intent · {interactions.length} Shows
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
                      Low Momentum · {interactions.length} Shows
                    </span>
                  )}
                </div>

                {/* Journey stepper */}
                {!isSingleTouch && (
                  <div className="flex items-center gap-0 overflow-x-auto no-scrollbar py-1">
                    {interactions.map((i, idx) => (
                      <div key={i.id} className="flex items-center shrink-0">
                        <div className="flex flex-col gap-0.5 min-w-[120px] max-w-[160px]">
                          <p className="text-[12.5px] font-semibold text-[#0F172A] truncate">{confName(i.conferenceId)}</p>
                          <p className="text-[11px] text-slate-400">{monthYear(i.timestamp)}</p>
                          {i.notes && <p className="text-[11px] text-slate-500 truncate">&quot;{i.notes}&quot;</p>}
                        </div>
                        {idx < interactions.length - 1 && <div className="h-px w-8 sm:w-12 bg-slate-200 mx-2 shrink-0" />}
                      </div>
                    ))}
                    {nextConf && (
                      <div className="flex items-center shrink-0">
                        <div className="h-px w-8 sm:w-12 bg-slate-200 mx-2 shrink-0" />
                        <div className="flex flex-col gap-0.5 min-w-[120px]">
                          <p className="text-[12.5px] font-semibold text-[#2563EB] truncate">Next: {nextConf.name}</p>
                          <p className="text-[11px] text-slate-400">{monthYear(nextConf.startDate)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Synthesis & Outreach strip — the one dominant action on a
                    multi-touch card. Single-touch contacts don't get it: the
                    drawer is gated to 2+ touchpoints same as the badge logic. */}
                {!isSingleTouch ? (
                  <div
                    className="rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
                    style={{ background: "linear-gradient(135deg, #f8faff 0%, #f0f7ff 100%)", border: "1px solid rgba(37, 99, 235, 0.2)" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconSpark className="w-4 h-4 text-[#2563EB] shrink-0" />
                      <p className="text-[13.5px] text-slate-700">
                        <span className="font-semibold text-[#0F172A]">{interactions.length} historical touchpoints detected.</span>{" "}
                        Ready to draft personalized C-level pitch.
                      </p>
                    </div>
                    <button
                      onClick={() => openDrawer(contact.id)}
                      className="shrink-0 inline-flex items-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-[15px] font-semibold px-6 py-2.5 rounded-lg shadow-[0_2px_4px_rgba(15,23,42,0.15)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.2)] hover:-translate-y-px transition-all"
                    >
                      <IconSpark className="w-4 h-4" />
                      Draft AI Follow-up Pitch
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setExpandedId(contact.id)}
                    className="self-start text-[13px] font-medium text-[#2563EB] hover:underline"
                  >
                    Add Follow-up Note
                  </button>
                )}

                <button
                  onClick={() => setExpandedId(isOpen ? null : contact.id)}
                  className="self-start flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-700"
                >
                  <IconFileText className="w-3.5 h-3.5" />
                  {isOpen ? "Hide" : "View"} Meeting Notes ({interactions.length})
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                    {!isSingleTouch && <p className="text-[13px] text-slate-600 border-l-2 border-slate-200 pl-3">{arc.nudge}</p>}
                    {interactions.map((i) => (
                      <div key={i.id} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#0F172A] text-[13.5px]">{confName(i.conferenceId)}</span>
                            <span className="text-[12px] text-slate-500">{new Date(i.timestamp).toLocaleDateString()}</span>
                            <span className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                              rep: {i.repName}
                            </span>
                          </div>
                          <TemperatureBadge temperature={i.temperature} />
                        </div>

                        <p className="text-[13px] text-slate-600">
                          {i.title || "—"} · {i.company || "—"}
                        </p>

                        {i.notes && (
                          <blockquote className="border-l-2 border-[#2563EB]/40 pl-3 text-[13px] text-[#0F172A] leading-snug">
                            {i.notes}
                          </blockquote>
                        )}

                        {i.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {i.tags.map((t) => (
                              <span key={t} className="text-[11px] bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-700">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => pushToHubspot(i.id)}
                            disabled={hubspotBusy === i.id || i.hubspotStatus === "synced"}
                            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold border border-slate-200 bg-white rounded-full px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                          >
                            <IconCloudSync className="w-3 h-3" />
                            {i.hubspotStatus === "synced" ? "Synced" : hubspotBusy === i.id ? "Syncing…" : "Ready to Sync"}
                          </button>
                          <HubspotStatus status={i.hubspotStatus} />
                          {hubspotMsg[i.id] && <span className="text-[11px] text-slate-400">{hubspotMsg[i.id]}</span>}
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

      {drawerContactId && drawerEnriched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerContactId(null)} />
          <div className="relative bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1">AI Follow-up Draft</p>
                <p className="text-lg font-semibold text-[#0F172A]">{drawerEnriched.contact.displayName}</p>
              </div>
              <button
                onClick={() => setDrawerContactId(null)}
                className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50"
                aria-label="Close"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            {drawerLoading ? (
              <p className="text-sm text-slate-400 py-6 text-center">Thinking…</p>
            ) : drawerAi?.error ? (
              <p className="text-sm text-rose-600">{drawerAi.error}</p>
            ) : drawerAi?.draft ? (
              <>
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1">Diagnosis</p>
                  <p className="text-[13.5px] text-slate-700">{drawerAi.draft.diagnosis}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1">Tactical Pitch Angle</p>
                  <p className="text-[13.5px] text-slate-700">{drawerAi.draft.pitchAngle}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1">Email Draft</p>
                  <p className="text-[13.5px] text-slate-700 whitespace-pre-line bg-slate-50 rounded-lg p-3 border border-slate-100">
                    {drawerAi.draft.emailDraft}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => copyDraft(drawerAi.draft!.emailDraft)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <IconCopy className="w-3.5 h-3.5" />
                    {copyMsg ?? "Copy Draft"}
                  </button>
                  <button
                    onClick={() => pushTaskToHubspot(drawerContactId, drawerAi.draft!.emailDraft)}
                    disabled={taskBusy === drawerContactId}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                  >
                    {taskBusy === drawerContactId ? "Pushing…" : "Push to HubSpot as Task"}
                  </button>
                </div>
                {taskMsg && <p className="text-[12px] text-slate-500 text-center">{taskMsg}</p>}
              </>
            ) : drawerAi?.raw ? (
              <p className="text-[13.5px] text-slate-700 whitespace-pre-line">{drawerAi.raw}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function HubspotStatus({ status }: { status: Interaction["hubspotStatus"] }) {
  const style =
    status === "synced" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400";
  const label = status === "synced" ? "HubSpot ✓" : status === "failed" ? "HubSpot failed" : "Not synced";
  return <span className={`text-[10.5px] rounded-full px-2 py-0.5 whitespace-nowrap ${style}`}>{label}</span>;
}
