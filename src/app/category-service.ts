import type { Category, CategoryId } from "../domain/model";
import type { TodoRepository } from "../storage/repository";
import { type Clock, systemClock } from "./clock";
import { ValidationError } from "./errors";
import { requireName, resolveByIdentifier } from "./service-support";

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

export function createCategoryService(
  repo: TodoRepository,
  clock: Clock = systemClock,
): CategoryService {
  async function findByName(name: string, excludeId?: CategoryId): Promise<Category | undefined> {
    const categories = await repo.listCategories();
    return categories.find((category) => category.name === name && category.id !== excludeId);
  }

  function resolve(idOrName: string): Promise<Category> {
    return resolveByIdentifier(
      {
        getExact: (id) => repo.getCategory(id),
        listAll: () => repo.listCategories(),
        matches: (category, query) => category.name === query,
        describe: "category",
      },
      idOrName,
    );
  }

  return {
    async create(input) {
      const name = requireName(input.name, "Category");
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
        const name = requireName(changes.name, "Category");
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
      const result = await repo.deleteCategory(category.id, {
        force: options?.force === true,
        updatedAt: clock(),
      });
      if (!result.deleted) {
        throw new ValidationError(
          `Category "${category.name}" is used by ${result.referencedTodoCount} todo(s); ` +
            "pass --force to delete and un-assign them",
        );
      }
      return category;
    },
  };
}
