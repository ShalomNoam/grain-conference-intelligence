"use client";

// Everything here lives in the browser only (localStorage). Nothing is
// written server-side and no key is ever hardcoded in source — this is
// what satisfies the assignment's "API keys configurable by the user, not
// hardcoded" constraint. Values are read fresh on each call rather than
// cached in a module-level variable, so multiple components stay in sync
// after a Settings save without needing a global state library.

const KEYS = {
  repName: "grain-cit:repName",
  geminiKey: "grain-cit:geminiKey",
  hubspotToken: "grain-cit:hubspotToken",
  lastConferenceId: "grain-cit:lastConferenceId",
} as const;

function read(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // private-browsing / storage disabled — fail silently, nothing to persist
  }
}

export const getRepName = () => read(KEYS.repName);
export const setRepName = (v: string) => write(KEYS.repName, v);

export const getGeminiKey = () => read(KEYS.geminiKey);
export const setGeminiKey = (v: string) => write(KEYS.geminiKey, v);

export const getHubspotToken = () => read(KEYS.hubspotToken);
export const setHubspotToken = (v: string) => write(KEYS.hubspotToken, v);

export const getLastConferenceId = () => read(KEYS.lastConferenceId);
export const setLastConferenceId = (v: string) => write(KEYS.lastConferenceId, v);
