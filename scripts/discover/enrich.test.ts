import { describe, expect, it, vi } from "vitest";
import { candidateSchema, type Candidate } from "@/lib/schemas";
import { sightmap } from "../refresh/pricing/sightmap";
import { enrichCandidates } from "./enrich";

const base = (overrides: Partial<Candidate["listing"]> = {}): Candidate =>
  candidateSchema.parse({
    key: "0052J00138000000",
    decision: "pending",
    foundAt: "2026-11-10T00:00:00Z",
    parcelIds: ["0052J00138000000"],
    address: "4614-4630 5th Ave, Pittsburgh, PA 15213",
    neighborhood: "North Oakland",
    location: { lat: 40.4467, lng: -79.948 },
    size: "40+ units",
    marketValue: 17_000_000,
    distanceMiles: 0.28,
    commuteMinutes: 8,
    osm: { id: "way/1", name: "Fairfax Apartments", website: null, yearBuilt: null },
    possibleDuplicateOf: null,
    listing: {
      name: "Fairfax Apartments",
      shortName: null,
      phone: null,
      website: null,
      imageUrl: null,
      openToUndergrad: null,
      amenities: { inUnitLaundry: null, fitness: null, parking: null },
      yearBuilt: null,
      ...overrides,
    },
  });

describe("enrichCandidates", () => {
  it("finds a website by search and suggests the detected pricing platform", async () => {
    const candidate = base();
    const findWebsite = vi.fn(async () => "https://fairfaxpgh.com/");
    const fetchHomepage = vi.fn(async () => '<iframe src="https://sightmap.com/embed/abc123"></iframe>');
    await enrichCandidates([candidate], { findWebsite, fetchHomepage, adapters: [sightmap] });
    expect(findWebsite).toHaveBeenCalledWith("Fairfax Apartments", candidate.address);
    expect(candidate).toMatchObject({
      websiteSource: "search",
      detectedPlatform: "sightmap",
      listing: { website: "https://fairfaxpgh.com/", pricing: { adapter: "sightmap" } },
    });
  });

  it("keeps an OpenStreetMap website and skips the search", async () => {
    const candidate = base({ website: "https://www.chalfontapartments.com/" });
    const findWebsite = vi.fn();
    await enrichCandidates([candidate], { findWebsite, fetchHomepage: async () => "<html></html>", adapters: [sightmap] });
    expect(findWebsite).not.toHaveBeenCalled();
    expect(candidate.detectedPlatform).toBeNull();
    expect(candidate.listing.pricing).toEqual({ adapter: "manual" });
  });

  it("logs failures instead of throwing", async () => {
    const log = vi.fn();
    const candidate = base();
    await enrichCandidates([candidate], {
      findWebsite: async () => {
        throw new Error("rate limited");
      },
      fetchHomepage: async () => "",
      adapters: [sightmap],
      log,
    });
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/rate limited/));
    expect(candidate.listing.website).toBeNull();
  });
});
