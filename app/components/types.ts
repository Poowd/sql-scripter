// types.ts — shared SQL Forge types

export type Operator =
  | "=" | "!=" | ">" | "<" | ">=" | "<="
  | "LIKE" | "IN" | "NOT IN"
  | "IS NULL" | "IS NOT NULL"
  | "EXISTS" | "NOT EXISTS";

export type LogicGate = "AND" | "OR";
export type SQLOperation = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
export type ValueType = "string" | "number";

export interface Condition {
  id: string;
  column: string;
  operator: Operator;
  value: string;
  valueType: ValueType;   // whether value is quoted string or raw number
  logic: LogicGate;
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

export interface GroupByClause {
  id: string;
  column: string;
}

export interface ColumnValuePair {
  id: string;
  column: string;
  value: string;
  valueType: ValueType;   // whether value is quoted string or raw number
}

// A full query node (used for main query AND for nested subqueries)
export interface QueryNode {
  id: string;
  operation: SQLOperation;
  table: string;
  selectColumns: string;
  distinct: boolean;          // SELECT DISTINCT
  pairs: ColumnValuePair[];
  conditions: Condition[];
  joins: JoinClause[];
  groupBy: GroupByClause[];   // GROUP BY columns
  orderBy: OrderByClause[];
  limit: string;
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