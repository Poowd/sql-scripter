"use client";

import { useState } from "react";

export type Operator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "IS NULL" | "IS NOT NULL";
export type LogicGate = "AND" | "OR";

export interface Condition {
  id: string;
  column: string;
  operator: Operator;
  value: string;
  logic: LogicGate;
}

export interface JoinClause {
  id: string;
  type: "INNER" | "LEFT" | "RIGHT" | "FULL OUTER";
  table: string;
  onLeft: string;
  onRight: string;
}

export interface OrderByClause {
  id: string;
  column: string;
  direction: "ASC" | "DESC";
}

interface ConditionBuilderProps {
  conditions: Condition[];
  joins: JoinClause[];
  orderBy: OrderByClause[];
  limit: string;
  onConditionsChange: (conditions: Condition[]) => void;
  onJoinsChange: (joins: JoinClause[]) => void;
  onOrderByChange: (orderBy: OrderByClause[]) => void;
  onLimitChange: (limit: string) => void;
  availableColumns?: string[];
}

const OPERATORS: Operator[] = ["=", "!=", ">", "<", ">=", "<=", "LIKE", "IN", "IS NULL", "IS NOT NULL"];

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function ConditionBuilder({
  conditions,
  joins,
  orderBy,
  limit,
  onConditionsChange,
  onJoinsChange,
  onOrderByChange,
  onLimitChange,
  availableColumns = [],
}: ConditionBuilderProps) {
  const [activeTab, setActiveTab] = useState<"where" | "join" | "order">("where");

  // ── WHERE ──
  const addCondition = () => {
    onConditionsChange([
      ...conditions,
      { id: genId(), column: "", operator: "=", value: "", logic: "AND" },
    ]);
  };

  const updateCondition = (id: string, patch: Partial<Condition>) => {
    onConditionsChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCondition = (id: string) => {
    onConditionsChange(conditions.filter((c) => c.id !== id));
  };

  // ── JOIN ──
  const addJoin = () => {
    onJoinsChange([...joins, { id: genId(), type: "INNER", table: "", onLeft: "", onRight: "" }]);
  };

  const updateJoin = (id: string, patch: Partial<JoinClause>) => {
    onJoinsChange(joins.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  const removeJoin = (id: string) => {
    onJoinsChange(joins.filter((j) => j.id !== id));
  };

  // ── ORDER BY ──
  const addOrderBy = () => {
    onOrderByChange([...orderBy, { id: genId(), column: "", direction: "ASC" }]);
  };

  const updateOrderBy = (id: string, patch: Partial<OrderByClause>) => {
    onOrderByChange(orderBy.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const removeOrderBy = (id: string) => {
    onOrderByChange(orderBy.filter((o) => o.id !== id));
  };

  const inputCls =
    "bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors placeholder-[#484f58]";
  const selectCls = inputCls + " cursor-pointer";
  const btnRemoveCls =
    "ml-2 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-[#6e7681] hover:text-[#f85149] hover:bg-[#f851491a] transition-colors";

  const tabs = [
    { key: "where", label: "WHERE", count: conditions.length },
    { key: "join", label: "JOIN", count: joins.length },
    { key: "order", label: "ORDER / LIMIT", count: orderBy.length + (limit ? 1 : 0) },
  ] as const;

  return (
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#30363d]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-3 text-xs font-semibold tracking-widest uppercase transition-colors relative ${
              activeTab === t.key
                ? "text-[#58a6ff]"
                : "text-[#6e7681] hover:text-[#e6edf3]"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#58a6ff22] text-[#58a6ff] text-[10px]">
                {t.count}
              </span>
            )}
            {activeTab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58a6ff]" />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* WHERE */}
        {activeTab === "where" && (
          <>
            {conditions.length === 0 && (
              <p className="text-[#484f58] text-sm text-center py-4">No conditions yet. Add one below.</p>
            )}
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                {idx > 0 ? (
                  <select
                    value={cond.logic}
                    onChange={(e) => updateCondition(cond.id, { logic: e.target.value as LogicGate })}
                    className={selectCls + " w-20"}
                  >
                    <option>AND</option>
                    <option>OR</option>
                  </select>
                ) : (
                  <span className="w-20 text-center text-xs text-[#484f58] font-mono">WHERE</span>
                )}
                <input
                  placeholder="column"
                  value={cond.column}
                  onChange={(e) => updateCondition(cond.id, { column: e.target.value })}
                  list="col-suggestions"
                  className={inputCls + " flex-1 min-w-[100px]"}
                />
                <datalist id="col-suggestions">
                  {availableColumns.map((c) => <option key={c} value={c} />)}
                </datalist>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(cond.id, { operator: e.target.value as Operator })}
                  className={selectCls + " w-32"}
                >
                  {OPERATORS.map((op) => <option key={op}>{op}</option>)}
                </select>
                {!["IS NULL", "IS NOT NULL"].includes(cond.operator) && (
                  <input
                    placeholder="value"
                    value={cond.value}
                    onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                    className={inputCls + " flex-1 min-w-[100px]"}
                  />
                )}
                <button onClick={() => removeCondition(cond.id)} className={btnRemoveCls} title="Remove">
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addCondition}
              className="mt-2 flex items-center gap-2 text-sm text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-full border border-[#58a6ff] text-xs">+</span>
              Add condition
            </button>
          </>
        )}

        {/* JOIN */}
        {activeTab === "join" && (
          <>
            {joins.length === 0 && (
              <p className="text-[#484f58] text-sm text-center py-4">No joins yet.</p>
            )}
            {joins.map((join) => (
              <div key={join.id} className="space-y-2 p-3 rounded-lg border border-[#30363d] bg-[#0d1117]">
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={join.type}
                    onChange={(e) => updateJoin(join.id, { type: e.target.value as JoinClause["type"] })}
                    className={selectCls + " w-36"}
                  >
                    <option>INNER</option>
                    <option>LEFT</option>
                    <option>RIGHT</option>
                    <option>FULL OUTER</option>
                  </select>
                  <span className="text-[#484f58] text-xs font-mono">JOIN</span>
                  <input
                    placeholder="table name"
                    value={join.table}
                    onChange={(e) => updateJoin(join.id, { table: e.target.value })}
                    className={inputCls + " flex-1 min-w-[120px]"}
                  />
                  <button onClick={() => removeJoin(join.id)} className={btnRemoveCls} title="Remove">✕</button>
                </div>
                <div className="flex items-center gap-2 flex-wrap pl-2">
                  <span className="text-[#484f58] text-xs font-mono">ON</span>
                  <input
                    placeholder="left.column"
                    value={join.onLeft}
                    onChange={(e) => updateJoin(join.id, { onLeft: e.target.value })}
                    className={inputCls + " flex-1 min-w-[100px]"}
                  />
                  <span className="text-[#484f58] text-xs">=</span>
                  <input
                    placeholder="right.column"
                    value={join.onRight}
                    onChange={(e) => updateJoin(join.id, { onRight: e.target.value })}
                    className={inputCls + " flex-1 min-w-[100px]"}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addJoin}
              className="mt-2 flex items-center gap-2 text-sm text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-full border border-[#58a6ff] text-xs">+</span>
              Add join
            </button>
          </>
        )}

        {/* ORDER BY / LIMIT */}
        {activeTab === "order" && (
          <>
            {orderBy.map((ob) => (
              <div key={ob.id} className="flex items-center gap-2 flex-wrap">
                <input
                  placeholder="column"
                  value={ob.column}
                  onChange={(e) => updateOrderBy(ob.id, { column: e.target.value })}
                  list="col-suggestions"
                  className={inputCls + " flex-1 min-w-[120px]"}
                />
                <select
                  value={ob.direction}
                  onChange={(e) => updateOrderBy(ob.id, { direction: e.target.value as "ASC" | "DESC" })}
                  className={selectCls + " w-24"}
                >
                  <option>ASC</option>
                  <option>DESC</option>
                </select>
                <button onClick={() => removeOrderBy(ob.id)} className={btnRemoveCls} title="Remove">✕</button>
              </div>
            ))}
            <button
              onClick={addOrderBy}
              className="flex items-center gap-2 text-sm text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-full border border-[#58a6ff] text-xs">+</span>
              Add ORDER BY column
            </button>
            <div className="flex items-center gap-3 pt-2 border-t border-[#30363d]">
              <label className="text-xs text-[#8b949e] font-mono uppercase tracking-wider">LIMIT</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={limit}
                onChange={(e) => onLimitChange(e.target.value)}
                className={inputCls + " w-32"}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}