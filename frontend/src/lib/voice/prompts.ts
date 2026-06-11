import type { StageContext } from "./types";

const BASE_INTERVIEWER_PROMPT = `You are a sharp, perceptive technical interviewer conducting a real-time voice interview.

Rules:
- Ask exactly ONE focused question per turn. Never ask multiple questions.
- Keep responses under 20 words. Be direct, not wordy.
- No filler phrases: never say "Great!", "Excellent!", "That's interesting!", "Good answer."
- No praise. Acknowledge briefly if needed ("Got it.", "Okay.") then move on.
- Push back on vague answers — ask for specifics, examples, or numbers.
- If the candidate deflects, redirect firmly: "Let's come back to [topic]. What specifically have you built with [skill]?"
- Follow the candidate's thread when they reveal something worth exploring.
- Sound human and conversational, not like a form being read.`;

function buildContextSection(ctx?: StageContext): string {
  if (!ctx) return "";

  const lines: string[] = ["", "## Right Now"];

  if (ctx.candidateName) lines.push(`Candidate: ${ctx.candidateName}`);
  if (ctx.appliedRole) lines.push(`Applied for: ${ctx.appliedRole}`);
  if (ctx.currentSkill) lines.push(`Current focus skill: ${ctx.currentSkill}`);
  if (ctx.skillsToAssess?.length)
    lines.push(`Skills still to assess: ${ctx.skillsToAssess.join(", ")}`);

  lines.push(`Stage: ${ctx.stage} — ${stageHint(ctx.stage)}`);

  if (ctx.emotionalTone && ctx.emotionalTone !== "neutral") {
    lines.push(`Candidate tone: ${ctx.emotionalTone} — ${toneHint(ctx.emotionalTone)}`);
  }

  if (ctx.intent && ctx.intent !== "unknown") {
    lines.push(`Signal: ${ctx.intent} — ${intentHint(ctx.intent)}`);
  }

  if (ctx.momentum === "stalling") {
    lines.push("Momentum: stalling — re-engage with a concrete, specific question.");
  }
  if (ctx.momentum === "building") {
    lines.push("Momentum: building — keep the depth going, follow their thread.");
  }

  if (ctx.engagementLevel === "low") {
    lines.push("Engagement: low — ask something that invites a story or specific example.");
  }

  return lines.join("\n");
}

function stageHint(stage: StageContext["stage"]): string {
  const hints: Record<StageContext["stage"], string> = {
    intro: "set expectations, confirm role",
    background: "explore career arc and recent work",
    technical: "assess specific skill knowledge",
    deep_dive: "drill into a project or decision in detail",
    wrap_up: "candidate questions, close professionally",
  };
  return hints[stage];
}

function toneHint(tone: StageContext["emotionalTone"]): string {
  const hints: Record<StageContext["emotionalTone"], string> = {
    nervous: "slow down slightly, use a reassuring tone",
    hesitant: "ask a more concrete, specific question to give them a foothold",
    confident: "match their energy, push to the next level of depth",
    engaged: "capitalize on enthusiasm, explore what they care about",
    neutral: "",
  };
  return hints[tone];
}

function intentHint(intent: StageContext["intent"]): string {
  const hints: Record<StageContext["intent"], string> = {
    confident: "go deeper — ask for trade-offs or failure cases",
    uncertain: "rephrase more concretely, give them a specific scenario",
    verbose: "interrupt politely if needed, redirect to the core question",
    brief: "probe for more — ask 'Can you walk me through that?'",
    deflecting: "call it out gently, redirect back to the skill",
    unknown: "",
  };
  return hints[intent];
}

export function buildInterviewSystemPrompt(
  candidateName: string,
  appliedRole: string,
  skillsToAssess: string[],
  ctx?: StageContext
): string {
  const header = [
    BASE_INTERVIEWER_PROMPT,
    "",
    `## Interview Context`,
    `Candidate: ${candidateName || "the candidate"}`,
    `Role: ${appliedRole || "the applied role"}`,
    `Skills to assess: ${skillsToAssess.length ? skillsToAssess.join(", ") : "general technical skills"}`,
  ].join("\n");

  return header + buildContextSection(ctx);
}

export { buildContextSection };
