"use client";

// Everything here lives in the browser only (localStorage). Nothing is
// written server-side and no key is ever hardcoded in source — this is
// what satisfies the assignment's "API keys configurable by the user, not
// hardcoded" constraint. Values are read fresh on each call rather than
// cached in a module-level variable, so multiple components stay in sync
// after a Settings save without needing a global state library.

const KEYS = {
  repName: "grain-cit:repName",
  apiKey: "grain-cit:apiKey",
  apiProvider: "grain-cit:apiProvider",
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

export const getApiKey = () => read(KEYS.apiKey).trim();
export const setApiKey = (v: string) => write(KEYS.apiKey, v.trim());

// The provider actually resolved for the stored key — auto-detected, or
// picked manually when detection couldn't tell (see lib/ai-provider.ts).
// Persisted alongside the key so every AI call sends a known provider
// instead of re-guessing (and possibly failing) each time.
export const getApiProvider = () => read(KEYS.apiProvider);
export const setApiProvider = (v: string) => write(KEYS.apiProvider, v);

export const getHubspotToken = () => read(KEYS.hubspotToken);
export const setHubspotToken = (v: string) => write(KEYS.hubspotToken, v);

export const getLastConferenceId = () => read(KEYS.lastConferenceId);
export const setLastConferenceId = (v: string) => write(KEYS.lastConferenceId, v);
