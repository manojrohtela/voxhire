"""
Voice runtime tuning constants.

All latency-critical thresholds live here so they can be tuned in one place.
Times are in seconds unless suffixed otherwise.
"""

# ── Audio formats ─────────────────────────────────────────────────────────────
# Client mic → server: 16 kHz mono PCM16 (Deepgram + Silero VAD native rate)
INPUT_SAMPLE_RATE = 16_000
# Server TTS → client: 24 kHz mono PCM16 (Cartesia raw output)
OUTPUT_SAMPLE_RATE = 24_000
# Silero VAD v5 operates on exactly 512-sample windows @ 16 kHz (32 ms)
VAD_FRAME_SAMPLES = 512
VAD_FRAME_BYTES = VAD_FRAME_SAMPLES * 2

# ── Voice activity detection ─────────────────────────────────────────────────
VAD_SPEECH_PROB = 0.50          # speech probability threshold while LISTENING
VAD_BARGE_PROB = 0.65           # stricter threshold while agent is speaking
BARGE_IN_FRAMES = 8             # ~256 ms of sustained speech to interrupt TTS
THINKING_RESUME_FRAMES = 5      # ~160 ms of speech cancels an in-flight LLM turn

# ── Smart endpointing (when do we decide the user finished their turn) ──────
ENDPOINT_COMPLETE_S = 0.7       # transcript ends with . ? !  → fast handoff
ENDPOINT_DEFAULT_S = 1.1        # no terminal punctuation
ENDPOINT_INCOMPLETE_S = 1.8     # trailing comma / conjunction / filler — they're mid-thought
FINALIZE_GRACE_S = 0.4          # extra wait after forcing Deepgram to finalize interims

# Words that signal the candidate is mid-sentence even though they paused
INCOMPLETE_TAIL_WORDS = {
    "and", "but", "so", "because", "or", "then", "also", "like",
    "um", "uh", "umm", "uhh", "hmm", "the", "a", "an", "to", "of",
    "i", "i'm", "it's", "that's", "we", "my", "is", "was", "with",
}

# ── Silence handling (candidate says nothing at all) ────────────────────────
ENCOURAGE_AFTER_S = 8.0         # gentle nudge
REPEAT_AFTER_S = 16.0           # offer to repeat the question

# ── Turn limits ──────────────────────────────────────────────────────────────
LLM_MAX_TOKENS = 200
LLM_TEMPERATURE = 0.7
WRAP_UP_BUFFER_MIN = 2          # force wrap_up this many minutes before scheduled end
HARD_STOP_OVERRUN_MIN = 3       # absolute cutoff past scheduled duration
FINAL_DRAIN_TIMEOUT_S = 20.0    # max wait for client to finish playing closing audio

# ── Provider endpoints ───────────────────────────────────────────────────────
DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"
CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket"
CARTESIA_VERSION = "2024-06-10"
CARTESIA_MODEL_ID = "sonic-2"

SILERO_VAD_ONNX_URL = (
    "https://raw.githubusercontent.com/snakers4/silero-vad/master/"
    "src/silero_vad/data/silero_vad.onnx"
)
