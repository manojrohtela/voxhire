/**
 * PCMCaptureProcessor — runs on the audio rendering thread.
 *
 * Takes mic input at the AudioContext's native rate (typically 44.1/48 kHz),
 * downsamples to 16 kHz mono via linear interpolation, and posts Int16Array
 * chunks of 512 samples (32 ms — one Silero VAD frame) to the main thread,
 * which forwards them over the WebSocket as binary frames.
 */
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate; // `sampleRate` is a worklet global
    this.inputBuffer = [];
    this.readPos = 0;
    this.CHUNK = 512;
    this.outBuffer = new Int16Array(this.CHUNK);
    this.outPos = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    // Accumulate native-rate samples
    for (let i = 0; i < channel.length; i++) this.inputBuffer.push(channel[i]);

    // Walk the buffer at `ratio` steps, linearly interpolating
    while (this.readPos + 1 < this.inputBuffer.length) {
      const idx = Math.floor(this.readPos);
      const frac = this.readPos - idx;
      const sample =
        this.inputBuffer[idx] * (1 - frac) + this.inputBuffer[idx + 1] * frac;

      const clamped = Math.max(-1, Math.min(1, sample));
      this.outBuffer[this.outPos++] =
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this.outPos === this.CHUNK) {
        // Transfer ownership — zero-copy postMessage
        this.port.postMessage(this.outBuffer.buffer, [this.outBuffer.buffer]);
        this.outBuffer = new Int16Array(this.CHUNK);
        this.outPos = 0;
      }
      this.readPos += this.ratio;
    }

    // Drop consumed input, keep the fractional remainder
    const consumed = Math.floor(this.readPos);
    if (consumed > 0) {
      this.inputBuffer = this.inputBuffer.slice(consumed);
      this.readPos -= consumed;
    }
    return true;
  }
}

registerProcessor("pcm-capture", PCMCaptureProcessor);
