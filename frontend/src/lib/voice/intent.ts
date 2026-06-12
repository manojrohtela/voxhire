import type {
  CandidateIntent,
  EmotionalTone,
  EngagementLevel,
  InterviewMomentum,
} from "./types";
import type { InterviewMemory } from "./memory";

export function detectIntent(text: string): CandidateIntent {
  const t = text.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);

  if (words.length < 5) return "brief";

  // Rambling: very long responses that likely lose focus
  if (words.length > 120) return "rambling";

  // Deflecting — explicit no-knowledge admissions (strict patterns only)
  const deflectPatterns = [
    "don't have experience with",
    "haven't worked with",
    "never worked with",
    "no experience with",
    "not sure about that",
    "can't really answer",
    "don't know how to",
    "haven't really done",
    "not familiar with",
    "haven't had a chance to",
  ];
  if (deflectPatterns.some((p) => t.includes(p))) return "deflecting";

  // Confident — ownership and specificity markers
  const confidentPatterns = [
    "i built",
    "i implemented",
    "i designed",
    "i led",
    "i created",
    "i architected",
    "i deployed",
    "i solved",
    "i wrote",
    "i worked on",
    "we shipped",
    "in production",
    "specifically",
    "for example",
    "in particular",
    "the reason i",
    "what i did was",
  ];
  if (confidentPatterns.some((p) => t.includes(p))) return "confident";

  // Verbose — long but not rambling, structured answer
  if (words.length > 80) return "verbose";

  // Uncertain — hedging language (require 2+ signals to avoid false positives)
  const uncertainPatterns = [
    "i think",
    "i believe",
    "i'm not sure",
    "probably",
    "not certain",
    "might be",
    "kind of",
    "more or less",
    "i guess",
    "sort of",
    "maybe",
    "i suppose",
  ];
  const uncertainCount = uncertainPatterns.filter((p) => t.includes(p)).length;
  if (uncertainCount >= 2) return "uncertain";
  if (uncertainCount >= 1) return "uncertain";

  return "unknown";
}

export function detectEmotionalTone(text: string): EmotionalTone {
  const t = text.toLowerCase();

  // Nervous: multiple filler/apology signals
  const nervousPatterns = ["um", "uh", "err", "hmm", "sorry", "apologize", "nervous", "anxious", "a bit stressed"];
  if (nervousPatterns.filter((p) => t.includes(p)).length >= 2) return "nervous";

  // Confident: assertive language
  const confidentPatterns = ["definitely", "absolutely", "certainly", "clearly", "specifically", "exactly", "precisely"];
  if (confidentPatterns.some((p) => t.includes(p))) return "confident";

  // Engaged: enthusiasm signals
  const engagedPatterns = ["great question", "interesting", "i love", "excited", "passionate", "enjoy", "fascinated", "really enjoy"];
  if (engagedPatterns.some((p) => t.includes(p))) return "engaged";

  // Hesitant: multiple hedging/filler patterns (require 3+ to avoid false positives)
  const hesitantPatterns = ["well", "i mean", "like", "you know", "kind of", "sort of", "i guess"];
  if (hesitantPatterns.filter((p) => t.includes(p)).length >= 3) return "hesitant";

  return "neutral";
}

export function updateEngagement(
  memory: Pick<InterviewMemory, "engagementLevel">,
  userText: string
): EngagementLevel {
  const words = userText.split(/\s+/).filter(Boolean).length;
  const { engagementLevel } = memory;

  if (words >= 40) {
    // Substantive answer — step up engagement
    return engagementLevel === "low" ? "medium" : "high";
  }
  if (words <= 8) {
    // Very short — step down engagement
    return engagementLevel === "high" ? "medium" : "low";
  }
  return engagementLevel;
}

export function assessMomentum(
  memory: Pick<InterviewMemory, "lastResponseWordCount" | "momentum">,
  newWordCount: number
): InterviewMomentum {
  const prev = memory.lastResponseWordCount;
  if (newWordCount === 0 || prev === 0) return memory.momentum;

  const ratio = newWordCount / prev;
  if (ratio >= 1.3) return "building";
  if (ratio <= 0.6) return "stalling";
  return "stable";
}
