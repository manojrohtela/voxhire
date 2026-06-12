"""
Deepgram streaming STT over WebSocket.

Owns its connection lifecycle: the run() task connects, pumps audio from an
inbound queue, emits transcript events to an outbound queue, sends keepalives,
and transparently reconnects with backoff if Deepgram drops the socket.

Emitted events (dicts):
  {"type": "interim",       "text": str}   — partial transcript, will change
  {"type": "final",         "text": str}   — finalized segment, append to turn
  {"type": "speech_final",  "text": str}   — final + Deepgram's own endpoint fired
  {"type": "utterance_end"}                — Deepgram UtteranceEnd marker
"""

import asyncio
import json
import logging
import urllib.parse

import websockets

from app.core.config import settings
from .config import DEEPGRAM_WS_URL, INPUT_SAMPLE_RATE

logger = logging.getLogger(__name__)

KEEPALIVE_INTERVAL_S = 5
RECONNECT_BACKOFF_S = (0.5, 1.0, 2.0, 4.0)


def _build_url() -> str:
    params = {
        "model": "nova-3",
        "language": "en",
        "encoding": "linear16",
        "sample_rate": str(INPUT_SAMPLE_RATE),
        "channels": "1",
        "punctuate": "true",
        "smart_format": "true",
        "interim_results": "true",
        "endpointing": "false",
        "utterance_end_ms": "3000",
        "vad_events": "true",
        "filler_words": "false",
    }
    return f"{DEEPGRAM_WS_URL}?{urllib.parse.urlencode(params)}"


class DeepgramSTT:
    def __init__(self, event_q: "asyncio.Queue[dict]"):
        self._event_q = event_q
        self._audio_q: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=200)
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._closed = False

    def feed_audio(self, pcm16: bytes) -> None:
        """Non-blocking enqueue; drops oldest audio under backpressure (reconnect storms)."""
        try:
            self._audio_q.put_nowait(pcm16)
        except asyncio.QueueFull:
            try:
                self._audio_q.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._audio_q.put_nowait(pcm16)

    async def finalize(self) -> None:
        """Force Deepgram to flush buffered audio into a final transcript now."""
        ws = self._ws
        if ws is not None:
            try:
                await ws.send(json.dumps({"type": "Finalize"}))
            except Exception:
                pass

    async def close(self) -> None:
        self._closed = True
        await self._audio_q.put(None)
        ws = self._ws
        if ws is not None:
            try:
                await ws.send(json.dumps({"type": "CloseStream"}))
                await ws.close()
            except Exception:
                pass

    async def run(self) -> None:
        """Connection owner — call as a task; returns when close() is called."""
        attempt = 0
        while not self._closed:
            try:
                async with websockets.connect(
                    _build_url(),
                    extra_headers={"Authorization": f"Token {settings.DEEPGRAM_API_KEY}"},
                    max_size=2**20,
                ) as ws:
                    self._ws = ws
                    attempt = 0
                    logger.info("Deepgram connected")
                    sender = asyncio.create_task(self._send_loop(ws))
                    keeper = asyncio.create_task(self._keepalive_loop(ws))
                    try:
                        await self._recv_loop(ws)
                    finally:
                        sender.cancel()
                        keeper.cancel()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                if self._closed:
                    break
                delay = RECONNECT_BACKOFF_S[min(attempt, len(RECONNECT_BACKOFF_S) - 1)]
                attempt += 1
                logger.warning("Deepgram dropped (%s) — reconnecting in %.1fs", exc, delay)
                await asyncio.sleep(delay)
            finally:
                self._ws = None

    async def _send_loop(self, ws) -> None:
        while True:
            chunk = await self._audio_q.get()
            if chunk is None:
                return
            await ws.send(chunk)

    async def _keepalive_loop(self, ws) -> None:
        # Required by Deepgram if audio ever stalls >10s (tab backgrounded, etc.)
        while True:
            await asyncio.sleep(KEEPALIVE_INTERVAL_S)
            await ws.send(json.dumps({"type": "KeepAlive"}))

    async def _recv_loop(self, ws) -> None:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except (TypeError, json.JSONDecodeError):
                continue

            mtype = msg.get("type")
            if mtype == "UtteranceEnd":
                await self._event_q.put({"type": "utterance_end"})
            elif mtype == "Results":
                alt = (msg.get("channel") or {}).get("alternatives") or [{}]
                text = (alt[0].get("transcript") or "").strip()
                if not text:
                    continue
                if msg.get("is_final"):
                    kind = "speech_final" if msg.get("speech_final") else "final"
                    await self._event_q.put({"type": kind, "text": text})
                else:
                    await self._event_q.put({"type": "interim", "text": text})
