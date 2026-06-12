"""
Silero VAD v5 via onnxruntime — no torch dependency.

The ONNX model is ~2 MB and is auto-downloaded to models/ on first use.
Each instance is stateful (RNN hidden state carried across frames), so create
one VAD per connection and feed it consecutive 512-sample PCM16 frames @16 kHz.
"""

import asyncio
import logging
from pathlib import Path

import httpx
import numpy as np
import onnxruntime as ort

from .config import SILERO_VAD_ONNX_URL, VAD_FRAME_SAMPLES

logger = logging.getLogger(__name__)

_MODEL_PATH = Path(__file__).parent / "models" / "silero_vad.onnx"
_download_lock = asyncio.Lock()


async def ensure_model() -> Path:
    """Download the Silero VAD ONNX model once; concurrent sessions share the lock."""
    if _MODEL_PATH.exists():
        return _MODEL_PATH
    async with _download_lock:
        if _MODEL_PATH.exists():
            return _MODEL_PATH
        _MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        logger.info("Downloading Silero VAD model…")
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            res = await client.get(SILERO_VAD_ONNX_URL)
            res.raise_for_status()
            tmp = _MODEL_PATH.with_suffix(".tmp")
            tmp.write_bytes(res.content)
            tmp.rename(_MODEL_PATH)
        logger.info("Silero VAD model saved to %s", _MODEL_PATH)
    return _MODEL_PATH


class SileroVAD:
    """Stateful speech-probability detector. ~1 ms per 32 ms frame on CPU."""

    def __init__(self, model_path: Path):
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        self._session = ort.InferenceSession(
            str(model_path), sess_options=opts, providers=["CPUExecutionProvider"]
        )
        self._sr = np.array(16_000, dtype=np.int64)
        self.reset()

    @classmethod
    async def create(cls) -> "SileroVAD":
        path = await ensure_model()
        # ONNX session creation is blocking — keep it off the event loop
        return await asyncio.to_thread(cls, path)

    def reset(self) -> None:
        self._state = np.zeros((2, 1, 128), dtype=np.float32)

    def prob(self, frame_pcm16: bytes) -> float:
        """Speech probability [0..1] for one 512-sample PCM16 frame."""
        samples = np.frombuffer(frame_pcm16, dtype=np.int16)
        if samples.shape[0] != VAD_FRAME_SAMPLES:
            return 0.0
        x = (samples.astype(np.float32) / 32768.0)[None, :]
        out, self._state = self._session.run(
            None, {"input": x, "state": self._state, "sr": self._sr}
        )
        return float(out[0][0])
