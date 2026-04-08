/**
 * Two-model strategy (Google AI Studio):
 * 1) Gemma 3 27B IT — strong free-tier throughput (model id: gemma-3-27b-it). Override with GEMINI_PRIMARY_MODEL when Google publishes newer IDs (e.g. larger Gemma variants).
 * 2) Gemini 2.5 Flash — reasoning + native JSON MIME for analysis when needed.
 *
 * Env: GEMINI_API_KEY (required). Optional: GEMINI_PRIMARY_MODEL, GEMINI_SMART_MODEL.
 * Legacy: GEMINI_ANALYZE_MODEL / GEMINI_CHAT_MODEL still override the primary slot if GEMINI_PRIMARY_MODEL is unset.
 *
 * https://ai.google.dev/gemini-api/docs/models
 *
 * Gemma models (e.g. gemma-3-27b-it) do not support systemInstruction / developer
 * instructions in the API — embed the system text in the user prompt instead.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export const DEFAULT_PRIMARY_MODEL = 'gemma-3-27b-it';
export const DEFAULT_SMART_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_MODEL = DEFAULT_PRIMARY_MODEL;

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

export function buildTwoModelChain() {
  const first =
    process.env.GEMINI_PRIMARY_MODEL?.trim() ||
    process.env.GEMINI_ANALYZE_MODEL?.trim() ||
    DEFAULT_PRIMARY_MODEL;
  const second =
    process.env.GEMINI_SMART_MODEL?.trim() ||
    process.env.GEMINI_CHAT_MODEL?.trim() ||
    DEFAULT_SMART_MODEL;
  if (first === second) return [first];
  return [first, second];
}

export function getAnalyzeModelId() {
  return buildTwoModelChain()[0];
}

export function getChatModelId() {
  return buildTwoModelChain()[0];
}

export function isGeminiRateLimitError(error) {
  const status = error?.status ?? error?.statusCode;
  const msg = error?.message || String(error);
  return status === 429 || /429|RESOURCE_EXHAUSTED|quota|Too Many Requests/i.test(msg);
}

export function isModelUnavailableError(error) {
  const status = error?.status ?? error?.statusCode;
  const msg = error?.message || String(error);
  return status === 404 || /not found|invalid model|is not found|NOT_FOUND|unsupported/i.test(msg);
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

/** JSON MIME is supported on Gemini-family models; Gemma uses plain text + strict JSON in the prompt. */
export function buildAnalyzeGenerationConfig(modelId) {
  const id = String(modelId);
  const base = {
    temperature: 0.1,
    maxOutputTokens: 8192,
  };
  if (id.startsWith('gemini-')) {
    return { ...base, responseMimeType: 'application/json' };
  }
  return base;
}

export function buildChatGenerationConfig() {
  return {
    temperature: 0.2,
    maxOutputTokens: 2048,
  };
}

/** Gemma API models reject systemInstruction with 400 "Developer instruction is not enabled". */
export function supportsSystemInstruction(modelId) {
  return !String(modelId).toLowerCase().startsWith('gemma');
}

function combineSystemAndUser(systemInstruction, userText) {
  return `${systemInstruction}\n\n${userText}`;
}

export async function generateContentWithFallback(genAI, { systemInstruction }, userText) {
  const chain = buildTwoModelChain();
  let lastError;

  for (const modelId of chain) {
    const generationConfig = buildAnalyzeGenerationConfig(modelId);
    const useSys = supportsSystemInstruction(modelId);
    const model = genAI.getGenerativeModel({
      model: modelId,
      ...(useSys ? { systemInstruction } : {}),
      generationConfig,
    });
    const prompt = useSys ? userText : combineSystemAndUser(systemInstruction, userText);
    const attempt = () => model.generateContent(prompt);

    try {
      const result = await attempt();
      return { result, modelId };
    } catch (e) {
      lastError = e;
      if (isModelUnavailableError(e)) {
        console.warn(`[Gemini] ${modelId} unavailable — using fallback`);
        continue;
      }
      if (!isGeminiRateLimitError(e)) throw e;
      const wait = parseRetryDelayMs(e);
      if (wait > 0) {
        await sleep(Math.min(wait, 60_000));
        try {
          const result = await attempt();
          return { result, modelId };
        } catch (e2) {
          lastError = e2;
          if (isModelUnavailableError(e2)) continue;
          if (!isGeminiRateLimitError(e2)) throw e2;
        }
      }
      console.warn(`[Gemini] ${modelId} rate-limited — using fallback`);
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

export async function chatWithFallback(genAI, { systemInstruction }, priorHistory, userContent) {
  const chain = buildTwoModelChain();
  const generationConfig = buildChatGenerationConfig();
  let lastError;

  const tryModel = async (modelId) => {
    const useFlat = !supportsSystemInstruction(modelId);
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
      const result = await tryModel(modelId);
      return { result, modelId };
    } catch (e) {
      lastError = e;
      if (isModelUnavailableError(e)) continue;
      if (!isGeminiRateLimitError(e)) throw e;
      const wait = parseRetryDelayMs(e);
      if (wait > 0) await sleep(Math.min(wait, 60_000));
      try {
        const result = await tryModel(modelId);
        return { result, modelId };
      } catch (e2) {
        lastError = e2;
        if (isModelUnavailableError(e2)) continue;
        if (!isGeminiRateLimitError(e2)) throw e2;
      }
    }
  }

  throw lastError;
}

export function formatQuotaErrorMessage() {
  return (
    'Both configured models (Gemma primary + Gemini 2.5 Flash fallback) failed with quota or rate limits. ' +
    'See https://ai.google.dev/gemini-api/docs/rate-limits — enable billing or wait. ' +
    'Env: GEMINI_PRIMARY_MODEL, GEMINI_SMART_MODEL.'
  );
}
