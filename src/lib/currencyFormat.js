/**
 * ISO-4217-aware formatting for ATM / core extracts (multi-currency).
 */

const FALLBACK = "USD";

export function inferMajorityCurrency(rows) {
  if (!rows?.length) return FALLBACK;
  const counts = {};
  for (const r of rows) {
    const c = r?.currency || r?.Currency || r?.CCY;
    if (c && typeof c === "string" && /^[A-Za-z]{3}$/.test(c.trim())) {
      const u = c.trim().toUpperCase();
      counts[u] = (counts[u] || 0) + 1;
    }
  }
  const keys = Object.keys(counts);
  if (!keys.length) return FALLBACK;
  return keys.sort((a, b) => counts[b] - counts[a])[0];
}

export function formatMoneyAmount(amount, currencyCode = FALLBACK) {
  const n = Number(amount);
  const cc = (currencyCode || FALLBACK).toUpperCase();
  if (!Number.isFinite(n)) return `— ${cc}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cc,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cc}`;
  }
}

/** Compact form for charts / tight UI */
export function formatMoneyCompact(amount, currencyCode = FALLBACK) {
  const n = Number(amount);
  const cc = (currencyCode || FALLBACK).toUpperCase();
  if (!Number.isFinite(n)) return `—`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cc,
      notation: n >= 1e6 ? "compact" : "standard",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cc}`;
  }
}
