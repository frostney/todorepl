#!/usr/bin/env bun
import { run } from "@stricli/core";
import { startAgentRepl } from "./agent-repl";
import { createApp } from "./app";
import { createAppContext } from "./context";

const args = Bun.argv.slice(2);

if (args.length === 0) {
  await startAgentRepl();
} else {
  const context = createAppContext();
  await run(createApp(), args, context);
  const code = context.process.exitCode;
  if (typeof code === "number" && code !== 0) process.exitCode = code < 0 ? 1 : code;
}
