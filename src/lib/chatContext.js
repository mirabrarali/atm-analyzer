/**
 * Shrinks transaction data for the copilot API to stay under strict token budgets.
 */

import { inferMajorityCurrency } from "./currencyFormat";

export function shrinkTransactionsForChat(rows, maxSample = 16) {
  const list = Array.isArray(rows) ? rows : [];
  let vol = 0;
  const tc = {};
  const sc = {};
  for (const r of list) {
    const a = Number(r?.amount);
    const safe = Number.isFinite(a) ? a : 0;
    vol += safe;
    const t = String(r?.type || "?").slice(0, 24);
    const s = String(r?.status || "?").slice(0, 14);
    tc[t] = (tc[t] || 0) + 1;
    sc[s] = (sc[s] || 0) + 1;
  }
  const cc = inferMajorityCurrency(list);
  const sample = list.slice(0, maxSample).map((r) => ({
    t: String(r?.type || "?").slice(0, 24),
    a: Number(r?.amount) && Number.isFinite(Number(r?.amount)) ? Number(r.amount) : 0,
    s: String(r?.status || "?").slice(0, 14),
    c: String(r?.currency || cc || "USD")
      .slice(0, 3)
      .toUpperCase(),
  }));
  return {
    stats: {
      n: list.length,
      v: Math.round(vol * 100) / 100,
      tc,
      sc,
      cc,
    },
    sample,
  };
}

export function trimChatHistory(history, maxTurns = 5, maxCharsPerMessage = 320) {
  return (history || [])
    .slice(-maxTurns)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, maxCharsPerMessage),
    }));
}
