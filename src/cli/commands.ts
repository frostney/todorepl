import { buildCommand, buildRouteMap } from "@stricli/core";
import { resolveTodoDataPath } from "../storage/data-path";
import { printJson, printTable } from "./output";

type CommonFlags = {
  data?: string;
  json?: boolean;
};

const commonFlags = {
  data: {
    kind: "parsed",
    parse: String,
    optional: true,
    brief: "Path to the todorepl data file.",
    placeholder: "path",
  },
  json: {
    kind: "boolean",
    optional: true,
    brief: "Print JSON output.",
  },
} as const;

const addCommand = buildCommand<CommonFlags, [string]>({
  docs: { brief: "Add a todo." },
  parameters: {
    flags: commonFlags,
    positional: {
      kind: "tuple",
      parameters: [{ parse: String, brief: "Todo name.", placeholder: "name" }],
    },
  },
  async func(flags, name) {
    const result = {
      status: "planned",
      name,
      data: resolveTodoDataPath(flags.data),
    };
    flags.json ? printJson(result) : printTable([result]);
  },
});

const listCommand = buildCommand<CommonFlags>({
  docs: { brief: "List todos." },
  parameters: { flags: commonFlags },
  async func(flags) {
    const rows: Record<string, unknown>[] = [];
    flags.json ? printJson(rows) : printTable(rows);
  },
});

export const rootRoute = buildRouteMap({
  routes: {
    add: addCommand,
    list: listCommand,
  },
  docs: { brief: "Date-centric todo CLI with REPL and subcommand modes." },
});
