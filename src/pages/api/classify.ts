import type { NextApiRequest, NextApiResponse } from "next";
import { getGenAI } from "../../lib/gemini";
import { emotionPrompt } from "../../lib/prompt";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }

  let genAI;
  try {
    genAI = getGenAI();
  } catch (err) {
    return res
      .status(503)
      .json({ error: "GEMINI_API_KEY is not set. Add it to .env.local to use classification." });
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const result = await model.generateContent(
    emotionPrompt(text)
  );

  const rawText = result.response.text().trim();

  function extractJson(s: string): unknown {
    const trimmed = s.trim();
    const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const toParse = jsonBlock ? jsonBlock[1].trim() : trimmed;
    return JSON.parse(toParse);
  }

  let parsed: unknown;
  try {
    parsed = extractJson(rawText);
  } catch {
    return res
      .status(500)
      .json({
        error: "Invalid Gemini response",
        detail: rawText.slice(0, 200),
      });
  }

  return res.status(200).json(parsed);
}