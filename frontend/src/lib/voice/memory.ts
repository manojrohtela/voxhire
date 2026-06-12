import type {
  InterviewStage,
  CandidateIntent,
  EmotionalTone,
  EngagementLevel,
  InterviewMomentum,
} from "./types";

export interface InterviewMemory {
  stage: InterviewStage;
  turnCount: number;
  stageStartTurn: number;               // turnCount when the current stage began
  intent: CandidateIntent;
  emotionalTone: EmotionalTone;
  consecutiveSameTone: number;
  engagementLevel: EngagementLevel;
  momentum: InterviewMomentum;
  lastResponseWordCount: number;
  skillsCovered: string[];              // skills fully assessed
  skillsQueue: string[];                // remaining skills to assess (ordered)
  currentSkill: string | null;
  questionsAskedOnCurrentSkill: number; // resets when skill advances
  deflectStreak: number;                // consecutive deflecting answers on current skill
  candidateName: string;
  appliedRole: string;
  recentAssistantOpenings: string[];    // last N AI opening phrases (anti-repetition)
  difficulty: string;
  aiPersonality: string;
  interviewType: string;
}

export function createInterviewMemory(
  candidateName = "",
  appliedRole = "",
  skillsToAssess: string[] = [],
  difficulty = "Medium",
  aiPersonality = "Neutral",
  interviewType = "Technical",
): InterviewMemory {
  return {
    stage: "intro",
    turnCount: 0,
    stageStartTurn: 0,
    intent: "unknown",
    emotionalTone: "neutral",
    consecutiveSameTone: 0,
    engagementLevel: "medium",
    momentum: "stable",
    lastResponseWordCount: 0,
    skillsCovered: [],
    skillsQueue: [...skillsToAssess],
    currentSkill: skillsToAssess[0] ?? null,
    questionsAskedOnCurrentSkill: 0,
    deflectStreak: 0,
    candidateName,
    appliedRole,
    recentAssistantOpenings: [],
    difficulty,
    aiPersonality,
    interviewType,
  };
}
