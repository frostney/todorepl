import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Application, buildApplication, run, type StricliProcess } from "@stricli/core";
import { exitCodeForError } from "../app/errors";
import type { Todo } from "../domain/model";
import { createSqliteRepository } from "../storage/sqlite-store";
import { rootRoute } from "./commands";
import { type AppContext, createAppContext } from "./context";

const NOW = "2026-06-24T10:00:00.000Z";
const TODAY = "2026-06-24";

// Stricli resolves a command's exit code and assigns it via `context.process.exitCode ??= code`,
// so 0 (success), 2 (ValidationError), and 3 (NotFoundError) all surface on ctx.process.exitCode.
const app: Application<AppContext> = buildApplication(rootRoute, {
  name: "todorepl",
  versionInfo: { currentVersion: "0.1.0" },
  scanner: { caseStyle: "allow-kebab-for-camel" },
  documentation: { caseStyle: "convert-camel-to-kebab" },
  determineExitCode: exitCodeForError,
});

type CliResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

let workDir: string;
let dbFile: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "todorepl-commands-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

// A fresh on-disk db per test keeps cases isolated while still persisting state
// across the multiple `runCli` calls a single test makes (":memory:" would reset
// on every open, since each command opens its own connection).
beforeEach(async () => {
  dbFile = join(await mkdtemp(join(workDir, "db-")), "todos.db");
});

afterEach(async () => {
  await rm(dbFile, { recursive: true, force: true });
});

// Drives the real Stricli application end-to-end. Output may be emitted via the
// injected StricliProcess streams or via console.log/console.error, so capture
// both and merge them.
async function runCli(args: string[]): Promise<CliResult> {
  let stdout = "";
  let stderr = "";

  const proc: StricliProcess = {
    stdout: {
      write: (text: string): void => {
        stdout += text;
      },
    },
    stderr: {
      write: (text: string): void => {
        stderr += text;
      },
    },
  };

  const context = createAppContext({
    process: proc,
    openStore: () => createSqliteRepository({ path: dbFile }),
    clock: () => NOW,
  });

  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...parts: unknown[]): void => {
    stdout += `${parts.map(String).join(" ")}\n`;
  };
  console.error = (...parts: unknown[]): void => {
    stderr += `${parts.map(String).join(" ")}\n`;
  };

  try {
    await run(app, args, context);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return { stdout, stderr, exitCode: asExitCode(context.process.exitCode) };
}

function asExitCode(code: StricliProcess["exitCode"]): number {
  return typeof code === "number" ? code : 0;
}

function parseTodo(stdout: string): Todo {
  return JSON.parse(stdout) as Todo;
}

function parseTodos(stdout: string): Todo[] {
  return JSON.parse(stdout) as Todo[];
}

// Adds a todo via the CLI, asserts success, and returns the parsed Todo so tests
// can chain follow-up commands against a real generated id.
async function addTodo(name: string, extraArgs: string[] = []): Promise<Todo> {
  const result = await runCli(["add", name, "--date", TODAY, "--json", ...extraArgs]);
  expect(result.exitCode).toBe(0);
  return parseTodo(result.stdout);
}

describe("add", () => {
  test("creates an open todo with id, name, and date", async () => {
    const result = await runCli(["add", "Buy milk", "--date", TODAY, "--json"]);

    expect(result.exitCode).toBe(0);
    const todo = parseTodo(result.stdout);
    expect(todo.name).toBe("Buy milk");
    expect(todo.date).toBe(TODAY);
    expect(todo.status).toBe("open");
    expect(typeof todo.id).toBe("string");
    expect(todo.id.length).toBeGreaterThan(0);
  });

  test("rejects an invalid date with exit code 2", async () => {
    const result = await runCli(["add", "x", "--date", "not-a-date", "--json"]);

    expect(result.exitCode).toBe(2);
  });
});

describe("list", () => {
  test("returns the added todos as a JSON array", async () => {
    const first = await addTodo("First");
    const second = await addTodo("Second");

    const result = await runCli(["list", "--json"]);

    expect(result.exitCode).toBe(0);
    const todos = parseTodos(result.stdout);
    expect(todos.map((todo) => todo.id).sort()).toEqual([first.id, second.id].sort());
  });

  test("filters by date and status", async () => {
    const open = await addTodo("Stay open");
    const done = await addTodo("Finish me");
    await runCli(["done", done.id, "--json"]);

    const result = await runCli(["list", "--date", TODAY, "--status", "done", "--json"]);

    expect(result.exitCode).toBe(0);
    const todos = parseTodos(result.stdout);
    expect(todos.map((todo) => todo.id)).toEqual([done.id]);
    expect(todos.map((todo) => todo.id)).not.toContain(open.id);
  });
});

describe("show", () => {
  test("returns the todo for a full id", async () => {
    const created = await addTodo("Inspect me");

    const result = await runCli(["show", created.id, "--json"]);

    expect(result.exitCode).toBe(0);
    expect(parseTodo(result.stdout).id).toBe(created.id);
  });

  test("resolves a unique id prefix", async () => {
    const created = await addTodo("Prefix lookup");

    const result = await runCli(["show", created.id.slice(0, 8), "--json"]);

    expect(result.exitCode).toBe(0);
    expect(parseTodo(result.stdout).id).toBe(created.id);
  });

  test("returns exit code 3 for an unknown id", async () => {
    const result = await runCli(["show", "does-not-exist", "--json"]);

    expect(result.exitCode).toBe(3);
  });
});

describe("done", () => {
  test("marks a todo as done", async () => {
    const created = await addTodo("Complete me");

    const result = await runCli(["done", created.id, "--json"]);

    expect(result.exitCode).toBe(0);
    expect(parseTodo(result.stdout).status).toBe("done");
  });
});

describe("edit", () => {
  test("updates the name", async () => {
    const created = await addTodo("Old name");

    const result = await runCli(["edit", created.id, "--name", "New", "--json"]);

    expect(result.exitCode).toBe(0);
    const edited = parseTodo(result.stdout);
    expect(edited.id).toBe(created.id);
    expect(edited.name).toBe("New");
  });
});

describe("move", () => {
  test("changes the date", async () => {
    const created = await addTodo("Reschedule me");

    const result = await runCli(["move", created.id, "2026-07-01", "--json"]);

    expect(result.exitCode).toBe(0);
    const moved = parseTodo(result.stdout);
    expect(moved.id).toBe(created.id);
    expect(moved.date).toBe("2026-07-01");
  });
});

describe("delete", () => {
  test("removes the todo from list but keeps it with --include-deleted", async () => {
    const kept = await addTodo("Keep me");
    const doomed = await addTodo("Delete me");

    const deleted = await runCli(["delete", doomed.id, "--json"]);
    expect(deleted.exitCode).toBe(0);

    const listed = await runCli(["list", "--json"]);
    expect(listed.exitCode).toBe(0);
    const visibleIds = parseTodos(listed.stdout).map((todo) => todo.id);
    expect(visibleIds).toContain(kept.id);
    expect(visibleIds).not.toContain(doomed.id);

    const withDeleted = await runCli(["list", "--include-deleted", "--json"]);
    expect(withDeleted.exitCode).toBe(0);
    expect(parseTodos(withDeleted.stdout).map((todo) => todo.id)).toContain(doomed.id);
  });
});

describe("end-to-end lifecycle", () => {
  test("add, edit, move, done, then delete persist across commands", async () => {
    const created = await addTodo("Lifecycle");

    await runCli(["edit", created.id, "--name", "Lifecycle renamed", "--json"]);
    await runCli(["move", created.id, "2026-07-01", "--json"]);
    await runCli(["done", created.id, "--json"]);

    const shown = await runCli(["show", created.id, "--json"]);
    expect(shown.exitCode).toBe(0);
    const todo = parseTodo(shown.stdout);
    expect(todo.name).toBe("Lifecycle renamed");
    expect(todo.date).toBe("2026-07-01");
    expect(todo.status).toBe("done");

    await runCli(["delete", created.id, "--json"]);
    const finalList = await runCli(["list", "--json"]);
    expect(parseTodos(finalList.stdout).map((t) => t.id)).not.toContain(created.id);
  });
});
