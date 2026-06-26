import { describe, expect, test } from "bun:test";
import type { ToolSet } from "ai";
import { createCategoryService } from "../../app/category-service";
import { fixedClock, registerMemoryRepos } from "../../app/service-test-harness";
import { createTodoService } from "../../app/todo-service";
import type { Category, Todo } from "../../domain/model";
import type { Services } from "../commands/shared";
import { createAgentTools } from "./tools";

const newRepo = registerMemoryRepos();

function makeTools(): ToolSet {
  const repo = newRepo();
  const clock = fixedClock();
  const services: Services = {
    todos: createTodoService(repo, clock),
    categories: createCategoryService(repo, clock),
    repo,
  };
  return createAgentTools(services);
}

function toolNamed(tools: ToolSet, name: string): ToolSet[string] {
  const tool = tools[name];
  if (tool === undefined) throw new Error(`missing tool: ${name}`);
  return tool;
}

// Tools ignore the execution options argument, so a cast keeps the call sites tidy.
async function run(tools: ToolSet, name: string, input: Record<string, unknown>): Promise<unknown> {
  const tool = toolNamed(tools, name);
  if (tool.execute === undefined) throw new Error(`tool ${name} is not executable`);
  return tool.execute(input as never, undefined as never);
}

function isError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

describe("createAgentTools", () => {
  test("add_todo creates a todo that list_todos then returns", async () => {
    const tools = makeTools();
    const added = (await run(tools, "add_todo", { name: "Buy milk" })) as Todo;
    expect(added.name).toBe("Buy milk");
    expect(added.status).toBe("open");

    const listed = (await run(tools, "list_todos", {})) as Todo[];
    expect(listed.map((todo) => todo.id)).toContain(added.id);
  });

  test("complete_todo marks a todo done by short id prefix", async () => {
    const tools = makeTools();
    const added = (await run(tools, "add_todo", { name: "Ship release" })) as Todo;
    const done = (await run(tools, "complete_todo", { id: added.id.slice(0, 8) })) as Todo;
    expect(done.status).toBe("done");
  });

  test("add_todo resolves a category by name into its id", async () => {
    const tools = makeTools();
    const category = (await run(tools, "create_category", { name: "Work" })) as Category;
    const added = (await run(tools, "add_todo", { name: "Standup", category: "Work" })) as Todo;
    expect(added.categoryId).toBe(category.id);
  });

  test("returns a recoverable { error } instead of throwing on an unknown id", async () => {
    const tools = makeTools();
    const result = await run(tools, "get_todo", { id: "does-not-exist" });
    expect(isError(result)).toBe(true);
  });

  test("mutating tools require approval while read tools do not", () => {
    const tools = makeTools();
    for (const name of [
      "add_todo",
      "edit_todo",
      "complete_todo",
      "move_todo",
      "remove_todo",
      "create_category",
      "remove_category",
    ]) {
      expect(toolNamed(tools, name).needsApproval).toBe(true);
    }
    for (const name of ["list_todos", "get_todo", "list_categories"]) {
      expect(toolNamed(tools, name).needsApproval).toBeUndefined();
    }
  });
});
