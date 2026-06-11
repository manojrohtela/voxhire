import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/voice/tts";

type RequestBody = { text?: string };

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "No text provided for speech." }, { status: 400 });
  }

  try {
    const audio = await synthesizeSpeech(text);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Speech synthesis failed." },
      { status: 500 }
    );
  }
}
