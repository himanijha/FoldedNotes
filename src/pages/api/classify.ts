import type { NextApiRequest, NextApiResponse } from "next";
import { genAI } from "../../lib/gemini";
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

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const result = await model.generateContent(
    emotionPrompt(text)
  );

  let parsed;
  try {
    parsed = JSON.parse(result.response.text());
  } catch {
    return res
      .status(500)
      .json({ error: "Invalid Gemini response" });
  }

  return res.status(200).json(parsed);
}