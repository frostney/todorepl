import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StricliProcess } from "@stricli/core";
import type { Todo } from "../domain/model";
import { createSqliteRepository } from "../storage/sqlite-store";
import { createApp } from "./app";
import { type AppContext, createAppContext } from "./context";
import { processReplInput } from "./repl";

const NOW = "2026-06-24T10:00:00.000Z";
const TODAY = "2026-06-24";

const app = createApp();

let workDir: string;
let dbFile: string;
let stdout: string;
let stderr: string;
let context: AppContext;

// Output may arrive on the injected StricliProcess streams or via
// console.log/console.error, so capture both into the same buffers (mirroring
// commands.test.ts) and reset them before each fed line.
function resetCapture(): void {
  stdout = "";
  stderr = "";
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "todorepl-repl-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

// A fresh on-disk db per test isolates cases while still persisting state across
// the multiple lines a single test feeds (":memory:" would reset on every open).
beforeEach(async () => {
  dbFile = join(await mkdtemp(join(workDir, "db-")), "todos.db");
  resetCapture();
  const proc: StricliProcess = {
    stdout: {
      write: (text: string) => {
        stdout += text;
      },
    },
    stderr: {
      write: (text: string) => {
        stderr += text;
      },
    },
  };
  context = createAppContext({
    process: proc,
    openStore: () => createSqliteRepository({ path: dbFile }),
    clock: () => NOW,
  });
});

afterEach(async () => {
  await rm(dbFile, { recursive: true, force: true });
});

type FedResult = { result: "continue" | "exit"; stdout: string; stderr: string };

// Resets buffers, dispatches one line through the REPL, and returns the outcome
// plus whatever it wrote. console.log/console.error are merged into the same
// buffers for the duration of the call.
async function feed(line: string): Promise<FedResult> {
  resetCapture();
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...parts: unknown[]) => {
    stdout += `${parts.map(String).join(" ")}\n`;
  };
  console.error = (...parts: unknown[]) => {
    stderr += `${parts.map(String).join(" ")}\n`;
  };
  try {
    const result = await processReplInput(line, app, context);
    return { result, stdout, stderr };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

const parseTodo = (text: string): Todo => JSON.parse(text) as Todo;
const parseTodos = (text: string): Todo[] => JSON.parse(text) as Todo[];

describe("processReplInput", () => {
  test("treats an empty line as a no-op continue", async () => {
    const { result, stdout: out } = await feed("");
    expect(result).toBe("continue");
    expect(out).toBe("");
  });

  test("treats a whitespace-only line as a no-op continue", async () => {
    const { result, stdout: out } = await feed("   \t  ");
    expect(result).toBe("continue");
    expect(out).toBe("");
  });

  test("exits on exit", async () => {
    expect((await feed("exit")).result).toBe("exit");
  });

  test("exits on quit", async () => {
    expect((await feed("quit")).result).toBe("exit");
  });

  test("prints command help and continues", async () => {
    const { result, stdout: out } = await feed("help");
    expect(result).toBe("continue");
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/add|list|Usage/i);
  });

  test("dispatches a quoted add through the shared app, preserving the name", async () => {
    const { result, stdout: out } = await feed('add "Buy milk" --date 2026-06-24 --json');
    expect(result).toBe("continue");
    const todo = parseTodo(out);
    expect(todo.name).toBe("Buy milk");
    expect(todo.date).toBe(TODAY);
    expect(todo.status).toBe("open");
  });

  test("persists state across lines so a later list sees the added todo", async () => {
    const created = parseTodo((await feed('add "Buy milk" --date 2026-06-24 --json')).stdout);

    const { result, stdout: out } = await feed("list --json");
    expect(result).toBe("continue");
    const ids = parseTodos(out).map((todo) => todo.id);
    expect(ids).toContain(created.id);
  });

  test("continues (non-fatal) on an unknown command and reports to stderr", async () => {
    const { result, stderr: err } = await feed("bogus");
    expect(result).toBe("continue");
    expect(err.length).toBeGreaterThan(0);
  });

  test("continues (non-fatal) on invalid input and reports to stderr", async () => {
    const { result, stderr: err } = await feed("add Oops --date not-a-date --json");
    expect(result).toBe("continue");
    expect(err.length).toBeGreaterThan(0);
  });
});
