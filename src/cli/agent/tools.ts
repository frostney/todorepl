import { type ToolSet, tool } from "ai";
import { z } from "zod";
import type { CategoryService } from "../../app/category-service";
import type { AddTodoInput, EditTodoInput } from "../../app/todo-service";
import { buildTodoFilter, type Services } from "../commands/shared";

// Runs a service call and converts thrown errors (e.g. validation failures) into a
// value the model can read and recover from, instead of crashing the agent loop.
async function attempt<T>(run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// Shared schema for the optional todo attributes, mirroring the `todo add`/`edit`
// command surface: time is a minute-of-day integer, durations are fixed slots, and
// a category may be given by name or id.
const attributeObject = z.object({
  scheduledTime: z
    .number()
    .int()
    .min(0)
    .max(1439)
    .optional()
    .describe("Scheduled time as minute of day, a multiple of 15 (9:00 AM = 540, 2:30 PM = 870)."),
  duration: z
    .union([z.literal(15), z.literal(30), z.literal(60)])
    .optional()
    .describe("Duration in minutes: 15, 30, or 60."),
  category: z.string().optional().describe("Category name or id."),
  emoji: z.string().optional().describe("A single emoji."),
});

// Derived from the schema so the type can't drift from the validated shape.
type AttributeInput = z.infer<typeof attributeObject>;

// Translates the attribute schema into the string-based shape the services accept,
// resolving a category name/id into a concrete category id.
async function attributeFields(
  input: AttributeInput,
  categories: CategoryService,
): Promise<Pick<EditTodoInput, "scheduledTime" | "duration" | "categoryId" | "emoji">> {
  const fields: Pick<EditTodoInput, "scheduledTime" | "duration" | "categoryId" | "emoji"> = {};
  if (input.scheduledTime !== undefined) fields.scheduledTime = String(input.scheduledTime);
  if (input.duration !== undefined) fields.duration = String(input.duration);
  if (input.emoji !== undefined) fields.emoji = input.emoji;
  if (input.category !== undefined) fields.categoryId = await categories.resolveId(input.category);
  return fields;
}

const idInput = z.object({ id: z.string().describe("Todo id or unique prefix.") });

// Builds the tool surface the agent uses to read and modify todos and categories.
// Read tools run automatically; mutating tools set `needsApproval` so the terminal
// UI asks the user to confirm before anything changes.
export function createAgentTools(services: Services): ToolSet {
  const { todos, categories } = services;

  return {
    list_todos: tool({
      description:
        "List todos, optionally filtered by date range, status, scheduling, or category.",
      inputSchema: z.object({
        date: z.string().optional().describe("Exact date, YYYY-MM-DD."),
        from: z.string().optional().describe("Start date inclusive, YYYY-MM-DD."),
        to: z.string().optional().describe("End date inclusive, YYYY-MM-DD."),
        status: z.enum(["open", "done"]).optional(),
        category: z.string().optional().describe("Category name or id."),
        scheduled: z
          .boolean()
          .optional()
          .describe("True for only scheduled, false for only unscheduled."),
        includeDeleted: z.boolean().optional(),
      }),
      execute: (input) => attempt(async () => todos.list(await buildTodoFilter(input, categories))),
    }),

    get_todo: tool({
      description: "Get a single todo by id or unique prefix.",
      inputSchema: idInput,
      execute: ({ id }) => attempt(() => todos.get(id)),
    }),

    add_todo: tool({
      description: "Create a todo. Defaults to today's date when none is given.",
      inputSchema: z.object({
        name: z.string().describe("What the todo is."),
        date: z.string().optional().describe("Due date, YYYY-MM-DD. Defaults to today."),
        ...attributeObject.shape,
      }),
      needsApproval: true,
      execute: (input) =>
        attempt(async () => {
          const add: AddTodoInput = {
            name: input.name,
            ...(await attributeFields(input, categories)),
          };
          if (input.date !== undefined) add.date = input.date;
          return todos.add(add);
        }),
    }),

    edit_todo: tool({
      description: "Edit a todo's name, time, duration, category, or emoji.",
      inputSchema: z.object({
        id: z.string().describe("Todo id or unique prefix."),
        name: z.string().optional().describe("New name."),
        ...attributeObject.shape,
      }),
      needsApproval: true,
      execute: (input) =>
        attempt(async () => {
          const changes: EditTodoInput = await attributeFields(input, categories);
          if (input.name !== undefined) changes.name = input.name;
          return todos.edit(input.id, changes);
        }),
    }),

    complete_todo: tool({
      description: "Mark a todo as done.",
      inputSchema: idInput,
      needsApproval: true,
      execute: ({ id }) => attempt(() => todos.complete(id)),
    }),

    move_todo: tool({
      description: "Move a todo to a different date.",
      inputSchema: z.object({
        id: z.string().describe("Todo id or unique prefix."),
        date: z.string().describe("Target date, YYYY-MM-DD."),
      }),
      needsApproval: true,
      execute: ({ id, date }) => attempt(() => todos.move(id, { date })),
    }),

    remove_todo: tool({
      description: "Delete a todo (soft delete).",
      inputSchema: idInput,
      needsApproval: true,
      execute: ({ id }) => attempt(() => todos.remove(id)),
    }),

    list_categories: tool({
      description: "List all categories.",
      inputSchema: z.object({}),
      execute: () => attempt(() => categories.list()),
    }),

    create_category: tool({
      description: "Create a category.",
      inputSchema: z.object({
        name: z.string().describe("Category name."),
        color: z.string().optional().describe("Color, e.g. a hex code."),
        emoji: z.string().optional().describe("A single emoji."),
      }),
      needsApproval: true,
      execute: (input) =>
        attempt(() =>
          categories.create({
            name: input.name,
            ...(input.color !== undefined ? { color: input.color } : {}),
            ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
          }),
        ),
    }),

    remove_category: tool({
      description: "Delete a category. Use force to also un-assign it from any todos.",
      inputSchema: z.object({
        category: z.string().describe("Category name or id."),
        force: z.boolean().optional().describe("Delete even if todos use it, un-assigning them."),
      }),
      needsApproval: true,
      execute: ({ category, force }) =>
        attempt(() => categories.remove(category, force === undefined ? undefined : { force })),
    }),
  };
}
