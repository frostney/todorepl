#!/usr/bin/env bun
import { buildApplication, run } from "@stricli/core";
import { rootRoute } from "./commands";
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
  });

  await run(app, args, { process: process as never });
}
