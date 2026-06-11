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

  return ((data.text as string) || "").trim();
}
