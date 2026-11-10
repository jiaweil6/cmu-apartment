import { describe, expect, it } from "vitest";
import listingsFile from "@/data/apartments.json";
import candidatesFile from "@/data/candidates.json";
import rejectedFile from "@/data/rejected.json";
import snapshotFile from "@/data/snapshot.json";
import { candidatesFileSchema, listingsSchema, rejectedFileSchema, snapshotSchema } from "./schemas";

// Guards the committed data files, which scripts and reviewers edit.
describe("data files", () => {
  const listings = listingsSchema.parse(listingsFile);
  const snapshot = snapshotSchema.parse(snapshotFile);

  it("has a snapshot entry for every listed apartment", () => {
    const listed = listings.apartments.map((a) => a.id);
    expect(Object.keys(snapshot.apartments).sort()).toEqual([...listed].sort());
  });

  it("has valid review files", () => {
    expect(candidatesFileSchema.safeParse(candidatesFile).success).toBe(true);
    expect(rejectedFileSchema.safeParse(rejectedFile).success).toBe(true);
  });

  it("rejects a duplicate id", () => {
    const [first] = listings.apartments;
    const result = listingsSchema.safeParse({ ...listings, apartments: [first, first] });
    expect(result.success).toBe(false);
  });

  it("rejects a price on a room type that isn't offered", () => {
    const [id] = Object.keys(snapshot.apartments);
    const metrics = snapshot.apartments[id];
    const bad = {
      ...snapshot,
      apartments: {
        [id]: { ...metrics, units: { ...metrics.units, studio: { ...metrics.units.studio, status: "not-offered", minPrice: 1500 } } },
      },
    };
    expect(snapshotSchema.safeParse(bad).success).toBe(false);
  });
});

describe("pricing configuration", () => {
  it("names a known adapter, with the settings it needs, for every listing", async () => {
    const { ADAPTERS } = await import("@/scripts/refresh/pricing");
    const manualPrices = (await import("@/data/manual-prices.json")).default as Record<string, unknown>;
    for (const apartment of listingsSchema.parse(listingsFile).apartments) {
      const { adapter, url } = apartment.pricing;
      expect(ADAPTERS.has(adapter), `${apartment.id}: unknown adapter "${adapter}"`).toBe(true);
      if (adapter === "manual") expect(manualPrices[apartment.id], `${apartment.id}: no manual prices`).toBeDefined();
      if (adapter === "sightmap" || adapter === "entrata-wp") expect(url, `${apartment.id}: pricing.url`).toBeDefined();
    }
  });
});
