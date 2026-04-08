import Groq from 'groq-sdk';
import { inferMajorityCurrency } from '@/lib/currencyFormat';
import { compactRowsForAnalysis } from '@/lib/analysisPayload';

export const dynamic = 'force-dynamic';

/** Prefer 8B when TPM limits are tight; override with ATM_ANALYZE_MODEL if needed. */
const MODEL_ANALYZE = process.env.ATM_ANALYZE_MODEL || 'llama-3.1-8b-instant';

function getApiKey() {
  return process.env.ATM_AI_API_KEY || process.env.GROQ_API_KEY;
}

function aggregateTransactions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let totalVolume = 0;
  const typeCount = {};
  const statusCount = {};
  for (const r of list) {
    const amt = Number(r?.amount);
    totalVolume += Number.isFinite(amt) ? amt : 0;
    const t = String(r?.type || 'UNKNOWN').trim() || 'UNKNOWN';
    const s = String(r?.status || 'SUCCESS').trim().toUpperCase() || 'SUCCESS';
    typeCount[t] = (typeCount[t] || 0) + 1;
    statusCount[s] = (statusCount[s] || 0) + 1;
  }
  const n = list.length || 1;
  return {
    rowCount: list.length,
    totalVolume: Math.round(totalVolume * 100) / 100,
    avgAmount: Math.round((totalVolume / n) * 100) / 100,
    typeCount,
    statusCount,
    dominantCurrency: inferMajorityCurrency(list),
  };
}

const SYSTEM_PROMPT = `You are a bank ATM data analyst. Reply with ONLY valid JSON (no markdown).

Schema:
{"summary":"string","totalTransactions":number,"totalVolume":number,"avgTransactionAmount":number,"peakHour":"string or N/A","anomalyCount":number,"anomalyDetails":["string"],"insights":["string"],"deepDiveNotes":["string"],"keyFindings":["string"],"riskLevel":"LOW"|"MEDIUM"|"HIGH","riskExplanation":"string","transactionBreakdown":[{"name":"string","value":number}],"statusBreakdown":[{"name":"string","value":number}],"recommendations":["string"]}

Rules: Copy totalTransactions,totalVolume,avgTransactionAmount,transactionBreakdown,statusBreakdown EXACTLY from serverComputedStats. Use dominantCurrency for money wording (not USD unless that code). Interpret patterns in deepDiveNotes and keyFindings.`;

export async function POST(request) {
  try {
    const body = await request.json();
    const { data, fileName } = body;

    const apiKey = getApiKey();
    if (!apiKey) {
      return Response.json(
        { error: 'AI inference API key is not configured on the server.' },
        { status: 500 }
      );
    }

    const client = new Groq({ apiKey });
    const stats = aggregateTransactions(data);
    const compactSample = compactRowsForAnalysis(data, 40);

    const userPayload = JSON.stringify({
      fn: String(fileName || 'unknown').slice(0, 200),
      serverComputedStats: stats,
      sampleRowsCompact: compactSample,
    });

    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
      model: MODEL_ANALYZE,
      temperature: 0.05,
      max_tokens: 2048,
      top_p: 1,
      stream: false,
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1].trim());
      } else {
        const braceMatch = raw.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          analysis = JSON.parse(braceMatch[0]);
        } else {
          analysis = { summary: raw, error: 'Could not parse structured response' };
        }
      }
    }

    return Response.json({ analysis });
  } catch (error) {
    const msg = error?.message || String(error);
    const is413 = /413|rate_limit|TPM|tokens/i.test(msg);
    console.error('Analysis API Error:', error);
    if (is413) {
      return Response.json(
        {
          error:
            'The analysis request is too large for the current AI quota. Try a shorter file, fewer rows, or wait a minute and retry. The dashboard still shows charts from your data.',
        },
        { status: 503 }
      );
    }
    return Response.json(
      { error: `Analysis failed: ${msg}` },
      { status: 500 }
    );
  }
}
