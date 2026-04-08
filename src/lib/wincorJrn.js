/**
 * Wincor / Diebold Nixdorf multifunction ATM journal (e.g. ========WINCOR MULTIFUNCTION=======).
 * Records are anchored by RRN + TERM ID; amounts appear as ISO currency + value (e.g. OMR15.000)
 * or glued to the masked PAN line (e.g. ...0929OMR30.000).
 */

const WINCOR_MARK = /WINCOR\s+MULTIFUNCTION/i;

function inferFileCurrency(lines) {
  for (const line of lines) {
    const l = line.trim();
    if (/^DENOMINATION\s+/i.test(l)) {
      const m = l.match(/\b([A-Z]{3})\s*\d/i);
      if (m) return m[1];
    }
  }
  return null;
}

function detectTxType(lines, rrnIndex) {
  let txType = "UNKNOWN";
  const from = Math.max(0, rrnIndex - 40);
  for (let b = rrnIndex - 1; b >= from; b--) {
    const lb = lines[b].trim();
    if (/^CASH WITHDRAWAL$/i.test(lb)) {
      txType = "CASH_WITHDRAWAL";
      break;
    }
    if (/^BALANCE INQUIRY$/i.test(lb)) {
      txType = "BALANCE_INQUIRY";
      break;
    }
    if (/^PIN CREATION$/i.test(lb)) {
      txType = "PIN_CREATION";
      break;
    }
    if (/\bINQUIRY\s*$/i.test(lb) && /\d{2}\/\d{2}\/\d{2}/.test(lb)) {
      txType = "INQUIRY";
      break;
    }
    if (/^\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+INQUIRY$/i.test(lb)) {
      txType = "INQUIRY";
      break;
    }
  }
  return txType;
}

function extractDateBefore(lines, rrnIndex) {
  for (let b = rrnIndex - 1; b >= Math.max(0, rrnIndex - 12); b--) {
    const dt = lines[b].trim().match(/^(\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/);
    if (dt) return dt[1];
  }
  return "";
}

/**
 * Amount appears on the line after RRN (often masked PAN + OMRxx.xxx glued) or OMR xx.xxx alone.
 * Only scan lines *before* RC: so we never read DENOMINATION / cassette rows.
 */
function extractCurrencyAmountAfterRrn(lines, startIndex) {
  const end = Math.min(lines.length, startIndex + 14);
  const beforeRc = [];
  for (let j = startIndex; j < end; j++) {
    const raw = lines[j];
    const trimmed = raw.trim();
    if (/^RC:\s*/i.test(trimmed)) break;
    if (
      /^(DENOMINATION|DISPENSED|CASSETTE|CASH TYPE|REMAINING|REJECTED)\s/i.test(trimmed) ||
      /^\s*TYPE\d+\s/i.test(trimmed)
    ) {
      continue;
    }
    beforeRc.push(raw);
  }

  const tryLine = (raw) => {
    const gl = raw.match(/([A-Z]{3})(\d+\.\d{2,3})\b/);
    if (gl && /^[A-Z]{3}$/.test(gl[1]) && !["TVR", "TSI", "AID"].includes(gl[1])) {
      return { currency: gl[1], amount: parseFloat(gl[2]) };
    }
    const sp = raw.match(/\b([A-Z]{3})\s+([0-9]+(?:\.[0-9]+)?)\s*$/);
    if (sp && /^[A-Z]{3}$/.test(sp[1])) {
      return { currency: sp[1], amount: parseFloat(sp[2]) };
    }
    return null;
  };

  for (const raw of beforeRc) {
    if (/\*{2,}/.test(raw) || /X{4,}/i.test(raw)) {
      const got = tryLine(raw);
      if (got) return got;
    }
  }
  for (const raw of beforeRc) {
    const got = tryLine(raw);
    if (got) return got;
  }
  return { amount: null, currency: null };
}

function extractRc(lines, start) {
  const end = Math.min(lines.length, start + 16);
  for (let j = start; j < end; j++) {
    const trimmed = lines[j].trim();
    const rcM = trimmed.match(/^RC:\s*(\d+)\s*-\s*(.+)$/i);
    if (rcM) {
      return { rcCode: rcM[1], rcMsg: rcM[2].trim() };
    }
  }
  return { rcCode: "", rcMsg: "" };
}

function fallbackAmountFromRequest(lines, rrnIndex) {
  const from = Math.max(0, rrnIndex - 45);
  for (let b = rrnIndex - 1; b >= from; b--) {
    const am = lines[b].match(/TRANSACTION\s+REQUEST[^\n]*AMOUNT:\s*(\d+)/i);
    if (am) return parseFloat(am[1]);
    const am2 = lines[b].match(/\bAMOUNT:\s*(\d+)\s*$/i);
    if (am2) return parseFloat(am2[1]);
  }
  return null;
}

function normalizeStatus(rcCode, rcMsg) {
  if (rcCode === "00") return "APPROVED";
  if (rcCode && rcCode !== "00") return "FAILED";
  const u = (rcMsg || "").toUpperCase();
  if (u.includes("APPROVED")) return "APPROVED";
  return rcMsg || "UNKNOWN";
}

/**
 * @returns {{ id: string, date: string, type: string, amount: number, currency: string, status: string, raw: string, rrn?: string, terminalId?: string, rcCode?: string }[]}
 */
export function parseWincorJrn(text) {
  const lines = text.split(/\r?\n/);
  const txs = [];
  const fileCurrency = inferFileCurrency(lines) || "USD";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const rrnMatch = line.match(/^RRN:\s*(\d+)\s+TERM ID:\s*(\d+)/i);
    if (!rrnMatch) continue;

    const rrn = rrnMatch[1];
    const terminalId = rrnMatch[2];
    const txType = detectTxType(lines, i);
    const dateStr = extractDateBefore(lines, i);

    let { amount, currency } = extractCurrencyAmountAfterRrn(lines, i + 1);
    const { rcCode, rcMsg } = extractRc(lines, i + 1);

    if (amount == null && (txType === "CASH_WITHDRAWAL" || txType === "PIN_CREATION")) {
      const fb = fallbackAmountFromRequest(lines, i);
      if (fb != null) {
        amount = fb;
        currency = currency || fileCurrency;
      }
    }

    if (amount == null) amount = 0;
    if (!currency) currency = fileCurrency;

    const status = normalizeStatus(rcCode, rcMsg);
    const raw = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 8)).join("\n");

    txs.push({
      id: Math.random().toString(36).slice(2, 11),
      date: dateStr,
      type: txType,
      amount,
      currency,
      status,
      rcCode: rcCode || undefined,
      rrn,
      terminalId,
      raw,
    });
  }

  return txs;
}

export function isWincorMultifunctionJournal(text) {
  return typeof text === "string" && WINCOR_MARK.test(text);
}
