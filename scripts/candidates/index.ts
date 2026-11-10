/**
 * Applies review decisions in data/candidates.json.
 *
 *   npm run candidates:promote [-- --dry-run]
 *
 * Exits with an error if an approved candidate is missing required fields, so
 * the workflow run shows what to fix.
 */
import { parseArgs } from "node:util";
import {
  readCandidates,
  readListings,
  readManualPrices,
  readRejected,
  readSnapshot,
  writeCandidates,
  writeListings,
  writeManualPrices,
  writeRejected,
  writeSnapshot,
} from "../lib/data-files";
import { promote } from "./promote";

const { values: args } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });

const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const result = promote({
  listings: readListings(),
  candidates: readCandidates(),
  rejected: readRejected(),
  snapshot: readSnapshot(),
  manualPrices: readManualPrices(),
  now,
});

for (const listing of result.promoted) console.log(`Listed ${listing.name} as "${listing.id}"`);
for (const key of result.rejectedKeys) console.log(`Rejected ${key}`);
for (const { address, missing } of result.problems) {
  console.error(`Can't list ${address} yet: fill in ${missing.join(", ")}`);
}

if (!args["dry-run"] && (result.promoted.length || result.rejectedKeys.length)) {
  writeListings(result.listings);
  writeSnapshot(result.snapshot, result.listings);
  writeCandidates(result.candidates);
  writeRejected(result.rejected);
  writeManualPrices(result.manualPrices);
}
if (result.problems.length) process.exit(1);
