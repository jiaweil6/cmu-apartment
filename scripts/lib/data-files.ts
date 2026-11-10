import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { listingsSchema, snapshotSchema, type Listings, type Snapshot } from "@/lib/schemas";

const DATA_DIR = path.join(process.cwd(), "data");
export const LISTINGS_PATH = path.join(DATA_DIR, "apartments.json");
export const SNAPSHOT_PATH = path.join(DATA_DIR, "snapshot.json");

export function readListings(): Listings {
  return listingsSchema.parse(JSON.parse(readFileSync(LISTINGS_PATH, "utf8")));
}

export function readSnapshot(): Snapshot {
  return snapshotSchema.parse(JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")));
}

/** Validates, orders apartments like the listings file, and writes with stable formatting. */
export function writeSnapshot(snapshot: Snapshot, listings: Listings): void {
  const ordered: Snapshot = {
    generatedAt: snapshot.generatedAt,
    apartments: Object.fromEntries(
      listings.apartments.filter(({ id }) => snapshot.apartments[id]).map(({ id }) => [id, snapshot.apartments[id]]),
    ),
  };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshotSchema.parse(ordered), null, 2) + "\n");
}
