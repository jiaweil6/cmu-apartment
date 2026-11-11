/**
 * Commutes are planned to reach campus by this time on a weekday, as for a 10 AM class:
 * the trip you'd take is the latest-departing one that still arrives by then.
 * 24-hour "HH:MM", in Pittsburgh time. Used by the transit refresh, discovery and the page text.
 */
export const ARRIVE_BY = "10:00";

/** "10 AM" or "9:30 AM", for page text. */
export function arriveByLabel(time = ARRIVE_BY): string {
  const [hours, minutes] = time.split(":").map(Number);
  const clock = minutes ? `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}` : `${hours % 12 || 12}`;
  return `${clock} ${hours < 12 ? "AM" : "PM"}`;
}
