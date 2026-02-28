"use client";

import { useState, useCallback, useRef } from "react";
import QueryNodeEditor from "./query-node-editor";
import { buildSQL, makeEmptyNode } from "./sql-builder";
import { QueryNode, VisualQuerySchema } from "./types";

function isValidSchema(data: unknown): data is VisualQuerySchema {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.$schema === "sql-forge/visual-query/v1" && typeof d.root === "object" && d.root !== null;
}

function countSubQueries(node: QueryNode): number {
  return Object.values(node.subQueries).reduce((acc, sq) => acc + 1 + countSubQueries(sq), 0);
}

const SQL_KEYWORDS = new Set([
  "SELECT","DISTINCT","FROM","WHERE","AND","OR","NOT","INSERT","INTO","VALUES",
  "UPDATE","SET","DELETE","JOIN","LEFT","RIGHT","INNER","FULL","OUTER","CROSS",
  "ON","GROUP","BY","ORDER","ASC","DESC","LIMIT","IS","NULL","LIKE","IN","EXISTS",
]);

function highlightSQL(line: string, depthColor: string): React.ReactNode {
  if (line.trimStart().startsWith("--")) return <span style={{ color: "#484f58" }}>{line}</span>;
  return line.split(/\b/).map((token, j) => (
    <span key={j} style={{
      color: SQL_KEYWORDS.has(token.toUpperCase()) ? "#ff7b72"
           : /^'\S*'$/.test(token)                 ? "#a5d6ff"
           : /^\d+$/.test(token)                    ? "#79c0ff"
           : depthColor,
    }}>{token}</span>
  ));
}

export default function SQLGeneratorPage() {
  const [root, setRoot]           = useState<QueryNode>(makeEmptyNode("SELECT"));
  const [queryName, setQueryName] = useState("my_query");
  const [copied, setCopied]       = useState(false);
  const [toast, setToast]         = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const sql = buildSQL(root, 0);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sql]);

  const handleExport = useCallback(() => {
    const now = new Date().toISOString();
    const schema: VisualQuerySchema = {
      $schema: "sql-forge/visual-query/v1",
      meta: { name: queryName || "my_query", createdAt: now, updatedAt: now },
      root,
    };
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${(queryName || "my_query").replace(/\s+/g, "_")}.sqlforge.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Query exported");
  }, [root, queryName]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (!isValidSchema(raw)) { showToast("error", "Invalid Quelder file"); return; }
        setRoot(raw.root);
        setQueryName(raw.meta?.name ?? "my_query");
        showToast("success", `Loaded "${raw.meta?.name ?? file.name}"`);
      } catch { showToast("error", "Failed to parse JSON"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const sqCount  = countSubQueries(root);
  const opColors: Record<string, string> = {
    SELECT: "#58a6ff", INSERT: "#3fb950", UPDATE: "#d29922", DELETE: "#f85149",
  };

  const depthLineColors = ["#e6edf3", "#3fb950bb", "#d29922bb", "#f85149bb"];

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-semibold shadow-2xl"
          style={{
            background: toast.type === "success" ? "#0f2a16" : "#2a0f0f",
            border:     `1px solid ${toast.type === "success" ? "#3fb95066" : "#f8514966"}`,
            color:      toast.type === "success" ? "#3fb950" : "#f85149",
          }}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="border-b border-[#30363d] px-5 py-3 flex items-center gap-3 flex-wrap">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#58a6ff22] border border-[#58a6ff44] flex items-center justify-center text-[#58a6ff]">⬡</div>
          <div>
            <div className="text-lg font-bold tracking-wide">Quelder</div>
          </div>
        </div>

        {/* Feature badges */}
        <div className="flex items-center gap-2 ml-1">
          {[
            { color: "#58a6ff", label: "Main" },
            { color: "#3fb950", label: "Sub L1" },
            { color: "#d29922", label: "Sub L2" },
            { color: "#f85149", label: "Sub L3" },
          ].map((d) => (
            <div key={d.label} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
              <span className="text-[9px] text-[#6e7681]">{d.label}</span>
            </div>
          ))}
          {sqCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "#58a6ff22", color: "#58a6ff", border: "1px solid #58a6ff44" }}>
              {sqCount} nested
            </span>
          )}
        </div>

        {/* Feature pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: "DISTINCT",  active: root.distinct && root.operation === "SELECT", color: "#a371f7" },
            { label: "GROUP BY",  active: root.groupBy.length > 0,  color: "#f0883e" },
            { label: "ORDER BY",  active: root.orderBy.length > 0,  color: "#58a6ff" },
            { label: "JOIN",      active: root.joins.length > 0,     color: "#3fb950" },
            { label: "WHERE",     active: root.conditions.length > 0, color: "#d29922" },
          ].map((f) => f.active ? (
            <span key={f.label} className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider"
              style={{ background: f.color + "22", color: f.color, border: `1px solid ${f.color}44` }}>
              {f.label}
            </span>
          ) : null)}
        </div>

        <div className="flex-1" />

        {/* Query name + actions */}
        <div className="flex items-center gap-2">
          <input type="text" value={queryName} onChange={(e) => setQueryName(e.target.value)}
            placeholder="query name"
            className="bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded-md px-3 py-1.5 w-32 focus:outline-none focus:border-[#58a6ff] placeholder-[#484f58] transition-colors" />

          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#58a6ff] hover:border-[#58a6ff66] transition-all">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"/>
              <path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"/>
            </svg>
            Export
          </button>

          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#3fb950] hover:border-[#3fb95066] transition-all">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"/>
              <path d="M11.78 5.22a.749.749 0 0 1-1.06 1.06L8.75 4.31v5.44a.75.75 0 0 1-1.5 0V4.31L5.28 6.28a.749.749 0 1 1-1.06-1.06l3.25-3.25a.749.749 0 0 1 1.06 0l3.25 3.25Z"/>
            </svg>
            Load
          </button>

          <button onClick={() => { setRoot(makeEmptyNode("SELECT")); setQueryName("my_query"); }}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#21262d] border border-[#30363d] text-[#6e7681] hover:text-[#f85149] hover:border-[#f8514966] transition-all">
            Reset
          </button>

          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
        </div>
      </header>

      {/* ── Main layout ── */}
      <main className="max-w-7xl mx-auto px-5 py-7 grid grid-cols-1 lg:grid-cols-2 gap-7 items-start">

        {/* LEFT — editor */}
        <div>
          <QueryNodeEditor node={root} depth={0} onChange={setRoot} />
        </div>

        {/* RIGHT — SQL output */}
        <div className="lg:sticky lg:top-7 space-y-3">

          {/* Output header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8b949e]">Generated SQL</span>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={{
                background: copied ? "#3fb95022" : "#21262d",
                border:     `1px solid ${copied ? "#3fb95066" : "#30363d"}`,
                color:      copied ? "#3fb950" : "#8b949e",
              }}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>

          {/* Code panel */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">

            {/* Fake window bar */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#30363d] bg-[#0d1117]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f85149] opacity-60" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#d29922] opacity-60" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#3fb950] opacity-60" />
              <span className="ml-3 text-[10px] text-[#484f58] uppercase tracking-widest">
                {(queryName || "query").replace(/\s+/g, "_")}.sql
              </span>
              <span className="ml-auto text-[10px] font-bold" style={{ color: opColors[root.operation] }}>
                {root.operation}{root.distinct && root.operation === "SELECT" ? " DISTINCT" : ""}
              </span>
            </div>

            <pre className="p-5 text-sm leading-relaxed overflow-x-auto min-h-[260px] max-h-[55vh] overflow-y-auto">
              <code>
                {sql.split("\n").map((line, i) => {
                  const indentLevel = Math.floor(((line.match(/^(\s*)/) ?? ["", ""])[1].length) / 2);
                  const depthColor  = depthLineColors[Math.min(indentLevel, 3)];
                  return (
                    <span key={i} className="block">
                      {highlightSQL(line, depthColor)}
                    </span>
                  );
                })}
              </code>
            </pre>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 text-[10px] text-[#484f58] flex-wrap">
            <span>{sql.split("\n").length} lines</span>
            <span>{sql.length} chars</span>
            {root.distinct && root.operation === "SELECT" && <span style={{ color: "#a371f7" }}>DISTINCT</span>}
            {root.groupBy.length > 0 && <span style={{ color: "#f0883e" }}>GROUP BY {root.groupBy.length}</span>}
            {sqCount > 0 && <span style={{ color: "#58a6ff" }}>{sqCount} subquer{sqCount === 1 ? "y" : "ies"}</span>}
            <span className="ml-auto font-bold" style={{ color: opColors[root.operation] }}>{root.operation}</span>
          </div>

          {/* Quick reference card */}
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-3 space-y-2.5">
            <p className="text-[10px] text-[#484f58] uppercase tracking-widest font-semibold">Feature reference</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { color: "#a371f7", label: "DISTINCT",     tip: "Toggle in header bar" },
                { color: "#f0883e", label: "GROUP BY",     tip: "GROUP BY tab in clauses" },
                { color: "#58a6ff", label: "Subqueries",   tip: "⊂ sub button on WHERE" },
                { color: "#d29922", label: "Value type",   tip: '"abc" / 123 toggle per value' },
                { color: "#3fb950", label: "JOIN",         tip: "JOIN tab — 4 join types" },
                { color: "#e6edf3", label: "JSON export",  tip: "Export / Load in header" },
              ].map((f) => (
                <div key={f.label} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: f.color }} />
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: f.color }}>{f.label}</span>
                    <span className="text-[10px] text-[#484f58] ml-1">— {f.tip}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}