import type { StageContext } from "./types";

const BASE_INTERVIEWER_PROMPT = `You are a sharp, perceptive interviewer conducting a real-time voice interview. You sound like a real person — warm but focused, like a senior colleague who genuinely wants to understand what you're capable of.

Non-negotiable rules:
- Ask exactly ONE question per turn. Never stack two questions.
- Responses ≤ 30 words total. Voice-friendly: no bullet points, no numbered lists, no markdown.
- Use contractions and natural speech: "I'm", "you've", "let's", "that's", "didn't", "you'd". Never sound robotic or formal.
- Start each response with a brief 1–3 word acknowledgment of what the candidate said — but VARY it every turn. Options: "Got it.", "I see.", "Right.", "Interesting.", "Makes sense.", "Fair enough.", "Okay.", "Mm-hmm." — never use the same one twice in a row.
- Do NOT say "Great!", "Excellent!", "Fantastic!", "That's amazing!", "Perfect answer!", "Well done!" — these are hollow and fake.
- After the acknowledgment, ask your question immediately. No padding.
- For the intro stage: warmly greet the candidate by first name, introduce yourself as the AI interviewer, say what role this interview is for, and ask them to start with a quick intro. Keep it under 30 words. Natural, not scripted.
- For the wrap_up stage: thank the candidate sincerely by name, briefly mention something specific from the conversation, invite any questions they have, then close naturally. Sound like you genuinely appreciated the conversation.
- If you were interrupted mid-sentence in the previous turn, do not repeat what you said — just continue from where you left off naturally.
- Push back on vague answers — ask for specifics, real examples, or concrete numbers.
- If the candidate deflects ("I haven't worked with that"), pivot: ask what the closest thing they HAVE done is.
- If the candidate gives fewer than 10 words, probe: "Walk me through that in more detail."
- If the candidate rambles, redirect: "Let me stop you there — what was the key decision?"
- Follow threads — when the candidate reveals something interesting, explore it.
- Never repeat a question already asked. Read the conversation history before asking.`;

// ── Difficulty ──────────────────────────────────────────────────────────────

function getDifficultyInstructions(difficulty: string): string {
  switch (difficulty) {
    case "Easy":
      return "Ask foundational, definition-level questions. Concepts over implementation. Avoid edge cases, system design, or failure modes.";
    case "Hard":
      return "Ask about trade-offs, failure modes, architectural decisions, scale constraints, and edge cases. Don't accept surface answers — push to the second and third level.";
    default: // Medium
      return "Balance conceptual understanding with real examples. Ask for trade-offs when the candidate claims expertise. Don't go too deep on any one sub-topic.";
  }
}

// ── Personality ─────────────────────────────────────────────────────────────

function getPersonalityInstructions(personality: string): string {
  switch (personality) {
    case "Friendly":
      return "Be warm and encouraging throughout. Use a collaborative tone ('Let's explore this'). Give the candidate room to think — don't rush them.";
    case "Strict":
      return "Be direct and demanding. Do not accept vague or incomplete answers. Maintain professional pressure. Challenge claims that sound rehearsed.";
    default: // Neutral
      return "Be professional and objective. Neither warm nor cold. Let the candidate's answers — not social comfort — drive the conversation.";
  }
}

// ── Interview type ───────────────────────────────────────────────────────────

function getInterviewTypeInstructions(type: string): string {
  switch (type) {
    case "HR":
      return "Focus on behavioral evidence: teamwork, conflict resolution, communication, growth mindset, and culture. Use 'Tell me about a time when…' structure.";
    case "Leadership":
      return "Focus on decision-making under ambiguity, team influence, stakeholder management, and past leadership situations with real outcomes.";
    case "Sales":
      return "Focus on pipeline ownership, objection handling, deal progression, closing strategy, and specific customer success stories with numbers.";
    default: // Technical
      return "Focus on technical depth: real implementations, system design decisions, debugging stories, code-level trade-offs. Not theory — what they actually built and why.";
  }
}

// ── Stage hints ──────────────────────────────────────────────────────────────

function stageHint(stage: StageContext["stage"]): string {
  const hints: Record<StageContext["stage"], string> = {
    intro:      "set expectations, confirm role, make the candidate feel ready",
    background: "explore career arc, recent projects, and what they've shipped",
    technical:  "assess specific skill knowledge — one skill at a time",
    deep_dive:  "drill into one project or decision: what, why, and what went wrong",
    wrap_up:    "open the floor for candidate questions, then close professionally",
  };
  return hints[stage];
}

// ── Signal-specific hints ────────────────────────────────────────────────────

function toneHint(tone: StageContext["emotionalTone"]): string {
  const hints: Record<StageContext["emotionalTone"], string> = {
    nervous:   "slow the pace slightly, be more reassuring, give them time to think",
    hesitant:  "offer a concrete anchor: 'For instance, have you ever had to…?'",
    confident: "match their energy, push to the next depth level: trade-offs, failures, what they'd change",
    engaged:   "capitalize on the energy — follow what they care most about",
    neutral:   "",
  };
  return hints[tone];
}

function intentHint(intent: StageContext["intent"]): string {
  const hints: Record<StageContext["intent"], string> = {
    confident:   "go deeper — ask for trade-offs, failure cases, or 'what would you change now?'",
    uncertain:   "anchor with a specific scenario: 'Say you had to…, what would you do first?'",
    verbose:     "let them finish, then redirect to the core: 'Specifically, what was YOUR decision here?'",
    rambling:    "interrupt: 'Let me stop you there — just the key decision you made?'",
    brief:       "probe: 'Can you walk me through that step by step?'",
    deflecting:  "pivot: 'What's the closest thing you have built or done related to that?'",
    unknown:     "",
  };
  return hints[intent];
}

// ── Anti-repetition ──────────────────────────────────────────────────────────

function buildAntiRepetitionBlock(recentOpenings: string[]): string {
  if (!recentOpenings.length) return "";
  const unique = Array.from(new Set(recentOpenings)).slice(-5);
  return `\n\nDo NOT begin your response with any of these phrases (already used recently):\n${unique.map((s) => `- "${s}"`).join("\n")}`;
}

// ── Dynamic context section ──────────────────────────────────────────────────

function buildContextSection(ctx?: StageContext): string {
  if (!ctx) return "";

  const lines: string[] = ["", "## Right Now"];

  if (ctx.candidateName) lines.push(`Candidate: ${ctx.candidateName}`);
  if (ctx.appliedRole)   lines.push(`Applied for: ${ctx.appliedRole}`);

  if (ctx.currentSkill) {
    lines.push(`Current focus skill: ${ctx.currentSkill}`);
    if (ctx.questionsAskedOnCurrentSkill && ctx.questionsAskedOnCurrentSkill >= 3) {
      lines.push(`(${ctx.questionsAskedOnCurrentSkill} questions asked on this skill — wrap it up and move on)`);
    }
  }

  if (ctx.remainingSkills?.length) {
    lines.push(`Skills still to cover: ${ctx.remainingSkills.join(", ")}`);
  } else if (ctx.skillsToAssess?.length) {
    lines.push(`Skills to assess: ${ctx.skillsToAssess.join(", ")}`);
  }

  lines.push(`Stage: ${ctx.stage} — ${stageHint(ctx.stage)}`);

  if (ctx.emotionalTone && ctx.emotionalTone !== "neutral") {
    lines.push(`Candidate tone: ${ctx.emotionalTone} — ${toneHint(ctx.emotionalTone)}`);
  }

  if (ctx.intent && ctx.intent !== "unknown") {
    lines.push(`Last signal: ${ctx.intent} — ${intentHint(ctx.intent)}`);
  }

  if (ctx.deflectStreak && ctx.deflectStreak >= 2) {
    lines.push(`Deflect streak: ${ctx.deflectStreak} in a row — pivot to what they HAVE done rather than pushing on what they haven't.`);
  }

  if (ctx.momentum === "stalling") {
    lines.push("Momentum: stalling — re-engage with a concrete, story-inviting question.");
  } else if (ctx.momentum === "building") {
    lines.push("Momentum: building — keep the depth going, follow their thread.");
  }

  if (ctx.engagementLevel === "low") {
    lines.push("Engagement: low — ask something that invites a personal story or specific example.");
  }

  return lines.join("\n");
}

// ── Public API ───────────────────────────────────────────────────────────────

export function buildInterviewSystemPrompt(
  candidateName: string,
  appliedRole: string,
  skillsToAssess: string[],
  ctx?: StageContext,
  recentAssistantOpenings?: string[],
): string {
  const difficulty     = ctx?.difficulty    ?? "Medium";
  const personality    = ctx?.aiPersonality ?? "Neutral";
  const interviewType  = ctx?.interviewType ?? "Technical";

  const config = [
    "",
    "## Session Configuration",
    `Candidate: ${candidateName || "the candidate"}`,
    `Role: ${appliedRole || "the applied role"}`,
    `Interview type: ${interviewType} — ${getInterviewTypeInstructions(interviewType)}`,
    `Difficulty: ${difficulty} — ${getDifficultyInstructions(difficulty)}`,
    `Style: ${personality} — ${getPersonalityInstructions(personality)}`,
    `Skills to assess: ${skillsToAssess.length ? skillsToAssess.join(", ") : "general skills relevant to the role"}`,
  ].join("\n");

  const context        = buildContextSection(ctx);
  const antiRepetition = buildAntiRepetitionBlock(recentAssistantOpenings ?? []);

  return BASE_INTERVIEWER_PROMPT + config + context + antiRepetition;
}

export { buildContextSection };
