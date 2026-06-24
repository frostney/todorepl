import type { Todo } from "../domain/model";
import { parseDateString, parseMinuteOfDay, parseTodoDuration } from "../domain/validation";
import type { TodoFilter, TodoRepository } from "../storage/repository";
import { type Clock, systemClock } from "./clock";
import { AmbiguousMatchError, NotFoundError, ValidationError } from "./errors";

export type AddTodoInput = {
  name: string;
  date?: string;
  scheduledTime?: string;
  duration?: string;
  categoryId?: string;
  emoji?: string;
};

export type EditTodoInput = {
  name?: string;
  scheduledTime?: string;
  duration?: string;
  categoryId?: string;
  emoji?: string;
};

export type MoveTodoInput = {
  date: string;
};

export interface TodoService {
  add(input: AddTodoInput): Promise<Todo>;
  list(filter?: TodoFilter): Promise<Todo[]>;
  get(idOrPrefix: string): Promise<Todo>;
  complete(idOrPrefix: string): Promise<Todo>;
  edit(idOrPrefix: string, changes: EditTodoInput): Promise<Todo>;
  move(idOrPrefix: string, move: MoveTodoInput): Promise<Todo>;
  remove(idOrPrefix: string): Promise<Todo>;
}

type OptionalTodoFields = Pick<Todo, "categoryId" | "emoji" | "scheduledTime" | "duration">;

function validate<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error));
  }
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Todo name is required");
  }
  return trimmed;
}

function applyOptionalFields(target: Partial<OptionalTodoFields>, input: EditTodoInput): void {
  if (input.scheduledTime !== undefined) {
    target.scheduledTime = validate(() => parseMinuteOfDay(input.scheduledTime as string));
  }
  if (input.duration !== undefined) {
    target.duration = validate(() => parseTodoDuration(input.duration as string));
  }
  if (input.categoryId !== undefined) {
    target.categoryId = input.categoryId;
  }
  if (input.emoji !== undefined) {
    target.emoji = input.emoji;
  }
}

export function createTodoService(repo: TodoRepository, clock: Clock = systemClock): TodoService {
  async function nextOrder(date: string): Promise<number> {
    const existing = await repo.listTodos({ date, includeDeleted: true });
    const maxOrder = existing.reduce((max, todo) => Math.max(max, todo.order), -1);
    return maxOrder + 1;
  }

  async function resolve(idOrPrefix: string): Promise<Todo> {
    const exact = await repo.getTodo(idOrPrefix);
    if (exact) {
      return exact;
    }
    const matches = (await repo.listTodos({ includeDeleted: true })).filter((todo) =>
      todo.id.startsWith(idOrPrefix),
    );
    if (matches.length === 0) {
      throw new NotFoundError(`No todo matches "${idOrPrefix}"`);
    }
    if (matches.length > 1) {
      throw new AmbiguousMatchError(`"${idOrPrefix}" matches ${matches.length} todos`);
    }
    return matches[0] as Todo;
  }

  async function persist(todo: Todo): Promise<Todo> {
    await repo.putTodo(todo);
    return todo;
  }

  return {
    async add(input) {
      const name = requireName(input.name);
      const date =
        input.date !== undefined
          ? validate(() => parseDateString(input.date as string))
          : clock().slice(0, 10);
      const timestamp = clock();
      const todo: Todo = {
        id: crypto.randomUUID(),
        name,
        date,
        status: "open",
        order: await nextOrder(date),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      applyOptionalFields(todo, input);
      return persist(todo);
    },

    list(filter) {
      return repo.listTodos(filter);
    },

    get(idOrPrefix) {
      return resolve(idOrPrefix);
    },

    async complete(idOrPrefix) {
      const existing = await resolve(idOrPrefix);
      const timestamp = clock();
      return persist({ ...existing, status: "done", completedAt: timestamp, updatedAt: timestamp });
    },

    async edit(idOrPrefix, changes) {
      const existing = await resolve(idOrPrefix);
      const updated: Todo = { ...existing, updatedAt: clock() };
      if (changes.name !== undefined) {
        updated.name = requireName(changes.name);
      }
      applyOptionalFields(updated, changes);
      return persist(updated);
    },

    async move(idOrPrefix, move) {
      const existing = await resolve(idOrPrefix);
      const date = validate(() => parseDateString(move.date));
      return persist({ ...existing, date, order: await nextOrder(date), updatedAt: clock() });
    },

    async remove(idOrPrefix) {
      const existing = await resolve(idOrPrefix);
      const timestamp = clock();
      return persist({ ...existing, deletedAt: timestamp, updatedAt: timestamp });
    },
  };
}
