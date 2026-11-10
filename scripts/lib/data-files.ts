import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  candidatesFileSchema,
  listingsSchema,
  manualPricesSchema,
  rejectedFileSchema,
  snapshotSchema,
  type CandidatesFile,
  type Listings,
  type ManualPrices,
  type RejectedFile,
  type Snapshot,
} from "@/lib/schemas";

const DATA_DIR = path.join(process.cwd(), "data");
export const LISTINGS_PATH = path.join(DATA_DIR, "apartments.json");
export const SNAPSHOT_PATH = path.join(DATA_DIR, "snapshot.json");
export const CANDIDATES_PATH = path.join(DATA_DIR, "candidates.json");
export const REJECTED_PATH = path.join(DATA_DIR, "rejected.json");
export const MANUAL_PRICES_PATH = path.join(DATA_DIR, "manual-prices.json");

const writeJson = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

export function readListings(): Listings {
  return listingsSchema.parse(JSON.parse(readFileSync(LISTINGS_PATH, "utf8")));
}

export function writeListings(listings: Listings): void {
  writeJson(LISTINGS_PATH, listingsSchema.parse(listings));
}

export function readCandidates(): CandidatesFile {
  return candidatesFileSchema.parse(JSON.parse(readFileSync(CANDIDATES_PATH, "utf8")));
}

export function writeCandidates(file: CandidatesFile): void {
  writeJson(CANDIDATES_PATH, candidatesFileSchema.parse(file));
}

export function readRejected(): RejectedFile {
  return rejectedFileSchema.parse(JSON.parse(readFileSync(REJECTED_PATH, "utf8")));
}

export function writeRejected(file: RejectedFile): void {
  writeJson(REJECTED_PATH, rejectedFileSchema.parse(file));
}

export function readManualPrices(): ManualPrices {
  return manualPricesSchema.parse(JSON.parse(readFileSync(MANUAL_PRICES_PATH, "utf8")));
}

export function writeManualPrices(prices: ManualPrices): void {
  writeJson(MANUAL_PRICES_PATH, manualPricesSchema.parse(prices));
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
  writeJson(SNAPSHOT_PATH, snapshotSchema.parse(ordered));
}
