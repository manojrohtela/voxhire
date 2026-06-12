import type { InterviewStage } from "./types";
import type { InterviewMemory } from "./memory";

export const INTERVIEW_FLOW: InterviewStage[] = [
  "intro",
  "background",
  "technical",
  "deep_dive",
  "wrap_up",
];

// Minimum turns in stage before ANY advancement is considered
export const MIN_TURNS_PER_STAGE: Record<InterviewStage, number> = {
  intro:      1,
  background: 2,
  technical:  2,
  deep_dive:  3,
  wrap_up:    1,
};

// Hard ceiling — force advancement regardless of quality signals
export const MAX_TURNS_PER_STAGE: Record<InterviewStage, number> = {
  intro:      3,
  background: 6,
  technical:  10, // covers multiple skills
  deep_dive:  6,
  wrap_up:    4,
};

/**
 * Returns true when the current skill has been sufficiently probed and we
 * should rotate to the next one within the same stage.
 */
export function isSkillExhausted(memory: InterviewMemory): boolean {
  const { questionsAskedOnCurrentSkill, deflectStreak } = memory;
  // Hard limit: 4 questions is enough for one skill
  if (questionsAskedOnCurrentSkill >= 4) return true;
  // If candidate has deflected twice on the same skill, move on
  if (questionsAskedOnCurrentSkill >= 2 && deflectStreak >= 2) return true;
  return false;
}

/**
 * Marks the current skill as covered and selects the next skill from the queue.
 * Returns the delta to apply to InterviewMemory.
 */
export function advanceSkill(memory: InterviewMemory): Pick<
  InterviewMemory,
  "currentSkill" | "skillsCovered" | "skillsQueue" | "questionsAskedOnCurrentSkill" | "deflectStreak"
> {
  const covered = memory.currentSkill
    ? [...memory.skillsCovered, memory.currentSkill]
    : [...memory.skillsCovered];
  const remaining = memory.skillsQueue.filter((s) => !covered.includes(s));
  return {
    currentSkill: remaining[0] ?? null,
    skillsCovered: covered,
    skillsQueue: remaining,
    questionsAskedOnCurrentSkill: 0,
    deflectStreak: 0,
  };
}

/**
 * Determines the next stage based on turn count, quality signals, and skill coverage.
 * Does NOT mutate memory — returns the target stage only.
 */
export function advanceStage(memory: InterviewMemory): InterviewStage {
  const { stage, turnCount, stageStartTurn, deflectStreak, skillsQueue, skillsCovered } = memory;
  const turnsInStage = turnCount - stageStartTurn;
  const min = MIN_TURNS_PER_STAGE[stage];
  const max = MAX_TURNS_PER_STAGE[stage];

  // Never advance before minimum turns
  if (turnsInStage < min) return stage;

  const idx = INTERVIEW_FLOW.indexOf(stage);
  const next: InterviewStage = idx + 1 < INTERVIEW_FLOW.length
    ? INTERVIEW_FLOW[idx + 1]
    : "wrap_up";

  // Always advance at hard ceiling
  if (turnsInStage >= max) return next;

  // Technical: stay until all skills in queue are covered
  if (stage === "technical") {
    const remaining = skillsQueue.filter((s) => !skillsCovered.includes(s));
    if (remaining.length > 0) return stage;
    return next;
  }

  // Deep dive: stay until skill is exhausted or candidate is stuck
  if (stage === "deep_dive") {
    const exhausted = isSkillExhausted(memory);
    const stuck = deflectStreak >= 3;
    if (!exhausted && !stuck) return stage;
    return next;
  }

  // Intro / background / wrap_up: advance one turn after minimum (natural pacing)
  // but hold an extra turn if the candidate is still engaged and answering well
  const oneExtraTurn = turnsInStage >= min + 1;
  if (oneExtraTurn || deflectStreak >= 2) return next;
  return stage;
}

export function getStageGoal(stage: InterviewStage): string {
  const goals: Record<InterviewStage, string> = {
    intro:      "Welcome the candidate warmly, confirm the role they applied for, and set expectations for the interview format.",
    background: "Explore the candidate's recent experience and career trajectory to understand their depth of background.",
    technical:  "Assess technical knowledge with focused questions on specific skills relevant to the role.",
    deep_dive:  "Probe deeper on one specific skill or project to evaluate real-world application and problem-solving ability.",
    wrap_up:    "Give the candidate a chance to ask questions and close the session professionally.",
  };
  return goals[stage];
}
