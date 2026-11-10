import type { ApartmentRoutes, RouteLeg } from "@/lib/schemas";
import { totalMeters, type Itinerary, type Leg, type OtpPlace } from "../lib/otp";

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "2026-11-17T08:41:00-05:00" → "08:41" in Pittsburgh. */
export const localClock = (time: string) => clock.format(new Date(time));

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`OpenTripPlanner left out ${what}`);
  return value;
}

function place(otp: OtpPlace | undefined, what: string): RouteLeg["from"] {
  const p = required(otp, what);
  return {
    name: p.stop?.name ?? p.name ?? "Unnamed place",
    stopCode: p.stop?.code ?? null,
    location: { lat: round(p.lat, 6), lng: round(p.lon, 6) },
  };
}

function leg(otp: Leg, index: number): RouteLeg {
  const ride = otp.mode !== "WALK";
  return {
    mode: otp.mode,
    from: place(otp.from, `leg ${index + 1}'s start`),
    to: place(otp.to, `leg ${index + 1}'s end`),
    departAt: localClock(required(otp.start, `leg ${index + 1}'s start time`).scheduledTime),
    arriveAt: localClock(required(otp.end, `leg ${index + 1}'s end time`).scheduledTime),
    minutes: round(required(otp.duration, `leg ${index + 1}'s duration`) / 60, 1),
    meters: Math.round(otp.distance),
    route: ride && otp.route ? { shortName: otp.route.shortName, longName: otp.route.longName } : null,
    headsign: ride ? (otp.headsign ?? null) : null,
    stops: ride ? (otp.intermediateStops?.length ?? 0) + 1 : null,
    geometry: required(otp.legGeometry, `leg ${index + 1}'s path`).points,
  };
}

/** The commute trip as stored in data/routes.json. `arriveBy` is the deadline it was planned for ("09:00"). */
export function toCommuteRoute(itinerary: Itinerary, arriveBy: string): NonNullable<ApartmentRoutes["commute"]> {
  return {
    arriveBy,
    departAt: localClock(itinerary.start),
    arriveAt: localClock(itinerary.end),
    minutes: round(itinerary.duration / 60, 1),
    legs: itinerary.legs.map(leg),
  };
}

/** The walking route as stored in data/routes.json. */
export function toWalkRoute(itinerary: Itinerary): NonNullable<ApartmentRoutes["walk"]> {
  return {
    meters: Math.round(totalMeters(itinerary)),
    minutes: round(itinerary.duration / 60, 1),
    geometry: itinerary.legs.map((l, index) => required(l.legGeometry, `walking leg ${index + 1}'s path`).points),
  };
}
