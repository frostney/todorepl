import { run } from "@stricli/core";
import { createSqliteRepository } from "../storage/sqlite-store";
import { createApp } from "./app";
import { type AppContext, createAppContext } from "./context";

export const NOW = "2026-06-24T10:00:00.000Z";

export type CliResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

// Capturing AppContext bound to a db FILE path and the fixed clock. Commands and
// the REPL write through the StricliProcess sinks, so capturing those is enough;
// no console patching is needed.
export function createCapturingContext(dbFile: string): {
  context: AppContext;
  read: () => { stdout: string; stderr: string };
} {
  let stdout = "";
  let stderr = "";

  const context = createAppContext({
    process: {
      stdout: {
        write: (text) => {
          stdout += text;
        },
      },
      stderr: {
        write: (text) => {
          stderr += text;
        },
      },
    },
    openStore: () => createSqliteRepository({ path: dbFile }),
    clock: () => NOW,
  });

  return { context, read: () => ({ stdout, stderr }) };
}

// Builds the app once and returns a runner that drives command-mode integration
// tests against the SAME db file, with a fresh capturing context per call.
export function makeRunCli(dbFile: string): (args: string[]) => Promise<CliResult> {
  const app = createApp();
  return async (args) => {
    const { context, read } = createCapturingContext(dbFile);
    await run(app, args, context);
    const { stdout, stderr } = read();
    const code = context.process.exitCode;
    return { stdout, stderr, exitCode: typeof code === "number" ? code : 0 };
  };
}
