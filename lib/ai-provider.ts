// A rep pastes one API key into Settings — no provider picker, no model
// picker, by default. We detect the provider from the key's own shape
// (every major LLM vendor prefixes keys distinctly) and route to the right
// endpoint/format automatically. When a key doesn't match any known shape,
// the UI never blocks saving it — it falls back to letting the rep pick the
// provider manually from a short list, and that choice (not a guess) is
// what gets sent on every AI call from then on.

export type AiProvider = "gemini" | "anthropic" | "openai" | "openrouter";

export const ALL_PROVIDERS: AiProvider[] = ["gemini", "anthropic", "openai", "openrouter"];

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

export function isAiProvider(v: string): v is AiProvider {
  return (ALL_PROVIDERS as string[]).includes(v);
}

// Order matters: check the more specific prefixes before the generic ones
// they'd otherwise be swallowed by (sk-ant- / sk-or- / sk-proj- / sk-admin-
// all also start with the bare "sk-" that plain OpenAI keys use).
export function detectProvider(rawKey: string): AiProvider | null {
  const key = rawKey.trim();
  if (!key) return null;
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";
  if (key.startsWith("sk-proj-") || key.startsWith("sk-admin-")) return "openai";
  if (key.startsWith("AIza") || key.startsWith("AQ.")) return "gemini";
  if (key.startsWith("sk-")) return "openai";
  return null;
}

export interface AiCallResult {
  text?: string;
  error?: string;
  provider?: AiProvider;
}

// A clean, rep-facing message — not a raw JSON dump — but still carrying the
// vendor's own error.message when there is one, since "invalid key" and
// "model not found" and "out of credit" all need a different fix and a rep
// (or whoever's debugging their report) shouldn't have to guess which.
// The full response body is additionally logged server-side either way.
async function friendlyHttpError(res: Response, providerLabel: string): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (raw) console.error(`[ai-provider] ${providerLabel} HTTP ${res.status}:`, raw.slice(0, 2000));

  let detail = "";
  try {
    const data = raw ? JSON.parse(raw) : null;
    detail = data?.error?.message || data?.message || "";
  } catch {
    // Response wasn't JSON — no extra detail available, fall back to the base message.
  }

  const base = `Error connecting to ${providerLabel}: please verify the key is valid and has available credit. (HTTP ${res.status})`;
  return detail ? `${base} — ${detail}` : base;
}

// Which exact Gemini model names are live varies by account and shifts over
// time (a hardcoded "gemini-2.5-flash" 404'd, then a hardcoded
// "gemini-1.5-flash" 404'd too — Google's own roster moved out from under
// both). Rather than hardcode a fourth guess, ask Google's own ListModels
// endpoint what this key can actually use, and pick a "flash" model from
// the real, current answer. Falls back to a hardcoded default only if the
// discovery call itself fails, so a real invalid-key error still surfaces
// normally instead of being masked by a discovery failure.
async function resolveGeminiModel(apiKey: string): Promise<string> {
  const fallback = "gemini-flash-latest";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return fallback;
    const data = await res.json();
    const models: Array<{ name?: string; supportedGenerationMethods?: string[] }> = data?.models ?? [];
    const usable = models.filter((m) => m.name && m.supportedGenerationMethods?.includes("generateContent"));
    const flash = usable.find((m) => m.name!.includes("flash") && !m.name!.includes("8b"));
    const chosen = flash ?? usable[0];
    return chosen?.name ? chosen.name.replace(/^models\//, "") : fallback;
  } catch {
    return fallback;
  }
}

// Server-side only (needs to reach each vendor's API directly). Picks the
// endpoint, auth header, request body shape, and response parsing for
// whichever provider applies, and normalizes all four down to
// { text } | { error } so callers never need per-provider branching.
// `opts.provider` — when the client already knows the provider (auto-detected
// at save time, or picked manually because detection failed) — is trusted
// over a fresh detection pass, since the rep's own choice should always win.
export async function callAiProvider(
  rawApiKey: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; provider?: AiProvider | null } = {}
): Promise<AiCallResult> {
  const apiKey = rawApiKey.trim();
  const provider = opts.provider ?? detectProvider(apiKey);
  const maxTokens = opts.maxTokens ?? 220;
  const temperature = opts.temperature ?? 0.4;

  if (!apiKey) {
    return { error: "No API key configured. Add one in Settings to enable AI summaries." };
  }

  if (!provider) {
    return {
      error:
        "We couldn't tell which AI provider this key belongs to. Open Settings and pick the provider manually from the dropdown under the key field.",
    };
  }

  const label = PROVIDER_LABEL[provider];

  try {
    if (provider === "gemini") {
      const model = await resolveGeminiModel(apiKey);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        }
      );
      if (!res.ok) return { error: await friendlyHttpError(res, label), provider };
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { error: "Gemini returned no content (it may have blocked the prompt).", provider };
      return { text: text.trim(), provider };
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { error: await friendlyHttpError(res, label), provider };
      const data = await res.json();
      const text: string | undefined = data?.content?.[0]?.text;
      if (!text) return { error: "Claude returned no content.", provider };
      return { text: text.trim(), provider };
    }

    if (provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { error: await friendlyHttpError(res, label), provider };
      const data = await res.json();
      const text: string | undefined = data?.choices?.[0]?.message?.content;
      if (!text) return { error: "OpenRouter returned no content.", provider };
      return { text: text.trim(), provider };
    }

    // openai
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return { error: await friendlyHttpError(res, label), provider };
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) return { error: "OpenAI returned no content.", provider };
    return { text: text.trim(), provider };
  } catch (err) {
    return { error: `Could not reach ${label}: ${err instanceof Error ? err.message : String(err)}`, provider };
  }
}
