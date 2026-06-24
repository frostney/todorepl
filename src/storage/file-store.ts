import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { Category, Todo } from "../domain/model";
import { resolveTodoDataPath } from "./data-path";
import {
  emptySnapshot,
  type FileRepositoryOptions,
  SCHEMA_VERSION,
  StoreCorruptError,
  type StoreSnapshot,
  StoreVersionError,
  type TodoRepository,
} from "./repository";

export function createFileRepository(options?: FileRepositoryOptions): TodoRepository {
  const path = resolveTodoDataPath(options?.path);

  return {
    async load(): Promise<StoreSnapshot> {
      let raw: string;
      try {
        raw = await readFile(path, "utf8");
      } catch (error) {
        if (isErrnoException(error) && error.code === "ENOENT") {
          return emptySnapshot();
        }
        throw new StoreCorruptError(path, error);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        throw new StoreCorruptError(path, error);
      }

      if (!isValidShape(parsed)) {
        throw new StoreCorruptError(path);
      }

      if (parsed.version !== SCHEMA_VERSION) {
        throw new StoreVersionError(path, parsed.version);
      }

      return {
        version: parsed.version,
        todos: parsed.todos as Todo[],
        categories: parsed.categories as Category[],
      };
    },

    async save(snapshot: StoreSnapshot): Promise<void> {
      const dir = dirname(path);
      await mkdir(dir, { recursive: true });

      const base = basename(path);
      const tempPath = join(dir, `.${base}.${crypto.randomUUID()}.tmp`);
      const contents = `${JSON.stringify(snapshot, null, 2)}\n`;

      try {
        await writeFile(tempPath, contents, "utf8");
        await rename(tempPath, path);
      } catch (error) {
        await rm(tempPath, { force: true }).catch(() => {});
        throw error;
      }
    },
  };
}

type ValidShape = {
  version: number;
  todos: unknown[];
  categories: unknown[];
};

function isValidShape(value: unknown): value is ValidShape {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === "number" &&
    Array.isArray(record.todos) &&
    Array.isArray(record.categories)
  );
}

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
