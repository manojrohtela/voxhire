export type InterviewStage =
  | "intro"
  | "background"
  | "technical"
  | "deep_dive"
  | "wrap_up";

export type CandidateIntent =
  | "confident"
  | "uncertain"
  | "verbose"
  | "brief"
  | "deflecting"
  | "unknown";

export type EmotionalTone =
  | "nervous"
  | "confident"
  | "hesitant"
  | "engaged"
  | "neutral";

export type EngagementLevel = "high" | "medium" | "low";

export type InterviewMomentum = "building" | "stable" | "stalling";

export interface StageContext {
  stage: InterviewStage;
  emotionalTone: EmotionalTone;
  intent: CandidateIntent;
  engagementLevel?: EngagementLevel;
  momentum?: InterviewMomentum;
  consecutiveSameTone?: number;
  candidateName?: string;
  appliedRole?: string;
  currentSkill?: string | null;
  skillsToAssess?: string[];
}
