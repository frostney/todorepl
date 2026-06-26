import { type CategoryService, createCategoryService } from "../../app/category-service";
import { createTodoService, type TodoService } from "../../app/todo-service";
import type { TodoStatus } from "../../domain/model";
import type { TodoFilter, TodoRepository } from "../../storage/repository";
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
  repo: TodoRepository;
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
      repo,
    });
  } finally {
    repo.close();
  }
}

// Normalized todo filter input shared by the CLI `list` command and the agent's
// `list_todos` tool, so both surfaces map and resolve filters one way.
export type TodoFilterInput = {
  date?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  status?: TodoStatus | undefined;
  scheduled?: boolean | undefined;
  includeDeleted?: boolean | undefined;
  category?: string | undefined;
};

// Maps a TodoFilterInput into a repository TodoFilter, resolving a category
// name-or-id into a concrete id.
export async function buildTodoFilter(
  input: TodoFilterInput,
  categories: CategoryService,
): Promise<TodoFilter> {
  const filter: TodoFilter = {};
  if (input.date !== undefined) filter.date = input.date;
  if (input.from !== undefined) filter.dateFrom = input.from;
  if (input.to !== undefined) filter.dateTo = input.to;
  if (input.status !== undefined) filter.status = input.status;
  if (input.scheduled !== undefined) filter.scheduled = input.scheduled;
  if (input.includeDeleted !== undefined) filter.includeDeleted = input.includeDeleted;
  if (input.category !== undefined) filter.categoryId = await categories.resolveId(input.category);
  return filter;
}
