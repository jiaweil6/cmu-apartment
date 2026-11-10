import listingsFile from "@/data/apartments.json";
import snapshotFile from "@/data/snapshot.json";
import { listingsSchema, snapshotSchema, type Listings, type Snapshot, type UnitInfo } from "./schemas";
import type { Apartment, Place, RoomType } from "./types";

const UNKNOWN_UNIT: UnitInfo = {
  status: "unknown",
  minPrice: null,
  observedAt: "1970-01-01T00:00:00Z",
  source: "none",
};

/** Prices this much older than the latest refresh are flagged as possibly out of date. */
export const STALE_PRICE_DAYS = 14;

/**
 * Combines listing details with the latest snapshot. An apartment the snapshot
 * doesn't cover yet (e.g. just added) gets unknown prices until the next refresh.
 * Staleness is measured against the snapshot's date, not today, so the static
 * build and the browser always agree.
 */
export function mergeListings(listings: Listings, snapshot: Snapshot): Apartment[] {
  const staleBefore = new Date(Date.parse(snapshot.generatedAt) - STALE_PRICE_DAYS * 86_400_000).toISOString();
  return listings.apartments.map((info) => {
    const metrics = snapshot.apartments[info.id];
    const units: Record<RoomType, UnitInfo> = metrics?.units ?? {
      studio: UNKNOWN_UNIT,
      oneBedroom: UNKNOWN_UNIT,
      twoBedroom: UNKNOWN_UNIT,
      threeBedroom: UNKNOWN_UNIT,
    };
    const pricesCheckedAt =
      Object.values(units)
        .filter((unit) => unit.status !== "unknown" || unit.minPrice !== null)
        .map((unit) => unit.observedAt)
        .sort()
        .at(-1) ?? null;
    return {
      ...info,
      units,
      commuteMinutes: metrics?.commuteMinutes ?? null,
      walkMiles: metrics?.walkMiles ?? null,
      pricesCheckedAt,
      pricesStale: pricesCheckedAt !== null && pricesCheckedAt < staleBefore,
    };
  });
}

const listings = listingsSchema.parse(listingsFile);
const snapshot = snapshotSchema.parse(snapshotFile);

/**
 * Data access for listings. Pages and API routes read through here, so moving
 * the data into a database later only changes this file.
 */
export async function getApartments(): Promise<Apartment[]> {
  return mergeListings(listings, snapshot);
}

export async function getCampus(): Promise<Place> {
  return listings.campus;
}
