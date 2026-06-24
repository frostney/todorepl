import { buildCommand, buildRouteMap } from "@stricli/core";
import type { CreateCategoryInput, EditCategoryInput } from "../../app/category-service";
import type { Category } from "../../domain/model";
import type { AppContext } from "../context";
import { formatJson, formatTable } from "../output";
import { type CommonFlags, commonFlags, withServices } from "./shared";

function displayCategoryRow(category: Category): Record<string, unknown> {
  return {
    id: category.id.slice(0, 8),
    name: category.name,
    emoji: category.emoji ?? "-",
    color: category.color ?? "-",
  };
}

function renderCategory(category: Category, json: boolean | undefined): string {
  return json ? formatJson(category) : formatTable([displayCategoryRow(category)]);
}

function renderCategories(categories: readonly Category[], json: boolean | undefined): string {
  return json ? formatJson(categories) : formatTable(categories.map(displayCategoryRow));
}

const idOrNamePositional = {
  kind: "tuple",
  parameters: [{ parse: String, brief: "Category id or name.", placeholder: "idOrName" }],
} as const;

const attributeFlags = {
  color: { kind: "parsed", parse: String, optional: true, brief: "Color." },
  emoji: { kind: "parsed", parse: String, optional: true, brief: "Emoji." },
} as const;

type CreateFlags = CommonFlags & {
  color?: string;
  emoji?: string;
};

const create = buildCommand<CreateFlags, [string], AppContext>({
  docs: { brief: "Create a category." },
  parameters: {
    flags: { ...commonFlags, ...attributeFlags },
    positional: {
      kind: "tuple",
      parameters: [{ parse: String, brief: "Category name.", placeholder: "name" }],
    },
  },
  async func(flags, name) {
    const input: CreateCategoryInput = { name };
    if (flags.color !== undefined) input.color = flags.color;
    if (flags.emoji !== undefined) input.emoji = flags.emoji;
    const category = await withServices(this, flags.data, ({ categories }) =>
      categories.create(input),
    );
    this.process.stdout.write(renderCategory(category, flags.json));
  },
});

const list = buildCommand<CommonFlags, [], AppContext>({
  docs: { brief: "List categories." },
  parameters: { flags: commonFlags },
  async func(flags) {
    const categories = await withServices(this, flags.data, ({ categories }) => categories.list());
    this.process.stdout.write(renderCategories(categories, flags.json));
  },
});

const show = buildCommand<CommonFlags, [string], AppContext>({
  docs: { brief: "Show a category." },
  parameters: { flags: commonFlags, positional: idOrNamePositional },
  async func(flags, idOrName) {
    const category = await withServices(this, flags.data, ({ categories }) =>
      categories.get(idOrName),
    );
    this.process.stdout.write(renderCategory(category, flags.json));
  },
});

type EditFlags = CommonFlags & {
  name?: string;
  color?: string;
  emoji?: string;
};

const edit = buildCommand<EditFlags, [string], AppContext>({
  docs: { brief: "Edit a category." },
  parameters: {
    flags: {
      ...commonFlags,
      name: { kind: "parsed", parse: String, optional: true, brief: "New name." },
      ...attributeFlags,
    },
    positional: idOrNamePositional,
  },
  async func(flags, idOrName) {
    const changes: EditCategoryInput = {};
    if (flags.name !== undefined) changes.name = flags.name;
    if (flags.color !== undefined) changes.color = flags.color;
    if (flags.emoji !== undefined) changes.emoji = flags.emoji;
    const category = await withServices(this, flags.data, ({ categories }) =>
      categories.edit(idOrName, changes),
    );
    this.process.stdout.write(renderCategory(category, flags.json));
  },
});

type DeleteFlags = CommonFlags & {
  force?: boolean;
};

const deleteCommand = buildCommand<DeleteFlags, [string], AppContext>({
  docs: { brief: "Delete a category." },
  parameters: {
    flags: {
      ...commonFlags,
      force: {
        kind: "boolean",
        optional: true,
        brief: "Delete and un-assign even when todos use it.",
      },
    },
    positional: idOrNamePositional,
  },
  async func(flags, idOrName) {
    const category = await withServices(this, flags.data, ({ categories }) =>
      categories.remove(idOrName, { force: flags.force === true }),
    );
    this.process.stdout.write(renderCategory(category, flags.json));
  },
});

export const categoryRoute = buildRouteMap<string, AppContext>({
  routes: { create, list, show, edit, delete: deleteCommand },
  docs: { brief: "Manage categories." },
});
