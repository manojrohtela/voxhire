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

  const deflectPatterns = [
    "not sure about that",
    "haven't really",
    "don't have experience",
    "never worked with",
    "hard to say",
    "it depends",
    "i guess",
    "maybe",
    "sort of",
  ];
  if (deflectPatterns.some((p) => t.includes(p))) return "deflecting";

  const uncertainPatterns = [
    "i think",
    "i believe",
    "i'm not sure",
    "probably",
    "not certain",
    "might be",
    "kind of",
    "more or less",
  ];
  if (uncertainPatterns.some((p) => t.includes(p))) return "uncertain";

  const confidentPatterns = [
    "i built",
    "i implemented",
    "i designed",
    "i led",
    "i created",
    "i architected",
    "i deployed",
    "i solved",
    "specifically",
    "for example",
    "in particular",
  ];
  if (confidentPatterns.some((p) => t.includes(p))) return "confident";

  if (words.length > 80) return "verbose";

  return "unknown";
}

export function detectEmotionalTone(text: string): EmotionalTone {
  const t = text.toLowerCase();

  const nervousPatterns = [
    "um",
    "uh",
    "err",
    "hmm",
    "sorry",
    "apologize",
    "nervous",
    "anxious",
    "a bit stressed",
  ];
  if (nervousPatterns.filter((p) => t.includes(p)).length >= 2) return "nervous";

  const hesitantPatterns = [
    "well",
    "i mean",
    "like",
    "you know",
    "kind of",
    "sort of",
    "i guess",
  ];
  if (hesitantPatterns.filter((p) => t.includes(p)).length >= 3) return "hesitant";

  const confidentPatterns = [
    "definitely",
    "absolutely",
    "certainly",
    "clearly",
    "specifically",
    "exactly",
    "precisely",
  ];
  if (confidentPatterns.some((p) => t.includes(p))) return "confident";

  const engagedPatterns = [
    "great question",
    "interesting",
    "i love",
    "excited",
    "passionate",
    "enjoy",
    "fascinated",
  ];
  if (engagedPatterns.some((p) => t.includes(p))) return "engaged";

  return "neutral";
}

export function updateEngagement(
  memory: Pick<InterviewMemory, "engagementLevel" | "turnCount">,
  userText: string
): EngagementLevel {
  const words = userText.split(/\s+/).filter(Boolean).length;
  const { engagementLevel } = memory;

  if (words >= 40) {
    return engagementLevel === "low" ? "medium" : "high";
  }
  if (words <= 8) {
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
