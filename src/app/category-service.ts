import type { Category, CategoryId, Todo } from "../domain/model";
import type { TodoRepository } from "../storage/repository";
import { type Clock, systemClock } from "./clock";
import { AmbiguousMatchError, NotFoundError, ValidationError } from "./errors";

export type CreateCategoryInput = { name: string; color?: string; emoji?: string };

export type EditCategoryInput = { name?: string; color?: string; emoji?: string };

export type RemoveCategoryOptions = { force?: boolean };

export interface CategoryService {
  create(input: CreateCategoryInput): Promise<Category>;
  list(): Promise<Category[]>;
  get(idOrName: string): Promise<Category>;
  edit(idOrName: string, changes: EditCategoryInput): Promise<Category>;
  remove(idOrName: string, options?: RemoveCategoryOptions): Promise<Category>;
  resolveId(idOrName: string): Promise<CategoryId>;
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Category name is required");
  }
  return trimmed;
}

export function createCategoryService(
  repo: TodoRepository,
  clock: Clock = systemClock,
): CategoryService {
  async function findByName(name: string, excludeId?: CategoryId): Promise<Category | undefined> {
    const categories = await repo.listCategories();
    return categories.find((category) => category.name === name && category.id !== excludeId);
  }

  async function resolve(idOrName: string): Promise<Category> {
    const exact = await repo.getCategory(idOrName);
    if (exact) {
      return exact;
    }
    const matches = (await repo.listCategories()).filter((category) => category.name === idOrName);
    if (matches.length === 0) {
      throw new NotFoundError(`No category matches "${idOrName}"`);
    }
    if (matches.length > 1) {
      throw new AmbiguousMatchError(`"${idOrName}" matches ${matches.length} categories`);
    }
    return matches[0] as Category;
  }

  // Hard delete plus un-assignment is performed as a sequence of writes, not a
  // single transaction; a crash mid-loop can leave todos un-assigned before the
  // category itself is removed.
  async function unassignAndDelete(category: Category, used: Todo[]): Promise<Category> {
    const timestamp = clock();
    for (const todo of used) {
      const { categoryId: _categoryId, ...rest } = todo;
      await repo.putTodo({ ...rest, updatedAt: timestamp });
    }
    await repo.deleteCategory(category.id);
    return category;
  }

  return {
    async create(input) {
      const name = requireName(input.name);
      if (await findByName(name)) {
        throw new ValidationError(`Category "${name}" already exists`);
      }
      const timestamp = clock();
      const category: Category = {
        id: crypto.randomUUID(),
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      };
      await repo.putCategory(category);
      return category;
    },

    list() {
      return repo.listCategories();
    },

    get(idOrName) {
      return resolve(idOrName);
    },

    async resolveId(idOrName) {
      return (await resolve(idOrName)).id;
    },

    async edit(idOrName, changes) {
      const existing = await resolve(idOrName);
      const updated: Category = { ...existing, updatedAt: clock() };
      if (changes.name !== undefined) {
        const name = requireName(changes.name);
        if (name !== existing.name && (await findByName(name, existing.id))) {
          throw new ValidationError(`Category "${name}" already exists`);
        }
        updated.name = name;
      }
      if (changes.color !== undefined) {
        updated.color = changes.color;
      }
      if (changes.emoji !== undefined) {
        updated.emoji = changes.emoji;
      }
      await repo.putCategory(updated);
      return updated;
    },

    async remove(idOrName, options) {
      const category = await resolve(idOrName);
      const used = await repo.listTodos({ categoryId: category.id, includeDeleted: true });
      if (used.length > 0 && options?.force !== true) {
        throw new ValidationError(
          `Category "${category.name}" is used by ${used.length} todo(s); ` +
            "pass --force to delete and un-assign them",
        );
      }
      return unassignAndDelete(category, used);
    },
  };
}
