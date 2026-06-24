import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { Category, Todo } from "../domain/model";
import { createFileRepository } from "./file-store";
import type { StoreSnapshot } from "./repository";
import { emptySnapshot, SCHEMA_VERSION, StoreCorruptError, StoreVersionError } from "./repository";

const tempDirs: string[] = [];

async function makeRepo(fileName = "todos.json") {
  const dir = await mkdtemp(join(tmpdir(), "todorepl-store-"));
  tempDirs.push(dir);
  const path = join(dir, fileName);
  return { repo: createFileRepository({ path }), path, dir };
}

function sampleSnapshot(): StoreSnapshot {
  const category = {
    id: "cat-work",
    name: "Work",
    color: "#ff8800",
    emoji: "💼",
    createdAt: "2026-06-24T10:00:00.000Z",
    updatedAt: "2026-06-24T10:00:00.000Z",
  } satisfies Category;

  const todo = {
    id: "todo-1",
    name: "Ship storage engine",
    date: "2026-06-24",
    status: "done",
    order: 0,
    categoryId: category.id,
    emoji: "🚨",
    scheduledTime: 540,
    duration: 30,
    completedAt: "2026-06-24T11:00:00.000Z",
    createdAt: "2026-06-24T10:00:00.000Z",
    updatedAt: "2026-06-24T11:00:00.000Z",
  } satisfies Todo;

  return { version: SCHEMA_VERSION, todos: [todo], categories: [category] };
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("createFileRepository", () => {
  test("load() on a missing file returns an empty snapshot without creating the file", async () => {
    const { repo, path } = await makeRepo();

    const snapshot = await repo.load();

    expect(snapshot).toEqual(emptySnapshot());
    expect(snapshot.version).toBe(SCHEMA_VERSION);
    expect(snapshot.todos).toEqual([]);
    expect(snapshot.categories).toEqual([]);
    expect(await pathExists(path)).toBe(false);
  });

  test("save() then load() round-trips a fully-populated snapshot", async () => {
    const { repo } = await makeRepo();
    const snapshot = sampleSnapshot();

    await repo.save(snapshot);

    expect(await repo.load()).toEqual(snapshot);
  });

  test("save() creates missing parent directories", async () => {
    const { dir } = await makeRepo();
    const path = join(dir, "nested", "deeper", "todos.json");
    const repo = createFileRepository({ path });
    const snapshot = sampleSnapshot();

    await repo.save(snapshot);

    expect(await pathExists(path)).toBe(true);
    expect(await repo.load()).toEqual(snapshot);
  });

  test("load() rejects invalid JSON with StoreCorruptError", async () => {
    const { repo, path } = await makeRepo();
    await writeFile(path, "{ not valid json", "utf8");

    await expect(repo.load()).rejects.toBeInstanceOf(StoreCorruptError);
  });

  test("load() rejects valid JSON of the wrong shape with StoreCorruptError", async () => {
    const { repo, path } = await makeRepo();
    await writeFile(path, JSON.stringify({ version: 1, todos: "nope", categories: [] }), "utf8");

    await expect(repo.load()).rejects.toBeInstanceOf(StoreCorruptError);
  });

  test("load() rejects an unknown schema version with StoreVersionError", async () => {
    const { repo, path } = await makeRepo();
    await writeFile(path, JSON.stringify({ version: 999, todos: [], categories: [] }), "utf8");

    await expect(repo.load()).rejects.toBeInstanceOf(StoreVersionError);
  });

  test("save() writes atomically and fully replaces prior contents", async () => {
    const { repo, path, dir } = await makeRepo();
    const first = sampleSnapshot();

    await repo.save(first);

    expect(await readdir(dir)).toEqual([basename(path)]);

    const second: StoreSnapshot = {
      version: SCHEMA_VERSION,
      todos: [
        {
          id: "todo-2",
          name: "Replace everything",
          date: "2026-06-25",
          status: "open",
          order: 0,
          createdAt: "2026-06-25T09:00:00.000Z",
          updatedAt: "2026-06-25T09:00:00.000Z",
        },
      ],
      categories: [],
    };

    await repo.save(second);

    expect(await repo.load()).toEqual(second);
    expect(await readdir(dir)).toEqual([basename(path)]);
  });
});
