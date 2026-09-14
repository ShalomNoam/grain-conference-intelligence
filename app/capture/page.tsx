"use client";

import { useEffect, useState } from "react";
import type { Conference, Interaction, Temperature } from "@/lib/types";
import { getRepName, setRepName, getLastConferenceId, setLastConferenceId } from "@/lib/settings";

const TAG_PRESETS = [
  "Budget owner",
  "Champion",
  "Manual FX today",
  "Multi-currency",
  "Competitor user",
  "Evaluating now",
  "No urgency",
];

type Feedback = { kind: "success" | "review" | "error"; message: string } | null;

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

  useEffect(() => {
    setRep(getRepName());
    fetch("/api/conferences")
      .then((r) => r.json())
      .then((d) => {
        const list: Conference[] = d.conferences ?? [];
        setConferences(list);
        const saved = getLastConferenceId();
        if (saved && list.some((c) => c.id === saved)) {
          setConferenceId(saved);
        } else if (list.length) {
          setConferenceId(list[0].id);
        }
      });
  }, []);

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
    if (!name.trim() || !conferenceId) return;
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
      if (data.status === "new_contact") msg = `Logged — new contact.`;
      else if (data.status === "matched_exact") msg = `Linked to existing contact "${data.contact.displayName}" (email match).`;
      else if (data.status === "matched_auto") msg = `Linked to existing contact "${data.contact.displayName}" — met before.`;
      else if (data.status === "pending_review") msg = `Possible match with an existing contact — review it on the Contacts page.`;
      setFeedback({ kind: data.status === "pending_review" ? "review" : "success", message: msg });
      setRecent((r) => [{ name, company, feedback: msg }, ...r].slice(0, 5));
      resetForLeadEntry();
    } catch (err) {
      setFeedback({ kind: "error", message: "Network error — couldn't save. Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto pb-28">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-gold-ink mb-1">Field Capture</p>
        <h1 className="text-[22px] font-bold">Log who you just met</h1>
        <p className="text-ink-dim text-[13.5px] mt-1">Name + company is enough to save. Everything else is optional.</p>
      </div>

      <div className="flex flex-col gap-2">
        <select
          value={conferenceId}
          onChange={(e) => setConferenceId(e.target.value)}
          className="border border-line rounded-lg px-3 min-h-[48px] text-[16px] bg-paper-surface"
        >
          {conferences.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={rep}
          onChange={(e) => setRep(e.target.value)}
          placeholder="Your name"
          className="border border-line rounded-lg px-3 min-h-[48px] text-[15px] bg-paper-surface text-ink-dim"
        />
      </div>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-[14px] font-medium ${
            feedback.kind === "success" ? "bg-teal-bg text-teal" : feedback.kind === "review" ? "bg-warn-bg text-warn-ink" : "bg-danger-bg text-danger"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="bg-paper-surface border border-line rounded-DEFAULT p-4 flex flex-col gap-4">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name *"
          className="border border-line rounded-lg px-4 min-h-[48px] text-[16px]"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          className="border border-line rounded-lg px-4 min-h-[48px] text-[16px]"
        />

        <div>
          <p className="text-[13px] text-ink-dim font-medium mb-2">Temperature</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { t: "cold", label: "❄️ Cold", active: "bg-slate-500 text-white border-slate-500", idle: "border-slate-300 text-slate-500" },
                { t: "warm", label: "🔥 Warm", active: "bg-amber-500 text-white border-amber-500", idle: "border-amber-400 text-amber-600" },
                { t: "hot", label: "🔥 Hot", active: "bg-rose-600 text-white border-rose-600", idle: "border-rose-400 text-rose-600" },
              ] as const
            ).map(({ t, label, active, idle }) => (
              <button
                key={t}
                type="button"
                onClick={() => setTemperature(t as Temperature)}
                className={`min-h-[48px] rounded-lg text-[14px] font-semibold border-2 transition-colors ${
                  temperature === t ? active : `bg-transparent ${idle}`
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[13px] text-ink-dim font-medium mb-2">Quick tags</p>
          <div className="flex flex-wrap gap-2">
            {TAG_PRESETS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 min-h-[40px] rounded-full text-[13px] font-medium border transition-colors ${
                  tags.includes(tag) ? "bg-gold text-white border-gold" : "border-line text-ink-dim"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="One-line note (optional) — what they said, what to remember"
          rows={2}
          className="border border-line rounded-lg px-4 py-3 text-[15px] resize-none"
        />

        {!showMore ? (
          <button type="button" onClick={() => setShowMore(true)} className="self-start text-[13px] text-teal underline underline-offset-2">
            + Title / email
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" className="border border-line rounded-lg px-4 min-h-[48px] text-[15px]" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border border-line rounded-lg px-4 min-h-[48px] text-[15px]" />
          </div>
        )}
      </div>

      <div className="fixed bottom-16 md:bottom-0 inset-x-0 z-20 md:static bg-paper/95 backdrop-blur md:bg-transparent px-4 pb-3 pt-2 md:p-0">
        <button
          onClick={submit}
          disabled={submitting || !name.trim() || !conferenceId}
          className="w-full max-w-md mx-auto block bg-ink text-white rounded-full min-h-[52px] text-[16px] font-bold disabled:opacity-40 shadow-lg"
        >
          {submitting ? "Saving…" : `Save & Sync Lead`}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          <p className="text-[12px] text-ink-faint font-mono uppercase tracking-wide">Just logged</p>
          {recent.map((r, i) => (
            <div key={i} className="text-[12.5px] text-ink-dim border-b border-line pb-1.5">
              <span className="font-medium text-ink">{r.name}</span> {r.company && `· ${r.company}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
