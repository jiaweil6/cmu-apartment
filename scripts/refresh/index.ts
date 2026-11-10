/**
 * Refreshes fetched values in data/snapshot.json.
 *
 *   npm run refresh -- --only transit --gtfs-dir otp/gtfs [--otp-url http://localhost:8080]
 *                      [--summary refresh-summary.md] [--dry-run]
 *
 * Sources:
 *   transit  commute minutes and walking miles to campus, via a running OpenTripPlanner
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { readListings, readSnapshot, writeSnapshot } from "../lib/data-files";
import { nextRegularTuesday, readCsv } from "../lib/service-date";
import { transitSummary } from "./summary";
import { refreshTransit } from "./transit";

const { values: args } = parseArgs({
  options: {
    only: { type: "string", default: "transit" },
    "otp-url": { type: "string", default: "http://localhost:8080" },
    "gtfs-dir": { type: "string" },
    summary: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

function readFeed(gtfsDir: string) {
  const [info] = readCsv(readFileSync(path.join(gtfsDir, "feed_info.txt"), "utf8"));
  const exceptions = readCsv(readFileSync(path.join(gtfsDir, "calendar_dates.txt"), "utf8"));
  return {
    version: info.feed_version,
    startDate: info.feed_start_date,
    endDate: info.feed_end_date,
    exceptionDates: new Set(exceptions.map((row) => row.date)),
  };
}

async function main() {
  if (args.only !== "transit") throw new Error(`Unknown source "${args.only}". Available: transit`);
  if (!args["gtfs-dir"]) throw new Error("--gtfs-dir is required for transit (an unzipped GTFS feed)");

  const listings = readListings();
  const snapshot = readSnapshot();
  const feed = readFeed(args["gtfs-dir"]);
  const now = new Date();
  const observedAt = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const serviceDate = nextRegularTuesday(now, feed);
  const source = `OpenTripPlanner with PRT GTFS ${feed.version} and OpenStreetMap`;

  const { apartments, results } = await refreshTransit({
    otpUrl: args["otp-url"],
    listings,
    snapshot,
    serviceDate,
    observedAt,
    source,
  });
  const { markdown, needsReview } = transitSummary(results, { serviceDate, source });

  process.stdout.write(markdown);
  if (args.summary) writeFileSync(args.summary, markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `needs_review=${needsReview}\n`);

  if (results.every((r) => r.error)) throw new Error("Every apartment failed to route; leaving the snapshot unchanged");
  if (!args["dry-run"]) writeSnapshot({ generatedAt: observedAt, apartments }, listings);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
