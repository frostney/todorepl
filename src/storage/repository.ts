import type { Category, Todo } from "../domain/model";

export const SCHEMA_VERSION = 1;

export type StoreSnapshot = {
  version: number;
  todos: Todo[];
  categories: Category[];
};

export type FileRepositoryOptions = {
  path?: string;
};

export interface TodoRepository {
  load(): Promise<StoreSnapshot>;
  save(snapshot: StoreSnapshot): Promise<void>;
}

export function emptySnapshot(): StoreSnapshot {
  return { version: SCHEMA_VERSION, todos: [], categories: [] };
}

export class StoreCorruptError extends Error {
  constructor(path: string, cause?: unknown) {
    super(
      `Todo data file is corrupt or unreadable: ${path}. Inspect or remove the file, then retry.`,
      cause !== undefined ? { cause } : undefined,
    );
    this.name = "StoreCorruptError";
  }
}

export class StoreVersionError extends Error {
  constructor(path: string, foundVersion: number, supportedVersion: number = SCHEMA_VERSION) {
    super(
      `Todo data file at ${path} uses unsupported schema version ${foundVersion}; ` +
        `this build supports version ${supportedVersion}. Upgrade todorepl or restore a compatible file.`,
    );
    this.name = "StoreVersionError";
  }
}
