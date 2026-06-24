import { afterEach, describe, expect, test } from "bun:test";
import type { Todo } from "../domain/model";
import type { TodoRepository } from "../storage/repository";
import { createSqliteRepository } from "../storage/sqlite-store";
import {
  type CategoryService,
  type CreateCategoryInput,
  createCategoryService,
} from "./category-service";
import type { Clock } from "./clock";
import { NotFoundError, ValidationError } from "./errors";

const NOW = "2026-06-24T10:00:00.000Z";

const openRepos: TodoRepository[] = [];

afterEach(() => {
  while (openRepos.length > 0) {
    const repo = openRepos.pop();
    try {
      repo?.close();
    } catch {
      // ignore close failures during teardown
    }
  }
});

function fixedClock(now: string = NOW): Clock {
  return () => now;
}

// Distinct, ordered timestamps so updatedAt can be told apart from createdAt.
function steppingClock(start = NOW): Clock {
  let tick = Date.parse(start);
  return () => {
    const value = new Date(tick).toISOString();
    tick += 1_000;
    return value;
  };
}

function makeService(clock: Clock = fixedClock()): {
  service: CategoryService;
  repo: TodoRepository;
} {
  const repo = createSqliteRepository({ path: ":memory:" });
  openRepos.push(repo);
  return { service: createCategoryService(repo, clock), repo };
}

// Spread over a base so absent optionals are never set to `undefined`
// (exactOptionalPropertyTypes rejects { field: undefined }).
function category(overrides: Partial<CreateCategoryInput> = {}): CreateCategoryInput {
  return { name: "Work", ...overrides };
}

const TODO_BASE: Todo = {
  id: "todo-base",
  name: "Base todo",
  date: "2026-06-24",
  status: "open",
  order: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

// Adds a todo referencing the given category, returning its id for later lookup.
async function seedTodoFor(repo: TodoRepository, categoryId: string): Promise<string> {
  const todo: Todo = { ...TODO_BASE, id: "todo-in-use", categoryId };
  await repo.putTodo(todo);
  return todo.id;
}

describe("create", () => {
  test("returns a category with generated id and clock timestamps", async () => {
    const { service } = makeService();

    const created = await service.create(category({ name: "Errands" }));

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Errands");
    expect(created.createdAt).toBe(NOW);
    expect(created.updatedAt).toBe(NOW);
    expect(created.color).toBeUndefined();
    expect(created.emoji).toBeUndefined();
  });

  test("stores provided color and emoji", async () => {
    const { service } = makeService();

    const created = await service.create(category({ color: "#ff8800", emoji: "💼" }));

    expect(created.color).toBe("#ff8800");
    expect(created.emoji).toBe("💼");
  });

  test("rejects an empty or whitespace name", async () => {
    const { service } = makeService();

    await expect(service.create(category({ name: "   " }))).rejects.toBeInstanceOf(ValidationError);
  });

  test("rejects a duplicate name", async () => {
    const { service } = makeService();
    await service.create(category({ name: "Work" }));

    await expect(service.create(category({ name: "Work" }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("list", () => {
  test("returns created categories", async () => {
    const { service } = makeService();
    const work = await service.create(category({ name: "Work" }));
    const home = await service.create(category({ name: "Home" }));

    const listed = await service.list();

    expect(listed.map((row) => row.id).sort()).toEqual([work.id, home.id].sort());
  });
});

describe("identifier matching", () => {
  test("get and resolveId accept an exact id", async () => {
    const { service } = makeService();
    const created = await service.create(category({ name: "Work" }));

    expect((await service.get(created.id)).id).toBe(created.id);
    expect(await service.resolveId(created.id)).toBe(created.id);
  });

  test("get and resolveId accept an exact name", async () => {
    const { service } = makeService();
    const created = await service.create(category({ name: "Work" }));

    expect((await service.get("Work")).id).toBe(created.id);
    expect(await service.resolveId("Work")).toBe(created.id);
  });

  test("get throws NotFoundError for an unknown identifier", async () => {
    const { service } = makeService();

    await expect(service.get("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("resolveId throws NotFoundError for an unknown identifier", async () => {
    const { service } = makeService();

    await expect(service.resolveId("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("edit", () => {
  test("updates provided fields and bumps updatedAt", async () => {
    const { service } = makeService(steppingClock());
    const created = await service.create(category({ name: "Work", emoji: "💼" }));

    const edited = await service.edit(created.id, { name: "Office", color: "#0088ff" });

    expect(edited.name).toBe("Office");
    expect(edited.color).toBe("#0088ff");
    expect(edited.emoji).toBe("💼");
    expect(edited.createdAt).toBe(created.createdAt);
    expect(edited.updatedAt).not.toBe(created.updatedAt);
  });

  test("rejects renaming to another category's name", async () => {
    const { service } = makeService();
    await service.create(category({ name: "Home" }));
    const work = await service.create(category({ name: "Work" }));

    await expect(service.edit(work.id, { name: "Home" })).rejects.toBeInstanceOf(ValidationError);
  });

  test("throws NotFoundError for an unknown identifier", async () => {
    const { service } = makeService();

    await expect(service.edit("nope", { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("remove", () => {
  test("deletes an unused category", async () => {
    const { service } = makeService();
    const created = await service.create(category({ name: "Work" }));

    await service.remove(created.id);

    await expect(service.get(created.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await service.list()).toEqual([]);
  });

  test("accepts an exact name", async () => {
    const { service } = makeService();
    await service.create(category({ name: "Work" }));

    await service.remove("Work");

    expect(await service.list()).toEqual([]);
  });

  test("throws NotFoundError for an unknown identifier", async () => {
    const { service } = makeService();

    await expect(service.remove("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  test("rejects removing a category in use without force, leaving state unchanged", async () => {
    const { service, repo } = makeService();
    const created = await service.create(category({ name: "Work" }));
    const todoId = await seedTodoFor(repo, created.id);

    await expect(service.remove(created.id)).rejects.toBeInstanceOf(ValidationError);

    expect((await service.get(created.id)).id).toBe(created.id);
    expect((await repo.getTodo(todoId))?.categoryId).toBe(created.id);
  });

  test("removes a category in use with force and un-assigns its todo", async () => {
    const { service, repo } = makeService();
    const created = await service.create(category({ name: "Work" }));
    const todoId = await seedTodoFor(repo, created.id);

    await service.remove(created.id, { force: true });

    await expect(service.get(created.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await repo.getTodo(todoId))?.categoryId).toBeUndefined();
  });
});
