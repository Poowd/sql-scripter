"use client";

import { useState, useCallback, useRef } from "react";
import { QueryNode, VisualQuerySchema } from "./types";
import QueryNodeEditor from "./query-node-editor";
import { buildSQL, makeEmptyNode } from "./sql-builder";

function isValidSchema(data: unknown): data is VisualQuerySchema {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.$schema === "sql-forge/visual-query/v1" &&
    typeof d.root === "object" &&
    d.root !== null
  );
}

export default function SQLGeneratorPage() {
  const [root, setRoot] = useState<QueryNode>(makeEmptyNode("SELECT"));
  const [queryName, setQueryName] = useState("my_query");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const sql = buildSQL(root, 0);

  // ── Copy ──
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sql]);

  // ── Export JSON ──
  const handleExport = useCallback(() => {
    const now = new Date().toISOString();
    const schema: VisualQuerySchema = {
      $schema: "sql-forge/visual-query/v1",
      meta: { name: queryName || "my_query", createdAt: now, updatedAt: now },
      root,
    };
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(queryName || "my_query").replace(/\s+/g, "_")}.sqlforge.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Query exported successfully");
  }, [root, queryName]);

  // ── Import JSON ──
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (!isValidSchema(raw)) {
          showToast("error", "Invalid file: not a SQL Forge query");
          return;
        }
        setRoot(raw.root);
        setQueryName(raw.meta?.name ?? "my_query");
        showToast("success", `Loaded "${raw.meta?.name ?? file.name}"`);
      } catch {
        showToast("error", "Failed to parse JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // ── Reset ──
  const handleReset = () => {
    setRoot(makeEmptyNode("SELECT"));
    setQueryName("my_query");
  };

  const opColors: Record<string, string> = {
    SELECT: "#58a6ff", INSERT: "#3fb950", UPDATE: "#d29922", DELETE: "#f85149",
  };

  // Count total subquery nodes recursively
  function countSubQueries(node: QueryNode): number {
    return Object.values(node.subQueries).reduce(
      (acc, sq) => acc + 1 + countSubQueries(sq),
      0
    );
  }
  const sqCount = countSubQueries(root);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-semibold shadow-2xl"
          style={{
            background: toast.type === "success" ? "#0f2a16" : "#2a0f0f",
            border: `1px solid ${toast.type === "success" ? "#3fb95066" : "#f8514966"}`,
            color: toast.type === "success" ? "#3fb950" : "#f85149",
          }}
        >
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="border-b border-[#30363d] px-6 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#58a6ff22] border border-[#58a6ff44] flex items-center justify-center">
            <span className="text-[#58a6ff] text-base">⬡</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#e6edf3] tracking-wide">SQL FORGE</h1>
            <p className="text-[10px] text-[#484f58] tracking-widest uppercase">Query Builder</p>
          </div>
        </div>

        {/* Nesting depth legend */}
        <div className="flex items-center gap-3 ml-2">
          {[
            { color: "#58a6ff", label: "Main" },
            { color: "#3fb950", label: "L1" },
            { color: "#d29922", label: "L2" },
            { color: "#f85149", label: "L3" },
          ].map((d) => (
            <div key={d.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <span className="text-[10px] text-[#6e7681]">{d.label}</span>
            </div>
          ))}
          {sqCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#58a6ff22] text-[#58a6ff] border border-[#58a6ff44]">
              {sqCount} subquer{sqCount === 1 ? "y" : "ies"}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Query name + actions */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            placeholder="query name"
            className="bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded-md px-3 py-1.5 w-36 focus:outline-none focus:border-[#58a6ff] placeholder-[#484f58] transition-colors"
          />
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#58a6ff] hover:border-[#58a6ff66] hover:bg-[#58a6ff11]"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z" />
              <path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z" />
            </svg>
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#3fb950] hover:border-[#3fb95066] hover:bg-[#3fb95011]"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z" />
              <path d="M11.78 5.22a.749.749 0 0 1-1.06 1.06L8.75 4.31v5.44a.75.75 0 0 1-1.5 0V4.31L5.28 6.28a.749.749 0 1 1-1.06-1.06l3.25-3.25a.749.749 0 0 1 1.06 0l3.25 3.25Z" />
            </svg>
            Load JSON
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all bg-[#21262d] border border-[#30363d] text-[#6e7681] hover:text-[#f85149] hover:border-[#f8514966] hover:bg-[#f851491a]"
          >
            Reset
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* ── LEFT: Query tree editor ── */}
        <div className="space-y-4">
          <QueryNodeEditor node={root} depth={0} onChange={setRoot} />
        </div>

        {/* ── RIGHT: SQL output ── */}
        <div className="lg:sticky lg:top-8 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8b949e]">Generated SQL</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={{
                background: copied ? "#3fb95022" : "#21262d",
                border: `1px solid ${copied ? "#3fb95066" : "#30363d"}`,
                color: copied ? "#3fb950" : "#8b949e",
              }}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>

          {/* Code block */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#30363d] bg-[#0d1117]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f85149] opacity-70" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#d29922] opacity-70" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#3fb950] opacity-70" />
              <span className="ml-3 text-[10px] text-[#484f58] uppercase tracking-widest">
                {(queryName || "query").replace(/\s+/g, "_")}.sql
              </span>
              <span className="ml-auto text-[10px] font-bold" style={{ color: opColors[root.operation] }}>
                {root.operation}
              </span>
            </div>
            <pre className="p-5 text-sm leading-relaxed overflow-x-auto min-h-[240px] max-h-[60vh] overflow-y-auto">
              <code>
                {sql.split("\n").map((line, i) => {
                  // Detect indentation depth by leading spaces
                  const indentLevel = (line.match(/^(\s*)/) ?? ["", ""])[1].length / 2;
                  const depthColor = ["#e6edf3", "#3fb950aa", "#d29922aa", "#f85149aa"][Math.min(indentLevel, 3)];
                  return (
                    <span key={i} className="block" style={{ color: depthColor }}>
                      {line.startsWith("--") ? (
                        <span style={{ color: "#484f58" }}>{line}</span>
                      ) : (
                        line.split(/\b/).map((token, j) => {
                          const keywords = new Set([
                            "SELECT","FROM","WHERE","AND","OR","INSERT","INTO","VALUES",
                            "UPDATE","SET","DELETE","JOIN","LEFT","RIGHT","INNER","FULL","OUTER",
                            "ON","ORDER","BY","ASC","DESC","LIMIT","IS","NULL","NOT","LIKE",
                            "IN","EXISTS","NOT",
                          ]);
                          return (
                            <span key={j} style={{
                              color: keywords.has(token.toUpperCase()) ? "#ff7b72"
                                : token.startsWith("'") && token.endsWith("'") ? "#a5d6ff"
                                : token.match(/^\d+$/) ? "#79c0ff"
                                : depthColor,
                            }}>
                              {token}
                            </span>
                          );
                        })
                      )}
                    </span>
                  );
                })}
              </code>
            </pre>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-xs text-[#484f58]">
            <span>{sql.split("\n").length} lines</span>
            <span>{sql.length} chars</span>
            {sqCount > 0 && <span style={{ color: "#58a6ff" }}>{sqCount} nested subquer{sqCount === 1 ? "y" : "ies"}</span>}
            <span className="ml-auto font-semibold" style={{ color: opColors[root.operation] }}>{root.operation}</span>
          </div>

          {/* Nesting depth guide */}
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-3 space-y-2">
            <p className="text-[10px] text-[#484f58] uppercase tracking-widest font-semibold">Nesting guide</p>
            <div className="space-y-1">
              {[
                { color: "#58a6ff", label: "Main query", op: "IN, NOT IN, EXISTS, NOT EXISTS on any WHERE condition" },
                { color: "#3fb950", label: "Subquery L1", op: "Use ⊂ subquery button to nest deeper" },
                { color: "#d29922", label: "Subquery L2", op: "One more level available" },
                { color: "#f85149", label: "Subquery L3", op: "Maximum depth — no further nesting" },
              ].map((d) => (
                <div key={d.label} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: d.color }} />
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: d.color }}>{d.label}</span>
                    <span className="text-[10px] text-[#484f58] ml-2">{d.op}</span>
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