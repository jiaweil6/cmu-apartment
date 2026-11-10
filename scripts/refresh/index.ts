/**
 * Refreshes fetched values in data/snapshot.json (and, for transit, the trips in data/routes.json).
 *
 *   npm run refresh -- --only prices [--summary refresh-summary.md] [--dry-run]
 *   npm run refresh -- --only transit --gtfs-dir otp-run/gtfs [--otp-url http://localhost:8080]
 *                      [--summary refresh-summary.md] [--dry-run]
 *
 * Sources:
 *   prices   rents and availability, through each listing's pricing adapter
 *   transit  commute minutes and walking miles to campus, via a running OpenTripPlanner
 *
 * Writes `needs_review=true|false` to $GITHUB_OUTPUT for the publish step.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { readListings, readManualPrices, readRoutes, readSnapshot, writeRoutes, writeSnapshot } from "../lib/data-files";
import { createHttp } from "../lib/http";
import { nextRegularTuesday, readCsv } from "../lib/service-date";
import { ADAPTERS } from "./pricing";
import { priceSummary, refreshPrices } from "./prices";
import { transitSummary } from "./summary";
import { refreshTransit } from "./transit";
import type { Listings, RoutesFile, Snapshot } from "@/lib/schemas";

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
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

async function transit(observedAt: string, now: Date) {
  if (!args["gtfs-dir"]) throw new Error("--gtfs-dir is required for transit (an unzipped GTFS feed)");
  const listings = readListings();
  const feed = readFeed(args["gtfs-dir"]);
  const serviceDate = nextRegularTuesday(now, feed);
  const source = `OpenTripPlanner with PRT GTFS ${feed.version} and OpenStreetMap`;
  const { apartments, routes, results } = await refreshTransit({
    otpUrl: args["otp-url"],
    listings,
    snapshot: readSnapshot(),
    previousRoutes: readRoutes().apartments,
    serviceDate,
    observedAt,
    source,
  });
  if (results.every((r) => r.error)) throw new Error("Every apartment failed to route; leaving the snapshot unchanged");
  return {
    listings,
    apartments,
    routes: { generatedAt: observedAt, serviceDate, source, apartments: routes },
    ...transitSummary(results, { serviceDate, source }),
  };
}

async function prices(observedAt: string) {
  const listings = readListings();
  const { apartments, results } = await refreshPrices({
    listings,
    snapshot: readSnapshot(),
    adapters: ADAPTERS,
    context: { http: createHttp(), manual: readManualPrices(), today: observedAt.slice(0, 10) },
    now: observedAt,
  });
  const scraped = results.filter((r) => r.adapter !== "manual");
  if (scraped.length && scraped.every((r) => r.outcome === "failed")) {
    throw new Error("Every scraped source failed; leaving the snapshot unchanged");
  }
  return { listings, apartments, ...priceSummary(results) };
}

async function main() {
  const now = new Date();
  const observedAt = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  let run: { listings: Listings; apartments: Snapshot["apartments"]; routes?: RoutesFile; markdown: string; needsReview: boolean };
  if (args.only === "transit") run = await transit(observedAt, now);
  else if (args.only === "prices") run = await prices(observedAt);
  else throw new Error(`--only must be "prices" or "transit"`);

  process.stdout.write(run.markdown);
  if (args.summary) writeFileSync(args.summary, run.markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, run.markdown);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `needs_review=${run.needsReview}\n`);
  if (!args["dry-run"]) {
    writeSnapshot({ generatedAt: observedAt, apartments: run.apartments }, run.listings);
    if (run.routes) writeRoutes(run.routes, run.listings);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
