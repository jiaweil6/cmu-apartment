import { ARRIVE_BY } from "@/lib/commute";
import type { ApartmentMetrics, Listings, RoutesFile, Snapshot } from "@/lib/schemas";
import { latestTrip, METERS_PER_MILE, plan, shortestWalk, totalMeters, WALK_ONLY } from "../lib/otp";
import { zonedTime } from "../lib/service-date";
import { toCommuteRoute, toWalkRoute } from "./routes";

export interface TransitResult {
  id: string;
  name: string;
  commuteMinutes: { before?: number; after?: number };
  walkMiles: { before?: number; after?: number };
  error?: string;
}

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Computes commute minutes and walking miles to campus for every apartment, and
 * keeps the trips behind them (data/routes.json): the trip you'd take to be on
 * campus by ARRIVE_BY (lib/commute.ts), and the shortest walk. An apartment whose
 * routing fails keeps its previous values and routes.
 */
export async function refreshTransit(options: {
  otpUrl: string;
  listings: Listings;
  snapshot: Snapshot;
  previousRoutes: RoutesFile["apartments"];
  serviceDate: string;
  observedAt: string;
  source: string;
}): Promise<{ apartments: Snapshot["apartments"]; routes: RoutesFile["apartments"]; results: TransitResult[] }> {
  const { otpUrl, listings, snapshot, previousRoutes, serviceDate, observedAt, source } = options;
  const campus = listings.campus.location;
  const apartments: Snapshot["apartments"] = { ...snapshot.apartments };
  const routes: RoutesFile["apartments"] = { ...previousRoutes };
  const results: TransitResult[] = [];

  for (const apartment of listings.apartments) {
    const previous: ApartmentMetrics | undefined = snapshot.apartments[apartment.id];
    const result: TransitResult = {
      id: apartment.id,
      name: apartment.name,
      commuteMinutes: { before: previous?.commuteMinutes?.value },
      walkMiles: { before: previous?.walkMiles?.value },
    };
    results.push(result);
    if (!previous) {
      result.error = "No snapshot entry yet (prices must be fetched first)";
      continue;
    }

    try {
      const labels = { from: apartment.shortName, to: listings.campus.shortName };
      // The trip you'd take to make a class at ARRIVE_BY: the latest one that still arrives in time.
      const trip = latestTrip(
        await plan(otpUrl, apartment.location, campus, {
          dateTime: { latestArrival: zonedTime(serviceDate, ARRIVE_BY) },
          labels,
        }),
      );
      const walk = shortestWalk(
        await plan(otpUrl, apartment.location, campus, {
          dateTime: { earliestDeparture: zonedTime(serviceDate, "08:00") },
          modes: WALK_ONLY,
          labels,
        }),
      );
      const route = { commute: toCommuteRoute(trip, ARRIVE_BY), walk: toWalkRoute(walk) };
      const commuteMinutes = round(trip.duration / 60, 1);
      const walkMiles = round(totalMeters(walk) / METERS_PER_MILE, 2);
      apartments[apartment.id] = {
        ...previous,
        commuteMinutes: { value: commuteMinutes, observedAt, source },
        walkMiles: { value: walkMiles, observedAt, source },
      };
      routes[apartment.id] = route;
      result.commuteMinutes.after = commuteMinutes;
      result.walkMiles.after = walkMiles;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
  }

  return { apartments, routes, results };
}
