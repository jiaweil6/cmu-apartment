import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import listings2024 from "@/lib/__fixtures__/listings-2024.json";
import snapshot2024 from "@/lib/__fixtures__/snapshot-2024.json";
import { listingsSchema, snapshotSchema, type ManualPrices } from "@/lib/schemas";
import { manual } from "./pricing/manual";
import { readSightMap } from "./pricing/sightmap";
import type { PricingAdapter, PricingContext, UnitReading } from "./pricing/types";
import { priceSummary, refreshPrices } from "./prices";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "pricing/__fixtures__", name), "utf8"));

const all = listingsSchema.parse(listings2024);
const snapshot = snapshotSchema.parse(snapshot2024);
const now = "2026-11-10T12:00:00Z";
const context = (manualPrices: ManualPrices = {}): PricingContext => ({
  http: { text: async () => "", json: async () => ({}) as never },
  manual: manualPrices,
  today: "2026-11-10",
});

describe("SightMap adapter", () => {
  it("reads the lowest open rent, count and move-in per room type", () => {
    const coda = readSightMap(fixture("sightmap-coda.json"), "2026-11-10");
    expect(coda.studio).toEqual({ status: "available", minPrice: 1849, available: 6, availableFrom: null });
    expect(coda.twoBedroom).toEqual({ status: "available", minPrice: 3728, available: 1, availableFrom: "2026-12-24" });
    expect(coda.threeBedroom?.status).toBe("not-offered");
  });

  it("marks floor plans without open units as waitlisted", () => {
    const industry = readSightMap(fixture("sightmap-industry.json"), "2026-11-10");
    expect(industry.oneBedroom).toMatchObject({ status: "available", minPrice: 2384, available: 5 });
    expect(industry.threeBedroom).toEqual({ status: "waitlist", minPrice: null, available: 0, availableFrom: null });
  });
});

describe("refreshPrices", () => {
  const listings = { ...all, apartments: all.apartments.filter((a) => a.id === "industry-pittsburgh") };
  const stub = (units: Partial<Record<string, UnitReading>>, fail = false): Map<string, PricingAdapter> =>
    new Map([["manual", { id: "manual", read: async () => { if (fail) throw new Error("site down"); return { units }; } }]]);
  const run = (adapters: Map<string, PricingAdapter>) => refreshPrices({ listings, snapshot, adapters, context: context(), now });

  it("updates read rooms, keeps unread ones, and carries the last rent onto a waitlist", async () => {
    const { apartments, results } = await run(
      stub({ studio: { status: "available", minPrice: 2200, available: 2 }, twoBedroom: { status: "waitlist", minPrice: null } }),
    );
    const units = apartments["industry-pittsburgh"].units;
    expect(units.studio).toMatchObject({ minPrice: 2200, available: 2, observedAt: now, source: "manual" });
    expect(units.twoBedroom).toMatchObject({ status: "waitlist", minPrice: 5200 });
    expect(units.oneBedroom).toEqual(snapshot.apartments["industry-pittsburgh"].units.oneBedroom);
    expect(results[0]).toMatchObject({ outcome: "updated", anomalies: [] });
  });

  it("flags implausible and large swings and keeps the old value for implausible ones", async () => {
    const { apartments, results } = await run(
      stub({ studio: { status: "available", minPrice: 25 }, oneBedroom: { status: "available", minPrice: 4000 } }),
    );
    expect(apartments["industry-pittsburgh"].units.studio.minPrice).toBe(2170);
    expect(results[0].anomalies).toEqual([expect.stringMatching(/Studio read as \$25/), "1BR moved $2400 → $4000"]);
    expect(priceSummary(results).needsReview).toBe(true);
  });

  it("keeps everything when the source fails", async () => {
    const { apartments, results } = await run(stub({}, true));
    expect(apartments["industry-pittsburgh"]).toEqual(snapshot.apartments["industry-pittsburgh"]);
    expect(results[0]).toMatchObject({ outcome: "failed", error: "site down" });
    const { markdown, needsReview } = priceSummary(results);
    expect(needsReview).toBe(false);
    expect(markdown).toContain("| Industry Pittsburgh | manual | Failed: site down | 2024-02-03 |");
  });

  it("flags a building that suddenly offers nothing", async () => {
    const none = { status: "not-offered" as const, minPrice: null };
    const { results } = await run(stub({ studio: none, oneBedroom: none, twoBedroom: none, threeBedroom: none }));
    expect(results[0].anomalies).toContain("No room types offered any more");
  });
});

describe("manual adapter", () => {
  const [listing] = all.apartments;
  it("uses the verified date as the observation date", async () => {
    const units = { studio: { status: "available" as const, minPrice: 1900 }, oneBedroom: { status: "not-offered" as const, minPrice: null }, twoBedroom: { status: "unknown" as const, minPrice: null }, threeBedroom: { status: "unknown" as const, minPrice: null } };
    const reading = await manual.read(listing, context({ [listing.id]: { verifiedOn: "2026-10-01", units } }));
    expect(reading).toEqual({ units, observedAt: "2026-10-01T00:00:00Z" });
  });

  it("fails clearly when a building has no entry", async () => {
    await expect(manual.read(listing, context())).rejects.toThrow(/No entry for "skyvue"/);
  });
});
