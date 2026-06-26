import type { DateString, MinuteOfDay, TodoDuration } from "./model";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MINUTES_PER_DAY = 1_440;
const SLOT_GRANULARITY = 15;
const VALID_DURATIONS: readonly TodoDuration[] = [15, 30, 60];

export function parseDateString(value: string): DateString {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`Date must be in YYYY-MM-DD format, got: ${value}`);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Date is not a valid calendar date: ${value}`);
  }

  const roundTrip = parsed.toISOString().split("T")[0];
  if (roundTrip !== value) {
    throw new Error(`Date is not a valid calendar date: ${value}`);
  }

  return value;
}

// Formats a Date as a local-time YYYY-MM-DD string (not UTC), so "today" matches
// the calendar day the user is actually on.
export function formatLocalDate(at: Date): DateString {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseMinuteOfDay(value: string): MinuteOfDay {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= MINUTES_PER_DAY) {
    throw new Error(`Time must be an integer 0-${MINUTES_PER_DAY - 1}, got: ${value}`);
  }

  if (parsed % SLOT_GRANULARITY !== 0) {
    throw new Error(`Time must be divisible by ${SLOT_GRANULARITY}, got: ${value}`);
  }

  return parsed;
}

export function parseTodoDuration(value: string): TodoDuration {
  const parsed = Number(value);
  if (!VALID_DURATIONS.includes(parsed as TodoDuration)) {
    throw new Error(`Duration must be one of ${VALID_DURATIONS.join(", ")}, got: ${value}`);
  }

  return parsed as TodoDuration;
}
