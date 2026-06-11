import { NextResponse } from "next/server";
import { transcribeWithWhisper } from "@/lib/voice/whisper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No audio received." }, { status: 400 });
  }

  try {
    const text = await transcribeWithWhisper(audio);
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed." },
      { status: 500 }
    );
  }
}
