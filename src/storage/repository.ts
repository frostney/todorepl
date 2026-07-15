import type { Category, CategoryId, DateString, Todo, TodoId, TodoStatus } from "../domain/model";

export const SCHEMA_VERSION = 1;

export type StoreSnapshot = {
  version: number;
  todos: Todo[];
  categories: Category[];
};

export type TodoFilter = {
  date?: DateString;
  dateFrom?: DateString;
  dateTo?: DateString;
  categoryId?: CategoryId;
  status?: TodoStatus;
  scheduled?: boolean;
  includeDeleted?: boolean;
};

export type RepositoryOptions = {
  path?: string;
};

export interface TodoRepository {
  listTodos(filter?: TodoFilter): Promise<Todo[]>;
  getTodo(id: TodoId): Promise<Todo | undefined>;
  putTodo(todo: Todo): Promise<void>;
  listCategories(): Promise<Category[]>;
  getCategory(id: CategoryId): Promise<Category | undefined>;
  putCategory(category: Category): Promise<void>;
  deleteCategoryAndUnassignTodos(id: CategoryId, updatedAt: string): Promise<void>;
  exportSnapshot(): Promise<StoreSnapshot>;
  importSnapshot(snapshot: StoreSnapshot): Promise<void>;
  close(): void;
}

export function emptySnapshot(): StoreSnapshot {
  return { version: SCHEMA_VERSION, todos: [], categories: [] };
}

export class StoreCorruptError extends Error {
  constructor(path: string, cause?: unknown) {
    super(
      `Todo database is corrupt or unreadable: ${path}. Inspect or remove the file, then retry.`,
      cause !== undefined ? { cause } : undefined,
    );
    this.name = "StoreCorruptError";
  }
}

export class StoreVersionError extends Error {
  constructor(path: string, foundVersion: number, supportedVersion: number = SCHEMA_VERSION) {
    super(
      `Todo database at ${path} uses unsupported schema version ${foundVersion}; ` +
        `this build supports version ${supportedVersion}. Upgrade todorepl or restore a compatible file.`,
    );
    this.name = "StoreVersionError";
  }
}
