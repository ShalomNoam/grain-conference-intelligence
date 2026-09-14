"use client";

import { useEffect, useMemo, useState } from "react";
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

  const selectedConf = useMemo(() => conferences.find((c) => c.id === conferenceId), [conferences, conferenceId]);

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
    <div className="flex flex-col gap-4 max-w-xl mx-auto pb-16">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-gold-ink mb-1">Field Capture</p>
        <h1 className="text-[22px] font-bold">Log who you just met</h1>
        <p className="text-ink-dim text-[13.5px] mt-1">Built for the booth floor: name + company is enough to save. Everything else is optional.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={conferenceId}
          onChange={(e) => setConferenceId(e.target.value)}
          className="col-span-2 border border-line rounded-lg px-3 py-2.5 text-[14px] bg-paper-surface"
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
          className="col-span-2 border border-line rounded-lg px-3 py-2.5 text-[13.5px] bg-paper-surface text-ink-dim"
        />
      </div>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-[13.5px] font-medium ${
            feedback.kind === "success" ? "bg-teal-bg text-teal" : feedback.kind === "review" ? "bg-warn-bg text-warn-ink" : "bg-danger-bg text-danger"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="bg-paper-surface border border-line rounded-DEFAULT p-4 flex flex-col gap-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name *"
          className="border border-line rounded-lg px-3 py-3 text-[16px]"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          className="border border-line rounded-lg px-3 py-3 text-[16px]"
        />

        <div>
          <p className="text-[12px] text-ink-faint mb-1.5">Temperature</p>
          <div className="grid grid-cols-3 gap-2">
            {(["cold", "warm", "hot"] as Temperature[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTemperature(t)}
                className={`py-2.5 rounded-lg text-[13.5px] font-medium capitalize border transition-colors ${
                  temperature === t ? "bg-ink text-white border-ink" : "border-line text-ink-dim"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[12px] text-ink-faint mb-1.5">Quick tags</p>
          <div className="flex flex-wrap gap-1.5">
            {TAG_PRESETS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1.5 rounded-full text-[12px] border transition-colors ${
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
          className="border border-line rounded-lg px-3 py-2.5 text-[14px] resize-none"
        />

        {!showMore ? (
          <button type="button" onClick={() => setShowMore(true)} className="self-start text-[12.5px] text-teal underline underline-offset-2">
            + Title / email
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" className="border border-line rounded-lg px-3 py-2.5 text-[14px]" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border border-line rounded-lg px-3 py-2.5 text-[14px]" />
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={submitting || !name.trim() || !conferenceId}
        className="bg-ink text-white rounded-full py-3.5 text-[15px] font-semibold disabled:opacity-40 sticky bottom-20 md:bottom-4 shadow-lg"
      >
        {submitting ? "Saving…" : `Log lead${selectedConf ? ` at ${selectedConf.name}` : ""}`}
      </button>

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
