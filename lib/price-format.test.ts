import { describe, expect, it } from "vitest";
import listings2024 from "@/lib/__fixtures__/listings-2024.json";
import snapshot2024 from "@/lib/__fixtures__/snapshot-2024.json";
import { mergeListings } from "@/lib/apartments";
import { listingsSchema, snapshotSchema } from "@/lib/schemas";
import type { Apartment } from "@/lib/types";
import { formatPrice, missingRent, priceParts, staleSince } from "./price-format";

const [apartment] = mergeListings(listingsSchema.parse(listings2024), snapshotSchema.parse(snapshot2024));
const at = { observedAt: "2026-11-10T00:00:00Z", source: "test" };
const withStudio = (studio: Apartment["units"]["studio"]): Apartment => ({ ...apartment, units: { ...apartment.units, studio } });

describe("formatPrice", () => {
  it("shows rent with availability", () => {
    expect(formatPrice(withStudio({ status: "available", minPrice: 1849, available: 6, ...at }), "studio")).toBe("$1,849 · 6 open");
    expect(formatPrice(withStudio({ status: "available", minPrice: 3728, available: 1, availableFrom: "2026-12-24", ...at }), "studio")).toBe("$3,728 · Available Dec 24");
    expect(formatPrice(withStudio({ status: "waitlist", minPrice: 5200, ...at }), "studio")).toBe("$5,200 · Waitlist");
    expect(formatPrice(withStudio({ status: "not-offered", minPrice: null, ...at }), "studio")).toBe("Not available");
    expect(formatPrice(withStudio({ status: "unknown", minPrice: null, ...at }), "studio")).toBe("Unknown");
    expect(formatPrice(apartment, "studio")).toBe("$1,880");
  });

  it("splits rent from availability for the card summary", () => {
    expect(priceParts(withStudio({ status: "available", minPrice: 1849, available: 6, ...at }), "studio")).toEqual({
      price: "$1,849",
      status: "6 open",
      tone: "open",
    });
    expect(priceParts(withStudio({ status: "waitlist", minPrice: null, ...at }), "studio")).toEqual({
      price: null,
      status: "Waitlist",
      tone: "waitlist",
    });
  });

  it("names the month of stale prices only", () => {
    const checked = { ...apartment, pricesCheckedAt: "2024-02-03T00:00:00Z" };
    expect(staleSince({ ...checked, pricesStale: true })).toBe("Feb 2024");
    expect(staleSince({ ...checked, pricesStale: false })).toBeNull();
  });
});

describe("missingRent", () => {
  it("tells a room type the building lacks from one that's full or has no data", () => {
    expect(missingRent(withStudio({ status: "not-offered", minPrice: null, ...at }), "studio")).toBe("not-offered");
    expect(missingRent(withStudio({ status: "waitlist", minPrice: null, ...at }), "studio")).toBe("waitlist");
    expect(missingRent(withStudio({ status: "unknown", minPrice: null, ...at }), "studio")).toBe("unknown");
    expect(missingRent(withStudio({ status: "available", minPrice: null, ...at }), "studio")).toBe("unknown");
  });
});
