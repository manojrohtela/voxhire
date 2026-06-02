export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
}

export interface InterviewSession {
  id: string;
  candidateId: string;
  status: "scheduled" | "in_progress" | "completed";
  scheduledAt: string;
  interviewLink?: string;
}

export interface SkillEvaluation {
  skill: string;
  rating: "Strong" | "Medium" | "Weak";
  notes?: string;
}

export interface EvaluationReport {
  sessionId: string;
  candidate: Candidate;
  overallRecommendation: "Strong" | "Medium" | "Weak";
  skills: SkillEvaluation[];
  strengths: string[];
  weakAreas: string[];
  transcriptUrl?: string;
  recordingUrl?: string;
}
