import { shrinkTransactionsForChat, trimChatHistory } from '@/lib/chatContext';
import { getGeminiClient, getChatModelId } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_CHARS = 1800;

const SYSTEM_PROMPT =
  'You are a senior bank ATM operations analyst. Answer ONLY using the JSON block the user provides (keys st = stats, ex = example rows; each row may include c = ISO currency). All amounts use the ISO currency in the data (cc in st or c per row). Be concise; short bullets when listing. If data is empty, say so. Never invent transactions.';

function toGeminiHistory(history) {
  const list = (history || []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 4000) }],
  }));
  while (list.length && list[0].role !== 'user') list.shift();
  return list;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, history, context, summary, sample } = body;

    const genAI = getGeminiClient();
    if (!genAI) {
      return Response.json(
        {
          reply:
            'GEMINI_API_KEY is not configured. Add it in your server environment (Vercel or .env.local) and redeploy.',
        },
        { status: 200 }
      );
    }

    const userMsg = String(message || '').slice(0, MAX_MESSAGE_CHARS);
    if (!userMsg.trim()) {
      return Response.json({ reply: 'Please enter a question.' });
    }

    let statsPayload;
    let samplePayload;
    if (summary && Array.isArray(sample)) {
      statsPayload = summary;
      samplePayload = sample.slice(0, 24);
    } else {
      const shrunk = shrinkTransactionsForChat(context, 20);
      statsPayload = shrunk.stats;
      samplePayload = shrunk.sample;
    }

    const compactHistory = trimChatHistory(history, 8, 400);

    const dataBlock = JSON.stringify({ st: statsPayload, ex: samplePayload });
    const userContent = `DATA:${dataBlock}\n\nQUESTION:${userMsg}`;

    const model = genAI.getGenerativeModel({
      model: getChatModelId(),
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    const prior = toGeminiHistory(compactHistory);
    let reply;

    if (prior.length === 0) {
      const result = await model.generateContent(userContent);
      reply = result.response.text();
    } else {
      const chat = model.startChat({ history: prior });
      const result = await chat.sendMessage(userContent);
      reply = result.response.text();
    }

    return Response.json({
      reply: reply || "I couldn't generate a response. Please try again.",
    });
  } catch (error) {
    const raw = error?.message || String(error);
    if (/429|RESOURCE_EXHAUSTED|quota|rate|limit|too many/i.test(raw)) {
      return Response.json({
        reply:
          'The assistant hit an API quota or rate limit. Wait a few seconds and try again, or shorten your question.',
      });
    }
    console.error('Chat API error:', error);
    return Response.json(
      { reply: 'The AI service is temporarily unavailable. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
