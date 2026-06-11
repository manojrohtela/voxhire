import { buildInterviewSystemPrompt } from "./prompts";
import type { StageContext } from "./types";

type GroqMessage = { role: "user" | "assistant"; content: string };

function getDynamicTemperature(ctx?: StageContext): number {
  if (!ctx) return 0.68;
  const { emotionalTone, momentum, intent, engagementLevel } = ctx;
  if (emotionalTone === "nervous") return 0.58;
  if (intent === "deflecting") return 0.62;
  if (emotionalTone === "confident" || emotionalTone === "engaged" || engagementLevel === "high") return 0.78;
  if (momentum === "stalling" || intent === "brief") return 0.80;
  return 0.68;
}

export async function generateInterviewReplyStream(
  messages: GroqMessage[],
  candidateName: string,
  appliedRole: string,
  skillsToAssess: string[],
  stageContext?: StageContext
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing.");

  const systemPrompt = buildInterviewSystemPrompt(
    candidateName,
    appliedRole,
    skillsToAssess,
    stageContext
  );

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: getDynamicTemperature(stageContext),
      max_tokens: 80,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-12),
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message ?? "Groq streaming failed.");
  }

  return res.body;
}
