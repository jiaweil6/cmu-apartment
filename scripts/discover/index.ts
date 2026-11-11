/**
 * Finds apartment buildings near campus that we don't list yet and adds them
 * to data/candidates.json for review.
 *
 *   npm run discover -- [--radius 3.5] [--max-new 15] [--no-osm]
 *                       [--otp-url http://localhost:8080 --gtfs-dir otp-run/gtfs [--max-commute 45]]
 *                       [--summary discover-summary.md] [--dry-run]
 *
 * Sources: Allegheny County parcels with apartment land-use codes (WPRDC) and
 * OpenStreetMap buildings for names, websites and construction years. With an
 * OpenTripPlanner URL, each candidate gets its transit commute; --max-commute
 * leaves out longer ones (no limit by default, since some students drive). With
 * BRAVE_API_KEY set, new finds without a website get one from Brave Search.
 */
import { ARRIVE_BY } from "@/lib/commute";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import type { LatLng } from "@/lib/types";
import { readCandidates, readListings, readRejected, writeCandidates } from "../lib/data-files";
import { createHttp } from "../lib/http";
import { ADAPTERS } from "../refresh/pricing";
import { plan, tripMinutes } from "../lib/otp";
import { nextRegularTuesday, readCsv, zonedTime } from "../lib/service-date";
import { apartmentParcels } from "../lib/wprdc";
import { attachOsm, groupParcels, updateCandidates } from "./candidates";
import { enrichCandidates } from "./enrich";
import { osmApartmentBuildings } from "./osm";
import { discoverySummary } from "./summary";
import { websiteFinder } from "./website";

const { values: args } = parseArgs({
  options: {
    // Far enough for downtown, the North Shore and Station Square.
    radius: { type: "string", default: "3.5" },
    "max-new": { type: "string", default: "15" },
    // Optional: leave out buildings whose transit commute is longer (minutes). No limit by default.
    "max-commute": { type: "string" },
    "no-osm": { type: "boolean", default: false },
    "otp-url": { type: "string" },
    "gtfs-dir": { type: "string" },
    summary: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

function commuteFn(otpUrl: string, gtfsDir: string, campus: LatLng, now: Date) {
  const [info] = readCsv(readFileSync(path.join(gtfsDir, "feed_info.txt"), "utf8"));
  const exceptions = readCsv(readFileSync(path.join(gtfsDir, "calendar_dates.txt"), "utf8"));
  const date = nextRegularTuesday(now, {
    startDate: info.feed_start_date,
    endDate: info.feed_end_date,
    exceptionDates: new Set(exceptions.map((row) => row.date)),
  });
  return async (location: LatLng) => {
    try {
      return tripMinutes(await plan(otpUrl, location, campus, { dateTime: { latestArrival: zonedTime(date, ARRIVE_BY) } }));
    } catch {
      return null; // Unroutable: let the reviewer judge from the distance.
    }
  };
}

async function main() {
  const listings = readListings();
  const campus = listings.campus.location;
  const radius = Number(args.radius);
  const now = new Date();
  const nowIso = now.toISOString().replace(/\.\d{3}Z$/, "Z");

  const parcels = await apartmentParcels(campus, radius);
  let buildings = groupParcels(parcels, campus);
  if (!args["no-osm"]) buildings = attachOsm(buildings, await osmApartmentBuildings(campus, radius));

  const commute =
    args["otp-url"] && args["gtfs-dir"] ? commuteFn(args["otp-url"], args["gtfs-dir"], campus, now) : undefined;
  const { file, report } = await updateCandidates({
    buildings,
    listings,
    previous: readCandidates(),
    rejected: readRejected(),
    now: nowIso,
    maxNew: Number(args["max-new"]),
    commute,
    maxCommuteMinutes: args["max-commute"] ? Number(args["max-commute"]) : undefined,
  });

  // New finds only: websites (Brave Search, when BRAVE_API_KEY is set) and leasing platforms.
  const apiKey = process.env.BRAVE_API_KEY;
  const http = createHttp();
  await enrichCandidates(report.added, {
    findWebsite: apiKey ? websiteFinder(apiKey) : undefined,
    fetchHomepage: (url) => http.text(url),
    adapters: [...ADAPTERS.values()],
  });

  const markdown = discoverySummary(report, file.candidates.filter((c) => c.decision === "pending").length);
  process.stdout.write(markdown);
  if (args.summary) writeFileSync(args.summary, markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  if (!args["dry-run"] && report.added.length) writeCandidates(file);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
