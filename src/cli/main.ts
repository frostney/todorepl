#!/usr/bin/env bun
import { run } from "@stricli/core";
import { createApp } from "./app";
import { createAppContext } from "./context";
import { startRepl } from "./repl";

const args = Bun.argv.slice(2);

if (args.length === 0) {
  await startRepl();
} else {
  const context = createAppContext();
  await run(createApp(), args, context);
  const code = context.process.exitCode;
  if (typeof code === "number" && code !== 0) process.exitCode = code < 0 ? 1 : code;
}
