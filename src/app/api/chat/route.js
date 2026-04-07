import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, history, context } = body;

    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        {
          reply:
            'GROQ_API_KEY environment variable is not configured. Please add it to .env.local (GROQ_API_KEY=gsk_...) and restart the server.',
        },
        { status: 200 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const systemPrompt = `You are a sophisticated AI Financial Analyst working for a major bank.
Your role is to analyze ATM transaction logs and answer user questions precisely and accurately.
You have been provided with the following sample transaction data context (up to 100 rows).

DATA CONTEXT:
${JSON.stringify(context || [], null, 2)}

RULES:
1. Always base your answers on the provided data context.
2. Be direct, authoritative, and professional.
3. When summarizing, use concise bullet points and numbers.
4. For anomaly detection, flag anything with status FAILED, REJECTED, REVERSAL, or unusually high amounts.
5. If the user asks for charts or visuals, describe what insights would be shown.
6. If the data is empty, politely tell the user to upload a file first.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message },
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
    });

    const reply =
      chatCompletion.choices[0]?.message?.content ||
      "I couldn't generate a response. Please try again.";

    return Response.json({ reply });
  } catch (error) {
    console.error('Groq API Error:', error);
    return Response.json(
      { reply: `AI service error: ${error.message}` },
      { status: 500 }
    );
  }
}
