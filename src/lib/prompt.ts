// src/lib/prompts.ts
import { EMOTIONS } from "../types/emotion";

export const emotionPrompt = (text: string) => `
You are an emotion classification system.

TASK:
Classify the user's message into EXACTLY ONE of the following emotions:
${EMOTIONS.join(", ")}

Definitions:
- Angry: irritation, frustration, resentment, rage
- Anxious: worry, nervousness, unease, panic
- Sad: sadness, grief, sorrow, melancholy, low mood
- Happy: joy, excitement, contentment
- Fear: dread, threat, feeling unsafe
- Surprise: shock, disbelief, unexpected reaction
- Love/Warmth: affection, care, gratitude, emotional closeness

RULES:
- Choose ONE emotion only
- Return valid JSON
- No explanations, no extra text

OUTPUT FORMAT:
{
  "name": "default-temporary-name",
  "date": "<current date>",
  "text": "<user message that was inputted>",
  "emotion": "<one of the listed emotions>",
}

MESSAGE:
"""${text}"""
`;

export const summaryPrompt = (messages: string[]) => `
You are an emotional summary system.

TASK:
Summarize the emotional content of the following messages in 1-2 sentences.

RULES:
Focus on the most important emotions and how they relate to each other.
Help the user feel understood without rereading everything.

OUTPUT FORMAT:
{
  "summary": "<your emotional summary here>"
}

MESSAGE:
"""${messages.join("\n\n")}"""
`;