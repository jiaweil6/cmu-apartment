/**
 * Minimal client for OpenTripPlanner 2's GTFS GraphQL API (`/otp/gtfs/v1`).
 * The refresh workflow starts OTP locally with PRT's GTFS feed and an
 * OpenStreetMap extract (see .github/workflows/refresh-transit.yml).
 */
import type { LatLng } from "@/lib/types";

const PLAN_QUERY = `
query Plan($origin: PlanLabeledLocationInput!, $destination: PlanLabeledLocationInput!,
           $dateTime: PlanDateTimeInput, $modes: PlanModesInput) {
  planConnection(origin: $origin, destination: $destination, dateTime: $dateTime, modes: $modes, first: 5) {
    edges { node { start end duration legs { mode distance } } }
    routingErrors { code description }
  }
}`;

export interface Itinerary {
  start: string;
  end: string;
  /** Seconds. */
  duration: number;
  legs: { mode: string; distance: number }[];
}

interface PlanResponse {
  data?: { planConnection: { edges: { node: Itinerary }[]; routingErrors: { code: string; description: string }[] } };
  errors?: { message: string }[];
}

const location = ({ lat, lng }: LatLng) => ({ location: { coordinate: { latitude: lat, longitude: lng } } });

export async function plan(
  otpUrl: string,
  from: LatLng,
  to: LatLng,
  options: { dateTime: { latestArrival: string } | { earliestDeparture: string }; modes?: object },
): Promise<Itinerary[]> {
  const response = await fetch(`${otpUrl}/otp/gtfs/v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: PLAN_QUERY,
      variables: { origin: location(from), destination: location(to), dateTime: options.dateTime, modes: options.modes },
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
 * Door-to-door minutes for the trip you'd take to arrive by `deadline`: the
 * latest-departing itinerary OTP finds (transit or walking, whichever is faster).
 */
export function tripMinutes(itineraries: Itinerary[]): number {
  const latest = [...itineraries].sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0];
  return latest.duration / 60;
}

const METERS_PER_MILE = 1609.344;

/** Length of the shortest walking itinerary, in miles. */
export function walkingMiles(itineraries: Itinerary[]): number {
  const meters = Math.min(...itineraries.map((it) => it.legs.reduce((sum, leg) => sum + leg.distance, 0)));
  return meters / METERS_PER_MILE;
}

export const WALK_ONLY = { directOnly: true, direct: ["WALK"] };
