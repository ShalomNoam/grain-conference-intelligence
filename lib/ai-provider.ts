// A rep pastes one API key into Settings — no provider picker, no model
// picker. We detect the provider from the key's own shape (every major LLM
// vendor prefixes keys distinctly) and route to the right endpoint/format
// automatically. This is the "field, not form" version of BYO-key: the
// fewer decisions a busy sales rep has to make correctly, the more likely
// the AI feature actually gets configured at all.

export type AiProvider = "gemini" | "anthropic" | "openai";

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  openai: "OpenAI",
};

export function detectProvider(rawKey: string): AiProvider | null {
  const key = rawKey.trim();
  if (!key) return null;
  // Anthropic and OpenAI both use "sk-" prefixes, so the more specific
  // "sk-ant-" check must run before the generic OpenAI "sk-" fallback.
  if (key.startsWith("AIzaSy")) return "gemini";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-proj-") || key.startsWith("sk-")) return "openai";
  return null;
}

export interface AiCallResult {
  text?: string;
  error?: string;
  provider?: AiProvider;
}

async function describeHttpError(res: Response, name: string): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${name} API error (${res.status}). Check the key in Settings. ${body.slice(0, 300)}`;
}

// Server-side only (needs to reach each vendor's API directly). Picks the
// endpoint, auth header, request body shape, and response parsing for
// whichever provider the key belongs to, and normalizes all three down to
// { text } | { error } so callers never need per-provider branching.
export async function callAiProvider(
  apiKey: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<AiCallResult> {
  const provider = detectProvider(apiKey);
  const maxTokens = opts.maxTokens ?? 220;
  const temperature = opts.temperature ?? 0.4;

  if (!provider) {
    return {
      error:
        "This doesn't look like a Gemini, Claude, or OpenAI key. Gemini keys start with AIzaSy, Claude keys with sk-ant-, OpenAI keys with sk-.",
    };
  }

  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        }
      );
      if (!res.ok) return { error: await describeHttpError(res, "Gemini"), provider };
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { error: "Gemini returned no content (it may have blocked the prompt).", provider };
      return { text: text.trim(), provider };
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { error: await describeHttpError(res, "Claude"), provider };
      const data = await res.json();
      const text: string | undefined = data?.content?.[0]?.text;
      if (!text) return { error: "Claude returned no content.", provider };
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
    if (!res.ok) return { error: await describeHttpError(res, "OpenAI"), provider };
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) return { error: "OpenAI returned no content.", provider };
    return { text: text.trim(), provider };
  } catch (err) {
    return { error: `Could not reach ${PROVIDER_LABEL[provider]}: ${err instanceof Error ? err.message : String(err)}`, provider };
  }
}
