import type { RoomType } from "@/lib/types";
import type { PricingAdapter, UnitReading } from "./types";

/**
 * Plain web pages that list rents next to room types, e.g. "1-BR from $1630"
 * or "1 Bed + 1 Bath … $1,595-$1,895". Reads `pricing.url` (or the website)
 * and takes the first dollar amount after each room-type label, keeping the
 * lowest per room type. Rooms the page doesn't mention keep their previous
 * values, so a building that doesn't advertise studios stays as it was.
 */
const LABEL = /\b(?:(studio)|(\d)\s*(?:-|\s)?\s*(?:br\b|bed(?:room)?s?\b))/gi;
const PRICE = /\$\s?(\d{1,2},?\d{3})/;
const ROOMS: RoomType[] = ["studio", "oneBedroom", "twoBedroom", "threeBedroom"];

/** Visible text of an HTML page. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ");
}

export function readPageText(html: string): Partial<Record<RoomType, UnitReading>> {
  const text = pageText(html);
  const lowest = new Map<RoomType, number>();
  for (const match of text.matchAll(LABEL)) {
    const room = match[1] ? "studio" : ROOMS[Number(match[2])];
    if (!room) continue;
    // The rent must follow the label closely, before the next label.
    const after = text.slice(match.index! + match[0].length, match.index! + match[0].length + 160).split(LABEL)[0];
    const price = after.match(PRICE);
    if (!price) continue;
    const value = Number(price[1].replace(",", ""));
    if (!lowest.has(room) || value < lowest.get(room)!) lowest.set(room, value);
  }
  return Object.fromEntries(
    [...lowest].map(([room, minPrice]) => [room, { status: "available", minPrice, available: null, availableFrom: null }]),
  );
}

export const pageTextAdapter: PricingAdapter = {
  id: "page-text",
  async read(listing, { http }) {
    const units = readPageText(await http.text(listing.pricing.url ?? listing.website));
    if (Object.keys(units).length === 0) throw new Error("No rents found on the page (has its layout changed?)");
    return { units };
  },
};
