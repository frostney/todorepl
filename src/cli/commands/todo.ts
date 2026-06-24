import { buildCommand } from "@stricli/core";
import {
  type AddTodoInput,
  createTodoService,
  type EditTodoInput,
  type TodoService,
} from "../../app/todo-service";
import type { Todo } from "../../domain/model";
import type { TodoFilter } from "../../storage/repository";
import type { AppContext } from "../context";
import { formatJson, formatTable } from "../output";

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

const attributeFlags = {
  time: {
    kind: "parsed",
    parse: String,
    optional: true,
    brief: "Scheduled time (minute of day).",
  },
  duration: {
    kind: "parsed",
    parse: String,
    optional: true,
    brief: "Duration (15, 30, or 60).",
  },
  category: { kind: "parsed", parse: String, optional: true, brief: "Category id." },
  emoji: { kind: "parsed", parse: String, optional: true, brief: "Emoji." },
} as const;

type CommonFlags = {
  data?: string;
  json?: boolean;
};

async function withTodos<T>(
  ctx: AppContext,
  dataPath: string | undefined,
  fn: (todos: TodoService) => Promise<T>,
): Promise<T> {
  const repo = ctx.openStore(dataPath);
  const service = createTodoService(repo, ctx.clock);
  try {
    return await fn(service);
  } finally {
    repo.close();
  }
}

function formatTime(scheduledTime: number | undefined): string {
  if (scheduledTime === undefined) {
    return "-";
  }
  const hours = Math.floor(scheduledTime / 60);
  const minutes = scheduledTime % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function displayRow(todo: Todo): Record<string, unknown> {
  return {
    id: todo.id.slice(0, 8),
    date: todo.date,
    time: formatTime(todo.scheduledTime),
    dur: todo.duration ?? "-",
    status: todo.status,
    category: todo.categoryId?.slice(0, 8) ?? "-",
    emoji: todo.emoji ?? "-",
    name: todo.name,
  };
}

function renderTodo(todo: Todo, json: boolean | undefined): string {
  return json ? formatJson(todo) : formatTable([displayRow(todo)]);
}

function renderTodos(todos: readonly Todo[], json: boolean | undefined): string {
  return json ? formatJson(todos) : formatTable(todos.map(displayRow));
}

type AddFlags = CommonFlags & {
  date?: string;
  time?: string;
  duration?: string;
  category?: string;
  emoji?: string;
};

export const add = buildCommand<AddFlags, [string], AppContext>({
  docs: { brief: "Add a todo." },
  parameters: {
    flags: {
      ...commonFlags,
      date: { kind: "parsed", parse: String, optional: true, brief: "Due date (YYYY-MM-DD)." },
      ...attributeFlags,
    },
    positional: {
      kind: "tuple",
      parameters: [{ parse: String, brief: "Todo name.", placeholder: "name" }],
    },
  },
  async func(flags, name) {
    const input: AddTodoInput = { name };
    if (flags.date !== undefined) input.date = flags.date;
    if (flags.time !== undefined) input.scheduledTime = flags.time;
    if (flags.duration !== undefined) input.duration = flags.duration;
    if (flags.category !== undefined) input.categoryId = flags.category;
    if (flags.emoji !== undefined) input.emoji = flags.emoji;
    const todo = await withTodos(this, flags.data, (todos) => todos.add(input));
    this.process.stdout.write(renderTodo(todo, flags.json));
  },
});

type ListFlags = CommonFlags & {
  date?: string;
  from?: string;
  to?: string;
  category?: string;
  status?: "open" | "done";
  scheduled?: boolean;
  unscheduled?: boolean;
  includeDeleted?: boolean;
};

export const list = buildCommand<ListFlags, [], AppContext>({
  docs: { brief: "List todos." },
  parameters: {
    flags: {
      ...commonFlags,
      date: { kind: "parsed", parse: String, optional: true, brief: "Filter by exact date." },
      from: {
        kind: "parsed",
        parse: String,
        optional: true,
        brief: "Filter from date (inclusive).",
      },
      to: { kind: "parsed", parse: String, optional: true, brief: "Filter to date (inclusive)." },
      category: { kind: "parsed", parse: String, optional: true, brief: "Filter by category id." },
      status: {
        kind: "enum",
        values: ["open", "done"],
        optional: true,
        brief: "Filter by status.",
      },
      scheduled: { kind: "boolean", optional: true, brief: "Only scheduled todos." },
      unscheduled: { kind: "boolean", optional: true, brief: "Only unscheduled todos." },
      includeDeleted: { kind: "boolean", optional: true, brief: "Include deleted todos." },
    },
  },
  async func(flags) {
    const filter: TodoFilter = {};
    if (flags.date !== undefined) filter.date = flags.date;
    if (flags.from !== undefined) filter.dateFrom = flags.from;
    if (flags.to !== undefined) filter.dateTo = flags.to;
    if (flags.category !== undefined) filter.categoryId = flags.category;
    if (flags.status !== undefined) filter.status = flags.status;
    if (flags.scheduled) filter.scheduled = true;
    else if (flags.unscheduled) filter.scheduled = false;
    if (flags.includeDeleted) filter.includeDeleted = true;
    const todos = await withTodos(this, flags.data, (todos) => todos.list(filter));
    this.process.stdout.write(renderTodos(todos, flags.json));
  },
});

const idPositional = {
  kind: "tuple",
  parameters: [{ parse: String, brief: "Todo id or prefix.", placeholder: "id" }],
} as const;

export const show = buildCommand<CommonFlags, [string], AppContext>({
  docs: { brief: "Show a todo." },
  parameters: { flags: commonFlags, positional: idPositional },
  async func(flags, id) {
    const todo = await withTodos(this, flags.data, (todos) => todos.get(id));
    this.process.stdout.write(renderTodo(todo, flags.json));
  },
});

export const done = buildCommand<CommonFlags, [string], AppContext>({
  docs: { brief: "Mark a todo as done." },
  parameters: { flags: commonFlags, positional: idPositional },
  async func(flags, id) {
    const todo = await withTodos(this, flags.data, (todos) => todos.complete(id));
    this.process.stdout.write(renderTodo(todo, flags.json));
  },
});

export const deleteCommand = buildCommand<CommonFlags, [string], AppContext>({
  docs: { brief: "Delete a todo." },
  parameters: { flags: commonFlags, positional: idPositional },
  async func(flags, id) {
    const todo = await withTodos(this, flags.data, (todos) => todos.remove(id));
    this.process.stdout.write(renderTodo(todo, flags.json));
  },
});

type EditFlags = CommonFlags & {
  name?: string;
  time?: string;
  duration?: string;
  category?: string;
  emoji?: string;
};

export const edit = buildCommand<EditFlags, [string], AppContext>({
  docs: { brief: "Edit a todo." },
  parameters: {
    flags: {
      ...commonFlags,
      name: { kind: "parsed", parse: String, optional: true, brief: "New name." },
      ...attributeFlags,
    },
    positional: idPositional,
  },
  async func(flags, id) {
    const changes: EditTodoInput = {};
    if (flags.name !== undefined) changes.name = flags.name;
    if (flags.time !== undefined) changes.scheduledTime = flags.time;
    if (flags.duration !== undefined) changes.duration = flags.duration;
    if (flags.category !== undefined) changes.categoryId = flags.category;
    if (flags.emoji !== undefined) changes.emoji = flags.emoji;
    const todo = await withTodos(this, flags.data, (todos) => todos.edit(id, changes));
    this.process.stdout.write(renderTodo(todo, flags.json));
  },
});

export const move = buildCommand<CommonFlags, [string, string], AppContext>({
  docs: { brief: "Move a todo to a new date." },
  parameters: {
    flags: commonFlags,
    positional: {
      kind: "tuple",
      parameters: [
        { parse: String, brief: "Todo id or prefix.", placeholder: "id" },
        { parse: String, brief: "Target date (YYYY-MM-DD).", placeholder: "date" },
      ],
    },
  },
  async func(flags, id, date) {
    const todo = await withTodos(this, flags.data, (todos) => todos.move(id, { date }));
    this.process.stdout.write(renderTodo(todo, flags.json));
  },
});
