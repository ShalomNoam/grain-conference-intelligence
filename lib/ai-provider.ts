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

// Google's own docs recommend the x-goog-api-key header over the legacy
// ?key= query-string parameter — and it turns out to not just be a style
// preference: newer "auth key" credentials issued for Google Cloud-org
// accounts (service-account-bound keys, prefixed AQ. instead of AIza) are
// REJECTED via ?key= (401 ACCESS_TOKEN_TYPE_UNSUPPORTED / API_KEY_SERVICE_
// BLOCKED) but work fine via this header. Confirmed against a known-working
// reference implementation. Using the header for every Gemini call, not
// just AQ.-prefixed ones, also keeps the key out of URLs that could end up
// in server/proxy access logs.
const GEMINI_KEY_HEADER = "x-goog-api-key";

// Gemini responds 503 when the model is temporarily overloaded and 429 on
// rate limits — both are typically transient, so retry a couple of times
// with exponential backoff before surfacing an error.
const GEMINI_RETRYABLE_STATUSES = new Set([429, 503]);

async function fetchGeminiWithRetry(url: string, options: RequestInit, maxAttempts = 3): Promise<Response> {
  let res: Response;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    res = await fetch(url, options);
    if (!GEMINI_RETRYABLE_STATUSES.has(res.status) || attempt === maxAttempts) return res;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
  }
  return res!;
}

// Gemini's fast-moving model roster (2.5-flash and 1.5-flash both 404'd
// within the same week Google rolled out the 3.x line) means any single
// hardcoded name goes stale eventually. GEMINI_PRIMARY_MODEL is today's
// verified-working default (confirmed live against the real API, see
// commit history) — tried first, since it avoids an extra ListModels
// round-trip on the common case. If it 404s for a given key/account,
// resolveGeminiModel() below falls back to asking Google what that key can
// actually use, so the app keeps working even after this default goes
// stale again.
const GEMINI_PRIMARY_MODEL = "gemini-3.6-flash";

async function resolveGeminiModel(apiKey: string): Promise<string> {
  const fallback = "gemini-flash-latest";
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { [GEMINI_KEY_HEADER]: apiKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ai-provider] Gemini ListModels HTTP ${res.status}, falling back to ${fallback}:`, body.slice(0, 1000));
      return fallback;
    }
    const data = await res.json();
    const models: Array<{ name?: string; supportedGenerationMethods?: string[] }> = data?.models ?? [];
    const usable = models.filter((m) => m.name && m.supportedGenerationMethods?.includes("generateContent"));
    const flash = usable.find((m) => m.name!.includes("flash") && !m.name!.includes("8b"));
    const chosen = flash ?? usable[0];
    if (!chosen?.name) {
      console.error(
        `[ai-provider] Gemini ListModels returned ${models.length} models, none usable for generateContent. Falling back to ${fallback}. Raw names:`,
        models.map((m) => m.name)
      );
      return fallback;
    }
    const resolved = chosen.name.replace(/^models\//, "");
    console.log(`[ai-provider] Gemini ListModels resolved "${resolved}" from ${usable.length} usable model(s):`, usable.map((m) => m.name));
    return resolved;
  } catch (err) {
    console.error(`[ai-provider] Gemini ListModels threw, falling back to ${fallback}:`, err instanceof Error ? err.message : String(err));
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
      const callModel = async (model: string) =>
        fetchGeminiWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", [GEMINI_KEY_HEADER]: apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // gemini-3.6-flash is a "thinking" model by default — its internal
            // reasoning tokens eat into maxOutputTokens before the visible
            // answer does, which was silently truncating short summaries
            // mid-sentence. This task (a short relationship-arc read) doesn't
            // need multi-step reasoning, so turn thinking off entirely:
            // faster, cheaper, and the full maxOutputTokens budget goes to
            // the actual answer.
            generationConfig: { temperature, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
          }),
        });

      let res = await callModel(GEMINI_PRIMARY_MODEL);
      // Today's known-good model can go stale (Google's roster moves fast —
      // see GEMINI_PRIMARY_MODEL's comment). A 404 specifically means "this
      // model name doesn't exist for this key," so it's worth one retry
      // against whatever Google's own ListModels says is actually current
      // before giving up; any other failure (auth, quota, overload) means
      // trying a different model wouldn't help, so it's reported as-is.
      if (res.status === 404) {
        const fallbackModel = await resolveGeminiModel(apiKey);
        if (fallbackModel !== GEMINI_PRIMARY_MODEL) res = await callModel(fallbackModel);
      }

      if (!res.ok) {
        if (res.status === 503) return { error: "Gemini is temporarily overloaded and didn't recover after retrying. Try again in a moment.", provider };
        if (res.status === 429) return { error: "Gemini rate limit reached and didn't recover after retrying. Try again in a moment.", provider };
        return { error: await friendlyHttpError(res, label), provider };
      }
      const data = await res.json();
      const candidate = data?.candidates?.[0];
      if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "RECITATION") {
        return { error: `Gemini blocked this response (${candidate.finishReason.toLowerCase()}) rather than generating it.`, provider };
      }
      const text: string | undefined = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
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
