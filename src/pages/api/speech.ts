import type { NextApiRequest, NextApiResponse } from "next";

const LANGUAGE_639_2_TO_639_1: Record<string, string> = {
  eng: "en",
  spa: "es",
  fra: "fr",
  deu: "de",
  ita: "it",
  por: "pt",
  jpn: "ja",
  kor: "ko",
  zho: "zh",
  nld: "nl",
  pol: "pl",
  rus: "ru",
  tur: "tr",
  ara: "ar",
  hin: "hi",
};

function splitMainAndBracketed(text: string): { text: string; isBracketed: boolean }[] {
  const segments: { text: string; isBracketed: boolean }[] = [];
  let rest = text.trim();
  const re = /\[([^\]]*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(rest)) !== null) {
    const before = rest.slice(lastIndex, match.index).trim();
    if (before) segments.push({ text: before, isBracketed: false });
    const inner = match[1].trim();
    if (inner) segments.push({ text: inner, isBracketed: true });
    lastIndex = match.index + match[0].length;
  }
  const after = rest.slice(lastIndex).trim();
  if (after) segments.push({ text: after, isBracketed: false });
  return segments.length ? segments : [{ text: rest || "(empty)", isBracketed: false }];
}

async function generateSegment(
  apiKey: string,
  segment: { text: string; isBracketed: boolean },
  voiceMain: string,
  voicePersonable: string,
  language_code_6391: string | undefined
): Promise<{ audioBase64: string; contentType: string }> {
  const voice = segment.isBracketed ? voicePersonable : voiceMain;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: segment.text,
        model_id: "eleven_multilingual_v2",
        ...(language_code_6391 && { language_code: language_code_6391 }),
      }),
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    try {
      const errJson = JSON.parse(errText) as { detail?: { message?: string }; message?: string };
      throw new Error(errJson.detail?.message ?? errJson.message ?? errText);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(errText);
    }
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  return { audioBase64: buffer.toString("base64"), contentType };
}

type SpeechResponse =
  | { segments: { audioBase64: string; contentType: string }[] }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SpeechResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server misconfigured: ELEVENLABS_API_KEY is not set",
    });
  }

  const { text, voiceId, language_code } = req.body as {
    text?: string;
    voiceId?: string;
    language_code?: string;
  };

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Missing or empty text in request body" });
  }

  const voiceMain = voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const voicePersonable =
    process.env.ELEVENLABS_VOICE_ID_PERSONABLE || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  const rawLang = language_code?.trim();
  const language_code_6391 = rawLang
    ? (LANGUAGE_639_2_TO_639_1[rawLang.toLowerCase()] ?? (rawLang.length === 2 ? rawLang : undefined))
    : undefined;

  const segments = splitMainAndBracketed(text.trim());

  try {
    const results = await Promise.all(
      segments.map((seg) =>
        generateSegment(apiKey, seg, voiceMain, voicePersonable, language_code_6391)
      )
    );
    return res.status(200).json({ segments: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate speech";
    return res.status(500).json({ error: msg });
  }
}
