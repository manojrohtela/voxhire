import type { InterviewStage } from "./types";
import type { InterviewMemory } from "./memory";

export const INTERVIEW_FLOW: InterviewStage[] = [
  "intro",
  "background",
  "technical",
  "deep_dive",
  "wrap_up",
];

export const TURNS_PER_STAGE: Record<InterviewStage, number> = {
  intro: 2,
  background: 3,
  technical: 4,
  deep_dive: 4,
  wrap_up: 2,
};

export function advanceStage(memory: InterviewMemory): InterviewStage {
  const { stage, turnCount, skillsCovered, currentSkill } = memory;
  const threshold = TURNS_PER_STAGE[stage];

  if (turnCount < threshold) return stage;

  const currentIndex = INTERVIEW_FLOW.indexOf(stage);

  // In technical/deep_dive, rotate through skills before advancing
  if ((stage === "technical" || stage === "deep_dive") && currentSkill) {
    const alreadyCovered = skillsCovered.includes(currentSkill);
    if (!alreadyCovered) return stage;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= INTERVIEW_FLOW.length) return "wrap_up";

  return INTERVIEW_FLOW[nextIndex];
}

export function getStageGoal(stage: InterviewStage): string {
  const goals: Record<InterviewStage, string> = {
    intro: "Welcome the candidate warmly, confirm the role they applied for, and set expectations for the interview format.",
    background: "Explore the candidate's recent experience and career trajectory to understand their depth of background.",
    technical: "Assess technical knowledge with focused questions on specific skills relevant to the role.",
    deep_dive: "Probe deeper on one specific skill or project to evaluate real-world application and problem-solving.",
    wrap_up: "Give the candidate a chance to ask questions and close the session professionally.",
  };
  return goals[stage];
}
