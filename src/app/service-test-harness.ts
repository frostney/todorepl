import { afterEach } from "bun:test";
import type { TodoRepository } from "../storage/repository";
import { createSqliteRepository } from "../storage/sqlite-store";
import type { Clock } from "./clock";

export const NOW = "2026-06-24T10:00:00.000Z";

export function fixedClock(now: string = NOW): Clock {
  return () => now;
}

// Distinct, ordered timestamps so updatedAt/completedAt can be told apart from createdAt.
export function steppingClock(start: string = NOW): Clock {
  let tick = Date.parse(start);
  return () => {
    const value = new Date(tick).toISOString();
    tick += 1_000;
    return value;
  };
}

// Tracks every in-memory repo a file opens and closes them all after each test.
// Call once per test file; the returned factory creates tracked repos.
export function registerMemoryRepos(): () => TodoRepository {
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

  return () => {
    const repo = createSqliteRepository({ path: ":memory:" });
    openRepos.push(repo);
    return repo;
  };
}
