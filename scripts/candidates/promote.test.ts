import { describe, expect, it } from "vitest";
import listings2024 from "@/lib/__fixtures__/listings-2024.json";
import snapshot2024 from "@/lib/__fixtures__/snapshot-2024.json";
import { candidatesFileSchema, listingsSchema, snapshotSchema, type Candidate } from "@/lib/schemas";
import { promote, siteNeighborhood, slugify } from "./promote";

const listings = listingsSchema.parse(listings2024);
const snapshot = snapshotSchema.parse(snapshot2024);
const now = "2026-11-12T00:00:00Z";

const candidate = (key: string, overrides: Partial<Candidate> = {}): Candidate => ({
  key,
  decision: "pending",
  foundAt: "2026-11-10T00:00:00Z",
  parcelIds: [key],
  address: "4614-4630 5th Ave, Pittsburgh, PA 15213",
  neighborhood: "North Oakland",
  location: { lat: 40.4467, lng: -79.948 },
  size: "40+ units",
  marketValue: 17_000_000,
  distanceMiles: 0.28,
  commuteMinutes: 9,
  osm: { id: "way/1", name: "Fifth & Neville", website: null, yearBuilt: 2016 },
  possibleDuplicateOf: null,
  listing: {
    name: "Fifth & Neville",
    shortName: null,
    phone: null,
    website: "https://example.com/",
    imageUrl: null,
    openToUndergrad: true,
    amenities: { inUnitLaundry: true, fitness: false, parking: true },
    yearBuilt: null,
  },
  ...overrides,
});

const run = (candidates: Candidate[]) =>
  promote({
    listings,
    candidates: candidatesFileSchema.parse({ updatedAt: now, candidates }),
    rejected: { rejected: [] },
    snapshot,
    now,
  });

describe("promote", () => {
  it("lists approved candidates and gives them an empty snapshot entry", () => {
    const result = run([candidate("0052J00138000000", { decision: "approve" })]);
    const added = result.listings.apartments.at(-1)!;
    expect(added).toMatchObject({
      id: "fifth-neville",
      shortName: "Fifth & Neville",
      neighborhood: "Oakland",
      phone: "",
      yearBuilt: 2016,
      legacyScores: null,
      parcelIds: ["0052J00138000000"],
    });
    expect(listingsSchema.safeParse(result.listings).success).toBe(true);
    expect(result.snapshot.apartments[added.id].units.studio).toMatchObject({ status: "unknown", minPrice: null });
    expect(result.candidates.candidates).toHaveLength(0);
  });

  it("remembers rejections and keeps pending candidates", () => {
    const result = run([
      candidate("0052J00138000000", { decision: "reject", rejectReason: "Condos" }),
      candidate("0053C00170000000"),
    ]);
    expect(result.rejected.rejected).toEqual([
      { key: "0052J00138000000", parcelIds: ["0052J00138000000"], address: expect.any(String), reason: "Condos", rejectedAt: now },
    ]);
    expect(result.candidates.candidates.map((c) => c.key)).toEqual(["0053C00170000000"]);
    expect(result.listings.apartments).toHaveLength(listings.apartments.length);
  });

  it("holds back approved candidates with missing fields", () => {
    const incomplete = candidate("0052J00138000000", { decision: "approve" });
    incomplete.listing = { ...incomplete.listing, openToUndergrad: null, website: null };
    const result = run([incomplete]);
    expect(result.promoted).toHaveLength(0);
    expect(result.problems[0].missing).toEqual(["listing.website", "listing.openToUndergrad"]);
    expect(result.candidates.candidates).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("makes unique slugs", () => {
    expect(slugify("SkyVue", new Set(["skyvue"]))).toBe("skyvue-2");
    expect(slugify("The Bridge on Forbes Apartments", new Set())).toBe("the-bridge-on-forbes");
  });

  it("folds county neighborhoods into the site's filters", () => {
    expect(siteNeighborhood("Central Oakland")).toBe("Oakland");
    expect(siteNeighborhood("Squirrel Hill South")).toBe("Squirrel Hill");
    expect(siteNeighborhood("Bloomfield")).toBe("Bloomfield");
  });
});
