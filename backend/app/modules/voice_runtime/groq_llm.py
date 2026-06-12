"""
Groq streaming LLM — yields text deltas and complete sentences.

The sentence splitter is what feeds TTS early: the first sentence is dispatched
to Cartesia while the rest of the completion is still being generated.
"""

import logging
from typing import AsyncIterator

from groq import AsyncGroq

from app.core.config import settings
from .config import LLM_MAX_TOKENS, LLM_TEMPERATURE

logger = logging.getLogger(__name__)

_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


async def stream_completion(messages: list[dict]) -> AsyncIterator[str]:
    """Yield raw text deltas from a streamed chat completion."""
    stream = await _get_client().chat.completions.create(
        model=settings.GROQ_LLM_MODEL,
        messages=messages,
        stream=True,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


_ABBREVIATIONS = {"dr", "mr", "mrs", "ms", "vs", "etc", "eg", "ie", "st", "e.g", "i.e"}


def split_sentence(buf: str) -> tuple[str, str] | None:
    """
    Return (sentence, remainder) if buf contains a complete sentence, else None.
    Splits early so short acknowledgments ("Got it.") reach TTS immediately;
    a '.' only splits when followed by space + uppercase and the preceding word
    isn't an abbreviation or initial.
    """
    for i in range(1, len(buf) - 1):
        ch, nxt = buf[i], buf[i + 1]
        if ch in "?!" and nxt == " ":
            return buf[: i + 1].strip(), buf[i + 2 :]
        if ch == "." and nxt == " ":
            rest = buf[i + 2 :].lstrip()
            if not rest or not rest[0].isupper():
                continue
            prev_word = buf[:i].rsplit(None, 1)[-1].lower().rstrip(".")
            if prev_word in _ABBREVIATIONS or len(prev_word) <= 1:
                continue  # "Dr. Smith", "e.g. Redis", initials
            return buf[: i + 1].strip(), buf[i + 2 :]
    return None


async def stream_sentences(messages: list[dict]) -> AsyncIterator[str]:
    """Yield complete sentences as soon as they emerge from the token stream."""
    buf = ""
    async for delta in stream_completion(messages):
        buf += delta
        while (parts := split_sentence(buf)) is not None:
            sentence, buf = parts
            if sentence:
                yield sentence
    tail = buf.strip()
    if tail:
        yield tail
