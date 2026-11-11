import { afterEach, describe, expect, it, vi } from "vitest";
import listings2024 from "@/lib/__fixtures__/listings-2024.json";
import snapshot2024 from "@/lib/__fixtures__/snapshot-2024.json";
import { listingsSchema, snapshotSchema } from "@/lib/schemas";
import { parsePlanResponse, tripMinutes, walkingMiles, type Itinerary, type Leg } from "../lib/otp";
import { localClock, toCommuteRoute, toWalkRoute } from "./routes";
import { transitSummary } from "./summary";
import { refreshTransit } from "./transit";

const allListings = listingsSchema.parse(listings2024);
const listings = { ...allListings, apartments: allListings.apartments.slice(0, 2) };
const snapshot = snapshotSchema.parse(snapshot2024);

const place = (name: string, lat: number, lon: number, stop?: string) => ({
  name,
  lat,
  lon,
  stop: stop ? { name: stop, code: "1234" } : null,
});

/** A walk to a stop, a bus ride and a walk to campus, in the shape OTP returns. */
const busLegs = (start: string): Leg[] => [
  {
    mode: "WALK",
    distance: 300,
    duration: 240,
    start: { scheduledTime: start },
    end: { scheduledTime: start.replace(":00:00", ":04:00") },
    from: place("Coda", 40.46, -79.93),
    to: place("Centre Ave at Negley Ave", 40.461, -79.931, "Centre Ave at Negley Ave"),
    route: null,
    headsign: null,
    intermediateStops: null,
    legGeometry: { points: "_p~iF~ps|U_ulLnnqC" },
  },
  {
    mode: "BUS",
    distance: 2400,
    duration: 660,
    start: { scheduledTime: start.replace(":00:00", ":05:00") },
    end: { scheduledTime: start.replace(":00:00", ":16:00") },
    from: place("Centre Ave at Negley Ave", 40.461, -79.931, "Centre Ave at Negley Ave"),
    to: place("Fifth Ave at Morewood Ave", 40.446, -79.946, "Fifth Ave at Morewood Ave"),
    route: { shortName: "71B", longName: "Highland Park" },
    headsign: "Downtown",
    intermediateStops: [{ name: "a" }, { name: "b" }, { name: "c" }],
    legGeometry: { points: "_ulLnnqC_mqNvxq`@" },
  },
  {
    mode: "WALK",
    distance: 300,
    duration: 300,
    start: { scheduledTime: start.replace(":00:00", ":16:00") },
    end: { scheduledTime: start.replace(":00:00", ":21:00") },
    from: place("Fifth Ave at Morewood Ave", 40.446, -79.946, "Fifth Ave at Morewood Ave"),
    to: place("Carnegie Mellon University", 40.443, -79.945),
    route: null,
    headsign: null,
    intermediateStops: null,
    legGeometry: { points: "_p~iF~ps|U" },
  },
];

const walkLeg = (start: string, distance: number): Leg => ({
  ...busLegs(start)[0],
  distance,
  to: place("Carnegie Mellon University", 40.443, -79.945),
});

const itinerary = (start: string, minutes: number, legs: Leg[] = busLegs(start)): Itinerary => ({
  start,
  end: start,
  duration: minutes * 60,
  legs,
});

/** Fakes OTP: the latest transit trip arriving by 10 AM takes 22 min; walks are 2 km. Fails for one origin. */
function fakeOtp(failLatitude?: number) {
  const transit: Record<string, number> = { "10:00": 22 };
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { variables } = JSON.parse(init.body as string);
    if (variables.origin.location.coordinate.latitude === failLatitude) {
      return Response.json({ data: { planConnection: { edges: [], routingErrors: [{ code: "OUTSIDE_BOUNDS", description: "" }] } } });
    }
    const walking = variables.modes?.directOnly;
    const time = (variables.dateTime.latestArrival ?? "").slice(11, 16);
    const nodes = walking
      ? [itinerary("2026-11-17T08:00:00-05:00", 40, [walkLeg("2026-11-17T08:00:00-05:00", 2000)])]
      : [itinerary("2026-11-17T07:00:00-05:00", 99), itinerary("2026-11-17T08:00:00-05:00", transit[time])];
    return Response.json({ data: { planConnection: { edges: nodes.map((node) => ({ node })), routingErrors: [] } } });
  });
}

afterEach(() => vi.unstubAllGlobals());

let lastRoutes: Record<string, unknown> = {};
const routesFor = (id: string) => lastRoutes[id];

const run = () =>
  refreshTransit({
    otpUrl: "http://otp.test",
    listings,
    snapshot,
    previousRoutes: {},
    serviceDate: "2026-11-17",
    observedAt: "2026-11-10T00:00:00Z",
    source: "test",
  });

describe("refreshTransit", () => {
  it("records the trip that reaches campus by 10 AM and the walking distance", async () => {
    vi.stubGlobal("fetch", fakeOtp());
    const { apartments, results } = await run();
    const [first] = listings.apartments;
    expect(apartments[first.id].commuteMinutes).toEqual({ value: 22, observedAt: "2026-11-10T00:00:00Z", source: "test" });
    expect(apartments[first.id].walkMiles?.value).toBe(1.24); // 2 km
    expect(apartments[first.id].units).toEqual(snapshot.apartments[first.id].units);
    expect(results.every((r) => !r.error)).toBe(true);
  });

  it("keeps that trip and the walk as routes", async () => {
    vi.stubGlobal("fetch", fakeOtp());
    const { routes } = await run();
    const route = routes[listings.apartments[0].id];
    expect(route.commute).toMatchObject({ arriveBy: "10:00", minutes: 22 });
    expect(route.commute?.legs.map((leg) => leg.mode)).toEqual(["WALK", "BUS", "WALK"]);
    expect(route.walk).toMatchObject({ meters: 2000, minutes: 40 });
  });

  it("keeps previous values when an apartment can't be routed", async () => {
    const [, second] = listings.apartments;
    vi.stubGlobal("fetch", fakeOtp(second.location.lat));
    const { apartments, results, routes } = await run();
    lastRoutes = routes;
    expect(apartments[second.id]).toEqual(snapshot.apartments[second.id]);
    expect(results[1].error).toMatch(/OUTSIDE_BOUNDS/);
    expect(routesFor(second.id)).toBeUndefined();
    expect(transitSummary(results, { serviceDate: "2026-11-17", source: "test" }).needsReview).toBe(true);
  });
});

describe("stored routes", () => {
  const trip = itinerary("2026-11-17T08:37:00-05:00", 21, busLegs("2026-11-17T08:00:00-05:00"));
  const route = toCommuteRoute({ ...trip, end: "2026-11-17T08:58:00-05:00" }, "09:00");

  it("records times in Pittsburgh time", () => {
    expect(localClock("2026-11-17T13:41:00Z")).toBe("08:41");
    expect(route).toMatchObject({ arriveBy: "09:00", departAt: "08:37", arriveAt: "08:58", minutes: 21 });
  });

  it("names stops, the line and how many stops you ride", () => {
    const [walk, bus] = route.legs;
    expect(walk).toMatchObject({ mode: "WALK", route: null, stops: null, minutes: 4, meters: 300 });
    expect(walk.to).toEqual({ name: "Centre Ave at Negley Ave", stopCode: "1234", location: { lat: 40.461, lng: -79.931 } });
    expect(bus).toMatchObject({
      mode: "BUS",
      route: { shortName: "71B", longName: "Highland Park" },
      headsign: "Downtown",
      stops: 4,
      departAt: "08:05",
      arriveAt: "08:16",
      geometry: "_ulLnnqC_mqNvxq`@",
    });
  });

  it("keeps one path per walking leg", () => {
    expect(toWalkRoute(itinerary("2026-11-17T08:00:00-05:00", 31, [walkLeg("2026-11-17T08:00:00-05:00", 2500)]))).toEqual({
      meters: 2500,
      minutes: 31,
      geometry: ["_p~iF~ps|U_ulLnnqC"],
    });
  });

  it("fails loudly when OTP leaves out a path", () => {
    const [first] = busLegs("2026-11-17T08:00:00-05:00");
    expect(() => toCommuteRoute(itinerary("2026-11-17T08:00:00-05:00", 5, [{ ...first, legGeometry: null }]), "09:00")).toThrow(
      /leg 1's path/,
    );
  });
});

describe("OTP response parsing", () => {
  it("uses the latest-departing itinerary for trip time", () => {
    expect(tripMinutes([itinerary("2026-11-17T07:00:00-05:00", 15), itinerary("2026-11-17T08:10:00-05:00", 25)])).toBe(25);
  });

  it("sums leg distances for walking", () => {
    expect(walkingMiles([itinerary("x", 10, [{ mode: "WALK", distance: 804.672 }, { mode: "WALK", distance: 804.672 }])])).toBe(1);
    expect(walkingMiles([itinerary("x", 10, [{ mode: "WALK", distance: 3000 }]), itinerary("y", 10, [{ mode: "WALK", distance: 1609.344 }])])).toBe(1);
  });

  it("surfaces GraphQL errors", () => {
    expect(() => parsePlanResponse({ errors: [{ message: "Unknown field" }] })).toThrow(/Unknown field/);
  });
});

describe("transitSummary", () => {
  it("flags large changes for review", () => {
    const { markdown, needsReview } = transitSummary(
      [{ id: "a", name: "A", commuteMinutes: { before: 10, after: 30 }, walkMiles: { before: 1, after: 1 } }],
      { serviceDate: "2026-11-17", source: "test" },
    );
    expect(needsReview).toBe(true);
    expect(markdown).toContain("| A | 10 min → 30 min | 1 mi → 1 mi | Large change |");
  });
});
