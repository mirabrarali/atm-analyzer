import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';

/** Groq: llama3-8b-8192 was retired; use current production IDs. */
const MODEL_ANALYZE = 'llama-3.3-70b-versatile';

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
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { data, fileName } = body;

    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        { error: 'GROQ_API_KEY not configured.' },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const stats = aggregateTransactions(data);
    const sample = Array.isArray(data) ? data.slice(0, 120) : [];

    const systemPrompt = `You are a sophisticated AI Financial Analyst specializing in ATM transaction analysis for a major bank.
Analyze the provided ATM transaction data and return a STRICT JSON response (no markdown, no code fences, just raw JSON).

The JSON must follow this exact schema:
{
  "summary": "2-3 sentence executive summary of the data",
  "totalTransactions": number,
  "totalVolume": number,
  "avgTransactionAmount": number,
  "peakHour": "string or N/A",
  "anomalyCount": number,
  "anomalyDetails": ["string descriptions of notable anomalies or risks"],
  "insights": ["string - 4 to 6 key business insights"],
  "deepDiveNotes": ["string - 5 to 8 detailed analytical bullet points (patterns, concentrations, outliers, operational implications)"],
  "keyFindings": ["string - 3 to 5 punchy executive takeaways"],
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "riskExplanation": "why this risk level",
  "transactionBreakdown": [{"name": "type", "value": count}],
  "statusBreakdown": [{"name": "status", "value": count}],
  "recommendations": ["string - 3 to 5 actionable recommendations"]
}

RULES:
- The object "serverComputedStats" in the user message is ground truth for row counts, totals, and frequency tables. Your totalTransactions, totalVolume, avgTransactionAmount, transactionBreakdown, and statusBreakdown MUST match serverComputedStats (you may restate them).
- deepDiveNotes and keyFindings must add interpretation beyond raw counts (e.g. concentration risk, failure clusters, amount distribution implications).
- Be precise with numbers.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `File name: "${fileName || 'unknown'}"

serverComputedStats (GROUND TRUTH — copy counts and totals from here):
${JSON.stringify(stats)}

Representative sample rows (for context only):
${JSON.stringify(sample)}`,
        },
      ],
      model: MODEL_ANALYZE,
      temperature: 0.05,
      max_tokens: 4096,
      top_p: 1,
      stream: false,
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';

    // Try to extract JSON from the response
    let analysis;
    try {
      // Try direct parse first
      analysis = JSON.parse(raw);
    } catch {
      // Try to extract JSON from markdown code fences
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find JSON object in the text
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
    console.error('Analysis API Error:', error);
    return Response.json(
      { error: `Analysis failed: ${error.message}` },
      { status: 500 }
    );
  }
}
