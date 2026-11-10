/**
 * Picks the weekday used for commute times: the next Tuesday with normal
 * service, so holidays and one-off schedule changes don't skew results.
 */

const TUESDAY = 2;

/** Minimal CSV reader for GTFS files (no embedded commas or quotes in the fields we read). */
export function readCsv(text: string): Record<string, string>[] {
  const [header, ...rows] = text.replace(/^﻿/, "").trim().split(/\r?\n/);
  const keys = header.split(",").map((key) => key.trim());
  return rows.map((row) => Object.fromEntries(row.split(",").map((value, i) => [keys[i], value.trim()])));
}

const toGtfsDate = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");

/**
 * The first Tuesday at least two days after `today` that falls inside the
 * feed's validity and has no service exceptions (calendar_dates.txt).
 * Returns YYYY-MM-DD.
 */
export function nextRegularTuesday(
  today: Date,
  feed: { startDate: string; endDate: string; exceptionDates: Set<string> },
): string {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 2));
  for (let i = 0; i < 120; i++, date.setUTCDate(date.getUTCDate() + 1)) {
    const gtfsDate = toGtfsDate(date);
    if (date.getUTCDay() !== TUESDAY || gtfsDate < feed.startDate) continue;
    if (gtfsDate > feed.endDate) break;
    if (!feed.exceptionDates.has(gtfsDate)) return date.toISOString().slice(0, 10);
  }
  throw new Error(`No regular Tuesday found in the feed (${feed.startDate}–${feed.endDate})`);
}

/** `2026-11-17` + `09:00` in America/New_York → `2026-11-17T09:00:00-05:00`. */
export function zonedTime(date: string, time: string, timeZone = "America/New_York"): string {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(noonUtc)
    .find((part) => part.type === "timeZoneName")!.value; // e.g. "GMT-05:00"
  const offset = name === "GMT" ? "+00:00" : name.slice(3);
  return `${date}T${time}:00${offset}`;
}
