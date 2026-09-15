import { NextResponse } from "next/server";
import { buildFxFollowUpPrompt, type FxFollowUpInput } from "@/lib/ai-prompt";
import { callAiProvider, isAiProvider } from "@/lib/ai-provider";

export const dynamic = "force-dynamic";

// Companion to relationship-summary's route: same key-header contract, same
// callAiProvider pipeline, but no DB lookup — every number the prompt needs
// already lives in the calculator's own client-side state, so it's passed
// straight through in the request body instead of being looked up server-side.
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-ai-key") || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key configured. Add one in Settings to enable AI follow-up drafts." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const input: Partial<FxFollowUpInput> = body;
  if (
    typeof input.volume !== "number" ||
    typeof input.pair !== "string" ||
    typeof input.vertical !== "string" ||
    typeof input.settlementDays !== "number" ||
    typeof input.volatilityPct !== "number" ||
    typeof input.profitAtRiskUsd !== "number"
  ) {
    return NextResponse.json({ error: "Missing or invalid calculator figures." }, { status: 400 });
  }

  const prompt = buildFxFollowUpPrompt(input as FxFollowUpInput);
  const providerHeader = req.headers.get("x-ai-provider") ?? "";
  const result = await callAiProvider(apiKey, prompt, {
    provider: isAiProvider(providerHeader) ? providerHeader : undefined,
    maxTokens: 260,
  });

  if (!result.text) {
    return NextResponse.json({ error: result.error ?? "The AI provider returned no content." }, { status: 502 });
  }

  return NextResponse.json({ email: result.text, provider: result.provider });
}
