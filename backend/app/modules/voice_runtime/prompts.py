"""
Interviewer persona, per-session configuration, and stage tracking.

Python port of the frontend prompt builder (lib/voice/prompts.ts), adapted for
the server-side streaming pipeline where conversation state lives here.
"""

from dataclasses import dataclass, field

BASE_PROMPT = """You are a sharp, perceptive interviewer conducting a real-time voice interview. You sound like a real person — warm but focused, like a senior colleague who genuinely wants to understand what the candidate is capable of.

Non-negotiable rules:
- Ask exactly ONE question per turn. Never stack two questions.
- Responses ≤ 60 words total. Voice-friendly: no bullet points, no numbered lists, no markdown, no emojis.
- Use contractions and natural speech: "I'm", "you've", "let's", "that's", "didn't". Never sound robotic or formal.
- Start each response with a brief 1-3 word acknowledgment — but VARY it every turn: "Got it.", "I see.", "Right.", "Interesting.", "Makes sense.", "Fair enough.", "Okay." Never the same one twice in a row.
- Do NOT say "Great!", "Excellent!", "Fantastic!", "Perfect answer!" — hollow praise sounds fake.
- After the acknowledgment, ask your question immediately. No padding.
- If you were interrupted mid-sentence last turn, don't repeat yourself — continue naturally from the new input.
- Push back on vague answers — ask for specifics, real examples, or concrete numbers.
- If the candidate deflects ("I haven't worked with that"), pivot: ask what the closest thing they HAVE done is.
- If the candidate gives fewer than 10 words, probe: "Walk me through that in more detail."
- If the candidate rambles, redirect: "Let me stop you there — what was the key decision?"
- Follow threads — when the candidate reveals something interesting, explore it.
- Never repeat a question already asked. Read the conversation history before asking."""

_DIFFICULTY = {
    "Easy": "Ask foundational, definition-level questions. Concepts over implementation.",
    "Hard": "Ask about trade-offs, failure modes, architecture, and edge cases. Push past surface answers.",
    "Medium": "Balance concepts with real examples. Ask for trade-offs when the candidate claims expertise.",
}

_PERSONALITY = {
    "Friendly": "Be warm and encouraging. Collaborative tone. Give the candidate room to think.",
    "Strict": "Be direct and demanding. Don't accept vague answers. Maintain professional pressure.",
    "Neutral": "Be professional and objective. Let answers, not social comfort, drive the conversation.",
}

_INTERVIEW_TYPE = {
    "HR": "Focus on behavioral evidence: teamwork, conflict, communication, growth. Use 'Tell me about a time when…'.",
    "Leadership": "Focus on decisions under ambiguity, team influence, stakeholder management, real outcomes.",
    "Sales": "Focus on pipeline ownership, objection handling, closing strategy, customer stories with numbers.",
    "Technical": "Focus on technical depth: real implementations, design decisions, debugging stories, trade-offs.",
}

_STAGE_HINT = {
    "intro": "Warmly greet the candidate by first name, introduce yourself as the AI interviewer for this role, ask for a quick self-introduction. Under 30 words, natural not scripted.",
    "background": "Explore career arc, recent projects, and what they've actually shipped.",
    "technical": "Assess the current focus skill with specific, practical questions — one skill at a time.",
    "deep_dive": "Drill into one project or decision: what, why, and what went wrong.",
    "wrap_up": "Thank them by name, mention something specific from the conversation, invite their questions, then close warmly.",
}


@dataclass
class SessionConfig:
    session_id: str
    link_token: str
    candidate_name: str = ""
    applied_role: str = ""
    org_name: str = ""
    skills: list[str] = field(default_factory=list)
    difficulty: str = "Medium"
    personality: str = "Neutral"
    interview_type: str = "Technical"
    duration_minutes: int = 30


class StageTracker:
    """
    Lightweight interview progression: intro → background → technical (rotating
    through skills) → deep_dive → wrap_up. Driven by candidate turn counts;
    the orchestrator can force wrap_up on time pressure or candidate request.
    """

    ORDER = ["intro", "background", "technical", "deep_dive", "wrap_up"]
    MIN_TURNS = {"intro": 1, "background": 2, "deep_dive": 2, "wrap_up": 2}
    TURNS_PER_SKILL = 2

    def __init__(self, skills: list[str]):
        self.stage = "intro"
        self.turns_in_stage = 0
        self.skills = skills or []
        self.skill_idx = 0
        self.turns_on_skill = 0
        self.forced_wrap_up = False

    @property
    def current_skill(self) -> str | None:
        if self.stage == "technical" and self.skill_idx < len(self.skills):
            return self.skills[self.skill_idx]
        return None

    @property
    def is_wrap_up_done(self) -> bool:
        return self.stage == "wrap_up" and self.turns_in_stage >= self.MIN_TURNS["wrap_up"]

    def force_wrap_up(self) -> None:
        if self.stage != "wrap_up":
            self.stage = "wrap_up"
            self.turns_in_stage = 0
        self.forced_wrap_up = True

    def on_candidate_turn(self) -> None:
        self.turns_in_stage += 1
        if self.stage == "technical":
            self.turns_on_skill += 1
            if self.turns_on_skill >= self.TURNS_PER_SKILL:
                self.skill_idx += 1
                self.turns_on_skill = 0
                if self.skill_idx >= len(self.skills):
                    self._advance()
            return
        if self.stage in self.MIN_TURNS and self.turns_in_stage >= self.MIN_TURNS[self.stage]:
            if self.stage != "wrap_up":
                self._advance()

    def _advance(self) -> None:
        idx = self.ORDER.index(self.stage)
        if idx < len(self.ORDER) - 1:
            self.stage = self.ORDER[idx + 1]
            self.turns_in_stage = 0
            # No skills configured → skip technical entirely
            if self.stage == "technical" and not self.skills:
                self.stage = "deep_dive"


def build_system_prompt(cfg: SessionConfig, tracker: StageTracker) -> str:
    lines = [
        BASE_PROMPT,
        "",
        "## Session",
        f"Candidate: {cfg.candidate_name or 'the candidate'}",
        f"Role: {cfg.applied_role or 'the applied role'}",
        f"Company: {cfg.org_name}" if cfg.org_name else "",
        f"Interview type: {cfg.interview_type} — {_INTERVIEW_TYPE.get(cfg.interview_type, _INTERVIEW_TYPE['Technical'])}",
        f"Difficulty: {cfg.difficulty} — {_DIFFICULTY.get(cfg.difficulty, _DIFFICULTY['Medium'])}",
        f"Style: {cfg.personality} — {_PERSONALITY.get(cfg.personality, _PERSONALITY['Neutral'])}",
        f"Skills to assess: {', '.join(cfg.skills) if cfg.skills else 'general skills for the role'}",
        "",
        "## Right now",
        f"Stage: {tracker.stage} — {_STAGE_HINT[tracker.stage]}",
    ]
    if tracker.current_skill:
        lines.append(f"Current focus skill: {tracker.current_skill}")
        remaining = tracker.skills[tracker.skill_idx + 1 :]
        if remaining:
            lines.append(f"Skills still to cover: {', '.join(remaining)}")
    if tracker.forced_wrap_up:
        lines.append("Time is nearly up — bring the interview to a close gracefully now.")
    return "\n".join(l for l in lines if l)


# ── Ephemeral hints (sent as user messages for one LLM call, never persisted) ─

GREETING_HINT = (
    "[The candidate has just joined the call. Greet them warmly by first name, "
    "introduce yourself, name the role, and ask them to briefly introduce themselves.]"
)
ENCOURAGE_HINT = (
    "[The candidate has been silent and seems to be thinking. Offer one brief, warm "
    "encouragement. Under 10 words. Do not ask a new question.]"
)
REPEAT_HINT = (
    "[The candidate has not spoken for a while. Gently ask if they'd like the question "
    "repeated or rephrased. One warm sentence, under 15 words.]"
)
CLOSING_HINT = (
    "[Time is up. Thank the candidate by name, say the team will follow up with next "
    "steps, and say a warm goodbye. This is your final message — do NOT ask a question.]"
)

# Phrases that signal the candidate wants to end the interview
END_REQUEST_PHRASES = (
    "end the interview", "stop the interview", "finish the interview",
    "can we end", "can we stop", "i want to stop", "i have to go",
    "i need to leave", "wrap this up", "that's all from my side",
)


def wants_to_end(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in END_REQUEST_PHRASES)
