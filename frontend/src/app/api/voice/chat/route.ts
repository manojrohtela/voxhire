import { generateInterviewReplyStream } from "@/lib/voice/groq";
import type { StageContext } from "@/lib/voice/types";

type IncomingMessage = { role: "user" | "assistant"; content: string };

type RequestBody = {
  messages?: IncomingMessage[];
  candidateName?: string;
  appliedRole?: string;
  skillsToAssess?: string[];
  stageContext?: StageContext;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const candidateName = body.candidateName ?? "";
  const appliedRole = body.appliedRole ?? "";
  const skillsToAssess = Array.isArray(body.skillsToAssess) ? body.skillsToAssess : [];
  const stageContext = body.stageContext;

  if (!messages.length) {
    return new Response(
      JSON.stringify({ error: "Conversation history is empty." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const stream = await generateInterviewReplyStream(
      messages,
      candidateName,
      appliedRole,
      skillsToAssess,
      stageContext
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Chat failed." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
