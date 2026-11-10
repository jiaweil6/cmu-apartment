// Formatting for stored routes (data/routes.json). No data imports, so client components can use it.

/** "08:41" → "8:41 AM". */
export function formatClock(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

const MODE_NAMES: Record<string, string> = {
  BUS: "Bus",
  TRAM: "Light rail",
  SUBWAY: "Subway",
  RAIL: "Train",
  FUNICULAR: "Incline",
  FERRY: "Ferry",
  TROLLEYBUS: "Bus",
};

/** "Bus", "Light rail", "Incline"… for a ride's OpenTripPlanner mode. */
export const modeName = (mode: string) => MODE_NAMES[mode] ?? mode.charAt(0) + mode.slice(1).toLowerCase();

export const METERS_PER_MILE = 1609.344;

/** Whole minutes for a leg, at least 1: "Walk 1 min" rather than "Walk 0 min". */
export const wholeMinutes = (minutes: number) => Math.max(1, Math.round(minutes));

/** "0.2 mi" for a walking leg. */
export const miles = (meters: number) => `${(meters / METERS_PER_MILE).toFixed(1)} mi`;

const SMALL_WORDS = new Set(["to", "via", "and", "at", "of", "the", "on"]);

/**
 * PRT's timetable names stops and destinations in capitals with position codes:
 * "FORBES AVE + MOREWOOD AVE FS (CARNEGIE MELLON)" → "Forbes Ave & Morewood Ave (Carnegie Mellon)",
 * "HIGHLAND PARK TO DOWNTOWN VIA OAKLAND" → "Highland Park to Downtown via Oakland".
 * Names that are already mixed case are left alone.
 */
export function tidyName(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .replace(/\s+(FS|NS|NB|SB|EB|WB)\b/g, "")
    .replace(/\s*\+\s*/g, " & ")
    .toLowerCase()
    .replace(/[a-z]+/g, (word, offset: number) =>
      offset > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .replace(/\s+/g, " ")
    .trim();
}
