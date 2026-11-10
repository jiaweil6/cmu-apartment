import { afterEach, describe, expect, it, vi } from "vitest";
import listings2024 from "@/lib/__fixtures__/listings-2024.json";
import snapshot2024 from "@/lib/__fixtures__/snapshot-2024.json";
import { listingsSchema, snapshotSchema } from "@/lib/schemas";
import { parsePlanResponse, tripMinutes, walkingMiles } from "../lib/otp";
import { transitSummary } from "./summary";
import { refreshTransit } from "./transit";

const allListings = listingsSchema.parse(listings2024);
const listings = { ...allListings, apartments: allListings.apartments.slice(0, 2) };
const snapshot = snapshotSchema.parse(snapshot2024);

const itinerary = (start: string, minutes: number, legs = [{ mode: "BUS", distance: 3000 }]) => ({
  start,
  end: start,
  duration: minutes * 60,
  legs,
});

/** Fakes OTP: transit trips take 20/24/22 min by arrival deadline; walks are 2 km. Fails for one origin. */
function fakeOtp(failLatitude?: number) {
  const transit: Record<string, number> = { "08:30": 20, "09:00": 24, "09:30": 22 };
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { variables } = JSON.parse(init.body as string);
    if (variables.origin.location.coordinate.latitude === failLatitude) {
      return Response.json({ data: { planConnection: { edges: [], routingErrors: [{ code: "OUTSIDE_BOUNDS", description: "" }] } } });
    }
    const walking = variables.modes?.directOnly;
    const time = (variables.dateTime.latestArrival ?? "").slice(11, 16);
    const nodes = walking
      ? [itinerary("2026-11-17T08:00:00-05:00", 40, [{ mode: "WALK", distance: 2000 }])]
      : [itinerary("2026-11-17T07:00:00-05:00", 99), itinerary("2026-11-17T08:00:00-05:00", transit[time])];
    return Response.json({ data: { planConnection: { edges: nodes.map((node) => ({ node })), routingErrors: [] } } });
  });
}

afterEach(() => vi.unstubAllGlobals());

const run = () =>
  refreshTransit({
    otpUrl: "http://otp.test",
    listings,
    snapshot,
    serviceDate: "2026-11-17",
    observedAt: "2026-11-10T00:00:00Z",
    source: "test",
  });

describe("refreshTransit", () => {
  it("records the median trip and the walking distance", async () => {
    vi.stubGlobal("fetch", fakeOtp());
    const { apartments, results } = await run();
    const [first] = listings.apartments;
    expect(apartments[first.id].commuteMinutes).toEqual({ value: 22, observedAt: "2026-11-10T00:00:00Z", source: "test" });
    expect(apartments[first.id].walkMiles?.value).toBe(1.24); // 2 km
    expect(apartments[first.id].units).toEqual(snapshot.apartments[first.id].units);
    expect(results.every((r) => !r.error)).toBe(true);
  });

  it("keeps previous values when an apartment can't be routed", async () => {
    const [, second] = listings.apartments;
    vi.stubGlobal("fetch", fakeOtp(second.location.lat));
    const { apartments, results } = await run();
    expect(apartments[second.id]).toEqual(snapshot.apartments[second.id]);
    expect(results[1].error).toMatch(/OUTSIDE_BOUNDS/);
    expect(transitSummary(results, { serviceDate: "2026-11-17", source: "test" }).needsReview).toBe(true);
  });
});

describe("OTP response parsing", () => {
  it("uses the latest-departing itinerary for trip time", () => {
    expect(tripMinutes([itinerary("2026-11-17T07:00:00-05:00", 15), itinerary("2026-11-17T08:10:00-05:00", 25)])).toBe(25);
  });

  it("sums leg distances for walking", () => {
    expect(walkingMiles([itinerary("x", 10, [{ mode: "WALK", distance: 804.672 }, { mode: "WALK", distance: 804.672 }])])).toBe(1);
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
