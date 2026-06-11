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
  intent: CandidateIntent;
  emotionalTone: EmotionalTone;
  consecutiveSameTone: number;
  engagementLevel: EngagementLevel;
  momentum: InterviewMomentum;
  lastResponseWordCount: number;
  skillsCovered: string[];
  currentSkill: string | null;
  candidateName: string;
  appliedRole: string;
  recentAssistantOpenings: string[];
}

export function createInterviewMemory(
  candidateName = "",
  appliedRole = ""
): InterviewMemory {
  return {
    stage: "intro",
    turnCount: 0,
    intent: "unknown",
    emotionalTone: "neutral",
    consecutiveSameTone: 0,
    engagementLevel: "medium",
    momentum: "stable",
    lastResponseWordCount: 0,
    skillsCovered: [],
    currentSkill: null,
    candidateName,
    appliedRole,
    recentAssistantOpenings: [],
  };
}
