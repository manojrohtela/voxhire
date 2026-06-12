// Whisper hallucinates these phrases on silence/noise — discard them
const WHISPER_HALLUCINATIONS = new Set([
  "thank you",
  "thank you.",
  "thanks",
  "thanks.",
  "thank you so much",
  "thank you so much.",
  "thank you for watching",
  "thank you for watching.",
  "thank you for listening",
  "thank you for listening.",
  "thanks for watching",
  "thanks for watching.",
  "thanks for your time",
  "thanks for your time.",
  "you",
  "you.",
  ".",
  "..",
  "...",
  "okay",
  "okay.",
  "ok",
  "ok.",
  "hmm",
  "hmm.",
  "uh",
  "um",
  "bye",
  "bye.",
  "goodbye",
  "goodbye.",
]);

function isHallucination(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return true;
  if (WHISPER_HALLUCINATIONS.has(normalized)) return true;
  // Single token under 3 characters is almost always noise
  if (!normalized.includes(" ") && normalized.replace(/[^a-z]/g, "").length < 3) return true;
  return false;
}

export async function transcribeWithWhisper(audio: Blob): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing.");

  const formData = new FormData();
  formData.append("file", audio, "audio.webm");
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "en");
  formData.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Groq Whisper transcription failed.");

  const text = ((data.text as string) || "").trim();
  return isHallucination(text) ? "" : text;
}
