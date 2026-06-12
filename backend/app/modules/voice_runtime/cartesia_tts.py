"""
Cartesia Sonic streaming TTS over WebSocket.

One persistent socket per interview session. Each agent turn uses a fresh
context_id; sentences are appended to the context with continue=true (Cartesia
keeps prosody natural across sentence boundaries) and the context is flushed
with continue=false once the LLM stream ends.

Interruption: cancel(context_id) tells Cartesia to stop generating server-side,
and the orchestrator simply stops forwarding any already-buffered chunks.

Output: raw PCM16 mono @ 24 kHz (base64 inside JSON chunk messages).
"""

import asyncio
import base64
import json
import logging
from typing import AsyncIterator

import websockets

from app.core.config import settings
from .config import (
    CARTESIA_MODEL_ID,
    CARTESIA_VERSION,
    CARTESIA_WS_URL,
    OUTPUT_SAMPLE_RATE,
)

logger = logging.getLogger(__name__)


class CartesiaTTS:
    def __init__(self):
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._connect_lock = asyncio.Lock()

    async def _ensure_connected(self) -> websockets.WebSocketClientProtocol:
        async with self._connect_lock:
            if self._ws is not None:
                try:
                    await self._ws.ping()
                    return self._ws
                except Exception:
                    self._ws = None
            url = (
                f"{CARTESIA_WS_URL}"
                f"?api_key={settings.CARTESIA_API_KEY}"
                f"&cartesia_version={CARTESIA_VERSION}"
            )
            self._ws = await websockets.connect(url, max_size=2**22)
            logger.info("Cartesia TTS connected")
            return self._ws

    def _payload(self, context_id: str, transcript: str, cont: bool) -> str:
        return json.dumps(
            {
                "context_id": context_id,
                "model_id": CARTESIA_MODEL_ID,
                "voice": {"mode": "id", "id": settings.CARTESIA_VOICE_ID},
                "language": "en",
                "transcript": transcript,
                "continue": cont,
                "output_format": {
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": OUTPUT_SAMPLE_RATE,
                },
            }
        )

    async def send_text(self, context_id: str, text: str) -> None:
        """Append a sentence to the context; audio starts streaming immediately."""
        ws = await self._ensure_connected()
        await ws.send(self._payload(context_id, text + " ", cont=True))

    async def end_context(self, context_id: str) -> None:
        """Signal no more text is coming — Cartesia flushes remaining audio + done."""
        ws = await self._ensure_connected()
        await ws.send(self._payload(context_id, "", cont=False))

    async def cancel(self, context_id: str) -> None:
        """Abort server-side generation for an interrupted turn. Best-effort."""
        ws = self._ws
        if ws is None:
            return
        try:
            await ws.send(json.dumps({"context_id": context_id, "cancel": True}))
        except Exception:
            pass

    async def audio_stream(self, context_id: str) -> AsyncIterator[bytes]:
        """
        Yield PCM16 chunks for context_id until Cartesia sends done.
        Chunks from stale (cancelled) contexts are silently dropped.
        """
        ws = await self._ensure_connected()
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except (TypeError, json.JSONDecodeError):
                continue
            if msg.get("context_id") != context_id:
                continue  # leftovers from a cancelled turn
            mtype = msg.get("type")
            if mtype == "chunk":
                data = msg.get("data")
                if data:
                    yield base64.b64decode(data)
            elif mtype == "done":
                return
            elif mtype == "error":
                logger.error("Cartesia error: %s", msg.get("error"))
                return

    async def close(self) -> None:
        ws = self._ws
        self._ws = None
        if ws is not None:
            try:
                await ws.close()
            except Exception:
                pass
