import { buildRouteMap } from "@stricli/core";
import { add, deleteCommand, done, edit, list, move, show } from "./commands/todo";
import type { AppContext } from "./context";

export const rootRoute = buildRouteMap<string, AppContext>({
  routes: {
    add,
    list,
    show,
    done,
    edit,
    move,
    delete: deleteCommand,
  },
  docs: { brief: "Date-centric todo CLI with REPL and subcommand modes." },
});
