/**
 * Street-address normalization for matching county parcels, OpenStreetMap and
 * our listings. "4614-4630 Fifth Avenue" and "4620 5TH AVE" are the same building.
 */

const WORDS: Record<string, string> = {
  AVENUE: "AVE", STREET: "ST", ROAD: "RD", BOULEVARD: "BLVD", PLACE: "PL", DRIVE: "DR", LANE: "LN",
  TERRACE: "TER", COURT: "CT", SQUARE: "SQ", WAY: "WAY", NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  FIRST: "1ST", SECOND: "2ND", THIRD: "3RD", FOURTH: "4TH", FIFTH: "5TH", SIXTH: "6TH",
};

export interface StreetAddress {
  /** House number range; a single number has low === high. */
  low: number;
  high: number;
  /** Normalized street, e.g. "5TH AVE", "N DITHRIDGE ST". */
  street: string;
}

/** Parses "4614-4630 Fifth Ave, Pittsburgh, PA 15213" (anything after the first comma is ignored). */
export function parseAddress(text: string): StreetAddress | null {
  const line = text.split(",")[0].toUpperCase().replace(/[.#]/g, " ");
  const match = line.match(/^\s*(\d+)(?:\s*-\s*(\d+))?[A-Z]?\s+(.+?)\s*$/);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  const street = match[3]
    .split(/\s+/)
    .map((word) => WORDS[word] ?? word)
    // Drop unit designators: "SUITE 130", "APT 4", "L100"
    .join(" ")
    .replace(/\s+(SUITE|STE|APT|UNIT|FL|FLOOR)\s+\S+$/, "")
    .replace(/\s+L\d+$/, "");
  return { low: Math.min(low, high), high: Math.max(low, high), street };
}

/** True when both addresses are on the same street and their house numbers overlap. */
export function sameAddress(a: StreetAddress | null, b: StreetAddress | null): boolean {
  if (!a || !b || a.street !== b.street) return false;
  return a.low <= b.high && b.low <= a.high;
}

/** "4614-4630 5TH AVE" → "4614-4630 5th Ave" for display. */
export function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n, s) => n + s.toLowerCase());
}
