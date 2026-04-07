import Groq from 'groq-sdk';
import { shrinkTransactionsForChat, trimChatHistory } from '@/lib/chatContext';

export const dynamic = 'force-dynamic';

const CHAT_MODEL = 'llama-3.1-8b-instant';
const MAX_MESSAGE_CHARS = 1800;

function getApiKey() {
  return process.env.ATM_AI_API_KEY || process.env.GROQ_API_KEY;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, history, context, summary, sample } = body;

    const apiKey = getApiKey();
    if (!apiKey) {
      return Response.json(
        {
          reply:
            'The AI service is not configured. Add your inference API key to the server environment (for example in .env.local) and restart the application.',
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
      samplePayload = sample.slice(0, 18);
    } else {
      const shrunk = shrinkTransactionsForChat(context, 16);
      statsPayload = shrunk.stats;
      samplePayload = shrunk.sample;
    }

    const compactHistory = trimChatHistory(history, 5, 280);

    const dataBlock = JSON.stringify({ st: statsPayload, ex: samplePayload });

    const systemPrompt =
      'You are a senior bank ATM operations analyst. Answer ONLY using the JSON block STATS+EXAMPLES the user provides (keys st and ex). Be concise; use short bullets when listing items. If data is missing, say so. Never invent transaction rows.';

    const userContent = `DATA:${dataBlock}\n\nQUESTION:${userMsg}`;

    const client = new Groq({ apiKey });

    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...compactHistory.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userContent },
      ],
      model: CHAT_MODEL,
      temperature: 0.15,
      max_tokens: 512,
      top_p: 1,
      stream: false,
    });

    const reply =
      chatCompletion.choices[0]?.message?.content ||
      "I couldn't generate a response. Please try again.";

    return Response.json({ reply });
  } catch (error) {
    const raw = error?.message || String(error);
    if (/413|rate_limit|TPM|tokens per minute|tokens/i.test(raw)) {
      return Response.json({
        reply:
          'The assistant hit a short-term size limit. Try a briefer question, or clear the chat and ask again with fewer follow-ups.',
      });
    }
    console.error('Chat API error:', error);
    return Response.json(
      { reply: 'The AI service is temporarily unavailable. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
