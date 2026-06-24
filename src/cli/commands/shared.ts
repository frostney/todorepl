import { type CategoryService, createCategoryService } from "../../app/category-service";
import { createTodoService, type TodoService } from "../../app/todo-service";
import type { AppContext } from "../context";

export const commonFlags = {
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

export type CommonFlags = {
  data?: string;
  json?: boolean;
};

export type Services = {
  todos: TodoService;
  categories: CategoryService;
};

export async function withServices<T>(
  ctx: AppContext,
  dataPath: string | undefined,
  fn: (services: Services) => Promise<T>,
): Promise<T> {
  const repo = ctx.openStore(dataPath);
  try {
    return await fn({
      todos: createTodoService(repo, ctx.clock),
      categories: createCategoryService(repo, ctx.clock),
    });
  } finally {
    repo.close();
  }
}
