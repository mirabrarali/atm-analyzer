/**
 * Google Gemini (AI Studio) — generous free tier; set GEMINI_API_KEY in Vercel / .env.local
 * Docs: https://ai.google.dev/gemini-api/docs
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/** Default: fast, high-context Flash model (good for structured JSON + chat). */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

export function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    ''
  );
}

export function getGeminiClient() {
  const key = getGeminiApiKey();
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

export function getAnalyzeModelId() {
  return process.env.GEMINI_ANALYZE_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function getChatModelId() {
  return process.env.GEMINI_CHAT_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}
