"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import styles from "./about.module.css";
import {
  Activity,
  BarChart3,
  Brain,
  Shield,
  Upload,
  LineChart,
  Server,
  Lock,
  Zap,
  Target,
  Building2,
  FileSearch,
  PieChart,
  Users,
} from "lucide-react";

const SLIDE_COUNT = 6;
const barDemo = [
  { label: "Withdrawals", pct: 78, color: "#6366f1" },
  { label: "Inquiries", pct: 45, color: "#10b981" },
  { label: "Deposits", pct: 62, color: "#f59e0b" },
  { label: "Exceptions", pct: 22, color: "#ef4444" },
];

export default function AboutPage() {
  const deckRef = useRef(null);
  const slideRefs = useRef([]);
  const [active, setActive] = useState(0);
  const [barsOn, setBarsOn] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setBarsOn(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const onScroll = () => {
      const slides = slideRefs.current.filter(Boolean);
      const mid = el.scrollTop + el.clientHeight / 2;
      let idx = 0;
      slides.forEach((s, i) => {
        const top = s.offsetTop;
        const bottom = top + s.offsetHeight;
        if (mid >= top && mid < bottom) idx = i;
      });
      setActive(idx);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (i) => {
    const s = slideRefs.current[i];
    s?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={styles.root}>
      <div className={styles.progressDots} aria-hidden>
        {Array.from({ length: SLIDE_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.dot} ${active === i ? styles.dotActive : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Go to section ${i + 1}`}
          />
        ))}
      </div>

      <div className={styles.deck} ref={deckRef}>
        {/* Slide 1 — Title */}
        <section className={styles.slide} ref={(el) => { slideRefs.current[0] = el; }}>
          <div className={styles.slideInner}>
            <p className={styles.kicker}>Enterprise · ATM intelligence</p>
            <h1 className={styles.title}>ATM Analyzer Pro</h1>
            <p className={styles.subtitle}>
              The presentation-grade analytics layer your treasury, operations, and risk teams see in the boardroom —
              backed by a working product that ingests real JRN, CSV, and Excel feeds and turns them into decisions.
            </p>
            <div className={styles.heroVisual}>
              <div className={styles.heroCard}>
                <div className={styles.heroCardIcon}>
                  <Upload size={22} />
                </div>
                <h3>Ingest</h3>
                <p>Drop channel logs and core extracts without reformatting your entire data warehouse.</p>
              </div>
              <div className={styles.heroCard}>
                <div className={styles.heroCardIcon}>
                  <BarChart3 size={22} />
                </div>
                <h3>Understand</h3>
                <p>Volume, status mix, anomalies, and executive narratives in one coherent view.</p>
              </div>
              <div className={styles.heroCard}>
                <div className={styles.heroCardIcon}>
                  <Brain size={22} />
                </div>
                <h3>Act</h3>
                <p>A copilot answers follow-up questions so leaders leave with clarity, not another spreadsheet.</p>
              </div>
            </div>
            <div className={styles.ctaRow}>
              <Link href="/" className={styles.ctaPrimary}>
                <Activity size={18} /> Open live application
              </Link>
            </div>
          </div>
        </section>

        {/* Slide 2 — Problem */}
        <section className={styles.slide} ref={(el) => { slideRefs.current[1] = el; }}>
          <div className={styles.slideInner}>
            <p className={styles.kicker}>Why banks call us</p>
            <h2 className={styles.title}>Operational noise is expensive</h2>
            <div className={styles.grid2}>
              <div>
                <p className={styles.subtitle} style={{ marginBottom: "1rem" }}>
                  ATM fleets generate millions of lines across terminals, acquirers, and reconciliation batches. Most
                  institutions still bridge the gap with manual pivots and static decks that age the moment they are
                  emailed.
                </p>
                <ul className={styles.painList}>
                  <li>
                    <span className={styles.bulletDot} />
                    Risk and fraud see exceptions too late because signals sit inside raw logs.
                  </li>
                  <li>
                    <span className={styles.bulletDot} />
                    Branch and channel operations lack a single narrative the C-suite actually reads.
                  </li>
                  <li>
                    <span className={styles.bulletDot} />
                    Vendor black-box tools rarely align with your internal taxonomy or deployment policies.
                  </li>
                </ul>
              </div>
              <div className={styles.chartDemo}>
                <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Illustrative mix — your live dashboards mirror this polish on real data.
                </p>
                {barDemo.map((b) => (
                  <div key={b.label} className={styles.barRow}>
                    <span style={{ width: 100 }}>{b.label}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: barsOn ? `${b.pct}%` : "0%",
                          background: b.color,
                        }}
                      />
                    </div>
                    <span>{b.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Slide 3 — How it works */}
        <section className={styles.slide} ref={(el) => { slideRefs.current[2] = el; }}>
          <div className={styles.slideInner}>
            <p className={styles.kicker}>End-to-end flow</p>
            <h2 className={styles.title}>How ATM Analyzer Pro works</h2>
            <p className={styles.subtitle}>
              Four disciplined steps from file to insight — the same story your IT security reviewer and your CFO both
              need to hear.
            </p>
            <div className={styles.flowSteps}>
              <div className={styles.step}>
                <div className={styles.stepNum}>1</div>
                <div>
                  <h4>Secure upload</h4>
                  <p>
                    Analysts drag in JRN traces, CSV exports, or spreadsheets. Parsing normalizes heterogeneous columns
                    and log lines into a consistent transaction model in the browser session.
                  </p>
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>2</div>
                <div>
                  <h4>Deterministic analytics</h4>
                  <p>
                    Volume, type mix, status distribution, amount histograms, and rule-based anomaly flags are computed
                    immediately — so charts stay honest even before any model runs.
                  </p>
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>3</div>
                <div>
                  <h4>Deep analysis layer</h4>
                  <p>
                    A bank-tuned reasoning engine reads the same aggregates your dashboards show and produces executive
                    summaries, risk posture, deep-dive bullets, and recommendations aligned to your numbers.
                  </p>
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>4</div>
                <div>
                  <h4>Conversational copilot</h4>
                  <p>
                    Leaders ask follow-ups in plain language — exception drivers, concentration, operational hotspots —
                    grounded in the dataset you loaded, with tight context controls for production safety.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Slide 4 — Features */}
        <section className={styles.slide} ref={(el) => { slideRefs.current[3] = el; }}>
          <div className={styles.slideInner}>
            <p className={styles.kicker}>Capability map</p>
            <h2 className={styles.title}>Built for bank stakeholders</h2>
            <p className={styles.subtitle}>
              Every tile below maps to a screen or workflow in the live product — not vaporware slides.
            </p>
            <div className={styles.featureGrid}>
              <div className={styles.featureTile}>
                <h4>
                  <PieChart size={18} color="var(--primary)" /> Channel mix &amp; share
                </h4>
                <p>Donut and bar views with merged “Other” buckets so busy portfolios stay readable in committee packs.</p>
              </div>
              <div className={styles.featureTile}>
                <h4>
                  <LineChart size={18} color="var(--success)" /> Volume &amp; amount bands
                </h4>
                <p>See where cash movement concentrates across ticket sizes — ideal for liquidity and limit conversations.</p>
              </div>
              <div className={styles.featureTile}>
                <h4>
                  <Target size={18} color="var(--warning)" /> Anomaly surfacing
                </h4>
                <p>Parser-level flags plus model-generated narratives highlight reversals, failures, and outliers worth a second look.</p>
              </div>
              <div className={styles.featureTile}>
                <h4>
                  <FileSearch size={18} color="var(--accent)" /> Traceability
                </h4>
                <p>Raw snippets travel with flagged rows so investigators can jump from chart to log line without re-querying.</p>
              </div>
              <div className={styles.featureTile}>
                <h4>
                  <Shield size={18} color="var(--success)" /> Risk framing
                </h4>
                <p>Structured risk level, rationale, and remediation lists formatted the way audit and second-line expect.</p>
              </div>
              <div className={styles.featureTile}>
                <h4>
                  <Brain size={18} color="var(--primary)" /> Executive narrative
                </h4>
                <p>Key findings, deep-dive notes, and insight lists ready to drop into internal memos or steering packs.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Slide 5 — On-prem / fine-tuned */}
        <section className={styles.slide} ref={(el) => { slideRefs.current[4] = el; }}>
          <div className={styles.slideInner}>
            <p className={styles.kicker}>Deployment story</p>
            <h2 className={styles.title}>Your model. Your vault. Minimal metal.</h2>
            <p className={styles.subtitle}>
              ATM Analyzer Pro is designed around a proprietary, banking-specialized language stack that we fine-tune and
              operate for institutional workloads. For organizations that cannot send payloads to the public cloud, the
              same experience deploys on your network.
            </p>
            <div className={styles.deployBox}>
              <p>
                <span className={styles.deployHighlight}>In-house inference option:</span> run the full stack — parsers,
                analytics engine, and our compact banking-tuned model — on a modest GPU footprint or CPU-optimized nodes.
                You keep keys, data, and audit trails inside your perimeter while still receiving board-ready outputs.
              </p>
              <p>
                <span className={styles.deployHighlight}>Air-gapped friendly:</span> ideal for groups modernizing ATM
                oversight without ripping out legacy hosts, and for regions with strict data-sovereignty rules.
              </p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                The public demo showcases the interaction model; production rollouts pair it with your identity stack,
                SIEM hooks, and change-management process.
              </p>
            </div>
            <div className={styles.heroVisual} style={{ marginTop: "2rem" }}>
              <div className={styles.heroCard}>
                <div className={styles.heroCardIcon}>
                  <Server size={22} />
                </div>
                <h3>Compact footprint</h3>
                <p>Thoughtful batching and context shaping keep inference efficient on everyday bank hardware.</p>
              </div>
              <div className={styles.heroCard}>
                <div className={styles.heroCardIcon}>
                  <Lock size={22} />
                </div>
                <h3>Data sovereignty</h3>
                <p>No requirement to mirror sensitive journals in external SaaS when you choose on-prem delivery.</p>
              </div>
              <div className={styles.heroCard}>
                <div className={styles.heroCardIcon}>
                  <Zap size={22} />
                </div>
                <h3>Fast time-to-value</h3>
                <p>Start from files your teams already produce — no multi-year core project required for first insights.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Slide 6 — CTA */}
        <section className={styles.slide} ref={(el) => { slideRefs.current[5] = el; }}>
          <div className={styles.slideInner}>
            <p className={styles.kicker}>Next step</p>
            <h2 className={styles.title}>See the working product today</h2>
            <p className={styles.subtitle}>
              Load a sample extract, walk through Deep Analysis, and stress-test the copilot with the questions your
              steering committee would actually ask.
            </p>
            <div className={styles.ctaRow}>
              <Link href="/" className={styles.ctaPrimary}>
                <Building2 size={18} /> Launch ATM Analyzer Pro
              </Link>
              <Link href="/" className={styles.ctaSecondary}>
                <Users size={18} /> Book an architecture walkthrough
              </Link>
            </div>
            <p style={{ marginTop: "2rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              ATM Analyzer Pro — intelligent ATM transaction intelligence for modern financial institutions.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
