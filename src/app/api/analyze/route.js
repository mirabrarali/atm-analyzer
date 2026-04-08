import { inferMajorityCurrency } from '@/lib/currencyFormat';
import { compactRowsForAnalysis } from '@/lib/analysisPayload';
import { getGeminiClient, getAnalyzeModelId } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

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

const SYSTEM_PROMPT = `You are a bank ATM data analyst. Reply with ONLY valid JSON (no markdown, no code fences).

Schema:
{"summary":"string","totalTransactions":number,"totalVolume":number,"avgTransactionAmount":number,"peakHour":"string or N/A","anomalyCount":number,"anomalyDetails":["string"],"insights":["string"],"deepDiveNotes":["string"],"keyFindings":["string"],"riskLevel":"LOW"|"MEDIUM"|"HIGH","riskExplanation":"string","transactionBreakdown":[{"name":"string","value":number}],"statusBreakdown":[{"name":"string","value":number}],"recommendations":["string"]}

Rules: Copy totalTransactions, totalVolume, avgTransactionAmount, transactionBreakdown, statusBreakdown EXACTLY from serverComputedStats. Use dominantCurrency for money wording. deepDiveNotes and keyFindings must add real interpretation (concentration, failures, outliers).`;

export async function POST(request) {
  try {
    const body = await request.json();
    const { data, fileName } = body;

    const genAI = getGeminiClient();
    if (!genAI) {
      return Response.json(
        { error: 'GEMINI_API_KEY is not set. Add it in Vercel Environment Variables (or .env.local) and redeploy.' },
        { status: 500 }
      );
    }

    const stats = aggregateTransactions(data);
    const compactSample = compactRowsForAnalysis(data, 60);

    const userPayload = JSON.stringify({
      fn: String(fileName || 'unknown').slice(0, 200),
      serverComputedStats: stats,
      sampleRowsCompact: compactSample,
    });

    const model = genAI.getGenerativeModel({
      model: getAnalyzeModelId(),
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(userPayload);
    const raw = result.response.text() || '{}';

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
    console.error('Analysis API Error:', error);
    const isQuota =
      /429|RESOURCE_EXHAUSTED|quota|rate|limit|too many/i.test(msg) ||
      error?.status === 429;
    if (isQuota) {
      return Response.json(
        {
          error:
            'Gemini API quota or rate limit reached. Wait a moment and retry, or check your Google AI Studio billing / limits.',
        },
        { status: 503 }
      );
    }
    return Response.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
  }
}
