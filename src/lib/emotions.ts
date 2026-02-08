/**
 * Emotion display colors (hex) used for calendar, pills, and blending.
 */
export const EMOTION_COLORS: Record<string, string> = {
  Happy: "#c9a028",
  Sad: "#4a7a98",
  Angry: "#b85a52",
  Anxious: "#c48848",
  Fear: "#7a6a9a",
  Surprise: "#5a9a7a",
  "Love/Warmth": "#b86a82",
  Misc: "#8a8a92",
};

/** [lighter, darker] for 135deg gradient (top-left to bottom-right) on border/text */
export const EMOTION_GRADIENTS: Record<string, [string, string]> = {
  Happy: ["#e0b840", "#a87a18"],
  Sad: ["#6a9ab8", "#2a5a78"],
  Angry: ["#d87a72", "#8a3a32"],
  Anxious: ["#d4a068", "#9a6028"],
  Fear: ["#9a8aba", "#5a4a7a"],
  Surprise: ["#7aba9a", "#3a7a5a"],
  "Love/Warmth": ["#d88aa2", "#984a62"],
  Misc: ["#a0a0a8", "#6a6a72"],
};

const DEFAULT_COLOR = "#8a8a92";

/**
 * Returns the most frequently occurring emotion in the list, or null if empty.
 */
export function majorityEmotion(emotions: string[]): string | null {
  if (emotions.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const e of emotions) {
    const key = e || "Misc";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

/**
 * Returns a CSS background value: a gradient over the emotion colors (order preserved),
 * or a solid color if 0–1 emotions. Use for pills, calendar cells, and dots.
 */
export function emotionColorsAsGradient(emotions: string[]): string {
  if (emotions.length === 0) return DEFAULT_COLOR;
  const hexes = emotions
    .map((e) => EMOTION_COLORS[e] ?? EMOTION_COLORS.Misc ?? DEFAULT_COLOR)
    .filter(Boolean);
  if (hexes.length === 0) return DEFAULT_COLOR;
  if (hexes.length === 1) return hexes[0];
  const stops = hexes.join(", ");
  return `linear-gradient(135deg, ${stops})`;
}
