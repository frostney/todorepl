import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Category, CategoryId, Todo, TodoId } from "../domain/model";
import { resolveTodoDataPath } from "./data-path";
import {
  type RepositoryOptions,
  SCHEMA_VERSION,
  StoreCorruptError,
  type StoreSnapshot,
  StoreVersionError,
  type TodoFilter,
  type TodoRepository,
} from "./repository";

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, emoji TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL,
  "order" INTEGER NOT NULL, category_id TEXT, emoji TEXT, scheduled_time INTEGER,
  duration INTEGER, completed_at TEXT, deleted_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_date_status ON todos (date, status);
CREATE INDEX IF NOT EXISTS idx_todos_category ON todos (category_id);
`;

type TodoRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  order: number;
  category_id: string | null;
  emoji: string | null;
  scheduled_time: number | null;
  duration: number | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  name: string;
  color: string | null;
  emoji: string | null;
  created_at: string;
  updated_at: string;
};

const TODO_UPSERT = `INSERT OR REPLACE INTO todos (
  id, name, date, status, "order", category_id, emoji, scheduled_time,
  duration, completed_at, deleted_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const CATEGORY_UPSERT = `INSERT OR REPLACE INTO categories (
  id, name, color, emoji, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?)`;

function mapTodoRow(row: TodoRow): Todo {
  const todo: Todo = {
    id: row.id,
    name: row.name,
    date: row.date,
    status: row.status as Todo["status"],
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.category_id !== null) todo.categoryId = row.category_id;
  if (row.emoji !== null) todo.emoji = row.emoji;
  if (row.scheduled_time !== null) todo.scheduledTime = row.scheduled_time;
  if (row.duration !== null) todo.duration = row.duration as NonNullable<Todo["duration"]>;
  if (row.completed_at !== null) todo.completedAt = row.completed_at;
  if (row.deleted_at !== null) todo.deletedAt = row.deleted_at;
  return todo;
}

function mapCategoryRow(row: CategoryRow): Category {
  const category: Category = {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.color !== null) category.color = row.color;
  if (row.emoji !== null) category.emoji = row.emoji;
  return category;
}

function todoParams(todo: Todo): Array<string | number | null> {
  return [
    todo.id,
    todo.name,
    todo.date,
    todo.status,
    todo.order,
    todo.categoryId ?? null,
    todo.emoji ?? null,
    todo.scheduledTime ?? null,
    todo.duration ?? null,
    todo.completedAt ?? null,
    todo.deletedAt ?? null,
    todo.createdAt,
    todo.updatedAt,
  ];
}

function categoryParams(category: Category): Array<string | number | null> {
  return [
    category.id,
    category.name,
    category.color ?? null,
    category.emoji ?? null,
    category.createdAt,
    category.updatedAt,
  ];
}

function buildTodoWhere(filter: TodoFilter = {}): {
  clause: string;
  params: Array<string | number>;
} {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  const comparisons: Array<[value: string | undefined, sql: string]> = [
    [filter.date, "date = ?"],
    [filter.dateFrom, "date >= ?"],
    [filter.dateTo, "date <= ?"],
    [filter.categoryId, "category_id = ?"],
    [filter.status, "status = ?"],
  ];
  for (const [value, sql] of comparisons) {
    if (value !== undefined) {
      conditions.push(sql);
      params.push(value);
    }
  }

  if (filter.scheduled === true) conditions.push("scheduled_time IS NOT NULL");
  else if (filter.scheduled === false) conditions.push("scheduled_time IS NULL");
  if (filter.includeDeleted !== true) conditions.push("deleted_at IS NULL");

  const clause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  return { clause, params };
}

const TODO_ORDER_BY = ` ORDER BY date ASC, "order" ASC, id ASC`;
const CATEGORY_ORDER_BY = ` ORDER BY name ASC, id ASC`;

export function createSqliteRepository(options?: RepositoryOptions): TodoRepository {
  const path = options?.path === ":memory:" ? ":memory:" : resolveTodoDataPath(options?.path);

  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path, { create: true });
  try {
    const uv = (db.query("PRAGMA user_version").get() as { user_version: number }).user_version;
    if (uv > SCHEMA_VERSION) throw new StoreVersionError(path, uv);
    db.run(SCHEMA_DDL);
    if (uv === 0) db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  } catch (error) {
    db.close();
    if (error instanceof StoreVersionError) throw error;
    throw new StoreCorruptError(path, error);
  }

  const todoUpsert = db.query(TODO_UPSERT);
  const categoryUpsert = db.query(CATEGORY_UPSERT);
  const unassignTodosByCategory = db.query(
    "UPDATE todos SET category_id = NULL, updated_at = ? WHERE category_id = ?",
  );
  const deleteCategory = db.query("DELETE FROM categories WHERE id = ?");
  const deleteCategoryAndUnassignTodosTransaction = db.transaction(
    (id: CategoryId, updatedAt: string): void => {
      unassignTodosByCategory.run(updatedAt, id);
      deleteCategory.run(id);
    },
  );

  return {
    async listTodos(filter?: TodoFilter): Promise<Todo[]> {
      const { clause, params } = buildTodoWhere(filter);
      const rows = db
        .query(`SELECT * FROM todos${clause}${TODO_ORDER_BY}`)
        .all(...params) as TodoRow[];
      return rows.map(mapTodoRow);
    },

    async getTodo(id: TodoId): Promise<Todo | undefined> {
      const row = db.query("SELECT * FROM todos WHERE id = ?").get(id) as TodoRow | null;
      return row === null ? undefined : mapTodoRow(row);
    },

    async putTodo(todo: Todo): Promise<void> {
      todoUpsert.run(...todoParams(todo));
    },

    async listCategories(): Promise<Category[]> {
      const rows = db.query(`SELECT * FROM categories${CATEGORY_ORDER_BY}`).all() as CategoryRow[];
      return rows.map(mapCategoryRow);
    },

    async getCategory(id: CategoryId): Promise<Category | undefined> {
      const row = db.query("SELECT * FROM categories WHERE id = ?").get(id) as CategoryRow | null;
      return row === null ? undefined : mapCategoryRow(row);
    },

    async putCategory(category: Category): Promise<void> {
      categoryUpsert.run(...categoryParams(category));
    },

    async deleteCategoryAndUnassignTodos(id: CategoryId, updatedAt: string): Promise<void> {
      deleteCategoryAndUnassignTodosTransaction(id, updatedAt);
    },

    async exportSnapshot(): Promise<StoreSnapshot> {
      const todoRows = db.query(`SELECT * FROM todos${TODO_ORDER_BY}`).all() as TodoRow[];
      const categoryRows = db
        .query(`SELECT * FROM categories${CATEGORY_ORDER_BY}`)
        .all() as CategoryRow[];
      return {
        version: SCHEMA_VERSION,
        todos: todoRows.map(mapTodoRow),
        categories: categoryRows.map(mapCategoryRow),
      };
    },

    async importSnapshot(snapshot: StoreSnapshot): Promise<void> {
      if (snapshot.version !== SCHEMA_VERSION) {
        throw new StoreVersionError(path, snapshot.version);
      }
      const replaceAll = db.transaction(() => {
        db.run("DELETE FROM todos");
        db.run("DELETE FROM categories");
        for (const category of snapshot.categories) {
          categoryUpsert.run(...categoryParams(category));
        }
        for (const todo of snapshot.todos) {
          todoUpsert.run(...todoParams(todo));
        }
      });
      replaceAll();
    },

    close(): void {
      db.close();
    },
  };
}
