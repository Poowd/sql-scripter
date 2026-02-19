// types.ts — shared SQL Forge types

export type Operator =
  | "=" | "!=" | ">" | "<" | ">=" | "<="
  | "LIKE" | "IN" | "NOT IN"
  | "IS NULL" | "IS NOT NULL"
  | "EXISTS" | "NOT EXISTS";

export type LogicGate = "AND" | "OR";
export type SQLOperation = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

// A single flat WHERE condition (value can be a literal or a subquery id)
export interface Condition {
  id: string;
  column: string;
  operator: Operator;
  value: string;
  logic: LogicGate;
  // If set, this condition's value is a nested subquery instead of a literal
  subQueryId?: string;
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

export interface ColumnValuePair {
  id: string;
  column: string;
  value: string;
}

// A full query node (used for main query AND for nested subqueries)
export interface QueryNode {
  id: string;
  operation: SQLOperation;
  table: string;
  selectColumns: string;
  pairs: ColumnValuePair[];
  conditions: Condition[];
  joins: JoinClause[];
  orderBy: OrderByClause[];
  limit: string;
  // Child subquery nodes keyed by their id (used as subquery values in conditions)
  subQueries: Record<string, QueryNode>;
}

// Root persisted schema
export interface VisualQuerySchema {
  $schema: "sql-forge/visual-query/v1";
  meta: {
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  root: QueryNode;
}

export const SUBQUERY_OPERATORS: Operator[] = ["IN", "NOT IN", "EXISTS", "NOT EXISTS"];
export const OPERATORS: Operator[] = [
  "=", "!=", ">", "<", ">=", "<=",
  "LIKE", "IN", "NOT IN",
  "IS NULL", "IS NOT NULL",
  "EXISTS", "NOT EXISTS",
];