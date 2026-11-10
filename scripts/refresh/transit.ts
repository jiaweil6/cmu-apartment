import { plan, tripMinutes, walkingMiles, WALK_ONLY } from "../lib/otp";
import { zonedTime } from "../lib/service-date";
import type { ApartmentMetrics, Listings, Snapshot } from "@/lib/schemas";

/** Arrival deadlines on the service date; the commute is the median of the three trips. */
const ARRIVE_BY = ["08:30", "09:00", "09:30"];

export interface TransitResult {
  id: string;
  name: string;
  commuteMinutes: { before?: number; after?: number };
  walkMiles: { before?: number; after?: number };
  error?: string;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Computes commute minutes and walking miles to campus for every apartment.
 * An apartment whose routing fails keeps its previous values.
 */
export async function refreshTransit(options: {
  otpUrl: string;
  listings: Listings;
  snapshot: Snapshot;
  serviceDate: string;
  observedAt: string;
  source: string;
}): Promise<{ apartments: Snapshot["apartments"]; results: TransitResult[] }> {
  const { otpUrl, listings, snapshot, serviceDate, observedAt, source } = options;
  const campus = listings.campus.location;
  const apartments: Snapshot["apartments"] = { ...snapshot.apartments };
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
      const trips = await Promise.all(
        ARRIVE_BY.map(async (time) =>
          tripMinutes(await plan(otpUrl, apartment.location, campus, { dateTime: { latestArrival: zonedTime(serviceDate, time) } })),
        ),
      );
      const walk = walkingMiles(
        await plan(otpUrl, apartment.location, campus, {
          dateTime: { earliestDeparture: zonedTime(serviceDate, "08:00") },
          modes: WALK_ONLY,
        }),
      );
      const commuteMinutes = round(median(trips), 1);
      const walkMiles = round(walk, 2);
      apartments[apartment.id] = {
        ...previous,
        commuteMinutes: { value: commuteMinutes, observedAt, source },
        walkMiles: { value: walkMiles, observedAt, source },
      };
      result.commuteMinutes.after = commuteMinutes;
      result.walkMiles.after = walkMiles;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
  }

  return { apartments, results };
}
