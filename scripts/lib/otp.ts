/**
 * Minimal client for OpenTripPlanner 2's GTFS GraphQL API (`/otp/gtfs/v1`).
 * The refresh workflow starts OTP locally with PRT's GTFS feed and an
 * OpenStreetMap extract (see .github/workflows/refresh-transit.yml).
 */
import type { LatLng } from "@/lib/types";

const PLACE = "name lat lon stop { name code }";

const PLAN_QUERY = `
query Plan($origin: PlanLabeledLocationInput!, $destination: PlanLabeledLocationInput!,
           $dateTime: PlanDateTimeInput, $modes: PlanModesInput) {
  planConnection(origin: $origin, destination: $destination, dateTime: $dateTime, modes: $modes, first: 5) {
    edges {
      node {
        start end duration
        legs {
          mode distance duration
          start { scheduledTime }
          end { scheduledTime }
          from { ${PLACE} }
          to { ${PLACE} }
          route { shortName longName }
          headsign
          intermediateStops { name }
          legGeometry { points }
        }
      }
    }
    routingErrors { code description }
  }
}`;

export interface OtpPlace {
  name: string | null;
  lat: number;
  lon: number;
  stop: { name: string; code: string | null } | null;
}

/** A leg as OTP returns it. Everything but mode and distance is optional so tests can stay small. */
export interface Leg {
  mode: string;
  /** Meters. */
  distance: number;
  /** Seconds. */
  duration?: number;
  start?: { scheduledTime: string };
  end?: { scheduledTime: string };
  from?: OtpPlace;
  to?: OtpPlace;
  route?: { shortName: string | null; longName: string | null } | null;
  headsign?: string | null;
  intermediateStops?: { name: string }[] | null;
  /** Google encoded polyline. */
  legGeometry?: { points: string } | null;
}

export interface Itinerary {
  start: string;
  end: string;
  /** Seconds. */
  duration: number;
  legs: Leg[];
}

interface PlanResponse {
  data?: { planConnection: { edges: { node: Itinerary }[]; routingErrors: { code: string; description: string }[] } };
  errors?: { message: string }[];
}

const location = ({ lat, lng }: LatLng, label?: string) => ({
  location: { coordinate: { latitude: lat, longitude: lng } },
  ...(label ? { label } : {}),
});

export async function plan(
  otpUrl: string,
  from: LatLng,
  to: LatLng,
  options: {
    dateTime: { latestArrival: string } | { earliestDeparture: string };
    modes?: object;
    /** Names for the two ends, shown on the first and last legs. */
    labels?: { from: string; to: string };
  },
): Promise<Itinerary[]> {
  const response = await fetch(`${otpUrl}/otp/gtfs/v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: PLAN_QUERY,
      variables: {
        origin: location(from, options.labels?.from),
        destination: location(to, options.labels?.to),
        dateTime: options.dateTime,
        modes: options.modes,
      },
    }),
  });
  if (!response.ok) throw new Error(`OTP responded ${response.status}: ${await response.text()}`);
  return parsePlanResponse((await response.json()) as PlanResponse);
}

export function parsePlanResponse(body: PlanResponse): Itinerary[] {
  if (body.errors?.length) throw new Error(`OTP query failed: ${body.errors.map((e) => e.message).join("; ")}`);
  const result = body.data?.planConnection;
  if (!result) throw new Error("OTP returned no plan");
  const itineraries = result.edges.map((edge) => edge.node);
  if (itineraries.length === 0) {
    const reasons = result.routingErrors.map((e) => e.code).join(", ") || "no itineraries";
    throw new Error(`No route found (${reasons})`);
  }
  return itineraries;
}

/**
 * The trip you'd take to arrive by the deadline: the latest-departing itinerary
 * OTP finds (transit or walking, whichever is faster).
 */
export function latestTrip(itineraries: Itinerary[]): Itinerary {
  return [...itineraries].sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0];
}

/** Door-to-door minutes of `latestTrip`. */
export function tripMinutes(itineraries: Itinerary[]): number {
  return latestTrip(itineraries).duration / 60;
}

export const totalMeters = (itinerary: Itinerary) => itinerary.legs.reduce((sum, leg) => sum + leg.distance, 0);

/** The shortest walking itinerary, by distance along streets and paths. */
export function shortestWalk(itineraries: Itinerary[]): Itinerary {
  return [...itineraries].sort((a, b) => totalMeters(a) - totalMeters(b))[0];
}

export const METERS_PER_MILE = 1609.344;

/** Length of the shortest walking itinerary, in miles. */
export function walkingMiles(itineraries: Itinerary[]): number {
  return totalMeters(shortestWalk(itineraries)) / METERS_PER_MILE;
}

export const WALK_ONLY = { directOnly: true, direct: ["WALK"] };
