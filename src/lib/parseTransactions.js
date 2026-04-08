import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { inferMajorityCurrency } from './currencyFormat';
import { isWincorMultifunctionJournal, parseWincorJrn } from './wincorJrn';

const DATE_KEYS = [
  'date', 'datetime', 'timestamp', 'time', 'txn_date', 'transactiondate', 'postingdate',
  'valuedate', 'dt', 'tran_date',
];
const TYPE_KEYS = [
  'type', 'transactiontype', 'tran_type', 'txn_type', 'operation', 'transtype', 'desc',
  'description', 'category', 'tran_code', 'transaction_code',
];
const AMOUNT_KEYS = [
  'amount', 'value', 'amt', 'debit', 'credit', 'cash', 'dispensed', 'withdrawal',
  'transactionamount', 'tran_amount', 'net_amount',
];
const STATUS_KEYS = ['status', 'result', 'response', 'outcome', 'resp', 'rc', 'responsecode'];
const CURRENCY_KEYS = ['currency', 'ccy', 'curr', 'transactioncurrency', 'isocurrency', 'iso_currency'];

function normalizeKey(k) {
  return String(k || '')
    .toLowerCase()
    .replace(/[\s_\-]/g, '');
}

function findValue(row, keyList) {
  const entries = Object.entries(row || {});
  const normalized = new Map(entries.map(([k, v]) => [normalizeKey(k), v]));
  for (const cand of keyList) {
    const nk = normalizeKey(cand);
    if (normalized.has(nk)) {
      const v = normalized.get(nk);
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  for (const [k, v] of entries) {
    const nk = normalizeKey(k);
    for (const cand of keyList) {
      if (nk.includes(normalizeKey(cand)) || normalizeKey(cand).includes(nk)) {
        if (v !== undefined && v !== null && v !== '') return v;
      }
    }
  }
  return undefined;
}

function parseAmountValue(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  let s = String(raw).trim();
  if (!s) return 0;
  s = s.replace(/[\$£€\s]/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma && !hasDot) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) s = parts[0] + '.' + parts[1];
    else s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function mapTabularRow(row) {
  const dateVal = findValue(row, DATE_KEYS) ?? row.Date ?? row.date ?? '';
  const typeVal = findValue(row, TYPE_KEYS) ?? row.Type ?? row.type ?? 'UNKNOWN';
  const amountVal = findValue(row, AMOUNT_KEYS) ?? row.Amount ?? row.amount ?? row.Value ?? 0;
  const statusVal = findValue(row, STATUS_KEYS) ?? row.Status ?? row.status ?? 'SUCCESS';
  const curVal = findValue(row, CURRENCY_KEYS) ?? row.Currency ?? row.currency ?? '';
  const st = String(statusVal || 'SUCCESS').trim().toUpperCase() || 'SUCCESS';
  const ccy =
    curVal && String(curVal).trim().length >= 3
      ? String(curVal).trim().toUpperCase().slice(0, 3)
      : undefined;
  return {
    id: Math.random().toString(36).substr(2, 9),
    date: dateVal !== undefined && dateVal !== null ? String(dateVal) : '',
    type: String(typeVal || 'UNKNOWN').trim() || 'UNKNOWN',
    amount: parseAmountValue(amountVal),
    status: st,
    ...(ccy ? { currency: ccy } : {}),
    raw: JSON.stringify(row),
  };
}

const JRN_TYPES =
  /(WITHDRAWAL|DEPOSIT|INQUIRY|INQUIRY\s*REQUEST|TRANSFER|BALANCE|DISPENSE|CASH_IN|CASH\s*OUT|PAYMENT|REFUND|REVERSAL|PIN\s*CHANGE|ACCOUNT\s*INQUIRY|FAST\s*CASH)/i;
const JRN_STATUS = /(SUCCESS|FAILED|REJECTED|REVERSAL|TIMEOUT|ERROR|DENIED|DECLINED|APPROVED|OK|COMPLETE)/i;

function parseJrnLine(line) {
  const amountMatch =
    line.match(/[\$£€]?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))\b/) ||
    line.match(/\b(?:AMT|AMOUNT|VALUE)[\s:=]+[\$£€]?\s*([0-9]+[.,]?[0-9]*)\b/i);
  let amt = 0;
  if (amountMatch) {
    amt = parseAmountValue(amountMatch[1]);
  } else {
    const intMatch = line.match(/\b(?:AMT|AMOUNT)[\s:=]+\s*([0-9]+)\b/i);
    if (intMatch) amt = parseFloat(intMatch[1]);
  }

  let currency;
  const isoAmt = line.match(/\b([A-Z]{3})\s*([0-9]+(?:\.[0-9]+)?)\b/);
  if (isoAmt && !['TVR', 'TSI', 'RRN', 'AID', 'EMV'].includes(isoAmt[1])) {
    currency = isoAmt[1];
    if (!amt) amt = parseFloat(isoAmt[2]);
  }

  const typeMatch = line.match(JRN_TYPES);
  let type = typeMatch ? typeMatch[1].toUpperCase().replace(/\s+/g, '_') : 'UNKNOWN';

  const statusMatch = line.match(JRN_STATUS);
  let status = statusMatch ? statusMatch[1].toUpperCase() : 'SUCCESS';
  if (['APPROVED', 'OK', 'COMPLETE'].includes(status)) status = 'SUCCESS';

  const dateMatch = line.match(
    /\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?|\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?|\d{2}-\d{2}-\d{4})\b/
  );
  const date = dateMatch ? dateMatch[1] : '';

  const termMatch = line.match(/\b(?:TERM|TERMINAL|ATM|ATMID|DEVICE)[\s#:=]+([A-Z0-9\-]{4,})\b/i);
  const terminal = termMatch ? termMatch[1] : '';

  return {
    id: Math.random().toString(36).substr(2, 9),
    date,
    type,
    amount: amt,
    status,
    ...(currency ? { currency } : {}),
    raw: terminal ? `${line} [TERM:${terminal}]` : line,
  };
}

/**
 * Parses uploaded files (CSV, Excel, JRN/TXT) into a normalized transaction array.
 * Returns: { name, type, data: [{ id, date, type, amount, status, raw }], rawText?, rawLength }
 */
export const parseFileContent = (file) => {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet);
          const parsed = rows.map((row) => mapTabularRow(row));
          const fc = inferMajorityCurrency(parsed);
          resolve({
            name: file.name,
            type: 'EXCEL',
            data: parsed,
            rawLength: JSON.stringify(rows).length,
            fileCurrency: fc,
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;

          if (ext === 'csv') {
            Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                const parsed = results.data.map((row) => mapTabularRow(row));
                const fc = inferMajorityCurrency(parsed);
                resolve({
                  name: file.name,
                  type: 'CSV',
                  data: parsed,
                  rawLength: text.length,
                  fileCurrency: fc,
                });
              },
              error: reject,
            });
          } else if (isWincorMultifunctionJournal(text)) {
            const parsed = parseWincorJrn(text);
            const fc = inferMajorityCurrency(parsed);
            resolve({
              name: file.name,
              type: 'JRN (Wincor)',
              data: parsed,
              rawText: text,
              rawLength: text.length,
              fileCurrency: fc,
            });
          } else {
            const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
            const parsed = lines.map((line) => parseJrnLine(line));
            const fc = inferMajorityCurrency(parsed);
            resolve({
              name: file.name,
              type: 'JRN/TXT',
              data: parsed,
              rawText: text,
              rawLength: text.length,
              ...(fc && fc !== 'USD' ? { fileCurrency: fc } : {}),
            });
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    }
  });
};
