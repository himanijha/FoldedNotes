export const EMOTIONS = [
  "Angry",
  "Anxious",
  "Happy",
  "Fear",
  "Surprise",
  "Love/Warmth",
] as const;

export type Emotion = typeof EMOTIONS[number];

export interface EmotionResult {
  emotion: Emotion;
  confidence: number; // this number will be between 0 and 1
}