"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conference, Contact, Interaction, Temperature } from "@/lib/types";
import { getRepName, setRepName, getLastConferenceId, setLastConferenceId, getHubspotToken } from "@/lib/settings";
import { findContactMatch } from "@/lib/matching";
import { IconBolt, IconChevronDown, IconBriefcase, IconMail, IconCloudSync } from "@/components/icons";

const TAG_PRESETS = ["Budget Owner", "Champion", "Manual FX Today", "Multi-Currency", "Competitor User", "Evaluating Now"];

type Feedback = { kind: "success" | "review" | "error"; message: string } | null;
type ContactForMatch = { contact: Contact; interactions: Interaction[] };

const INPUT_CLS =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/10";
const LABEL_CLS = "text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5 block";

// Pick the conference closest to "now" — the one a rep standing on a show
// floor is most likely to be at — preferring an upcoming one over a past one.
function nearestConference(list: Conference[]): Conference {
  const now = Date.now();
  const upcoming = list
    .filter((c) => new Date(c.endDate).getTime() >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  if (upcoming.length) return upcoming[0];
  return [...list].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
}

export default function CapturePage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [conferenceId, setConferenceId] = useState("");
  const [rep, setRep] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [temperature, setTemperature] = useState<Temperature>("warm");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [recent, setRecent] = useState<{ name: string; company: string; feedback: string }[]>([]);
  const [contactsForMatch, setContactsForMatch] = useState<ContactForMatch[]>([]);

  function loadContactsForMatch() {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((d) => setContactsForMatch(d.contacts ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    setRep(getRepName());
    loadContactsForMatch();
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((d) => {
        const list: Conference[] = d.conferences ?? [];
        setConferences(list);
        const saved = getLastConferenceId();
        if (saved && list.some((c) => c.id === saved)) {
          setConferenceId(saved);
        } else if (list.length) {
          setConferenceId(nearestConference(list).id);
        }
      });
  }, []);

  // Live duplicate-relationship check — runs the same matching engine the
  // server uses on submit, just client-side and read-only, so a rep sees
  // "this is touch #2" before they even hit save, not after.
  const duplicateAlert = useMemo(() => {
    if (name.trim().length < 2 || contactsForMatch.length === 0) return null;
    const match = findContactMatch({ name, company, email: email || undefined }, contactsForMatch.map((x) => x.contact));
    if (match.type === "none" || !match.contact) return null;
    const enriched = contactsForMatch.find((x) => x.contact.id === match.contact!.id);
    if (!enriched || enriched.interactions.length === 0) return null;
    const lastInteraction = enriched.interactions[enriched.interactions.length - 1];
    const lastConf = conferences.find((c) => c.id === lastInteraction.conferenceId);
    return {
      displayName: enriched.contact.displayName,
      lastConfName: lastConf?.name ?? "a previous conference",
      nextTouch: enriched.interactions.length + 1,
    };
  }, [name, company, email, contactsForMatch, conferences]);

  function toggleTag(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  function resetForLeadEntry() {
    setName("");
    setCompany("");
    setTitle("");
    setEmail("");
    setShowMore(false);
    setTemperature("warm");
    setTags([]);
    setNotes("");
  }

  async function submit() {
    if (!name.trim() || !company.trim() || !conferenceId) return;
    setRepName(rep);
    setLastConferenceId(conferenceId);
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          title,
          email: email || undefined,
          conferenceId,
          repName: rep || "Unassigned rep",
          temperature,
          notes,
          tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ kind: "error", message: data.error ?? "Something went wrong." });
        return;
      }

      let msg = "";
      if (data.status === "new_contact") msg = "Lead captured.";
      else if (data.status === "matched_exact") msg = `Lead captured — linked to "${data.contact.displayName}" (email match).`;
      else if (data.status === "matched_auto") msg = `Lead captured — linked to "${data.contact.displayName}", met before.`;
      else if (data.status === "pending_review") msg = "Possible match with an existing contact — review it on the Contacts page.";

      // Auto-sync to HubSpot right after capture, only when a token is
      // configured and only claimed in the feedback if it actually
      // succeeded — never a false "synced" state. pending_review doesn't
      // create an interaction yet, so there's nothing to sync until the
      // rep resolves it on the Contacts page.
      if (data.status !== "pending_review" && data.interaction?.id) {
        const token = getHubspotToken();
        if (token) {
          try {
            const syncRes = await fetch("/api/hubspot/push", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-hubspot-token": token },
              body: JSON.stringify({ interactionId: data.interaction.id }),
            });
            msg += syncRes.ok ? " Synced to HubSpot." : " HubSpot sync failed — retry from Contacts.";
          } catch {
            msg += " HubSpot sync failed — retry from Contacts.";
          }
        }
      }

      setFeedback({ kind: data.status === "pending_review" ? "review" : "success", message: msg });
      setRecent((r) => [{ name, company, feedback: msg }, ...r].slice(0, 5));
      resetForLeadEntry();
      loadContactsForMatch();
    } catch (err) {
      setFeedback({ kind: "error", message: "Network error — couldn't save. Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const canSave = !submitting && name.trim() && company.trim() && conferenceId;

  return (
    <div className="max-w-[560px] mx-auto w-full pb-28">
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-1">
          <IconBolt className="w-3.5 h-3.5" />
          FIELD CAPTURE
        </p>
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Log who you just met</h1>
        <p className="text-sm text-slate-500 mt-1">Quick-sync live meeting notes directly into HubSpot.</p>
      </div>

      <div className="relative mb-4">
        <select
          value={conferenceId}
          onChange={(e) => setConferenceId(e.target.value)}
          className="appearance-none w-full h-11 rounded-full border border-slate-200 bg-white pl-4 pr-10 text-sm font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/10"
        >
          {conferences.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.city}
            </option>
          ))}
        </select>
        <IconChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-[14px] font-medium mb-4 ${
            feedback.kind === "success"
              ? "bg-emerald-50 text-emerald-700"
              : feedback.kind === "review"
              ? "bg-amber-50 text-amber-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.04),0_8px_10px_-6px_rgba(0,0,0,0.02)] p-6 sm:p-8 flex flex-col gap-5">
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4">
          <label>
            <span className={LABEL_CLS}>Full Name *</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dana Shapiro" className={INPUT_CLS} />
          </label>
          <label>
            <span className={LABEL_CLS}>Company *</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. PayLane Global" className={INPUT_CLS} />
          </label>
        </div>

        {duplicateAlert && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200/60 text-blue-800 rounded-lg px-3.5 py-2.5 text-[13px]">
            <IconBolt className="w-4 h-4 shrink-0 mt-0.5 text-[#2563EB]" />
            <span>
              Existing Relationship: <strong>{duplicateAlert.displayName}</strong> met at {duplicateAlert.lastConfName}. Logging appends
              touchpoint #{duplicateAlert.nextTouch}.
            </span>
          </div>
        )}

        <div>
          <span className={LABEL_CLS}>Interaction Temperature</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { t: "cold", label: "Cold", active: "border-slate-300 bg-slate-100 text-slate-700 font-semibold", idle: "text-slate-600 border-slate-200 hover:bg-slate-50" },
                { t: "warm", label: "Warm", active: "border-amber-200 bg-amber-50/60 text-amber-800 font-semibold", idle: "text-slate-600 border-slate-200 hover:bg-slate-50" },
                { t: "hot", label: "Hot", active: "border-rose-200 bg-rose-50 text-rose-700 font-semibold", idle: "text-slate-600 border-slate-200 hover:bg-slate-50" },
              ] as const
            ).map(({ t, label, active, idle }) => (
              <button
                key={t}
                type="button"
                onClick={() => setTemperature(t as Temperature)}
                className={`h-11 rounded-lg text-sm border transition-colors flex items-center justify-center gap-1.5 ${
                  temperature === t ? active : idle
                }`}
              >
                {temperature === t && t === "hot" && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {!showMore ? (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="self-start text-[13.5px] font-medium text-slate-500 underline underline-offset-2"
          >
            + Add more details (optional)
          </button>
        ) : (
          <div className="flex flex-col gap-4 border-t border-slate-100 pt-5">
            {!rep && (
              <label>
                <span className={LABEL_CLS}>Your Name</span>
                <input value={rep} onChange={(e) => setRep(e.target.value)} placeholder="Your name" className={INPUT_CLS} />
              </label>
            )}

            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4">
              <label>
                <span className={`${LABEL_CLS} flex items-center gap-1`}>
                  <IconBriefcase className="w-3 h-3" />
                  Job Title
                </span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. VP Finance" className={INPUT_CLS} />
              </label>
              <label>
                <span className={`${LABEL_CLS} flex items-center gap-1`}>
                  <IconMail className="w-3 h-3" />
                  Work Email
                </span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. dana@paylane.com" className={INPUT_CLS} />
              </label>
            </div>

            <div>
              <span className={LABEL_CLS}>Key Context</span>
              <div className="flex flex-wrap gap-2">
                {TAG_PRESETS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={
                      tags.includes(tag)
                        ? "bg-[#0F172A] text-white text-xs font-medium px-3 py-1.5 rounded-full"
                        : "bg-slate-50 text-slate-600 border border-slate-200 text-xs px-3 py-1.5 rounded-full hover:border-slate-300 transition-colors"
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="One-line note — what they said, what to remember"
              rows={2}
              className="border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm resize-none focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/10"
            />
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSave}
          className="w-full h-12 bg-[#0F172A] hover:bg-[#1E293B] text-white text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-1 active:scale-[0.99] disabled:opacity-40"
        >
          <IconCloudSync className="w-4 h-4" />
          {submitting ? "Saving…" : "Sync Lead to HubSpot"}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-4">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Just logged</p>
          {recent.map((r, i) => (
            <div key={i} className="text-[12.5px] text-slate-500 border-b border-slate-100 pb-1.5">
              <span className="font-medium text-[#0F172A]">{r.name}</span> {r.company && `· ${r.company}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
