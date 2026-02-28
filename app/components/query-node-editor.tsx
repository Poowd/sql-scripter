"use client";

import { useState } from "react";
import {
  QueryNode, Condition, JoinClause, OrderByClause,
  GroupByClause, ColumnValuePair, OPERATORS, SUBQUERY_OPERATORS, SQLOperation, ValueType,
} from "./types";
import { makeEmptyNode, genId } from "./sql-builder";

// ── Depth visual theme ──────────────────────────────────────────
const DEPTH_STYLES = [
  { border: "#30363d",   accent: "#58a6ff", label: "MAIN QUERY",   bg: "#161b22" },
  { border: "#3fb95055", accent: "#3fb950", label: "SUBQUERY L1",  bg: "#0d1f10" },
  { border: "#d2992255", accent: "#d29922", label: "SUBQUERY L2",  bg: "#1a170a" },
  { border: "#f8514955", accent: "#f85149", label: "SUBQUERY L3",  bg: "#1a0c0c" },
];
const MAX_DEPTH = 3;

// ── Value type toggle pill ──────────────────────────────────────
function ValueTypeToggle({
  value, onChange,
}: { value: ValueType; onChange: (v: ValueType) => void }) {
  return (
    <button
      onClick={() => onChange(value === "string" ? "number" : "string")}
      title={value === "string" ? "String value (quoted)" : "Numeric value (unquoted)"}
      className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md border text-[10px] font-bold tracking-wider transition-all"
      style={{
        borderColor: value === "string" ? "#58a6ff66" : "#d2992266",
        color:       value === "string" ? "#58a6ff"   : "#d29922",
        background:  value === "string" ? "#58a6ff11" : "#d2992211",
      }}
    >
      {value === "string" ? '"abc"' : "123"}
    </button>
  );
}

interface QueryNodeEditorProps {
  node: QueryNode;
  depth: number;
  onChange: (updated: QueryNode) => void;
  onRemove?: () => void;
}

export default function QueryNodeEditor({ node, depth, onChange, onRemove }: QueryNodeEditorProps) {
  const [tab, setTab] = useState<"where" | "join" | "groupby" | "order">("where");

  const style    = DEPTH_STYLES[Math.min(depth, 3)];
  const nextStyle = DEPTH_STYLES[Math.min(depth + 1, 3)];
  const ic       = "bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-md px-3 py-2 focus:outline-none transition-colors placeholder-[#484f58]";
  const btnDel   = "flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[#6e7681] hover:text-[#f85149] hover:bg-[#f851491a] transition-colors text-xs";

  const set = (patch: Partial<QueryNode>) => onChange({ ...node, ...patch });

  // ── pairs ──
  const addPair    = () => set({ pairs: [...node.pairs, { id: genId(), column: "", value: "", valueType: "string" }] });
  const removePair = (id: string) => set({ pairs: node.pairs.filter((p) => p.id !== id) });
  const updatePair = (id: string, patch: Partial<ColumnValuePair>) =>
    set({ pairs: node.pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  // ── conditions ──
  const addCondition    = () =>
    set({ conditions: [...node.conditions, { id: genId(), column: "", operator: "=", value: "", valueType: "string", logic: "AND" }] });
  const removeCondition = (id: string) => {
    const cond = node.conditions.find((c) => c.id === id);
    const next = { ...node, conditions: node.conditions.filter((c) => c.id !== id) };
    if (cond?.subQueryId) { const sqs = { ...next.subQueries }; delete sqs[cond.subQueryId]; next.subQueries = sqs; }
    onChange(next);
  };
  const updateCondition = (id: string, patch: Partial<Condition>) =>
    set({ conditions: node.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  // ── subqueries ──
  const attachSubQuery = (condId: string) => {
    const sq = makeEmptyNode("SELECT");
    onChange({
      ...node,
      conditions: node.conditions.map((c) => c.id === condId ? { ...c, subQueryId: sq.id } : c),
      subQueries: { ...node.subQueries, [sq.id]: sq },
    });
  };
  const detachSubQuery = (condId: string, sqId: string) => {
    const sqs = { ...node.subQueries }; delete sqs[sqId];
    onChange({
      ...node,
      conditions: node.conditions.map((c) => c.id === condId ? { ...c, subQueryId: undefined, value: "" } : c),
      subQueries: sqs,
    });
  };
  const updateSubQuery = (sqId: string, updated: QueryNode) =>
    set({ subQueries: { ...node.subQueries, [sqId]: updated } });

  // ── joins ──
  const addJoin    = () => set({ joins: [...node.joins, { id: genId(), type: "INNER", table: "", onLeft: "", onRight: "" }] });
  const removeJoin = (id: string) => set({ joins: node.joins.filter((j) => j.id !== id) });
  const updateJoin = (id: string, patch: Partial<JoinClause>) =>
    set({ joins: node.joins.map((j) => (j.id === id ? { ...j, ...patch } : j)) });

  // ── group by ──
  const addGroupBy    = () => set({ groupBy: [...node.groupBy, { id: genId(), column: "" }] });
  const removeGroupBy = (id: string) => set({ groupBy: node.groupBy.filter((g) => g.id !== id) });
  const updateGroupBy = (id: string, patch: Partial<GroupByClause>) =>
    set({ groupBy: node.groupBy.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  // ── order by ──
  const addOrderBy    = () => set({ orderBy: [...node.orderBy, { id: genId(), column: "", direction: "ASC" }] });
  const removeOrderBy = (id: string) => set({ orderBy: node.orderBy.filter((o) => o.id !== id) });
  const updateOrderBy = (id: string, patch: Partial<OrderByClause>) =>
    set({ orderBy: node.orderBy.map((o) => (o.id === id ? { ...o, ...patch } : o)) });

  const ops: SQLOperation[] = ["SELECT", "INSERT", "UPDATE", "DELETE"];
  const opColors: Record<SQLOperation, string> = {
    SELECT: "#58a6ff", INSERT: "#3fb950", UPDATE: "#d29922", DELETE: "#f85149",
  };

  const canNest = depth < MAX_DEPTH;

  const tabs = [
    { key: "where"   as const, label: "WHERE",         count: node.conditions.length },
    { key: "join"    as const, label: "JOIN",           count: node.joins.length },
    { key: "groupby" as const, label: "GROUP BY",       count: node.groupBy.length },
    { key: "order"   as const, label: "ORDER / LIMIT",  count: node.orderBy.length + (node.limit ? 1 : 0) },
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${style.border}`, background: style.bg }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-wrap gap-2"
        style={{ borderColor: style.border, background: "#0d111799" }}>
        <div className="flex items-center gap-2">
          {Array.from({ length: depth + 1 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: style.accent }} />
          ))}
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: style.accent }}>
            {style.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {ops.map((op) => (
            <button key={op} onClick={() => set({ operation: op })}
              className="px-2 py-1 rounded text-[10px] font-bold tracking-wider transition-all"
              style={{
                background: node.operation === op ? `${opColors[op]}22` : "transparent",
                color:      node.operation === op ? opColors[op] : "#6e7681",
                border:     `1px solid ${node.operation === op ? opColors[op] + "66" : "#30363d"}`,
              }}>
              {op}
            </button>
          ))}

          {/* DISTINCT toggle — only for SELECT */}
          {node.operation === "SELECT" && (
            <button
              onClick={() => set({ distinct: !node.distinct })}
              title="Toggle DISTINCT"
              className="px-2 py-1 rounded text-[10px] font-bold tracking-wider transition-all"
              style={{
                background: node.distinct ? "#a371f722" : "transparent",
                color:      node.distinct ? "#a371f7"   : "#6e7681",
                border:     `1px solid ${node.distinct ? "#a371f766" : "#30363d"}`,
              }}>
              DISTINCT
            </button>
          )}

          {onRemove && (
            <button onClick={onRemove}
              className="ml-1 px-2 py-1 rounded text-[10px] text-[#f85149] border border-[#f8514944] hover:bg-[#f851491a] transition-colors">
              ✕ Remove
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Table name */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8b949e] mb-1.5">Table Name</label>
          <input placeholder="e.g. users" value={node.table} onChange={(e) => set({ table: e.target.value })}
            className={ic + " w-full"} />
        </div>

        {/* SELECT columns + DISTINCT indicator */}
        {node.operation === "SELECT" && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8b949e]">Columns</label>
              {node.distinct && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "#a371f722", color: "#a371f7", border: "1px solid #a371f744" }}>
                  DISTINCT ON
                </span>
              )}
            </div>
            <input placeholder="* or col1, col2, col3" value={node.selectColumns}
              onChange={(e) => set({ selectColumns: e.target.value })}
              className={ic + " w-full"} />
          </div>
        )}

        {/* INSERT / UPDATE pairs with value type toggle */}
        {(node.operation === "INSERT" || node.operation === "UPDATE") && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8b949e] mb-1.5">
              {node.operation === "INSERT" ? "Columns & Values" : "SET Columns"}
            </label>
            <div className="space-y-2">
              {node.pairs.map((pair) => (
                <div key={pair.id} className="flex items-center gap-2">
                  <input placeholder="column" value={pair.column}
                    onChange={(e) => updatePair(pair.id, { column: e.target.value })}
                    className={ic + " flex-1 text-xs"} />
                  <span className="text-[#484f58] text-xs">=</span>
                  <input
                    placeholder={pair.valueType === "number" ? "0" : "value"}
                    type={pair.valueType === "number" ? "number" : "text"}
                    value={pair.value}
                    onChange={(e) => updatePair(pair.id, { value: e.target.value })}
                    className={ic + " flex-1 text-xs"} />
                  <ValueTypeToggle value={pair.valueType} onChange={(v) => updatePair(pair.id, { valueType: v })} />
                  <button onClick={() => removePair(pair.id)} className={btnDel}>✕</button>
                </div>
              ))}
              <button onClick={addPair}
                className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: style.accent }}>
                <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]"
                  style={{ borderColor: style.accent }}>+</span>
                Add column
              </button>
            </div>
          </div>
        )}

        {/* Clause tabs — hidden for INSERT */}
        {node.operation !== "INSERT" && (
          <div className="rounded-lg border border-[#30363d] overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-[#30363d] overflow-x-auto">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex-shrink-0 px-3 py-2.5 text-[10px] font-semibold tracking-widest uppercase relative transition-colors"
                  style={{ color: tab === t.key ? style.accent : "#6e7681" }}>
                  {t.label}
                  {t.count > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px]"
                      style={{ background: style.accent + "22", color: style.accent }}>
                      {t.count}
                    </span>
                  )}
                  {tab === t.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: style.accent }} />
                  )}
                </button>
              ))}
            </div>

            <div className="p-3 space-y-3 bg-[#0d111755]">

              {/* ── WHERE tab ── */}
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
                            const needsSQ = SUBQUERY_OPERATORS.includes(op) && canNest && !cond.subQueryId;
                            if (needsSQ) {
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

                        {/* Value area */}
                        {!["IS NULL", "IS NOT NULL", "EXISTS", "NOT EXISTS"].includes(cond.operator) && (
                          <>
                            {cond.subQueryId ? (
                              <span className="flex-1 px-3 py-1.5 rounded-md border border-dashed text-[10px] font-mono"
                                style={{ borderColor: nextStyle.accent, color: nextStyle.accent }}>
                                ↳ subquery
                              </span>
                            ) : (
                              <input
                                placeholder={cond.valueType === "number" ? "0" : "value"}
                                type={cond.valueType === "number" ? "number" : "text"}
                                value={cond.value}
                                onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                                className={ic + " flex-1 min-w-[80px] text-xs"} />
                            )}

                            {/* Value type toggle (only when not using subquery) */}
                            {!cond.subQueryId && (
                              <ValueTypeToggle
                                value={cond.valueType}
                                onChange={(v) => updateCondition(cond.id, { valueType: v })}
                              />
                            )}

                            {/* Subquery button */}
                            {canNest && (
                              <button
                                title={cond.subQueryId ? "Use literal value" : "Nest a subquery"}
                                onClick={() => cond.subQueryId
                                  ? detachSubQuery(cond.id, cond.subQueryId)
                                  : attachSubQuery(cond.id)
                                }
                                className="flex-shrink-0 px-2 py-1.5 rounded-md border text-[10px] font-semibold transition-all"
                                style={cond.subQueryId
                                  ? { borderColor: "#30363d", color: "#6e7681", background: "transparent" }
                                  : { borderColor: nextStyle.accent + "66", color: nextStyle.accent, background: nextStyle.accent + "11" }
                                }>
                                {cond.subQueryId ? "× sub" : "⊂ sub"}
                              </button>
                            )}
                          </>
                        )}

                        {/* EXISTS subquery badge */}
                        {["EXISTS", "NOT EXISTS"].includes(cond.operator) && cond.subQueryId && (
                          <span className="flex-1 px-3 py-1.5 rounded-md border border-dashed text-[10px] font-mono"
                            style={{ borderColor: nextStyle.accent, color: nextStyle.accent }}>
                            ↳ subquery
                          </span>
                        )}

                        <button onClick={() => removeCondition(cond.id)} className={btnDel}>✕</button>
                      </div>

                      {/* Recursive subquery editor */}
                      {cond.subQueryId && node.subQueries[cond.subQueryId] && (
                        <div className="ml-5 mt-2">
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
                    <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]"
                      style={{ borderColor: style.accent }}>+</span>
                    Add condition
                  </button>
                </>
              )}

              {/* ── JOIN tab ── */}
              {tab === "join" && (
                <>
                  {node.joins.length === 0 && <p className="text-[#484f58] text-xs text-center py-3">No joins yet.</p>}
                  {node.joins.map((join) => (
                    <div key={join.id} className="space-y-2 p-3 rounded-lg border border-[#30363d] bg-[#0d1117]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <select value={join.type}
                          onChange={(e) => updateJoin(join.id, { type: e.target.value as JoinClause["type"] })}
                          className={ic + " w-28 text-xs"}>
                          <option>INNER</option><option>LEFT</option><option>RIGHT</option><option>FULL OUTER</option>
                        </select>
                        <span className="text-[#484f58] text-[10px] font-mono">JOIN</span>
                        <input placeholder="table" value={join.table}
                          onChange={(e) => updateJoin(join.id, { table: e.target.value })}
                          className={ic + " flex-1 min-w-[100px] text-xs"} />
                        <button onClick={() => removeJoin(join.id)} className={btnDel}>✕</button>
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
                  <button onClick={addJoin}
                    className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: style.accent }}>
                    <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]"
                      style={{ borderColor: style.accent }}>+</span>
                    Add join
                  </button>
                </>
              )}

              {/* ── GROUP BY tab ── */}
              {tab === "groupby" && (
                <>
                  {node.groupBy.length === 0 && (
                    <p className="text-[#484f58] text-xs text-center py-3">No GROUP BY columns yet.</p>
                  )}
                  {node.groupBy.map((gb, idx) => (
                    <div key={gb.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-[#484f58] font-mono w-16 text-right flex-shrink-0">
                        {idx === 0 ? "GROUP BY" : ","}
                      </span>
                      <input placeholder="column" value={gb.column}
                        onChange={(e) => updateGroupBy(gb.id, { column: e.target.value })}
                        className={ic + " flex-1 text-xs"} />
                      <button onClick={() => removeGroupBy(gb.id)} className={btnDel}>✕</button>
                    </div>
                  ))}
                  <button onClick={addGroupBy}
                    className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: style.accent }}>
                    <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]"
                      style={{ borderColor: style.accent }}>+</span>
                    Add GROUP BY column
                  </button>

                  {node.groupBy.length > 0 && node.operation === "SELECT" && (
                    <div className="mt-2 p-2 rounded-md border border-dashed border-[#30363d] text-[10px] text-[#484f58]">
                      💡 Non-aggregated SELECT columns should appear in GROUP BY
                    </div>
                  )}
                </>
              )}

              {/* ── ORDER / LIMIT tab ── */}
              {tab === "order" && (
                <>
                  {node.orderBy.map((ob) => (
                    <div key={ob.id} className="flex items-center gap-2">
                      <input placeholder="column" value={ob.column}
                        onChange={(e) => updateOrderBy(ob.id, { column: e.target.value })}
                        className={ic + " flex-1 text-xs"} />
                      <select value={ob.direction}
                        onChange={(e) => updateOrderBy(ob.id, { direction: e.target.value as "ASC" | "DESC" })}
                        className={ic + " w-20 text-xs"}>
                        <option>ASC</option><option>DESC</option>
                      </select>
                      <button onClick={() => removeOrderBy(ob.id)} className={btnDel}>✕</button>
                    </div>
                  ))}
                  <button onClick={addOrderBy}
                    className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: style.accent }}>
                    <span className="w-4 h-4 flex items-center justify-center rounded-full border text-[10px]"
                      style={{ borderColor: style.accent }}>+</span>
                    Add ORDER BY
                  </button>
                  <div className="flex items-center gap-3 pt-2 border-t border-[#30363d]">
                    <label className="text-[10px] text-[#8b949e] font-mono uppercase tracking-wider flex-shrink-0">LIMIT</label>
                    <input type="number" placeholder="e.g. 100" value={node.limit}
                      onChange={(e) => set({ limit: e.target.value })}
                      className={ic + " w-28 text-xs"} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!canNest && (
          <p className="text-[10px] text-[#484f58] italic text-center">
            Maximum nesting depth (3) reached.
          </p>
        )}
      </div>
    </div>
  );
}