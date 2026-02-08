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

const THEME_VOICE_SETTINGS: Record<
  string,
  { stability: number; style: number }
> = {
  Angry: { stability: 0.35, style: 0.4 },
  Anxious: { stability: 0.35, style: 0.35 },
  Happy: { stability: 0.35, style: 0.4 },
  Fear: { stability: 0.35, style: 0.35 },
  Surprise: { stability: 0.35, style: 0.4 },
  "Love/Warmth": { stability: 0.4, style: 0.35 },
  Misc: { stability: 0.5, style: 0 },
};

async function generateSpeech(
  apiKey: string,
  text: string,
  voice_id: string,
  language_code_6391: string | undefined,
  theme?: string
): Promise<{ audioBase64: string; contentType: string }> {
  const voice_settings =
    theme && THEME_VOICE_SETTINGS[theme]
      ? THEME_VOICE_SETTINGS[theme]
      : THEME_VOICE_SETTINGS.Misc;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice_id)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        ...(language_code_6391 && { language_code: language_code_6391 }),
        voice_settings:
          voice_settings.style > 0
            ? {
                stability: voice_settings.stability,
                style: voice_settings.style,
              }
            : { stability: voice_settings.stability },
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

const SOUND_EFFECT_MOOD: Record<string, string> = {
  Angry: "intense, sharp, aggressive",
  Anxious: "tense, nervous, uneasy",
  Happy: "bright, cheerful, upbeat",
  Fear: "dark, tense, suspenseful",
  Surprise: "dynamic, expressive, dramatic",
  "Love/Warmth": "warm, gentle, soft",
  Misc: "neutral, natural",
};

function enrichSoundEffectPrompt(effect: string, theme?: string): string {
  const mood = theme ? SOUND_EFFECT_MOOD[theme] ?? SOUND_EFFECT_MOOD.Misc : SOUND_EFFECT_MOOD.Misc;
  const trimmed = effect.trim();
  if (!trimmed) return mood;
  return `${mood} ${trimmed}`;
}

async function generateSoundEffect(
  apiKey: string,
  text: string,
  theme?: string
): Promise<{ audioBase64: string; contentType: string }> {
  const prompt = enrichSoundEffectPrompt(text, theme);
  const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: 1.5,
      prompt_influence: 0.4,
    }),
  });
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

  const {
    text,
    voiceId,
    voiceMain: bodyVoiceMain,
    language_code,
    voice_theme: bodyVoiceTheme,
    segments: bodySegments,
  } = req.body as {
    text?: string;
    voiceId?: string;
    voiceMain?: string;
    language_code?: string;
    voice_theme?: string;
    segments?: { type: "speech" | "sound_effect"; text: string; voice_id?: string }[];
  };

  const rawLang = language_code?.trim();
  const language_code_6391 = rawLang
    ? (LANGUAGE_639_2_TO_639_1[rawLang.toLowerCase()] ?? (rawLang.length === 2 ? rawLang : undefined))
    : undefined;

  if (Array.isArray(bodySegments) && bodySegments.length > 0) {
    const defaultVoice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    try {
      const results = await Promise.all(
        bodySegments
          .filter((s) => typeof s.text === "string" && s.text.trim())
          .map(async (s) => {
            const t = s.text.trim();
            if (s.type === "sound_effect") {
              return generateSoundEffect(apiKey, t, bodyVoiceTheme);
            }
            const voice_id = (s.voice_id ?? bodyVoiceMain ?? voiceId)?.trim() || defaultVoice;
            return generateSpeech(apiKey, t, voice_id, language_code_6391, bodyVoiceTheme);
          })
      );
      return res.status(200).json({ segments: results });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate audio";
      return res.status(500).json({ error: msg });
    }
  }

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Missing or empty text in request body" });
  }

  const defaultMain = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const voiceMain = (bodyVoiceMain ?? voiceId)?.trim() || defaultMain;
  const segments = splitMainAndBracketed(text.trim());

  try {
    const results = await Promise.all(
      segments.map(async (seg) => {
        if (seg.isBracketed) {
          return generateSoundEffect(apiKey, seg.text, bodyVoiceTheme);
        }
        return generateSpeech(apiKey, seg.text, voiceMain, language_code_6391, bodyVoiceTheme);
      })
    );
    return res.status(200).json({ segments: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate audio";
    return res.status(500).json({ error: msg });
  }
}
