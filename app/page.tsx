"use client";

import { useState, useCallback } from "react";
import ConditionBuilder, { Condition, JoinClause, OrderByClause } from "./components/condition-builder";


type SQLOperation = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

interface ColumnValuePair {
  id: string;
  column: string;
  value: string;
}

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// ── SQL BUILDERS ────────────────────────────────────────────────
function buildSelect(
  table: string,
  columns: string,
  conditions: Condition[],
  joins: JoinClause[],
  orderBy: OrderByClause[],
  limit: string
): string {
  if (!table) return "-- Please fill in the table name";
  const cols = columns.trim() || "*";
  let sql = `SELECT ${cols}\nFROM ${table}`;

  for (const j of joins) {
    if (j.table && j.onLeft && j.onRight)
      sql += `\n${j.type} JOIN ${j.table} ON ${j.onLeft} = ${j.onRight}`;
  }
  if (conditions.length > 0) {
    const parts = conditions
      .map((c, i) => {
        const col = c.column || "column";
        const val = ["IS NULL", "IS NOT NULL"].includes(c.operator)
          ? ""
          : ` '${c.value}'`;
        const clause = `${col} ${c.operator}${val}`;
        return i === 0 ? clause : `${c.logic} ${clause}`;
      })
      .join("\n  ");
    sql += `\nWHERE ${parts}`;
  }
  if (orderBy.length > 0) {
    sql += `\nORDER BY ${orderBy
      .filter((o) => o.column)
      .map((o) => `${o.column} ${o.direction}`)
      .join(", ")}`;
  }
  if (limit) sql += `\nLIMIT ${limit}`;
  return sql + ";";
}

function buildInsert(table: string, pairs: ColumnValuePair[]): string {
  if (!table) return "-- Please fill in the table name";
  const filled = pairs.filter((p) => p.column);
  if (filled.length === 0) return "-- Add at least one column";
  const cols = filled.map((p) => p.column).join(", ");
  const vals = filled.map((p) => `'${p.value}'`).join(", ");
  return `INSERT INTO ${table} (${cols})\nVALUES (${vals});`;
}

function buildUpdate(
  table: string,
  pairs: ColumnValuePair[],
  conditions: Condition[]
): string {
  if (!table) return "-- Please fill in the table name";
  const filled = pairs.filter((p) => p.column);
  if (filled.length === 0) return "-- Add at least one SET column";
  const sets = filled.map((p) => `  ${p.column} = '${p.value}'`).join(",\n");
  let sql = `UPDATE ${table}\nSET\n${sets}`;
  if (conditions.length > 0) {
    const parts = conditions
      .map((c, i) => {
        const col = c.column || "column";
        const val = ["IS NULL", "IS NOT NULL"].includes(c.operator)
          ? ""
          : ` '${c.value}'`;
        const clause = `${col} ${c.operator}${val}`;
        return i === 0 ? clause : `${c.logic} ${clause}`;
      })
      .join("\n  ");
    sql += `\nWHERE ${parts}`;
  }
  return sql + ";";
}

function buildDelete(table: string, conditions: Condition[]): string {
  if (!table) return "-- Please fill in the table name";
  let sql = `DELETE FROM ${table}`;
  if (conditions.length > 0) {
    const parts = conditions
      .map((c, i) => {
        const col = c.column || "column";
        const val = ["IS NULL", "IS NOT NULL"].includes(c.operator)
          ? ""
          : ` '${c.value}'`;
        const clause = `${col} ${c.operator}${val}`;
        return i === 0 ? clause : `${c.logic} ${clause}`;
      })
      .join("\n  ");
    sql += `\nWHERE ${parts}`;
  }
  return sql + ";";
}

// ── COMPONENT ───────────────────────────────────────────────────
export default function SQLGeneratorPage() {
  const [operation, setOperation] = useState<SQLOperation>("SELECT");
  const [table, setTable] = useState("");
  const [selectCols, setSelectCols] = useState("*");

  // INSERT / UPDATE pairs
  const [pairs, setPairs] = useState<ColumnValuePair[]>([
    { id: genId(), column: "", value: "" },
  ]);

  // Condition builder state
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [joins, setJoins] = useState<JoinClause[]>([]);
  const [orderBy, setOrderBy] = useState<OrderByClause[]>([]);
  const [limit, setLimit] = useState("");

  const [copied, setCopied] = useState(false);

  // ── derived SQL ──
  const sql = (() => {
    switch (operation) {
      case "SELECT":
        return buildSelect(table, selectCols, conditions, joins, orderBy, limit);
      case "INSERT":
        return buildInsert(table, pairs);
      case "UPDATE":
        return buildUpdate(table, pairs, conditions);
      case "DELETE":
        return buildDelete(table, conditions);
    }
  })();

  // ── pair helpers ──
  const addPair = () =>
    setPairs((p) => [...p, { id: genId(), column: "", value: "" }]);
  const removePair = (id: string) =>
    setPairs((p) => p.filter((x) => x.id !== id));
  const updatePair = (id: string, patch: Partial<ColumnValuePair>) =>
    setPairs((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  // ── copy ──
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sql]);

  const inputCls =
    "w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors placeholder-[#484f58]";
  const labelCls = "block text-xs font-semibold uppercase tracking-widest text-[#8b949e] mb-1.5";

  const ops: SQLOperation[] = ["SELECT", "INSERT", "UPDATE", "DELETE"];
  const opColors: Record<SQLOperation, string> = {
    SELECT: "#58a6ff",
    INSERT: "#3fb950",
    UPDATE: "#d29922",
    DELETE: "#f85149",
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      {/* Header */}
      <header className="border-b border-[#30363d] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#58a6ff22] border border-[#58a6ff44] flex items-center justify-center">
            <span className="text-[#58a6ff] text-base">⬡</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#e6edf3] tracking-wide">Quelder</h1>
            <p className="text-[10px] text-[#484f58] tracking-widest uppercase">Query Builder initiated by Powd_</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {ops.map((op) => (
            <button
              key={op}
              onClick={() => setOperation(op)}
              className="px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition-all"
              style={{
                background: operation === op ? `${opColors[op]}22` : "transparent",
                color: operation === op ? opColors[op] : "#6e7681",
                border: `1px solid ${operation === op ? opColors[op] + "66" : "#30363d"}`,
              }}
            >
              {op}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── LEFT: Builder ── */}
        <div className="space-y-6">
          {/* Operation badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest"
            style={{
              background: `${opColors[operation]}15`,
              border: `1px solid ${opColors[operation]}44`,
              color: opColors[operation],
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: opColors[operation] }} />
            {operation} QUERY
          </div>

          {/* Table name */}
          <div>
            <label className={labelCls}>Table Name</label>
            <input
              placeholder="e.g. users"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* SELECT: columns */}
          {operation === "SELECT" && (
            <div>
              <label className={labelCls}>Columns</label>
              <input
                placeholder="* or col1, col2, col3"
                value={selectCols}
                onChange={(e) => setSelectCols(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {/* INSERT / UPDATE: column-value pairs */}
          {(operation === "INSERT" || operation === "UPDATE") && (
            <div>
              <label className={labelCls}>
                {operation === "INSERT" ? "Columns & Values" : "SET Columns"}
              </label>
              <div className="space-y-2">
                {pairs.map((pair) => (
                  <div key={pair.id} className="flex items-center gap-2">
                    <input
                      placeholder="column"
                      value={pair.column}
                      onChange={(e) => updatePair(pair.id, { column: e.target.value })}
                      className="flex-1 bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors placeholder-[#484f58]"
                    />
                    <span className="text-[#484f58] text-sm">=</span>
                    <input
                      placeholder="value"
                      value={pair.value}
                      onChange={(e) => updatePair(pair.id, { value: e.target.value })}
                      className="flex-1 bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors placeholder-[#484f58]"
                    />
                    <button
                      onClick={() => removePair(pair.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-[#6e7681] hover:text-[#f85149] hover:bg-[#f851491a] transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={addPair}
                  className="flex items-center gap-2 text-sm text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
                >
                  <span className="w-5 h-5 flex items-center justify-center rounded-full border border-[#58a6ff] text-xs">+</span>
                  Add column
                </button>
              </div>
            </div>
          )}

          {/* Condition builder — not shown for INSERT */}
          {operation !== "INSERT" && (
            <div>
              <label className={labelCls}>Query Clauses</label>
              <ConditionBuilder
                conditions={conditions}
                joins={joins}
                orderBy={orderBy}
                limit={limit}
                onConditionsChange={setConditions}
                onJoinsChange={setJoins}
                onOrderByChange={setOrderBy}
                onLimitChange={setLimit}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT: Output ── */}
        <div className="lg:sticky lg:top-8 self-start space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelCls}>Generated SQL</label>
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
          <div className="relative rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
            {/* Dots */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#30363d] bg-[#0d1117]">
              <span className="w-3 h-3 rounded-full bg-[#f85149] opacity-70" />
              <span className="w-3 h-3 rounded-full bg-[#d29922] opacity-70" />
              <span className="w-3 h-3 rounded-full bg-[#3fb950] opacity-70" />
              <span className="ml-3 text-[10px] text-[#484f58] uppercase tracking-widest">query.sql</span>
            </div>
            <pre className="p-5 text-sm leading-relaxed overflow-x-auto min-h-[200px]">
              <code>
                {sql.split("\n").map((line, i) => (
                  <span key={i} className="block">
                    {line.startsWith("--") ? (
                      <span className="text-[#484f58]">{line}</span>
                    ) : (
                      line
                        .split(/\b/)
                        .map((token, j) => {
                          const keywords = new Set([
                            "SELECT","FROM","WHERE","AND","OR","INSERT","INTO","VALUES",
                            "UPDATE","SET","DELETE","JOIN","LEFT","RIGHT","INNER","FULL","OUTER",
                            "ON","ORDER","BY","ASC","DESC","LIMIT","IS","NULL","NOT","LIKE","IN",
                          ]);
                          return (
                            <span
                              key={j}
                              style={{
                                color: keywords.has(token.toUpperCase())
                                  ? "#ff7b72"
                                  : token.startsWith("'") && token.endsWith("'")
                                  ? "#a5d6ff"
                                  : token.match(/^\d+$/)
                                  ? "#79c0ff"
                                  : "#e6edf3",
                              }}
                            >
                              {token}
                            </span>
                          );
                        })
                    )}
                  </span>
                ))}
              </code>
            </pre>
          </div>

          {/* Stats bar */}
          <div className="flex gap-4 text-xs text-[#484f58]">
            <span>{sql.split("\n").length} lines</span>
            <span>{sql.length} chars</span>
            <span
              className="ml-auto font-semibold"
              style={{ color: opColors[operation] }}
            >
              {operation}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}