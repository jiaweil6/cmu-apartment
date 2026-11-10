import { describe, expect, it } from "vitest";
import listings2024 from "@/lib/__fixtures__/listings-2024.json";
import snapshot2024 from "@/lib/__fixtures__/snapshot-2024.json";
import { mergeListings } from "@/lib/apartments";
import { listingsSchema, snapshotSchema } from "@/lib/schemas";
import type { Apartment } from "@/lib/types";
import { formatPrice } from "./ApartmentCard";

const [apartment] = mergeListings(listingsSchema.parse(listings2024), snapshotSchema.parse(snapshot2024));
const at = { observedAt: "2026-11-10T00:00:00Z", source: "test" };
const withStudio = (studio: Apartment["units"]["studio"]): Apartment => ({ ...apartment, units: { ...apartment.units, studio } });

describe("formatPrice", () => {
  it("shows rent with availability", () => {
    expect(formatPrice(withStudio({ status: "available", minPrice: 1849, available: 6, ...at }), "studio")).toBe("$1849 · 6 open");
    expect(formatPrice(withStudio({ status: "available", minPrice: 3728, available: 1, availableFrom: "2026-12-24", ...at }), "studio")).toBe("$3728 · Available Dec 24");
    expect(formatPrice(withStudio({ status: "waitlist", minPrice: 5200, ...at }), "studio")).toBe("$5200 · Waitlist");
    expect(formatPrice(withStudio({ status: "not-offered", minPrice: null, ...at }), "studio")).toBe("Not available");
    expect(formatPrice(withStudio({ status: "unknown", minPrice: null, ...at }), "studio")).toBe("Unknown");
    expect(formatPrice(apartment, "studio")).toBe("$1880");
  });
});
