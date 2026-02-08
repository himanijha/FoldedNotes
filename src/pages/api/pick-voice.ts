import type { NextApiRequest, NextApiResponse } from "next";
import { getGenAI } from "../../lib/gemini";

type VoiceSummary = {
  voice_id: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  category?: string;
};

function buildVoicePickPrompt(
  text: string,
  emotion: string,
  voices: VoiceSummary[]
): string {
  const voiceList = voices
    .map((v) => {
      const labelStr = v.labels
        ? Object.entries(v.labels)
            .map(([k, val]) => `${k}: ${val}`)
            .join(", ")
        : "";
      return `- ID: "${v.voice_id}" | Name: "${v.name}"${v.description ? ` | Description: "${v.description}"` : ""}${labelStr ? ` | Labels: ${labelStr}` : ""}${v.category ? ` | Category: ${v.category}` : ""}`;
    })
    .join("\n");

  return `You are a voice casting director for an emotional audio experience.

TASK:
Given the user's note and its classified emotion, pick the single BEST voice from the list below to read the note aloud. Consider:
- The emotion of the note (${emotion})
- The tone, content, and mood of the text
- The voice's description, labels (gender, age, accent, descriptors), and category
- Match warmth to warm notes, intensity to intense notes, calm to reflective notes, etc.

AVAILABLE VOICES:
${voiceList}

USER'S NOTE:
"""${text}"""

CLASSIFIED EMOTION: ${emotion}

RULES:
- Pick exactly ONE voice_id from the list above
- Return ONLY valid JSON, no extra text
- Format: { "voice_id": "<chosen_voice_id>", "reason": "<one sentence why>" }`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, emotion, voices } = req.body as {
    text?: string;
    emotion?: string;
    voices?: VoiceSummary[];
  };

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text" });
  }
  if (!Array.isArray(voices) || voices.length === 0) {
    return res.status(400).json({ error: "Missing voices list" });
  }

  let genAI;
  try {
    genAI = getGenAI();
  } catch {
    return res
      .status(503)
      .json({ error: "GEMINI_API_KEY is not set" });
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = buildVoicePickPrompt(text, emotion || "Misc", voices);

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    function extractJson(s: string): unknown {
      const trimmed = s.trim();
      const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const toParse = jsonBlock ? jsonBlock[1].trim() : trimmed;
      return JSON.parse(toParse);
    }

    const parsed = extractJson(rawText) as { voice_id?: string; reason?: string };

    if (!parsed.voice_id) {
      return res.status(500).json({ error: "Gemini did not return a voice_id", raw: rawText });
    }

    // Validate that the voice_id is in the provided list
    const valid = voices.some((v) => v.voice_id === parsed.voice_id);
    if (!valid) {
      // Fallback to first voice
      return res.status(200).json({ voice_id: voices[0].voice_id, reason: "Fallback: Gemini picked an unknown voice" });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to pick voice";
    return res.status(500).json({ error: msg });
  }
}
