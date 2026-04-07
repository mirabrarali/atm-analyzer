"use client";

import { useState, useRef, useMemo } from "react";
import {
  UploadCloud, FileText, PieChart, MessageSquare, Activity,
  ShieldAlert, CheckCircle2, AlertTriangle, TrendingUp,
  BarChart3, Zap, Eye, Trash2, Loader2, Send, ChevronRight,
  Shield, Database, Brain, Clock
} from "lucide-react";
import { parseFileContent } from "@/lib/parseTransactions";
import { computeTransactionInsights } from "@/lib/transactionInsights";
import {
  PieChart as RePieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid
} from "recharts";

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Home() {
  const [activeTab, setActiveTab] = useState("upload");
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoadingQA, setIsLoadingQA] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const processFiles = async (fileList) => {
    for (let i = 0; i < fileList.length; i++) {
      try {
        const parsed = await parseFileContent(fileList[i]);
        setFiles((prev) => [...prev, parsed]);
      } catch (e) {
        console.error("Parse error:", e);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length) processFiles(e.target.files);
  };

  const selectFileAndAnalyze = async (file) => {
    setActiveFile(file);
    setAiAnalysis(null);
    setAnalysisError(null);
    setActiveTab("dashboard");
    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: file.data, fileName: file.name }),
      });
      const result = await res.json();
      if (!res.ok) {
        setAiAnalysis(null);
        setAnalysisError(result.error || `Analysis failed (${res.status})`);
        return;
      }
      if (result.error && !result.analysis) {
        setAiAnalysis(null);
        setAnalysisError(result.error);
        return;
      }
      setAnalysisError(null);
      setAiAnalysis(result.analysis || null);
    } catch (e) {
      console.error("Analysis error:", e);
      setAiAnalysis(null);
      setAnalysisError(e?.message || "Network error calling analysis API.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const removeFile = (idx) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (activeFile?.name === prev[idx]?.name) {
        setActiveFile(next[0] || null);
        setAiAnalysis(null);
        setAnalysisError(null);
      }
      return next;
    });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeFile) return;
    const msg = { role: "user", content: chatInput };
    setChatMessages((prev) => [...prev, msg]);
    setChatInput("");
    setIsLoadingQA(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg.content,
          history: chatMessages,
          context: activeFile.data.slice(0, 150),
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "No response received." },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setIsLoadingQA(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const insights = useMemo(
    () => (activeFile?.data ? computeTransactionInsights(activeFile.data) : null),
    [activeFile]
  );

  const riskColor = {
    LOW: "var(--success)",
    MEDIUM: "var(--warning)",
    HIGH: "var(--danger)",
  };

  return (
    <div className="app-container">
      {/* ─── Sidebar ─── */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-icon"><Activity size={20} color="white" /></div>
          {!sidebarCollapsed && <span className="brand-text">ATM Analyzer<span className="brand-pro">PRO</span></span>}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {[
            { id: "upload", icon: <Database size={18} />, label: "File Management" },
            { id: "dashboard", icon: <BarChart3 size={18} />, label: "Deep Analysis" },
            { id: "qa", icon: <Brain size={18} />, label: "AI Copilot" },
          ].map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
              {activeTab === item.id && !sidebarCollapsed && <ChevronRight size={14} className="nav-arrow" />}
            </button>
          ))}
        </nav>

        {/* Files List */}
        {!sidebarCollapsed && (
          <div className="sidebar-files">
            <div className="files-header">
              <FileText size={14} />
              <span>Documents ({files.length})</span>
            </div>
            {files.length === 0 ? (
              <p className="files-empty">No files uploaded yet</p>
            ) : (
              <ul className="files-list">
                {files.map((f, idx) => (
                  <li
                    key={idx}
                    className={`file-item ${activeFile?.name === f.name ? "active" : ""}`}
                  >
                    <button className="file-btn" onClick={() => selectFileAndAnalyze(f)}>
                      <FileText size={14} />
                      <span className="file-name">{f.name}</span>
                      <span className="file-badge">{f.data.length}</span>
                    </button>
                    <button className="file-delete" onClick={() => removeFile(idx)} title="Remove">
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <Shield size={14} color="var(--success)" />
          {!sidebarCollapsed && <span>Secure Session Active</span>}
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="main-content">
        {/* Header */}
        <header className="main-header">
          <div>
            <h1 className="header-title">
              {activeTab === "upload" && "File Management System"}
              {activeTab === "dashboard" && "Intelligent Analytics"}
              {activeTab === "qa" && "AI Financial Copilot"}
            </h1>
            <p className="header-sub">
              {activeTab === "upload" && "Upload and manage ATM transaction datasets"}
              {activeTab === "dashboard" && "AI-powered deep analysis of transaction patterns"}
              {activeTab === "qa" && "Ask questions about your financial data in natural language"}
            </p>
          </div>
          {activeFile && (
            <div className="active-file-badge">
              <div className="pulse-dot" />
              <span>{activeFile.name}</span>
            </div>
          )}
        </header>

        <div className="content-area">
          {/* ═══ FILE MANAGEMENT TAB ═══ */}
          {activeTab === "upload" && (
            <div className="fade-in">
              <input
                type="file"
                multiple
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".csv,.jrn,.txt,.xls,.xlsx"
              />

              <div
                className={`upload-zone ${isDragging ? "dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <div className="upload-icon-wrap">
                  <UploadCloud size={48} />
                </div>
                <h2>Upload Transaction Data</h2>
                <p>Drag & drop JRN, CSV, or Excel files here</p>
                <button className="btn btn-primary upload-btn">
                  <UploadCloud size={16} /> Select Files
                </button>
                <div className="upload-formats">
                  {["JRN", "CSV", "XLSX", "XLS", "TXT"].map((fmt) => (
                    <span key={fmt} className="format-tag">{fmt}</span>
                  ))}
                </div>
              </div>

              {files.length > 0 && (
                <div className="files-table-wrap fade-in">
                  <h3 className="section-title"><Database size={18} /> Uploaded Documents</h3>
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Type</th>
                        <th>Records</th>
                        <th>Size</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((f, idx) => (
                        <tr key={idx} className={activeFile?.name === f.name ? "active-row" : ""}>
                          <td>
                            <div className="file-cell">
                              <FileText size={16} color="var(--primary)" />
                              <span>{f.name}</span>
                            </div>
                          </td>
                          <td><span className="type-badge">{f.type}</span></td>
                          <td>{f.data.length.toLocaleString()}</td>
                          <td>{(f.rawLength / 1024).toFixed(1)} KB</td>
                          <td>
                            <div className="action-btns">
                              <button className="btn btn-primary btn-sm" onClick={() => selectFileAndAnalyze(f)}>
                                <Eye size={14} /> Analyze
                              </button>
                              <button className="btn btn-outline btn-sm btn-danger-outline" onClick={() => removeFile(idx)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ DASHBOARD TAB ═══ */}
          {activeTab === "dashboard" && (
            <div className="fade-in">
              {!activeFile ? (
                <div className="empty-state">
                  <ShieldAlert size={56} color="var(--warning)" />
                  <h3>No Dataset Selected</h3>
                  <p>Upload and select a transaction file to unlock AI-powered analytics.</p>
                  <button className="btn btn-primary" onClick={() => setActiveTab("upload")}>
                    <UploadCloud size={16} /> Go to Uploads
                  </button>
                </div>
              ) : (
                <>
                  {/* AI Analysis Banner */}
                  {isAnalyzing && (
                    <div className="analysis-banner">
                      <Loader2 size={20} className="spin" />
                      <span>AI is analyzing <strong>{activeFile.name}</strong> — generating insights...</span>
                    </div>
                  )}

                  {analysisError && (
                    <div className="analysis-banner" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}>
                      <ShieldAlert size={20} color="var(--danger)" />
                      <span>{analysisError}</span>
                    </div>
                  )}

                  {/* KPI Cards */}
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-icon" style={{ background: "rgba(99,102,241,0.15)", color: "var(--primary)" }}>
                        <BarChart3 size={22} />
                      </div>
                      <div className="kpi-data">
                        <span className="kpi-label">Total Records</span>
                        <span className="kpi-value">{(aiAnalysis?.totalTransactions || insights?.totalTx || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-icon" style={{ background: "rgba(16,185,129,0.15)", color: "var(--success)" }}>
                        <TrendingUp size={22} />
                      </div>
                      <div className="kpi-data">
                        <span className="kpi-label">Transaction Volume</span>
                        <span className="kpi-value">${(aiAnalysis?.totalVolume || insights?.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-icon" style={{ background: "rgba(239,68,68,0.15)", color: "var(--danger)" }}>
                        <AlertTriangle size={22} />
                      </div>
                      <div className="kpi-data">
                        <span className="kpi-label">Anomalies Detected</span>
                        <span className="kpi-value" style={{ color: "var(--danger)" }}>{aiAnalysis?.anomalyCount ?? insights?.anomalies ?? 0}</span>
                      </div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-icon" style={{ background: "rgba(139,92,246,0.15)", color: "var(--accent)" }}>
                        <Zap size={22} />
                      </div>
                      <div className="kpi-data">
                        <span className="kpi-label">Avg. Amount</span>
                        <span className="kpi-value">${(aiAnalysis?.avgTransactionAmount || (insights?.totalValue / Math.max(insights?.totalTx || 1, 1)) || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {insights?.deepBullets?.length > 0 && (
                    <div className="glass-panel insight-summary" style={{ marginBottom: "1.5rem" }}>
                      <h3><Database size={18} /> Data-driven summary (parsed file)</h3>
                      <p className="summary-text" style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                        Derived from every row after CSV / Excel / JRN normalization — visible even while AI is loading or if the API is unavailable.
                      </p>
                      <ul className="insight-list">
                        {insights.deepBullets.map((line, i) => (
                          <li key={i}><CheckCircle2 size={14} color="var(--primary)" /> {line}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Summary + Risk + Deep dive */}
                  {aiAnalysis && (
                    <>
                      <div className="insight-row">
                        <div className="glass-panel insight-summary">
                          <h3><Brain size={18} /> AI Executive Summary</h3>
                          <p className="summary-text">{aiAnalysis.summary}</p>
                          {aiAnalysis.keyFindings?.length > 0 && (
                            <>
                              <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Key findings</h4>
                              <ul className="insight-list">
                                {aiAnalysis.keyFindings.map((k, i) => (
                                  <li key={i}><Zap size={14} color="var(--warning)" /> {k}</li>
                                ))}
                              </ul>
                            </>
                          )}
                          {aiAnalysis.insights?.length > 0 && (
                            <>
                              <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Business insights</h4>
                              <ul className="insight-list">
                                {aiAnalysis.insights.map((ins, i) => (
                                  <li key={i}><CheckCircle2 size={14} color="var(--success)" /> {ins}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                        <div className="glass-panel risk-panel">
                          <h3><Shield size={18} /> Risk Assessment</h3>
                          <div className="risk-badge" style={{ background: riskColor[aiAnalysis.riskLevel] || "var(--text-muted)" }}>
                            {aiAnalysis.riskLevel || "N/A"}
                          </div>
                          <p className="risk-explanation">{aiAnalysis.riskExplanation}</p>
                          {aiAnalysis.recommendations?.length > 0 && (
                            <>
                              <h4 style={{ marginTop: "1rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-muted)" }}>Recommendations</h4>
                              <ul className="rec-list">
                                {aiAnalysis.recommendations.map((rec, i) => (
                                  <li key={i}><ChevronRight size={12} /> {rec}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </div>
                      {aiAnalysis.deepDiveNotes?.length > 0 && (
                        <div className="glass-panel insight-summary" style={{ marginBottom: "1.5rem" }}>
                          <h3><Eye size={18} /> AI deep analysis</h3>
                          <ul className="insight-list">
                            {aiAnalysis.deepDiveNotes.map((note, i) => (
                              <li key={i}><MessageSquare size={14} color="var(--accent)" /> {note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  {/* Charts */}
                  <div className="charts-grid">
                    <div className="glass-panel chart-panel">
                      <h3>Transaction types (share of events)</h3>
                      <div style={{ height: "300px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={aiAnalysis?.transactionBreakdown || insights?.typeData || []}
                              cx="50%" cy="50%"
                              innerRadius={58} outerRadius={100}
                              paddingAngle={3} dataKey="value"
                              animationBegin={0} animationDuration={800}
                              labelLine={false}
                              label={({ name, percent }) =>
                                (percent ?? 0) > 0.04 ? `${String(name).slice(0, 14)} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                              }
                            >
                              {(aiAnalysis?.transactionBreakdown || insights?.typeData || []).map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: "var(--surface-primary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }} />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-legend">
                        {(aiAnalysis?.transactionBreakdown || insights?.typeData || []).map((entry, i) => (
                          <div key={i} className="legend-item">
                            <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                            <span>{entry.name}</span>
                            <span className="legend-val">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass-panel chart-panel">
                      <h3>Status distribution</h3>
                      <div style={{ height: "300px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aiAnalysis?.statusBreakdown || insights?.statusData || []} barCategoryGap="18%">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={56} />
                            <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ background: "var(--surface-primary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
                              {(aiAnalysis?.statusBreakdown || insights?.statusData || []).map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="charts-grid">
                    <div className="glass-panel chart-panel">
                      <h3>Volume by type (USD)</h3>
                      <div style={{ height: "280px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={insights?.volumeByTypeData || []} layout="vertical" margin={{ left: 8, right: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal />
                            <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `$${v}`} />
                            <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={11} width={100} />
                            <Tooltip contentStyle={{ background: "var(--surface-primary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }} formatter={(v) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Volume"]} />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800}>
                              {(insights?.volumeByTypeData || []).map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="glass-panel chart-panel">
                      <h3>Amount buckets (count of transactions)</h3>
                      <div style={{ height: "280px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={insights?.amountBuckets || []}>
                            <defs>
                              <linearGradient id="amtFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: "var(--surface-primary)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)" }} />
                            <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#amtFill)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Anomaly Details */}
                  {aiAnalysis?.anomalyDetails?.length > 0 && (
                    <div className="glass-panel anomaly-panel fade-in">
                      <h3><AlertTriangle size={18} color="var(--warning)" /> AI-flagged anomalies</h3>
                      <div className="anomaly-list">
                        {aiAnalysis.anomalyDetails.map((detail, i) => (
                          <div key={i} className="anomaly-item">
                            <ShieldAlert size={14} color="var(--danger)" />
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!aiAnalysis?.anomalyDetails?.length && insights?.flaggedSamples?.length > 0 && (
                    <div className="glass-panel anomaly-panel fade-in">
                      <h3><AlertTriangle size={18} color="var(--warning)" /> Parser-highlighted rows</h3>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 0.75rem" }}>
                        Rows with non-success status, UNKNOWN type, or extreme amounts vs. the dataset mean.
                      </p>
                      <div className="anomaly-list">
                        {insights.flaggedSamples.map((row, i) => (
                          <div key={i} className="anomaly-item">
                            <ShieldAlert size={14} color="var(--danger)" />
                            <span>
                              <strong>{row.type}</strong> · {row.status} · ${Number(row.amount).toFixed(2)}
                              {row.snippet ? ` — ${row.snippet}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══ Q&A TAB ═══ */}
          {activeTab === "qa" && (
            <div className="fade-in chat-container">
              <div className="chat-header-bar">
                <Brain size={20} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0 }}>AI Financial Copilot</h3>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Groq (Llama 3.1 instant) · Querying: {activeFile ? activeFile.name : "No file selected"}
                  </p>
                </div>
              </div>

              <div className="chat-messages">
                <div className="chat-bubble assistant">
                  <div className="bubble-role"><Brain size={12} /> AI COPILOT</div>
                  <p>
                    {activeFile
                      ? `I've loaded **${activeFile.name}** with ${activeFile.data.length} records. Ask me anything — transaction summaries, anomaly deep-dives, trend analysis, or compliance checks.`
                      : "Welcome! Please upload a document first, then I can analyze your ATM transaction data in depth."}
                  </p>
                </div>

                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-bubble ${msg.role}`}>
                    <div className="bubble-role">
                      {msg.role === "user" ? "YOU" : <><Brain size={12} /> AI COPILOT</>}
                    </div>
                    <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                  </div>
                ))}

                {isLoadingQA && (
                  <div className="chat-bubble assistant">
                    <div className="typing-indicator">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-bar">
                <input
                  type="text"
                  placeholder={activeFile ? "Ask about transactions, anomalies, trends..." : "Upload a file first..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={!activeFile || isLoadingQA}
                />
                <button
                  className="btn btn-primary send-btn"
                  onClick={handleSendMessage}
                  disabled={!activeFile || isLoadingQA || !chatInput.trim()}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        /* ── Sidebar ── */
        .sidebar { width: 300px; background: var(--surface-primary); border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: width 0.3s ease; }
        .sidebar.collapsed { width: 72px; }
        .sidebar-brand { padding: 1.25rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 0.75rem; }
        .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .brand-text { font-size: 1.15rem; font-weight: 700; color: #fff; }
        .brand-pro { font-size: 0.65rem; background: var(--primary); padding: 2px 6px; border-radius: 4px; margin-left: 6px; vertical-align: middle; }
        .sidebar-nav { padding: 0.75rem 0; display: flex; flex-direction: column; gap: 2px; }
        .nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 1.25rem; width: 100%; border: none; background: transparent; color: var(--text-muted); font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.15s ease; text-align: left; position: relative; }
        .nav-item:hover { background: var(--surface-hover); color: var(--foreground); }
        .nav-item.active { background: rgba(99,102,241,0.1); color: var(--primary); }
        .nav-item.active::before { content: ''; position: absolute; left: 0; top: 4px; bottom: 4px; width: 3px; border-radius: 0 3px 3px 0; background: var(--primary); }
        .nav-arrow { margin-left: auto; opacity: 0.5; }
        .sidebar-files { padding: 1rem 1.25rem; border-top: 1px solid var(--border); flex: 1; overflow-y: auto; }
        .files-header { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 0.75rem; }
        .files-empty { font-size: 0.8rem; color: var(--text-muted); }
        .files-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
        .file-item { display: flex; align-items: center; border-radius: var(--radius-sm); transition: all 0.15s ease; }
        .file-item.active { background: rgba(99,102,241,0.08); }
        .file-item:hover { background: var(--surface-hover); }
        .file-btn { flex: 1; display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: none; border: none; color: var(--foreground); font-size: 0.82rem; cursor: pointer; font-family: var(--font-sans); text-align: left; min-width: 0; }
        .file-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .file-badge { font-size: 0.7rem; background: var(--surface-secondary); padding: 1px 6px; border-radius: 10px; color: var(--text-muted); flex-shrink: 0; }
        .file-delete { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.4rem; border-radius: 4px; flex-shrink: 0; opacity: 0; transition: all 0.15s ease; }
        .file-item:hover .file-delete { opacity: 1; }
        .file-delete:hover { color: var(--danger); background: rgba(239,68,68,0.1); }
        .sidebar-footer { padding: 1rem 1.25rem; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem; }

        /* ── Header ── */
        .main-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; backdrop-filter: blur(8px); position: sticky; top: 0; z-index: 10; background: rgba(15,17,24,0.8); }
        .header-title { margin: 0; font-size: 1.4rem; }
        .header-sub { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-muted); }
        .active-file-badge { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; background: var(--surface-primary); padding: 0.4rem 1rem; border-radius: 2rem; border: 1px solid var(--border); }
        .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ── Content ── */
        .content-area { padding: 2rem; flex: 1; overflow-y: auto; }

        /* Upload Zone */
        .upload-zone { padding: 4rem 2rem; text-align: center; border: 2px dashed var(--border); border-radius: var(--radius-lg); background: var(--surface-primary); cursor: pointer; transition: all 0.25s ease; }
        .upload-zone:hover, .upload-zone.dragging { border-color: var(--primary); background: rgba(99,102,241,0.04); transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
        .upload-icon-wrap { width: 80px; height: 80px; margin: 0 auto 1.5rem; border-radius: 50%; background: rgba(99,102,241,0.1); display: flex; align-items: center; justify-content: center; color: var(--primary); }
        .upload-zone h2 { margin: 0 0 0.5rem; font-size: 1.3rem; }
        .upload-zone p { margin: 0; font-size: 0.9rem; }
        .upload-btn { margin-top: 1.5rem; }
        .upload-formats { margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.5rem; }
        .format-tag { font-size: 0.7rem; padding: 3px 10px; border-radius: 4px; background: var(--surface-secondary); color: var(--text-muted); font-weight: 500; }

        /* Files Table */
        .files-table-wrap { margin-top: 2rem; }
        .section-title { display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; margin-bottom: 1rem; }
        .files-table { width: 100%; border-collapse: separate; border-spacing: 0; background: var(--surface-primary); border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border); }
        .files-table th { text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.05em; background: var(--surface-secondary); border-bottom: 1px solid var(--border); }
        .files-table td { padding: 0.75rem 1rem; font-size: 0.88rem; border-bottom: 1px solid var(--border); }
        .files-table tr:last-child td { border-bottom: none; }
        .files-table tr:hover td { background: var(--surface-hover); }
        .files-table .active-row td { background: rgba(99,102,241,0.05); }
        .file-cell { display: flex; align-items: center; gap: 0.5rem; }
        .type-badge { font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; background: rgba(99,102,241,0.1); color: var(--primary); font-weight: 600; }
        .action-btns { display: flex; gap: 0.5rem; }
        .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; }
        .btn-danger-outline:hover { border-color: var(--danger); color: var(--danger); }

        /* Dashboard */
        .empty-state { text-align: center; padding: 4rem 2rem; }
        .empty-state h3 { margin: 1rem 0 0.5rem; }

        .analysis-banner { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.9rem; }

        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
        .kpi-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; background: var(--surface-primary); border: 1px solid var(--border); border-radius: var(--radius-md); transition: all 0.2s ease; }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
        .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpi-label { font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.04em; }
        .kpi-value { font-size: 1.6rem; font-weight: 700; color: var(--foreground); display: block; margin-top: 2px; }

        .insight-row { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
        .insight-summary h3, .risk-panel h3 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
        .summary-text { font-size: 0.92rem; line-height: 1.7; color: var(--foreground); }
        .insight-list { list-style: none; padding: 0; margin: 1rem 0 0; display: flex; flex-direction: column; gap: 0.5rem; }
        .insight-list li { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.85rem; color: var(--foreground); line-height: 1.5; }
        .risk-badge { display: inline-block; padding: 0.4rem 1.5rem; border-radius: 2rem; color: #fff; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.1em; }
        .risk-explanation { font-size: 0.85rem; margin-top: 0.75rem; line-height: 1.6; }
        .rec-list { list-style: none; padding: 0; margin: 0.5rem 0 0; display: flex; flex-direction: column; gap: 0.4rem; }
        .rec-list li { display: flex; align-items: flex-start; gap: 0.4rem; font-size: 0.82rem; color: var(--foreground); line-height: 1.5; }

        .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
        .chart-panel { padding: 1.5rem; }
        .chart-panel h3 { margin-bottom: 1rem; font-size: 1rem; }
        .chart-legend { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; }
        .legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--text-muted); }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .legend-val { font-weight: 600; color: var(--foreground); }

        .anomaly-panel { padding: 1.5rem; }
        .anomaly-panel h3 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
        .anomaly-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .anomaly-item { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.6rem 0.75rem; background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.1); border-radius: var(--radius-sm); font-size: 0.85rem; }

        /* Chat */
        .chat-container { display: flex; flex-direction: column; height: calc(100vh - 140px); background: var(--surface-primary); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
        .chat-header-bar { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--surface-secondary); }
        .chat-messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .chat-bubble { max-width: 80%; padding: 1rem 1.25rem; border-radius: var(--radius-md); animation: fadeIn 0.3s ease; }
        .chat-bubble.assistant { align-self: flex-start; background: var(--surface-secondary); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
        .chat-bubble.user { align-self: flex-end; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25); border-bottom-right-radius: 4px; }
        .bubble-role { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.3rem; }
        .chat-bubble.user .bubble-role { color: var(--primary); }
        .chat-bubble.assistant .bubble-role { color: var(--success); }
        .chat-bubble p { margin: 0; font-size: 0.9rem; line-height: 1.65; color: var(--foreground); }
        .typing-indicator { display: flex; gap: 4px; padding: 0.25rem 0; }
        .typing-indicator span { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); animation: bounce 1.4s infinite ease-in-out both; }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
        .chat-input-bar { display: flex; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border); background: var(--surface-primary); }
        .chat-input-bar input { flex: 1; background: var(--background); }
        .send-btn { padding: 0.75rem 1.25rem; border-radius: var(--radius-sm); }

        /* Utils */
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1.5s linear infinite; }

        @media (max-width: 900px) {
          .insight-row { grid-template-columns: 1fr; }
          .charts-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
