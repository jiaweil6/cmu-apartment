/**
 * Apartment buildings from OpenStreetMap via the Overpass API (ODbL). Used to
 * put names, websites and construction years on county parcels.
 */
import type { LatLng } from "@/lib/types";
import { METERS_PER_MILE } from "../lib/geo";

/** The main public Overpass server first, then public mirrors of it. */
export const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Busy or rate limited: worth trying again later. */
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

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
  return parseOverpass((await queryOverpass(query)) as { elements: Element[] });
}

export interface OverpassOptions {
  servers?: string[];
  attemptsPerServer?: number;
  /** Wait before the first retry; it doubles after each. */
  baseDelayMs?: number;
  /** Give up on a request that takes longer (the query itself allows 90 s). */
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Runs an Overpass query. Busy servers (429, 502, 503, 504) and network errors
 * are retried with exponential backoff, as Overpass asks, then the next server
 * is tried. Any other error means the query itself is wrong, so it fails at once.
 */
export async function queryOverpass(query: string, options: OverpassOptions = {}): Promise<unknown> {
  const {
    servers = OVERPASS_SERVERS,
    attemptsPerServer = 3,
    baseDelayMs = 30_000,
    timeoutMs = 120_000,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;
  const failures: string[] = [];
  for (const server of servers) {
    const host = new URL(server).hostname;
    let problem = "";
    for (let attempt = 1; attempt <= attemptsPerServer; attempt++) {
      let response: Response | null = null;
      try {
        response = await fetch(server, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "cmu-apartment-rankings (+https://github.com/jiaweil6/cmu-apartment)",
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        problem = error instanceof Error ? error.message : String(error);
      }
      if (response?.ok) return response.json();
      if (response) {
        await response.body?.cancel();
        if (!RETRY_STATUSES.has(response.status)) throw new Error(`Overpass (${host}) responded ${response.status}`);
        problem = `responded ${response.status}`;
      }

      if (attempt < attemptsPerServer) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        console.warn(`Overpass (${host}) ${problem}; retrying in ${delay / 1000} s`);
        await sleep(delay);
      }
    }
    failures.push(`${host} ${problem}`);
    console.warn(`Overpass (${host}) ${problem} after ${attemptsPerServer} attempts`);
  }
  throw new Error(`No Overpass server answered: ${failures.join("; ")}`);
}
