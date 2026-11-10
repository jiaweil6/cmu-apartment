import { describe, expect, it, vi } from "vitest";
import listings2024 from "@/lib/__fixtures__/listings-2024.json";
import { listingsSchema, type CandidatesFile, type RejectedFile } from "@/lib/schemas";
import type { Parcel } from "../lib/wprdc";
import { attachOsm, classify, groupParcels, updateCandidates } from "./candidates";
import { parseOverpass } from "./osm";

const campus = { lat: 40.4432068, lng: -79.9454248 };
const listings = listingsSchema.parse(listings2024);
const empty: CandidatesFile = { updatedAt: "2026-11-01T00:00:00Z", candidates: [] };
const noRejections: RejectedFile = { rejected: [] };

const parcel = (overrides: Partial<Parcel> & Pick<Parcel, "parcelId" | "houseNumber" | "street">): Parcel => ({
  zip: "15213",
  useCode: "403",
  taxExempt: false,
  marketValue: 5_000_000,
  location: { lat: 40.4467, lng: -79.948 },
  neighborhood: "North Oakland",
  ...overrides,
});

const parcels: Parcel[] = [
  parcel({ parcelId: "0052J00138000000", houseNumber: "4614-4630", street: "5TH AVE", marketValue: 17_000_000 }),
  parcel({ parcelId: "0052J00138000A00", houseNumber: "4620", street: "5TH AVE", useCode: "404", marketValue: 1_000_000 }),
  // Already listed (SkyVue's parcel):
  parcel({ parcelId: "0028J00097000200", houseNumber: "3333", street: "FORBES AVE", location: { lat: 40.4391, lng: -79.9643 } }),
  parcel({ parcelId: "0053C00170000000", houseNumber: "5023", street: "FREW ST", useCode: "402", location: { lat: 40.4447, lng: -79.9416 } }),
  parcel({ parcelId: "0027H00078000000", houseNumber: "154", street: "N BELLEFIELD AVE", taxExempt: true }),
];

describe("groupParcels", () => {
  it("merges parcels at the same address into one building", () => {
    const buildings = groupParcels(parcels, campus);
    expect(buildings).toHaveLength(4);
    expect(buildings[0]).toMatchObject({
      key: "0052J00138000000",
      parcelIds: ["0052J00138000000", "0052J00138000A00"],
      address: "4614-4630 5th Ave, Pittsburgh, PA 15213",
      useCode: "403",
      marketValue: 18_000_000,
    });
  });
});

describe("attachOsm", () => {
  const osm = parseOverpass({
    elements: [
      { type: "way", id: 1, center: { lat: 40.5, lon: -80.0 }, tags: {} }, // far from every parcel
      {
        type: "way",
        id: 2,
        center: { lat: 40.4, lon: -79.9 },
        tags: { name: "The Residences", "addr:housenumber": "4620", "addr:street": "Fifth Avenue", website: "https://example.com", start_date: "2016-08" },
      },
      { type: "node", id: 3, lat: 40.44471, lon: -79.94162, tags: { name: "Frew Flats", website: "not a url" } },
    ],
  });

  it("parses names, websites and construction years", () => {
    expect(osm[1]).toMatchObject({ id: "way/2", name: "The Residences", website: "https://example.com", yearBuilt: 2016 });
    expect(osm[2].website).toBeNull();
  });

  it("matches by address first, then by distance", () => {
    const [fifth, , frew] = attachOsm(groupParcels(parcels, campus), osm);
    expect(fifth.osm?.name).toBe("The Residences");
    expect(frew.osm?.name).toBe("Frew Flats");
  });
});

describe("classify", () => {
  const [fifth, skyvue, , exempt] = groupParcels(parcels, campus);
  const context = { listings, candidates: [], rejected: noRejections };

  it("recognizes listed, rejected and tax-exempt buildings", () => {
    expect(classify(skyvue, context)).toEqual({ kind: "listed", listingId: "skyvue" });
    expect(classify(exempt, context)).toMatchObject({ kind: "excluded" });
    expect(classify(fifth, context)).toEqual({ kind: "new" });
    const rejected = { rejected: [{ key: "x", parcelIds: ["0052J00138000A00"], address: "", reason: "condos", rejectedAt: "2026-11-01T00:00:00Z" }] };
    expect(classify(fifth, { ...context, rejected })).toEqual({ kind: "rejected" });
  });

  it("matches a listing by address when parcel IDs differ", () => {
    const sherwood = groupParcels([parcel({ parcelId: "0027D00189000000", houseNumber: "230", street: "N CRAIG ST" })], campus)[0];
    expect(classify(sherwood, context)).toEqual({ kind: "listed", listingId: "sherwood-towers" });
  });
});

describe("updateCandidates", () => {
  const buildings = groupParcels(parcels, campus);
  const run = (previous = empty, maxNew = 10, commute?: (l: { lat: number; lng: number }) => Promise<number | null>) =>
    updateCandidates({ buildings, listings, previous, rejected: noRejections, now: "2026-11-10T00:00:00Z", maxNew, commute });

  it("adds new buildings largest first, up to the cap", async () => {
    const { file, report } = await run(empty, 1);
    expect(report).toMatchObject({ buildings: 4, listed: 1, existing: 0, deferred: 1 });
    expect(report.excluded).toHaveLength(1);
    expect(file.candidates.map((c) => c.key)).toEqual(["0052J00138000000"]);
    expect(file.candidates[0]).toMatchObject({ decision: "pending", size: "40+ units", commuteMinutes: null });
  });

  it("keeps the reviewer's edits on later runs", async () => {
    const first = (await run()).file;
    first.candidates[0].listing.name = "Reviewed Name";
    first.candidates[0].decision = "approve";
    const { file, report } = await run(first);
    expect(report.added).toHaveLength(0);
    expect(report.existing).toBe(2);
    expect(file.candidates[0]).toMatchObject({ decision: "approve", listing: { name: "Reviewed Name" } });
  });

  it("excludes buildings over the commute limit", async () => {
    const commute = vi.fn(async ({ lat }: { lat: number }) => (lat > 40.446 ? 50 : 12));
    const { file, report } = await run(empty, 10, commute);
    expect(file.candidates.map((c) => c.commuteMinutes)).toEqual([12]);
    expect(report.excluded.map((e) => e.reason)).toContain("Commute 50 min (over 35)");
  });
});
