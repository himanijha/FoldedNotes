import type { NextApiRequest, NextApiResponse } from "next";

type TranscribeResponse =
  | { text: string; language_code?: string; words?: unknown[] }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TranscribeResponse>
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

  const { audioBase64, contentType = "audio/webm" } = req.body as {
    audioBase64?: string;
    contentType?: string;
  };

  if (!audioBase64 || typeof audioBase64 !== "string") {
    return res.status(400).json({ error: "Missing audioBase64 in request body" });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(audioBase64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid base64 audio" });
  }
  if (buffer.length === 0) {
    return res.status(400).json({ error: "Empty audio" });
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: contentType }),
    "recording.webm"
  );
  form.append("model_id", "scribe_v2");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    try {
      const errJson = JSON.parse(errText) as { detail?: { message?: string }; message?: string };
      const msg =
        errJson.detail?.message ?? errJson.message ?? errText;
      return res.status(response.status).json({ error: msg });
    } catch {
      return res.status(response.status).json({ error: errText });
    }
  }

  const data = (await response.json()) as {
    text?: string;
    language_code?: string;
    words?: unknown[];
  };
  return res.status(200).json({
    text: data.text ?? "",
    language_code: data.language_code,
    words: data.words,
  });
}
