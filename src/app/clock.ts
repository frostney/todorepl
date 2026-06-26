import type { DateString } from "../domain/model";
import { formatLocalDate } from "../domain/validation";

export type Clock = () => string;

export const systemClock: Clock = () => new Date().toISOString();

// The current date in the system's local time zone, as a YYYY-MM-DD string.
export function today(clock: Clock): DateString {
  return formatLocalDate(new Date(clock()));
}
