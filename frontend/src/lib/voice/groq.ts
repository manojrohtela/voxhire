import { buildInterviewSystemPrompt } from "./prompts";
import type { StageContext } from "./types";

type GroqMessage = { role: "user" | "assistant"; content: string };

function getDynamicTemperature(ctx?: StageContext): number {
  if (!ctx) return 0.68;
  const { emotionalTone, momentum, intent, engagementLevel } = ctx;

  if (emotionalTone === "nervous")  return 0.55;  // predictable/reassuring
  if (intent === "rambling")        return 0.58;  // tight, focused cut-in
  if (intent === "deflecting")      return 0.62;  // direct pivot
  if (intent === "brief")           return 0.65;  // concrete probe
  if (emotionalTone === "confident" || emotionalTone === "engaged" || engagementLevel === "high") return 0.80; // creative depth
  if (momentum === "stalling")      return 0.75;  // energising re-engagement
  if (emotionalTone === "hesitant") return 0.65;  // grounding anchor

  return 0.68; // balanced default
}

export async function generateInterviewReplyStream(
  messages: GroqMessage[],
  candidateName: string,
  appliedRole: string,
  skillsToAssess: string[],
  stageContext?: StageContext,
  recentAssistantOpenings?: string[],
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing.");

  const systemPrompt = buildInterviewSystemPrompt(
    candidateName,
    appliedRole,
    skillsToAssess,
    stageContext,
    recentAssistantOpenings,
  );

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: getDynamicTemperature(stageContext),
      max_tokens: 120,   // 80 could truncate; 120 handles natural sentence completion
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-16), // 16 messages ≈ 8 full turns of context
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message ?? "Groq streaming failed.");
  }

  return res.body;
}
