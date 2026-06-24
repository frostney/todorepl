#!/usr/bin/env bun
import { buildApplication, run } from "@stricli/core";
import { exitCodeForError } from "../app/errors";
import { rootRoute } from "./commands";
import { createAppContext } from "./context";
import { startRepl } from "./repl";

const args = Bun.argv.slice(2);

if (args.length === 0) {
  await startRepl();
} else {
  const app = buildApplication(rootRoute, {
    name: "todorepl",
    versionInfo: { currentVersion: "0.1.0" },
    scanner: { caseStyle: "allow-kebab-for-camel" },
    documentation: { caseStyle: "convert-camel-to-kebab" },
    determineExitCode: exitCodeForError,
  });

  const context = createAppContext();
  await run(app, args, context);
  const code = context.process.exitCode;
  if (typeof code === "number" && code !== 0) process.exitCode = code;
}
