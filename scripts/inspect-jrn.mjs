#!/usr/bin/env node
/**
 * Inspect a .jrn file using the same Wincor parser as the web app.
 * Usage: npm run inspect:jrn -- "C:/path/to/file.jrn"
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const { parseWincorJrn, isWincorMultifunctionJournal } = await import(
  pathToFileURL(join(root, "src/lib/wincorJrn.js")).href
);
const { inferMajorityCurrency } = await import(pathToFileURL(join(root, "src/lib/currencyFormat.js")).href);

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npm run inspect:jrn -- <path-to-file.jrn>");
  process.exit(1);
}
if (!existsSync(filePath)) {
  console.error("File not found:", filePath);
  process.exit(1);
}

const text = readFileSync(filePath, "utf8");
const lines = text.split(/\r?\n/).length;
const bytes = Buffer.byteLength(text, "utf8");

console.log("--- File ---");
console.log("Path:", filePath);
console.log("Lines:", lines, "· Bytes:", bytes);
console.log("Wincor multifunction journal:", isWincorMultifunctionJournal(text) ? "yes" : "no");

const rows = parseWincorJrn(text);
const cc = inferMajorityCurrency(rows);

console.log("--- Parsed transactions ---");
console.log("Count:", rows.length);
console.log("Dominant currency:", cc);

const types = {};
for (const r of rows) {
  types[r.type] = (types[r.type] || 0) + 1;
}
console.log("Types:", types);

console.log("--- First 5 records (sample) ---");
console.log(JSON.stringify(rows.slice(0, 5), null, 2));
