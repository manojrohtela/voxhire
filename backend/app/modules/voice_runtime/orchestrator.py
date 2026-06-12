"""
Real-time voice interview orchestrator.

One VoiceSession per WebSocket connection. Owns the full duplex pipeline:

  browser mic (16k PCM16) ─► VAD (Silero) ──► barge-in / endpointing decisions
                          └► Deepgram STT ──► transcript accumulation
  turn commit ─► Groq LLM (streamed) ─► sentence splitter ─► Cartesia TTS (streamed)
                                                          └► browser (24k PCM16)

State machine: LISTENING → THINKING → SPEAKING → LISTENING

INTERRUPTION (the critical path): mic audio is VAD-scored continuously, even
while the agent speaks. Sustained speech during SPEAKING/THINKING triggers
interrupt():
  1. "clear_audio" → client flushes its playback buffer instantly (perceived
     silence in <50 ms)
  2. the agent turn task (LLM stream + TTS forwarding) is cancelled
  3. Cartesia generation is cancelled server-side for that context
  4. the partial agent text is kept in history so the LLM knows it was cut off
  5. state resets to LISTENING — Deepgram never stopped, so the words that
     interrupted us are already part of the next user turn

Client → server messages:
  binary                      raw 16 kHz mono PCM16 mic audio
  {"type":"start"}            begin the interview (agent greets first)
  {"type":"playback_finished","turn_id":n}
  {"type":"end_interview"}    candidate clicked End

Server → client messages:
  binary                      raw 24 kHz mono PCM16 agent audio
  {"type":"ready"}                                {"type":"state","state":...}
  {"type":"transcript","role":"user","text","final"}
  {"type":"agent_start","turn_id"}                {"type":"agent_text","text","turn_id"}
  {"type":"agent_end","turn_id"}                  {"type":"clear_audio"}
  {"type":"interview_complete"}                   {"type":"error","message"}
"""

import asyncio
import contextlib
import logging
import time
import uuid
from datetime import datetime, timezone
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import func, select, update

from app.db.database import AsyncSessionLocal
from app.db.models import (
    InterviewSession,
    InterviewStatus,
    TranscriptEntry,
    TranscriptSpeaker,
)
from . import config as C
from .cartesia_tts import CartesiaTTS
from .deepgram_stt import DeepgramSTT
from .groq_llm import stream_sentences
from .prompts import (
    CLOSING_HINT,
    ENCOURAGE_HINT,
    GREETING_HINT,
    REPEAT_HINT,
    SessionConfig,
    StageTracker,
    build_system_prompt,
    wants_to_end,
)
from .vad import SileroVAD

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 40  # cap LLM context; old turns roll off


class AgentState(str, Enum):
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"


class VoiceSession:
    def __init__(self, ws: WebSocket, cfg: SessionConfig):
        self.ws = ws
        self.cfg = cfg
        self.tracker = StageTracker(cfg.skills)

        self.state = AgentState.LISTENING
        self.alive = True
        self.started = False
        self.closing = False
        self.completed = False

        self.history: list[dict] = []
        self.turn_id = 0
        self.agent_task: asyncio.Task | None = None
        self.current_ctx: str | None = None
        self.interrupting = False
        self.playback_done = asyncio.Event()

        # User-turn accumulation
        self.final_segments: list[str] = []
        self.interim_text = ""
        self.finalize_at: float | None = None
        self.user_turn_n = 0

        # VAD / timing
        self.consec_speech = 0
        self.last_speech_at = 0.0
        self.listening_since = 0.0
        self.encourage_done = False
        self.repeat_done = False
        self._pcm_buf = bytearray()

        self.started_mono = time.monotonic()
        self.seq = 0

        self.vad: SileroVAD | None = None
        self.dg: DeepgramSTT | None = None
        self.tts: CartesiaTTS | None = None
        self._dg_events: asyncio.Queue[dict] = asyncio.Queue()
        self._bg_tasks: list[asyncio.Task] = []

    # ──────────────────────────────────────────────────────────────────────
    # Lifecycle
    # ──────────────────────────────────────────────────────────────────────

    async def run(self) -> None:
        try:
            self.vad = await SileroVAD.create()
            self.dg = DeepgramSTT(self._dg_events)
            self.tts = CartesiaTTS()

            self.seq = await self._initial_sequence()
            await self._mark_started()

            self._bg_tasks = [
                asyncio.create_task(self.dg.run(), name="dg-run"),
                asyncio.create_task(self._dg_event_loop(), name="dg-events"),
                asyncio.create_task(self._ticker(), name="ticker"),
            ]
            await self._send_json({"type": "ready"})
            await self._client_loop()
        except WebSocketDisconnect:
            logger.info("Client disconnected (%s)", self.cfg.session_id)
        except Exception:
            logger.exception("Voice session crashed (%s)", self.cfg.session_id)
            await self._send_json({"type": "error", "message": "Internal voice pipeline error."})
        finally:
            await self._cleanup()

    async def _cleanup(self) -> None:
        self.alive = False
        if self.agent_task and not self.agent_task.done():
            self.agent_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self.agent_task
        for t in self._bg_tasks:
            t.cancel()
        await asyncio.gather(*self._bg_tasks, return_exceptions=True)
        if self.dg:
            with contextlib.suppress(Exception):
                await self.dg.close()
        if self.tts:
            await self.tts.close()

    # ──────────────────────────────────────────────────────────────────────
    # Client receive loop — mic audio + control messages
    # ──────────────────────────────────────────────────────────────────────

    async def _client_loop(self) -> None:
        while self.alive:
            msg = await self.ws.receive()
            if msg.get("type") == "websocket.disconnect":
                return
            if (data := msg.get("bytes")) is not None:
                self._on_audio(data)
            elif (text := msg.get("text")) is not None:
                await self._on_control(text)

    def _on_audio(self, data: bytes) -> None:
        # Always forward to Deepgram — the socket stays hot even while the
        # agent is speaking, so interrupting words are never lost.
        self.dg.feed_audio(data)

        # VAD operates on exact 512-sample windows
        self._pcm_buf.extend(data)
        while len(self._pcm_buf) >= C.VAD_FRAME_BYTES:
            frame = bytes(self._pcm_buf[: C.VAD_FRAME_BYTES])
            del self._pcm_buf[: C.VAD_FRAME_BYTES]
            self._on_vad_frame(self.vad.prob(frame))

    def _on_vad_frame(self, prob: float) -> None:
        now = time.monotonic()
        # Stricter threshold while the agent has the floor: echo cancellation
        # runs client-side, but we still demand stronger evidence to interrupt.
        gate = (
            C.VAD_BARGE_PROB
            if self.state in (AgentState.SPEAKING, AgentState.THINKING)
            else C.VAD_SPEECH_PROB
        )
        if prob >= gate:
            self.consec_speech += 1
        else:
            self.consec_speech = 0
        if prob >= C.VAD_SPEECH_PROB:
            self.last_speech_at = now

        if self.interrupting or self.closing:
            return
        if self.state == AgentState.SPEAKING and self.consec_speech >= C.BARGE_IN_FRAMES:
            asyncio.create_task(self.interrupt())
        elif self.state == AgentState.THINKING and self.consec_speech >= C.THINKING_RESUME_FRAMES:
            # User resumed talking before any audio played — abort the LLM call;
            # their continuation merges into the same turn (see _commit_user_turn).
            asyncio.create_task(self.interrupt())

    async def _on_control(self, raw: str) -> None:
        import json

        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return
        mtype = msg.get("type")

        if mtype == "start" and not self.started:
            self.started = True
            self.started_mono = time.monotonic()
            self._start_agent_turn(hint=GREETING_HINT)
        elif mtype == "playback_finished":
            if msg.get("turn_id") == self.turn_id:
                self.playback_done.set()
        elif mtype == "end_interview":
            await self._begin_closing()

    # ──────────────────────────────────────────────────────────────────────
    # Deepgram events — transcript accumulation
    # ──────────────────────────────────────────────────────────────────────

    async def _dg_event_loop(self) -> None:
        while self.alive:
            ev = await self._dg_events.get()
            etype = ev["type"]
            if etype in ("final", "speech_final"):
                self.final_segments.append(ev["text"])
                self.interim_text = ""
                await self._send_live_caption()
            elif etype == "interim":
                self.interim_text = ev["text"]
                await self._send_live_caption()
            # utterance_end is informational — VAD drives our endpointing

    def _pending_text(self) -> str:
        parts = self.final_segments + ([self.interim_text] if self.interim_text else [])
        return " ".join(p for p in parts if p).strip()

    async def _send_live_caption(self) -> None:
        text = self._pending_text()
        if text:
            await self._send_json(
                {"type": "transcript", "role": "user", "text": text,
                 "final": False, "turn": self.user_turn_n}
            )

    # ──────────────────────────────────────────────────────────────────────
    # Ticker — endpointing, silence nudges, time limits (every 50 ms)
    # ──────────────────────────────────────────────────────────────────────

    def _endpoint_threshold(self) -> float:
        """Adaptive end-of-turn silence: shorter when the sentence sounds finished."""
        text = self._pending_text()
        if not text:
            return C.ENDPOINT_DEFAULT_S
        if text[-1] in ".?!":
            return C.ENDPOINT_COMPLETE_S
        last_word = text.rstrip(",;:").split()[-1].lower().strip(",")
        if text.endswith(",") or last_word in C.INCOMPLETE_TAIL_WORDS:
            return C.ENDPOINT_INCOMPLETE_S
        return C.ENDPOINT_DEFAULT_S

    @property
    def _agent_busy(self) -> bool:
        return self.agent_task is not None and not self.agent_task.done()

    async def _ticker(self) -> None:
        while self.alive:
            await asyncio.sleep(0.05)
            if not self.started:
                continue
            now = time.monotonic()
            elapsed_min = (now - self.started_mono) / 60

            if not self.closing:
                if elapsed_min >= self.cfg.duration_minutes - C.WRAP_UP_BUFFER_MIN:
                    self.tracker.force_wrap_up()
                if elapsed_min >= self.cfg.duration_minutes + C.HARD_STOP_OVERRUN_MIN:
                    await self._begin_closing()
                    continue

            if self.state != AgentState.LISTENING or self._agent_busy or self.interrupting:
                continue

            if self._pending_text():
                silence = now - self.last_speech_at
                if silence < self._endpoint_threshold():
                    continue
                if self.interim_text and self.finalize_at is None:
                    # Interim words not yet finalized — force Deepgram to flush
                    self.finalize_at = now
                    await self.dg.finalize()
                elif not self.interim_text or now - (self.finalize_at or 0) >= C.FINALIZE_GRACE_S:
                    await self._commit_user_turn()
            else:
                idle = now - self.listening_since
                if not self.repeat_done and idle >= C.REPEAT_AFTER_S:
                    self.repeat_done = True
                    self._start_agent_turn(hint=REPEAT_HINT)
                elif not self.encourage_done and idle >= C.ENCOURAGE_AFTER_S:
                    self.encourage_done = True
                    self._start_agent_turn(hint=ENCOURAGE_HINT)

    # ──────────────────────────────────────────────────────────────────────
    # Turn handling
    # ──────────────────────────────────────────────────────────────────────

    async def _commit_user_turn(self) -> None:
        text = self._pending_text()
        self.final_segments.clear()
        self.interim_text = ""
        self.finalize_at = None
        if not text:
            return

        await self._send_json(
            {"type": "transcript", "role": "user", "text": text,
             "final": True, "turn": self.user_turn_n}
        )
        self.user_turn_n += 1

        # Merge with previous user message if the agent never got to reply
        # (THINKING-phase interruption: same turn, the candidate just kept going)
        if self.history and self.history[-1]["role"] == "user":
            self.history[-1]["content"] += " " + text
        else:
            self.history.append({"role": "user", "content": text})

        self.tracker.on_candidate_turn()
        await self._persist(TranscriptSpeaker.CANDIDATE, text)

        if wants_to_end(text):
            self.tracker.force_wrap_up()

        if self.tracker.is_wrap_up_done:
            await self._begin_closing()
        else:
            self._start_agent_turn()

    def _start_agent_turn(self, hint: str | None = None, closing: bool = False) -> None:
        if self._agent_busy or self.closing and not closing:
            return
        self.agent_task = asyncio.create_task(self._run_agent_turn(hint, closing))

    async def _begin_closing(self) -> None:
        if self.closing:
            return
        self.closing = True
        if self._agent_busy:
            await self.interrupt(silent=True)
        self._start_agent_turn(hint=CLOSING_HINT, closing=True)

    async def _run_agent_turn(self, hint: str | None, closing: bool) -> None:
        """One agent turn: LLM stream → sentence splitter → TTS → client audio."""
        self.turn_id += 1
        turn_id = self.turn_id
        ctx_id = uuid.uuid4().hex
        self.current_ctx = ctx_id
        self.playback_done = asyncio.Event()
        spoken: list[str] = []
        audio_task: asyncio.Task | None = None
        audio_bytes = 0

        await self._set_state(AgentState.THINKING)

        messages = [{"role": "system", "content": build_system_prompt(self.cfg, self.tracker)}]
        messages += self.history[-MAX_HISTORY_MESSAGES:]
        if hint:
            messages.append({"role": "user", "content": hint})

        async def forward_audio() -> int:
            nonlocal audio_bytes
            first = True
            async for chunk in self.tts.audio_stream(ctx_id):
                if first:
                    first = False
                    await self._send_json({"type": "agent_start", "turn_id": turn_id})
                    await self._set_state(AgentState.SPEAKING)
                await self.ws.send_bytes(chunk)
                audio_bytes += len(chunk)
            return audio_bytes

        try:
            got_sentence = False
            async for sentence in stream_sentences(messages):
                if not got_sentence:
                    got_sentence = True
                    audio_task = asyncio.create_task(forward_audio())
                spoken.append(sentence)
                # Sentence goes to TTS the instant it leaves the LLM —
                # first audio plays while the rest is still generating.
                await self.tts.send_text(ctx_id, sentence)
                await self._send_json(
                    {"type": "agent_text", "text": sentence, "turn_id": turn_id}
                )

            if not got_sentence:
                raise RuntimeError("LLM returned empty response")

            await self.tts.end_context(ctx_id)
            await audio_task
            audio_task = None

            full = " ".join(spoken)
            self.history.append({"role": "assistant", "content": full})
            await self._persist(TranscriptSpeaker.AI, full)
            await self._send_json({"type": "agent_end", "turn_id": turn_id})

            # Hold SPEAKING until the client drains its buffer (it has more
            # audio queued than we have in flight). Estimate as fallback.
            est = audio_bytes / 2 / C.OUTPUT_SAMPLE_RATE + 3.0
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(self.playback_done.wait(), timeout=min(est, 60))

            if closing:
                await self._complete()
                return
            await self._set_state(AgentState.LISTENING)
            self._reset_listening(fresh_question=hint is None or hint == GREETING_HINT)

        except asyncio.CancelledError:
            # Interrupted — keep what was actually generated so the model knows
            # where it got cut off mid-thought.
            partial = " ".join(spoken).strip()
            if partial:
                self.history.append(
                    {"role": "assistant", "content": partial + " (interrupted by candidate)"}
                )
                await self._persist(TranscriptSpeaker.AI, partial)
            raise
        except Exception:
            logger.exception("Agent turn failed (%s)", self.cfg.session_id)
            await self._send_json(
                {"type": "error", "message": "I had a glitch — please continue."}
            )
            await self._set_state(AgentState.LISTENING)
            self._reset_listening(fresh_question=False)
            if closing:
                await self._complete()
        finally:
            if audio_task and not audio_task.done():
                audio_task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await audio_task
            if self.current_ctx == ctx_id:
                self.current_ctx = None

    # ──────────────────────────────────────────────────────────────────────
    # INTERRUPTION — the crucial path
    # ──────────────────────────────────────────────────────────────────────

    async def interrupt(self, silent: bool = False) -> None:
        """
        Candidate started speaking while the agent was thinking or talking.
        Clear client audio instantly, abort LLM + TTS, return to LISTENING.
        """
        if self.interrupting:
            return
        self.interrupting = True
        try:
            # 1. Instant silence on the client — before any task teardown
            await self._send_json({"type": "clear_audio"})

            # 2. Abort the in-flight LLM stream + audio forwarding
            task = self.agent_task
            if task and not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task

            # 3. Stop Cartesia generating audio nobody will hear
            if self.current_ctx:
                await self.tts.cancel(self.current_ctx)
                self.current_ctx = None

            # 4. Back to listening. Deepgram never stopped — the words that
            #    interrupted us are already accumulating as the next turn.
            if not silent:
                await self._set_state(AgentState.LISTENING)
                self._reset_listening(fresh_question=False)
                self.last_speech_at = time.monotonic()
        finally:
            self.interrupting = False

    # ──────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────

    def _reset_listening(self, fresh_question: bool) -> None:
        self.listening_since = time.monotonic()
        self.finalize_at = None
        if fresh_question:
            # New question asked → silence nudges re-arm
            self.encourage_done = False
            self.repeat_done = False

    async def _set_state(self, state: AgentState) -> None:
        if self.state != state:
            self.state = state
            self.consec_speech = 0
            await self._send_json({"type": "state", "state": state.value})

    async def _send_json(self, payload: dict) -> None:
        if not self.alive:
            return
        try:
            await self.ws.send_json(payload)
        except Exception:
            self.alive = False

    async def _complete(self) -> None:
        if self.completed:
            return
        self.completed = True
        elapsed_min = int((time.monotonic() - self.started_mono) / 60)
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(InterviewSession)
                    .where(InterviewSession.id == self.cfg.session_id)
                    .values(
                        status=InterviewStatus.COMPLETED,
                        ended_at=datetime.now(timezone.utc),
                        actual_duration_minutes=elapsed_min,
                    )
                )
                await db.commit()
        except Exception:
            logger.exception("Failed to mark interview completed")
        await self._send_json({"type": "interview_complete"})
        self.alive = False

    # ──────────────────────────────────────────────────────────────────────
    # Persistence
    # ──────────────────────────────────────────────────────────────────────

    async def _initial_sequence(self) -> int:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(func.coalesce(func.max(TranscriptEntry.sequence), 0)).where(
                    TranscriptEntry.session_id == self.cfg.session_id
                )
            )
            return int(result.scalar() or 0)

    async def _mark_started(self) -> None:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(InterviewSession).where(InterviewSession.id == self.cfg.session_id)
                )
                session = result.scalar_one_or_none()
                if session and session.status != InterviewStatus.COMPLETED:
                    session.status = InterviewStatus.IN_PROGRESS
                    if session.started_at is None:
                        session.started_at = datetime.now(timezone.utc)
                    await db.commit()
        except Exception:
            logger.exception("Failed to mark interview in_progress")

    async def _persist(self, speaker: TranscriptSpeaker, text: str) -> None:
        self.seq += 1
        try:
            async with AsyncSessionLocal() as db:
                db.add(
                    TranscriptEntry(
                        session_id=self.cfg.session_id,
                        sequence=self.seq,
                        speaker=speaker,
                        text=text,
                        timestamp_seconds=time.monotonic() - self.started_mono,
                    )
                )
                await db.commit()
        except Exception:
            logger.exception("Failed to persist transcript entry")
