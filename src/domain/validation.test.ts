import { describe, expect, test } from "bun:test";
import type { Category, Todo } from "./model";
import { parseDateString, parseMinuteOfDay, parseTodoDuration } from "./validation";

describe("parseDateString", () => {
  test("accepts a valid calendar date", () => {
    expect(parseDateString("2026-06-24")).toBe("2026-06-24");
  });

  test("rejects impossible calendar dates", () => {
    expect(() => parseDateString("2026-02-30")).toThrow("valid calendar date");
  });
});

describe("parseMinuteOfDay", () => {
  test("accepts 15-minute snapped minutes from midnight", () => {
    expect(parseMinuteOfDay("540")).toBe(540);
  });

  test("rejects unsnapped minutes", () => {
    expect(() => parseMinuteOfDay("541")).toThrow("divisible by 15");
  });
});

describe("parseTodoDuration", () => {
  test("accepts supported durations", () => {
    expect(parseTodoDuration("30")).toBe(30);
  });

  test("rejects unsupported durations", () => {
    expect(() => parseTodoDuration("45")).toThrow("Duration must be one of");
  });
});

describe("domain model", () => {
  test("represents dated todos and categories", () => {
    const category = {
      id: "cat-work",
      name: "Work",
      emoji: "💼",
      createdAt: "2026-06-24T10:00:00.000Z",
      updatedAt: "2026-06-24T10:00:00.000Z",
    } satisfies Category;

    const todo = {
      id: "todo-1",
      name: "Ship scaffold",
      date: "2026-06-24",
      status: "open",
      order: 0,
      categoryId: category.id,
      emoji: "🚨",
      scheduledTime: 540,
      duration: 30,
      createdAt: "2026-06-24T10:00:00.000Z",
      updatedAt: "2026-06-24T10:00:00.000Z",
    } satisfies Todo;

    expect(todo.categoryId).toBe(category.id);
  });
});
