"use client";

import { useState } from "react";
import {
  QueryNode,
  Condition,
  JoinClause,
  OrderByClause,
  ColumnValuePair,
  OPERATORS,
  SUBQUERY_OPERATORS,
  SQLOperation,
} from "./types";
import { makeEmptyNode } from "./sql-builder";

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

// Depth colours so each level is visually distinct
const DEPTH_STYLES = [
  { border: "#30363d", accent: "#58a6ff", label: "MAIN QUERY",   bg: "#161b22" },
  { border: "#3fb95055", accent: "#3fb950", label: "SUBQUERY L1", bg: "#0f1f12" },
  { border: "#d2992255", accent: "#d29922", label: "SUBQUERY L2", bg: "#1f1a0d" },
  { border: "#f8514955", accent: "#f85149", label: "SUBQUERY L3", bg: "#1f0d0d" },
];

const MAX_DEPTH = 3;

interface QueryNodeEditorProps {
  node: QueryNode;
  depth: number;
  onChange: (updated: QueryNode) => void;
  onRemove?: () => void;
}

// ── tiny shared sub-components ──────────────────────────────────
function inputCls(accent: string) {
  return `bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-md px-3 py-2 focus:outline-none transition-colors placeholder-[#484f58] focus:border-[${accent}] focus:ring-1 focus:ring-[${accent}]`;
}

export default function QueryNodeEditor({ node, depth, onChange, onRemove }: QueryNodeEditorProps) {
  const [tab, setTab] = useState<"where" | "join" | "order">("where");

  const style = DEPTH_STYLES[Math.min(depth, 3)];
  const ic = "bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-md px-3 py-2 focus:outline-none transition-colors placeholder-[#484f58]";
  const btnRemove = "flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[#6e7681] hover:text-[#f85149] hover:bg-[#f851491a] transition-colors";

  // ── node updaters ──
  const set = (patch: Partial<QueryNode>) => onChange({ ...node, ...patch });

  // pairs
  const addPair = () => set({ pairs: [...node.pairs, { id: genId(), column: "", value: "" }] });
  const removePair = (id: string) => set({ pairs: node.pairs.filter((p) => p.id !== id) });
  const updatePair = (id: string, patch: Partial<ColumnValuePair>) =>
    set({ pairs: node.pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  // conditions
  const addCondition = () =>
    set({ conditions: [...node.conditions, { id: genId(), column: "", operator: "=", value: "", logic: "AND" }] });
  const removeCondition = (id: string) => {
    const cond = node.conditions.find((c) => c.id === id);
    const updated = { ...node, conditions: node.conditions.filter((c) => c.id !== id) };
    // also clean up its subquery if any
    if (cond?.subQueryId) {
      const sqs = { ...updated.subQueries };
      delete sqs[cond.subQueryId];
      updated.subQueries = sqs;
    }
    onChange(updated);
  };
  const updateCondition = (id: string, patch: Partial<Condition>) =>
    set({ conditions: node.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  // attach / detach a subquery from a condition
  const attachSubQuery = (condId: string) => {
    const sq = makeEmptyNode("SELECT");
    onChange({
      ...node,
      conditions: node.conditions.map((c) => c.id === condId ? { ...c, subQueryId: sq.id } : c),
      subQueries: { ...node.subQueries, [sq.id]: sq },
    });
  };
  const detachSubQuery = (condId: string, sqId: string) => {
    const sqs = { ...node.subQueries };
    delete sqs[sqId];
    onChange({
      ...node,
      conditions: node.conditions.map((c) => c.id === condId ? { ...c, subQueryId: undefined, value: "" } : c),
      subQueries: sqs,
    });
  };
  const updateSubQuery = (sqId: string, updated: QueryNode) =>
    set({ subQueries: { ...node.subQueries, [sqId]: updated } });

  // joins
  const addJoin = () => set({ joins: [...node.joins, { id: genId(), type: "INNER", table: "", onLeft: "", onRight: "" }] });
  const removeJoin = (id: string) => set({ joins: node.joins.filter((j) => j.id !== id) });
  const updateJoin = (id: string, patch: Partial<JoinClause>) =>
    set({ joins: node.joins.map((j) => (j.id === id ? { ...j, ...patch } : j)) });

  // orderBy
  const addOrderBy = () => set({ orderBy: [...node.orderBy, { id: genId(), column: "", direction: "ASC" }] });
  const removeOrderBy = (id: string) => set({ orderBy: node.orderBy.filter((o) => o.id !== id) });
  const updateOrderBy = (id: string, patch: Partial<OrderByClause>) =>
    set({ orderBy: node.orderBy.map((o) => (o.id === id ? { ...o, ...patch } : o)) });

  const ops: SQLOperation[] = ["SELECT", "INSERT", "UPDATE", "DELETE"];
  const opColors: Record<SQLOperation, string> = {
    SELECT: "#58a6ff", INSERT: "#3fb950", UPDATE: "#d29922", DELETE: "#f85149",
  };

  const tabs = [
    { key: "where" as const, label: "WHERE", count: node.conditions.length },
    { key: "join"  as const, label: "JOIN",  count: node.joins.length },
    { key: "order" as const, label: "ORDER / LIMIT", count: node.orderBy.length + (node.limit ? 1 : 0) },
  ];

  const canNest = depth < MAX_DEPTH;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1.5px solid ${style.border}`, background: style.bg }}
    >
      {/* ── Header bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: style.border, background: "#0d111799" }}
      >
        <div className="flex items-center gap-2">
          {/* Depth indicator dots */}
          {Array.from({ length: depth + 1 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: style.accent }} />
          ))}
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: style.accent }}>
            {style.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Operation switcher */}
          {ops.map((op) => (
            <button
              key={op}
              onClick={() => set({ operation: op })}
              className="px-2 py-1 rounded text-[10px] font-bold tracking-wider transition-all"
              style={{
                background: node.operation === op ? `${opColors[op]}22` : "transparent",
                color: node.operation === op ? opColors[op] : "#6e7681",
                border: `1px solid ${node.operation === op ? opColors[op] + "66" : "#30363d"}`,
              }}
            >
              {op}
            </button>
          ))}
          {onRemove && (
            <button
              onClick={onRemove}
              className="ml-2 px-2 py-1 rounded text-[10px] text-[#f85149] border border-[#f8514944] hover:bg-[#f851491a] transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Table */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8b949e] mb-1">Table Name</label>
          <input
            placeholder="e.g. users"
            value={node.table}
            onChange={(e) => set({ table: e.target.value })}
            className={ic + " w-full"}
          />
        </div>

        {/* SELECT columns */}
        {node.operation === "SELECT" && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8b949e] mb-1">Columns</label>
            <input
              placeholder="* or col1, col2"
              value={node.selectColumns}
              onChange={(e) => set({ selectColumns: e.target.value })}
              className={ic + " w-full"}
            />
          </div>
        )}

        {/* INSERT / UPDATE pairs */}
        {(node.operation === "INSERT" || node.operation === "UPDATE") && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8b949e] mb-1">
              {node.operation === "INSERT" ? "Columns & Values" : "SET Columns"}
            </label>
            <div className="space-y-2">
              {node.pairs.map((pair) => (
                <div key={pair.id} className="flex items-center gap-2">
                  <input placeholder="column" value={pair.column}
                    onChange={(e) => updatePair(pair.id, { column: e.target.value })}
                    className={ic + " flex-1"} />
                  <span className="text-[#484f58] text-sm">=</span>
                  <input placeholder="value" value={pair.value}
                    onChange={(e) => updatePair(pair.id, { value: e.target.value })}
                    className={ic + " flex-1"} />
                  <button onClick={() => removePair(pair.id)} className={btnRemove}>✕</button>
                </div>
              ))}
              <button onClick={addPair} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: style.accent }}>
                <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]" style={{ borderColor: style.accent }}>+</span>
                Add column
              </button>
            </div>
          </div>
        )}

        {/* Clauses tabs — hide for INSERT */}
        {node.operation !== "INSERT" && (
          <div className="rounded-lg border border-[#30363d] overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-[#30363d]">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="px-4 py-2.5 text-[10px] font-semibold tracking-widest uppercase relative transition-colors"
                  style={{ color: tab === t.key ? style.accent : "#6e7681" }}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px]"
                      style={{ background: style.accent + "22", color: style.accent }}>
                      {t.count}
                    </span>
                  )}
                  {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: style.accent }} />}
                </button>
              ))}
            </div>

            <div className="p-3 space-y-3 bg-[#0d111766]">
              {/* WHERE */}
              {tab === "where" && (
                <>
                  {node.conditions.length === 0 && (
                    <p className="text-[#484f58] text-xs text-center py-3">No conditions yet.</p>
                  )}
                  {node.conditions.map((cond, idx) => (
                    <div key={cond.id} className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* AND / OR / WHERE label */}
                        {idx > 0 ? (
                          <select value={cond.logic}
                            onChange={(e) => updateCondition(cond.id, { logic: e.target.value as "AND" | "OR" })}
                            className={ic + " w-16 text-xs"}>
                            <option>AND</option>
                            <option>OR</option>
                          </select>
                        ) : (
                          <span className="w-16 text-center text-[10px] text-[#484f58] font-mono">WHERE</span>
                        )}

                        {/* Column — hidden for EXISTS */}
                        {!["EXISTS", "NOT EXISTS"].includes(cond.operator) && (
                          <input placeholder="column" value={cond.column}
                            onChange={(e) => updateCondition(cond.id, { column: e.target.value })}
                            className={ic + " flex-1 min-w-[80px] text-xs"} />
                        )}

                        {/* Operator */}
                        <select value={cond.operator}
                          onChange={(e) => {
                            const op = e.target.value as Condition["operator"];
                            const needsSubQ = SUBQUERY_OPERATORS.includes(op);
                            // auto-attach subquery if switching to subquery operator and canNest
                            if (needsSubQ && canNest && !cond.subQueryId) {
                              const sq = makeEmptyNode("SELECT");
                              onChange({
                                ...node,
                                conditions: node.conditions.map((c) =>
                                  c.id === cond.id ? { ...c, operator: op, subQueryId: sq.id } : c
                                ),
                                subQueries: { ...node.subQueries, [sq.id]: sq },
                              });
                            } else {
                              updateCondition(cond.id, { operator: op });
                            }
                          }}
                          className={ic + " w-28 text-xs"}>
                          {OPERATORS.map((op) => <option key={op}>{op}</option>)}
                        </select>

                        {/* Value OR subquery toggle */}
                        {!["IS NULL", "IS NOT NULL", "EXISTS", "NOT EXISTS"].includes(cond.operator) && (
                          <>
                            {cond.subQueryId ? (
                              <span className="flex-1 px-3 py-1.5 rounded-md border border-dashed text-[10px] font-mono"
                                style={{ borderColor: DEPTH_STYLES[Math.min(depth + 1, 3)].accent, color: DEPTH_STYLES[Math.min(depth + 1, 3)].accent }}>
                                ↳ subquery
                              </span>
                            ) : (
                              <input placeholder="value" value={cond.value}
                                onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                                className={ic + " flex-1 min-w-[80px] text-xs"} />
                            )}

                            {/* Toggle subquery button */}
                            {canNest && (
                              <button
                                title={cond.subQueryId ? "Use literal value" : "Use subquery"}
                                onClick={() => cond.subQueryId
                                  ? detachSubQuery(cond.id, cond.subQueryId)
                                  : attachSubQuery(cond.id)
                                }
                                className="flex-shrink-0 px-2 py-1.5 rounded-md border text-[10px] font-semibold transition-all"
                                style={cond.subQueryId
                                  ? { borderColor: "#30363d", color: "#6e7681", background: "transparent" }
                                  : { borderColor: DEPTH_STYLES[Math.min(depth + 1, 3)].accent + "66",
                                      color: DEPTH_STYLES[Math.min(depth + 1, 3)].accent,
                                      background: DEPTH_STYLES[Math.min(depth + 1, 3)].accent + "11" }
                                }
                              >
                                {cond.subQueryId ? "× subquery" : "⊂ subquery"}
                              </button>
                            )}
                          </>
                        )}

                        {/* EXISTS subquery badge */}
                        {["EXISTS", "NOT EXISTS"].includes(cond.operator) && cond.subQueryId && (
                          <span className="flex-1 px-3 py-1.5 rounded-md border border-dashed text-[10px] font-mono"
                            style={{ borderColor: DEPTH_STYLES[Math.min(depth + 1, 3)].accent, color: DEPTH_STYLES[Math.min(depth + 1, 3)].accent }}>
                            ↳ subquery
                          </span>
                        )}

                        <button onClick={() => removeCondition(cond.id)} className={btnRemove}>✕</button>
                      </div>

                      {/* Nested QueryNodeEditor for subquery */}
                      {cond.subQueryId && node.subQueries[cond.subQueryId] && (
                        <div className="ml-6 mt-2">
                          <QueryNodeEditor
                            node={node.subQueries[cond.subQueryId]}
                            depth={depth + 1}
                            onChange={(updated) => updateSubQuery(cond.subQueryId!, updated)}
                            onRemove={() => detachSubQuery(cond.id, cond.subQueryId!)}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  <button onClick={addCondition}
                    className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: style.accent }}>
                    <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]" style={{ borderColor: style.accent }}>+</span>
                    Add condition
                  </button>
                </>
              )}

              {/* JOIN */}
              {tab === "join" && (
                <>
                  {node.joins.length === 0 && <p className="text-[#484f58] text-xs text-center py-3">No joins yet.</p>}
                  {node.joins.map((join) => (
                    <div key={join.id} className="space-y-2 p-3 rounded-lg border border-[#30363d] bg-[#0d1117]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <select value={join.type} onChange={(e) => updateJoin(join.id, { type: e.target.value as JoinClause["type"] })}
                          className={ic + " w-28 text-xs"}>
                          <option>INNER</option><option>LEFT</option><option>RIGHT</option><option>FULL OUTER</option>
                        </select>
                        <span className="text-[#484f58] text-[10px] font-mono">JOIN</span>
                        <input placeholder="table" value={join.table}
                          onChange={(e) => updateJoin(join.id, { table: e.target.value })}
                          className={ic + " flex-1 min-w-[100px] text-xs"} />
                        <button onClick={() => removeJoin(join.id)} className={btnRemove}>✕</button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pl-2">
                        <span className="text-[#484f58] text-[10px] font-mono">ON</span>
                        <input placeholder="left.col" value={join.onLeft}
                          onChange={(e) => updateJoin(join.id, { onLeft: e.target.value })}
                          className={ic + " flex-1 min-w-[80px] text-xs"} />
                        <span className="text-[#484f58] text-[10px]">=</span>
                        <input placeholder="right.col" value={join.onRight}
                          onChange={(e) => updateJoin(join.id, { onRight: e.target.value })}
                          className={ic + " flex-1 min-w-[80px] text-xs"} />
                      </div>
                    </div>
                  ))}
                  <button onClick={addJoin} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: style.accent }}>
                    <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]" style={{ borderColor: style.accent }}>+</span>
                    Add join
                  </button>
                </>
              )}

              {/* ORDER / LIMIT */}
              {tab === "order" && (
                <>
                  {node.orderBy.map((ob) => (
                    <div key={ob.id} className="flex items-center gap-2">
                      <input placeholder="column" value={ob.column}
                        onChange={(e) => updateOrderBy(ob.id, { column: e.target.value })}
                        className={ic + " flex-1 text-xs"} />
                      <select value={ob.direction} onChange={(e) => updateOrderBy(ob.id, { direction: e.target.value as "ASC" | "DESC" })}
                        className={ic + " w-20 text-xs"}>
                        <option>ASC</option><option>DESC</option>
                      </select>
                      <button onClick={() => removeOrderBy(ob.id)} className={btnRemove}>✕</button>
                    </div>
                  ))}
                  <button onClick={addOrderBy} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: style.accent }}>
                    <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]" style={{ borderColor: style.accent }}>+</span>
                    Add ORDER BY
                  </button>
                  <div className="flex items-center gap-3 pt-2 border-t border-[#30363d]">
                    <label className="text-[10px] text-[#8b949e] font-mono uppercase tracking-wider">LIMIT</label>
                    <input type="number" placeholder="e.g. 100" value={node.limit}
                      onChange={(e) => set({ limit: e.target.value })}
                      className={ic + " w-28 text-xs"} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Max depth notice */}
        {!canNest && (
          <p className="text-[10px] text-[#484f58] italic text-center">
            Maximum nesting depth (3) reached — no further subqueries allowed.
          </p>
        )}
      </div>
    </div>
  );
}