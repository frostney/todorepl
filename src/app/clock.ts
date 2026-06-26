import type { DateString } from "../domain/model";
import { formatLocalDate } from "../domain/validation";

export type Clock = () => string;

export const systemClock: Clock = () => new Date().toISOString();

// The local-time date (YYYY-MM-DD) for an instant. Pass a single sampled `clock()`
// value so the date stays consistent with timestamps derived from the same instant.
export function today(at: string | Date): DateString {
  return formatLocalDate(new Date(at));
}
