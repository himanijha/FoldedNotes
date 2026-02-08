import { GoogleGenerativeAI } from "@google/generative-ai";

if (!(process.env.GEMINI_API_KEY)) {
  throw new Error("GEMINI_API_KEY is not set");
}

export const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);