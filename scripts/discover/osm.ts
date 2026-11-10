/**
 * Apartment buildings from OpenStreetMap via the Overpass API (ODbL). Used to
 * put names, websites and construction years on county parcels.
 */
import type { LatLng } from "@/lib/types";
import { METERS_PER_MILE } from "../lib/geo";

const OVERPASS = "https://overpass-api.de/api/interpreter";

export interface OsmBuilding {
  id: string;
  name: string | null;
  website: string | null;
  /** Four-digit year from `start_date`, if tagged. */
  yearBuilt: number | null;
  /** Street address from `addr:*` tags, e.g. "4614 Fifth Avenue". */
  address: string | null;
  location: LatLng;
}

interface Element {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOverpass(body: { elements: Element[] }): OsmBuilding[] {
  return body.elements.flatMap((element) => {
    const point = element.center ?? (element.lat !== undefined ? { lat: element.lat, lon: element.lon! } : null);
    if (!point) return [];
    const tags = element.tags ?? {};
    const year = tags.start_date?.match(/^(\d{4})/)?.[1];
    const website = tags.website ?? tags["contact:website"] ?? null;
    return [
      {
        id: `${element.type}/${element.id}`,
        name: tags.name ?? null,
        website: website && /^https?:\/\//.test(website) ? website : null,
        yearBuilt: year ? Number(year) : null,
        address: tags["addr:housenumber"] && tags["addr:street"] ? `${tags["addr:housenumber"]} ${tags["addr:street"]}` : null,
        location: { lat: point.lat, lng: point.lon },
      },
    ];
  });
}

/** Apartment buildings (and named residential buildings) within `radiusMiles`. */
export async function osmApartmentBuildings(center: LatLng, radiusMiles: number): Promise<OsmBuilding[]> {
  const around = `around:${Math.round(radiusMiles * METERS_PER_MILE)},${center.lat},${center.lng}`;
  const query = `[out:json][timeout:90];
(
  nwr["building"="apartments"](${around});
  nwr["building"="residential"]["name"](${around});
);
out center tags;`;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "cmu-apartment-rankings (+https://github.com/jiaweil6/cmu-apartment)",
      },
      body: new URLSearchParams({ data: query }),
    });
    // Overpass asks clients to back off at least 30 s when rate limited.
    if ((response.status === 429 || response.status === 504) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 30_000 * attempt));
      continue;
    }
    if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
    return parseOverpass((await response.json()) as { elements: Element[] });
  }
}
