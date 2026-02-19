// sqlBuilder.ts — recursive SQL generator from QueryNode tree

import { Condition, QueryNode } from "./types";


function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export function genId2() {
  return genId();
}

export function buildSQL(node: QueryNode, depth = 0): string {
  const indent = "  ".repeat(depth);
  const inner = "  ".repeat(depth + 1);

  switch (node.operation) {
    case "SELECT":
      return buildSelect(node, depth, indent, inner);
    case "INSERT":
      return buildInsert(node);
    case "UPDATE":
      return buildUpdate(node, depth, indent, inner);
    case "DELETE":
      return buildDelete(node, depth, indent, inner);
  }
}

function resolveConditionValue(
  cond: Condition,
  subQueries: Record<string, QueryNode>,
  depth: number
): string {
  if (cond.subQueryId && subQueries[cond.subQueryId]) {
    const subSQL = buildSQL(subQueries[cond.subQueryId], depth + 2);
    const indented = subSQL
      .split("\n")
      .map((l, i) => (i === 0 ? l : "  ".repeat(depth + 2) + l))
      .join("\n");
    return `(\n${"  ".repeat(depth + 2)}${indented}\n${"  ".repeat(depth + 1)})`;
  }
  return `'${cond.value}'`;
}

function buildWhereClause(
  conditions: Condition[],
  subQueries: Record<string, QueryNode>,
  depth: number,
  indent: string,
  inner: string
): string {
  if (conditions.length === 0) return "";

  const parts = conditions
    .map((c, i) => {
      const col = c.column || "column";
      const isSubQuery = !!c.subQueryId;
      const isNullOp = ["IS NULL", "IS NOT NULL"].includes(c.operator);
      const isExistsOp = ["EXISTS", "NOT EXISTS"].includes(c.operator);

      let clause: string;
      if (isExistsOp) {
        const val = resolveConditionValue(c, subQueries, depth);
        clause = `${c.operator} ${val}`;
      } else if (isNullOp) {
        clause = `${col} ${c.operator}`;
      } else if (isSubQuery) {
        const val = resolveConditionValue(c, subQueries, depth);
        clause = `${col} ${c.operator} ${val}`;
      } else {
        clause = `${col} ${c.operator} '${c.value}'`;
      }

      return i === 0 ? clause : `${c.logic} ${clause}`;
    })
    .join(`\n${inner}`);

  return `\n${indent}WHERE ${parts}`;
}

function buildSelect(node: QueryNode, depth: number, indent: string, inner: string): string {
  if (!node.table) return `${indent}-- Please fill in the table name`;
  const cols = node.selectColumns.trim() || "*";
  let sql = `SELECT ${cols}\n${indent}FROM ${node.table}`;

  for (const j of node.joins) {
    if (j.table && j.onLeft && j.onRight)
      sql += `\n${indent}${j.type} JOIN ${j.table} ON ${j.onLeft} = ${j.onRight}`;
  }

  sql += buildWhereClause(node.conditions, node.subQueries, depth, indent, inner);

  if (node.orderBy.length > 0) {
    const cols = node.orderBy.filter((o) => o.column).map((o) => `${o.column} ${o.direction}`).join(", ");
    if (cols) sql += `\n${indent}ORDER BY ${cols}`;
  }
  if (node.limit) sql += `\n${indent}LIMIT ${node.limit}`;
  return sql + ";";
}

function buildInsert(node: QueryNode): string {
  if (!node.table) return "-- Please fill in the table name";
  const filled = node.pairs.filter((p) => p.column);
  if (filled.length === 0) return "-- Add at least one column";
  const cols = filled.map((p) => p.column).join(", ");
  const vals = filled.map((p) => `'${p.value}'`).join(", ");
  return `INSERT INTO ${node.table} (${cols})\nVALUES (${vals});`;
}

function buildUpdate(node: QueryNode, depth: number, indent: string, inner: string): string {
  if (!node.table) return `${indent}-- Please fill in the table name`;
  const filled = node.pairs.filter((p) => p.column);
  if (filled.length === 0) return `${indent}-- Add at least one SET column`;
  const sets = filled.map((p) => `${inner}${p.column} = '${p.value}'`).join(",\n");
  let sql = `UPDATE ${node.table}\n${indent}SET\n${sets}`;
  sql += buildWhereClause(node.conditions, node.subQueries, depth, indent, inner);
  return sql + ";";
}

function buildDelete(node: QueryNode, depth: number, indent: string, inner: string): string {
  if (!node.table) return `${indent}-- Please fill in the table name`;
  let sql = `DELETE FROM ${node.table}`;
  sql += buildWhereClause(node.conditions, node.subQueries, depth, indent, inner);
  return sql + ";";
}

export function makeEmptyNode(operation: QueryNode["operation"] = "SELECT"): QueryNode {
  return {
    id: Math.random().toString(36).slice(2, 9),
    operation,
    table: "",
    selectColumns: "*",
    pairs: [{ id: Math.random().toString(36).slice(2, 9), column: "", value: "" }],
    conditions: [],
    joins: [],
    orderBy: [],
    limit: "",
    subQueries: {},
  };
}