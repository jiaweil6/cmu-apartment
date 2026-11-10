import { describe, expect, it } from "vitest";
import { apartments } from "@/data/apartments";
import {
  NO_PRIORITIES,
  matchesFilters,
  priceScores,
  priorityShares,
  rankApartments,
  type Filters,
  type Priorities,
} from "./ranking";
import type { Apartment } from "./types";

const anyFilters: Filters = { roomType: "studio", studentType: "graduate", neighborhoods: [], amenities: [] };

const names = (priorities: Partial<Priorities>, filters: Partial<Filters>) =>
  rankApartments(apartments, { ...NO_PRIORITIES, ...priorities }, { ...anyFilters, ...filters }).map(
    ({ apartment }) => apartment.name,
  );

describe("rankApartments", () => {
  // Expected orders were recorded from the original static site.
  it.each([
    {
      priorities: { commute: 80, price: 60, rating: 30 },
      filters: { roomType: "oneBedroom", studentType: "undergraduate" },
      expected: [
        "Negley Court Apartments",
        "Maxon Towers Apartments",
        "Webster Hall Apartments",
        "The Bridge on Forbes Apartments",
        "Amberson Gardens Apartments",
        "Claybourne Apartments",
        "SkyVue",
        "Walnut on Highland",
        "Kenmawr Apartments",
        "Bakery Living",
        "Essex House",
        "One on Centre",
        "Industry Pittsburgh",
        "Coda on Centre",
        "Eastside Bond Apartments",
      ],
    },
    {
      priorities: { commute: 50, distance: 50, price: 50, rating: 50, newness: 50 },
      filters: { roomType: "studio", studentType: "graduate" },
      expected: [
        "The Bridge on Forbes Apartments",
        "Negley Court Apartments",
        "Webster Hall Apartments",
        "Amberson Gardens Apartments",
        "SkyVue",
        "Walnut on Highland",
        "Bakery Living",
        "One on Centre",
        "Industry Pittsburgh",
        "Coda on Centre",
        "Eastside Bond Apartments",
      ],
    },
    {
      priorities: { distance: 100, newness: 40 },
      filters: { roomType: "twoBedroom", studentType: "undergraduate", neighborhoods: ["Shadyside"], amenities: ["inUnitLaundry"] },
      expected: ["Industry Pittsburgh", "Coda on Centre", "Eastside Bond Apartments", "Bakery Living"],
    },
    {
      priorities: { price: 100 },
      filters: { roomType: "twoBedroom", neighborhoods: ["Oakland", "Squirrel Hill"], amenities: ["parking", "fitness"] },
      expected: [
        "Maxon Towers Apartments",
        "Camelot Apartments",
        "Webster Hall Apartments",
        "Sherwood Towers Apartments",
        "The Bridge on Forbes Apartments",
        "SkyVue",
        "One on Centre",
      ],
    },
    {
      priorities: { rating: 70, commute: 20, newness: 10 },
      filters: { roomType: "studio", studentType: "undergraduate", amenities: ["fitness"] },
      expected: [
        "The Bridge on Forbes Apartments",
        "Walnut on Highland",
        "Industry Pittsburgh",
        "Bakery Living",
        "Webster Hall Apartments",
        "SkyVue",
        "Eastside Bond Apartments",
        "Amberson Gardens Apartments",
        "One on Centre",
        "Coda on Centre",
      ],
    },
  ] as { priorities: Partial<Priorities>; filters: Partial<Filters>; expected: string[] }[])(
    "matches the original site: $filters.roomType, $priorities",
    ({ priorities, filters, expected }) => {
      expect(names(priorities, filters)).toEqual(expected);
    },
  );

  it("includes Maxon Towers' 3-bedroom, which the original spreadsheet marked unavailable", () => {
    expect(names({ commute: 30, price: 90 }, { roomType: "threeBedroom" })).toEqual([
      "Kenmawr Apartments",
      "Sherwood Towers Apartments",
      "Camelot Apartments",
      "Maxon Towers Apartments",
      "SkyVue",
      "The Bridge on Forbes Apartments",
      "One on Centre",
    ]);
  });

  it("returns nothing until a priority is set", () => {
    expect(rankApartments(apartments, NO_PRIORITIES, anyFilters)).toEqual([]);
  });

  it("leaves out apartments without the chosen room type", () => {
    const ranked = names({ price: 50 }, { roomType: "studio" });
    expect(ranked).not.toContain("Essex House");
    expect(ranked).toHaveLength(apartments.filter((a) => a.prices.studio !== null).length);
  });
});

describe("priceScores", () => {
  it("scores the cheapest 1 and the priciest 1/n, rounded to two decimals", () => {
    const scores = priceScores(apartments, "studio");
    expect(scores.size).toBe(11);
    expect(scores.get("negley-court")).toBe(1); // $885
    expect(scores.get("amberson-gardens")).toBe(0.91); // $1100, 10/11
    expect(scores.get("industry-pittsburgh")).toBe(0.09); // $2170, 1/11
    expect(scores.has("essex-house")).toBe(false); // no studios
  });

  it("gives equal prices the same, lower score", () => {
    const scores = priceScores(apartments, "twoBedroom");
    expect(scores.get("the-bridge-on-forbes")).toBe(0.41); // $2500
    expect(scores.get("walnut-on-highland")).toBe(0.41); // $2500
  });
});

describe("matchesFilters", () => {
  const sample = (overrides: Partial<Apartment>): Apartment => ({ ...apartments[0], ...overrides });

  it("hides apartments closed to undergraduates from undergraduates only", () => {
    const sherwood = apartments.find((a) => a.id === "sherwood-towers")!;
    expect(matchesFilters(sherwood, { ...anyFilters, studentType: "undergraduate" })).toBe(false);
    expect(matchesFilters(sherwood, { ...anyFilters, studentType: "graduate" })).toBe(true);
  });

  it("requires every selected amenity", () => {
    const noLaundry = sample({ amenities: { inUnitLaundry: false, fitness: true, parking: true } });
    expect(matchesFilters(noLaundry, { ...anyFilters, amenities: ["fitness", "parking"] })).toBe(true);
    expect(matchesFilters(noLaundry, { ...anyFilters, amenities: ["fitness", "inUnitLaundry"] })).toBe(false);
  });

  it('treats neighborhoods outside the named ones as "Others"', () => {
    const bloomfield = sample({ neighborhood: "Bloomfield" });
    expect(matchesFilters(bloomfield, { ...anyFilters, neighborhoods: ["Others"] })).toBe(true);
    expect(matchesFilters(bloomfield, { ...anyFilters, neighborhoods: ["Oakland"] })).toBe(false);
    expect(matchesFilters(sample({ neighborhood: "Oakland" }), { ...anyFilters, neighborhoods: ["Others"] })).toBe(false);
  });
});

describe("priorityShares", () => {
  it("converts slider positions to whole-number percentages", () => {
    expect(priorityShares({ ...NO_PRIORITIES, commute: 80, price: 60, rating: 30 })).toEqual({
      commute: 47,
      distance: 0,
      price: 35,
      rating: 18,
      newness: 0,
    });
  });

  it("is all zeros when nothing is set", () => {
    expect(priorityShares(NO_PRIORITIES)).toEqual(NO_PRIORITIES);
  });
});

describe("data", () => {
  it("has unique ids", () => {
    expect(new Set(apartments.map((a) => a.id)).size).toBe(apartments.length);
  });

  it("keeps stored scores within 0–1", () => {
    for (const value of apartments.flatMap(({ scores }) => Object.values(scores))) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
