// Fixed interviewer voice: professional male (Cole)
const VOICE_ID = "3e39e9a5-585c-4f5f-bac6-5e4905c51095";

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) throw new Error("CARTESIA_API_KEY is missing.");

  const clean = text.trim();
  if (!clean) throw new Error("No text provided for speech.");

  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": "2024-06-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "sonic-2",
      transcript: clean,
      voice: { mode: "id", id: VOICE_ID },
      output_format: { container: "mp3", bit_rate: 128000, sample_rate: 44100 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? err?.error ?? "Cartesia TTS failed.");
  }

  return res.arrayBuffer();
}
