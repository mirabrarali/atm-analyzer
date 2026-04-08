"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./jrn-format.module.css";
import { parseWincorJrn, isWincorMultifunctionJournal } from "@/lib/wincorJrn";
import { inferMajorityCurrency } from "@/lib/currencyFormat";
import { FileText, Play, BookOpen, ArrowRight } from "lucide-react";

export default function JrnFormatPage() {
  const [text, setText] = useState("");

  const result = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const wincor = isWincorMultifunctionJournal(text);
      const rows = wincor ? parseWincorJrn(text) : [];
      const cc = rows.length ? inferMajorityCurrency(rows) : null;
      const types = {};
      for (const r of rows) {
        types[r.type] = (types[r.type] || 0) + 1;
      }
      return { wincor, rows, cc, types };
    } catch (e) {
      return { error: e?.message || "Parse error" };
    }
  }, [text]);

  return (
    <div className={styles.wrap}>
      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
        <BookOpen size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
        Simple guide · no jargon required
      </p>
      <h1 style={{ marginTop: 0 }}>What is inside a JRN file?</h1>

      <p className={styles.lead}>
        Think of a <strong>JRN</strong> (journal) file as a <strong>diary of one ATM</strong>. Every time someone
        inserts a card, enters a PIN, asks for cash, or checks a balance, the machine writes lines of text into this
        file. It is not a neat spreadsheet — it is a <strong>long text log</strong> with timestamps, codes, and
        sometimes several lines for a single transaction.
      </p>

      <div className={styles.box}>
        <h3>What we saw in Wincor-style journals (like your sample)</h3>
        <ul className={styles.list}>
          <li>
            <strong>Blocks</strong> separated by a banner line (e.g. multifunction terminal header).
          </li>
          <li>
            <strong>RRN + terminal</strong> — a reference number and terminal ID that mark one customer-facing
            outcome.
          </li>
          <li>
            <strong>Amount + currency</strong> — e.g. <code>OMR15.000</code> (Omani rial), sometimes on the same line as
            a masked card number.
          </li>
          <li>
            <strong>Result code</strong> — e.g. <code>RC: 00 - APPROVED</code> or failure messages from the network.
          </li>
          <li>
            <strong>Transaction type</strong> — e.g. cash withdrawal, balance inquiry, PIN change — usually a few lines
            above the RRN block.
          </li>
        </ul>
      </div>

      <p className={styles.lead}>
        <strong>ATM Analyzer Pro</strong> does not read the file “line by line” as if each line were one payment. It
        first <strong>finds those RRN blocks</strong>, then pulls amount, currency, approval, and type from the right
        lines. That is why the same logic powers the main app’s charts and AI summaries.
      </p>

      <h2 style={{ marginTop: "2rem" }}>Try the extractor (rough preview)</h2>
      <p className={styles.note}>
        Paste a piece of your <code>.jrn</code> file below and click Extract. You will see how many transactions we
        detect, which currency dominates, and a small table — the same structure the analyzer uses internally.
      </p>

      <textarea
        className={`${styles.textarea} glass-panel`}
        placeholder="Paste journal text here (can include WINCOR sections, RRN lines, OMR amounts)…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={() => setText((t) => t.trim())}>
          <Play size={16} /> Run extract on text above
        </button>
        <Link href="/" className="btn btn-outline">
          Open full ATM Analyzer <ArrowRight size={16} />
        </Link>
      </div>

      {result?.error && (
        <p style={{ color: "var(--danger)" }}>{result.error}</p>
      )}

      {result && text.trim() && !result.error && (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Wincor-style?</div>
              <div className={styles.statValue}>{result.wincor ? "Yes" : "No"}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Records found</div>
              <div className={styles.statValue}>{result.rows?.length ?? 0}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Dominant currency</div>
              <div className={styles.statValue} style={{ fontSize: "1rem" }}>
                {result.cc || "—"}
              </div>
            </div>
          </div>

          {!result.wincor && (
            <p className={styles.note}>
              This paste does not look like a Wincor multifunction journal. The table may be empty; the main app still
              supports other JRN patterns and CSV/Excel.
            </p>
          )}

          {result.rows?.length > 0 && (
            <>
              <p className={styles.note}>
                <strong>Type mix (quick):</strong>{" "}
                {Object.entries(result.types || {})
                  .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                  .join(" · ")}
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>CCY</th>
                      <th>Status</th>
                      <th>RRN</th>
                      <th>Terminal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 40).map((r) => (
                      <tr key={r.id}>
                        <td>{String(r.type).replace(/_/g, " ")}</td>
                        <td>{r.amount}</td>
                        <td>{r.currency || "—"}</td>
                        <td>{r.status}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.72rem" }}>{r.rrn}</td>
                        <td>{r.terminalId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.rows.length > 40 && (
                <p className={styles.note}>Showing first 40 of {result.rows.length} rows.</p>
              )}
            </>
          )}
        </>
      )}

      <div className={styles.box} style={{ marginTop: "2.5rem" }}>
        <h3>
          <FileText size={16} style={{ verticalAlign: "middle", marginRight: 8 }} />
          Developers: inspect a file from the command line
        </h3>
        <p className={styles.note} style={{ marginTop: "0.5rem" }}>
          From the project folder, run:
        </p>
        <pre
          style={{
            background: "var(--background)",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.8rem",
            overflow: "auto",
            border: "1px solid var(--border)",
          }}
        >
          npm run inspect:jrn -- &quot;C:/path/to/your/file.jrn&quot;
        </pre>
        <p className={styles.note}>
          It prints whether the file looks like Wincor, how many transactions were parsed, and a JSON sample — useful to
          verify what is inside before loading the full app.
        </p>
      </div>
    </div>
  );
}
