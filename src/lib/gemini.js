/**
 * Google Gemini (AI Studio) — set GEMINI_API_KEY in Vercel / .env.local
 * https://ai.google.dev/gemini-api/docs/rate-limits
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/** Prefer 1.5 Flash first: free-tier often works when 2.0 shows limit:0. */
export const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

/** After primary (env or default); each model has its own quota bucket. */
const MODEL_FALLBACK_ORDER = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

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

export function buildModelChain(primaryModelId) {
  const first = (primaryModelId || DEFAULT_GEMINI_MODEL).trim();
  const rest = MODEL_FALLBACK_ORDER.filter((m) => m !== first);
  return [...new Set([first, ...rest])];
}

export function isGeminiRateLimitError(error) {
  const status = error?.status ?? error?.statusCode;
  const msg = error?.message || String(error);
  return status === 429 || /429|RESOURCE_EXHAUSTED|quota|Too Many Requests/i.test(msg);
}

export function isModelUnavailableError(error) {
  const status = error?.status ?? error?.statusCode;
  const msg = error?.message || String(error);
  return status === 404 || /not found|invalid model|is not found|NOT_FOUND/i.test(msg);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseRetryDelayMs(error) {
  try {
    const details = error?.errorDetails;
    for (const d of details || []) {
      if (d?.['@type']?.includes('RetryInfo') && d.retryDelay) {
        const num = parseFloat(String(d.retryDelay).replace(/[^\d.]/g, ''));
        if (Number.isFinite(num)) return Math.min(Math.round(num * 1000), 120_000);
      }
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export async function generateContentWithFallback(
  genAI,
  { systemInstruction, generationConfig, primaryModelId },
  userText
) {
  const chain = buildModelChain(primaryModelId);
  let lastError;

  for (const modelId of chain) {
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction,
      generationConfig,
    });
    const attempt = () => model.generateContent(userText);

    try {
      const result = await attempt();
      return { result, modelId };
    } catch (e) {
      lastError = e;
      if (isModelUnavailableError(e)) {
        console.warn(`[Gemini] ${modelId} unavailable — trying next model`);
        continue;
      }
      if (!isGeminiRateLimitError(e)) throw e;
      const wait = parseRetryDelayMs(e);
      if (wait > 0) {
        console.warn(`[Gemini] ${modelId} 429 — waiting ${wait}ms then retry once`);
        await sleep(Math.min(wait, 60_000));
        try {
          const result = await attempt();
          return { result, modelId };
        } catch (e2) {
          lastError = e2;
          if (isModelUnavailableError(e2)) break;
          if (!isGeminiRateLimitError(e2)) throw e2;
        }
      }
      console.warn(`[Gemini] ${modelId} quota/rate limit — trying next model`);
    }
  }

  throw lastError;
}

function buildFlatChatPrompt(systemInstruction, priorHistory, userContent) {
  const lines = [systemInstruction, ''];
  for (const h of priorHistory) {
    const role = h.role === 'model' ? 'Assistant' : 'User';
    lines.push(`${role}: ${h.parts?.[0]?.text || ''}`);
  }
  lines.push('', 'User:', userContent);
  return lines.join('\n');
}

export async function chatWithFallback(
  genAI,
  { systemInstruction, generationConfig, primaryModelId },
  priorHistory,
  userContent
) {
  const chain = buildModelChain(primaryModelId);
  let lastError;

  const tryModel = async (modelId, useFlat) => {
    if (useFlat) {
      const flat = buildFlatChatPrompt(systemInstruction, priorHistory, userContent);
      const model = genAI.getGenerativeModel({ model: modelId, generationConfig });
      return model.generateContent(flat);
    }
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction,
      generationConfig,
    });
    if (!priorHistory.length) {
      return model.generateContent(userContent);
    }
    const chat = model.startChat({ history: priorHistory });
    return chat.sendMessage(userContent);
  };

  for (const modelId of chain) {
    try {
      const result = await tryModel(modelId, false);
      return { result, modelId };
    } catch (e) {
      lastError = e;
      if (isModelUnavailableError(e)) continue;
      if (!isGeminiRateLimitError(e)) throw e;
      const wait = parseRetryDelayMs(e);
      if (wait > 0) {
        await sleep(Math.min(wait, 60_000));
        try {
          const result = await tryModel(modelId, false);
          return { result, modelId };
        } catch (e2) {
          lastError = e2;
          if (isModelUnavailableError(e2)) break;
          if (!isGeminiRateLimitError(e2)) throw e2;
        }
      }
    }
  }

  for (const modelId of chain) {
    try {
      const result = await tryModel(modelId, true);
      return { result, modelId };
    } catch (e) {
      lastError = e;
      if (isModelUnavailableError(e)) continue;
      if (!isGeminiRateLimitError(e)) throw e;
    }
  }

  throw lastError;
}

export function formatQuotaErrorMessage() {
  return (
    'Gemini API quota was exceeded (429) for every model tried. ' +
    'Check https://ai.google.dev/gemini-api/docs/rate-limits — enable billing or a higher quota in Google AI Studio / Cloud. ' +
    'Optional: set GEMINI_ANALYZE_MODEL=gemini-1.5-flash and GEMINI_CHAT_MODEL=gemini-1.5-flash.'
  );
}
