import type { NextApiRequest, NextApiResponse } from "next";

export const SPEECH_THEMES = [
  "Angry",
  "Anxious",
  "Happy",
  "Fear",
  "Surprise",
  "Love/Warmth",
  "Misc",
] as const;

export type SpeechTheme = (typeof SPEECH_THEMES)[number];

export type Voice = {
  voice_id: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  category?: string;
};
type VoicesResponse = { voices: Voice[]; themes: SpeechTheme[] } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VoicesResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server misconfigured: ELEVENLABS_API_KEY is not set",
    });
  }

  const response = await fetch(
    "https://api.elevenlabs.io/v2/voices?page_size=100",
    {
      headers: { "xi-api-key": apiKey },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    try {
      const errJson = JSON.parse(errText) as { detail?: { message?: string }; message?: string };
      return res.status(response.status).json({
        error: errJson.detail?.message ?? errJson.message ?? errText,
      });
    } catch {
      return res.status(response.status).json({ error: errText });
    }
  }

  const data = (await response.json()) as {
    voices?: {
      voice_id?: string;
      name?: string;
      description?: string;
      labels?: Record<string, string>;
      category?: string;
    }[];
  };
  const voices: Voice[] = (data.voices ?? [])
    .filter((v) => v.voice_id)
    .map((v) => ({
      voice_id: v.voice_id ?? "",
      name: v.name ?? "Unknown",
      description: v.description,
      labels: v.labels,
      category: v.category,
    }));

  return res.status(200).json({ voices, themes: [...SPEECH_THEMES] });
}
