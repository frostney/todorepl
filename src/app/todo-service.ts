import type { Todo } from "../domain/model";
import { parseDateString, parseMinuteOfDay, parseTodoDuration } from "../domain/validation";
import type { TodoFilter, TodoRepository } from "../storage/repository";
import { type Clock, systemClock, today } from "./clock";
import { asValidationError, requireName, resolveByIdentifier } from "./service-support";

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

function applyOptionalFields(target: Partial<OptionalTodoFields>, input: EditTodoInput): void {
  if (input.scheduledTime !== undefined) {
    target.scheduledTime = asValidationError(() => parseMinuteOfDay(input.scheduledTime as string));
  }
  if (input.duration !== undefined) {
    target.duration = asValidationError(() => parseTodoDuration(input.duration as string));
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

  function resolve(idOrPrefix: string): Promise<Todo> {
    return resolveByIdentifier(
      {
        getExact: (id) => repo.getTodo(id),
        listAll: () => repo.listTodos({ includeDeleted: true }),
        matches: (todo, query) => todo.id.startsWith(query),
        describe: "todo",
      },
      idOrPrefix,
    );
  }

  async function persist(todo: Todo): Promise<Todo> {
    await repo.putTodo(todo);
    return todo;
  }

  return {
    async add(input) {
      const name = requireName(input.name, "Todo");
      // Sample the clock once so the default date and the timestamps agree, even
      // if the call straddles a local-midnight boundary.
      const timestamp = clock();
      const date =
        input.date !== undefined
          ? asValidationError(() => parseDateString(input.date as string))
          : today(timestamp);
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

    async list(filter) {
      for (const value of [filter?.date, filter?.dateFrom, filter?.dateTo]) {
        if (value !== undefined) asValidationError(() => parseDateString(value));
      }
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
        updated.name = requireName(changes.name, "Todo");
      }
      applyOptionalFields(updated, changes);
      return persist(updated);
    },

    async move(idOrPrefix, move) {
      const existing = await resolve(idOrPrefix);
      const date = asValidationError(() => parseDateString(move.date));
      return persist({ ...existing, date, order: await nextOrder(date), updatedAt: clock() });
    },

    async remove(idOrPrefix) {
      const existing = await resolve(idOrPrefix);
      const timestamp = clock();
      return persist({ ...existing, deletedAt: timestamp, updatedAt: timestamp });
    },
  };
}
