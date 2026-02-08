import type { NextApiRequest, NextApiResponse } from "next";
import { getGenAI } from "../../lib/gemini";
import { summaryPrompt } from "../../lib/prompt";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body as { messages?: string[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "No messages provided" });
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

  try {
    const result = await model.generateContent(summaryPrompt(messages));
    const rawText = result.response.text().trim();

    function extractJson(s: string): unknown {
      const trimmed = s.trim();
      const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const toParse = jsonBlock ? jsonBlock[1].trim() : trimmed;
      return JSON.parse(toParse);
    }

    const parsed = extractJson(rawText) as { summary?: string };

    if (!parsed.summary) {
      return res.status(500).json({ error: "No summary returned", raw: rawText });
    }

    return res.status(200).json({ summary: parsed.summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate summary";
    return res.status(500).json({ error: msg });
  }
}
