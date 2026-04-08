/**
 * Minimizes rows sent to the analysis API — full `raw` journal text explodes token count.
 */

export function compactRowsForAnalysis(rows, maxRows = 40) {
  const list = Array.isArray(rows) ? rows : [];
  return list.slice(0, maxRows).map((r) => ({
    t: String(r?.type || "?").slice(0, 40),
    a: Math.round((Number(r?.amount) || 0) * 100) / 100,
    s: String(r?.status || "?").slice(0, 22),
    c: String(r?.currency || "").slice(0, 3).toUpperCase() || undefined,
  }));
}
