import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY?.trim();

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export function getGenAI(): GoogleGenerativeAI {
  if (!genAI) throw new Error("GEMINI_API_KEY is not set");
  return genAI;
}