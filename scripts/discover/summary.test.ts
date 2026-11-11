import { describe, expect, it } from "vitest";
import { candidateSchema, type Candidate } from "@/lib/schemas";
import type { DiscoveryReport } from "./candidates";
import { discoverySummary } from "./summary";

const candidate = (key: string, address: string, overrides: Partial<Candidate> = {}): Candidate =>
  candidateSchema.parse({
    key,
    decision: "pending",
    foundAt: "2026-11-11T00:00:00Z",
    parcelIds: [key.padEnd(16, "0")],
    address,
    neighborhood: "Bluff",
    location: { lat: 40.4353, lng: -79.9879 },
    size: "40+ units",
    marketValue: 9_500_000,
    distanceMiles: 2.3,
    commuteMinutes: 20,
    osm: null,
    possibleDuplicateOf: null,
    listing: {
      name: null,
      shortName: null,
      phone: null,
      website: null,
      imageUrl: null,
      openToUndergrad: null,
      amenities: { inUnitLaundry: null, fitness: null, parking: null },
      yearBuilt: null,
    },
    ...overrides,
  });

const report = (added: Candidate[]): DiscoveryReport => ({
  buildings: 10,
  listed: 5,
  rejected: 0,
  excluded: [],
  existing: 0,
  added,
  deferred: 0,
});

/** The table row for an address. */
const row = (markdown: string, address: string) => markdown.split("\n").find((line) => line.startsWith(`| ${address}`));

describe("discoverySummary", () => {
  it("notes what the website search returned when it found no site", () => {
    const bluff = candidate("A", "1315 Bluff St, Pittsburgh, PA 15282");
    const forbes = candidate("B", "429 Forbes Ave, Pittsburgh, PA 15219", { possibleDuplicateOf: "the-pennsylvanian" });
    const waterfront = candidate("C", "611-623 E Waterfront Dr, Pittsburgh, PA 15120");
    const markdown = discoverySummary(
      report([bluff, forbes, waterfront]),
      3,
      new Map([
        ["A", { results: 5, others: ["https://liveatluminaduq.com/", "https://example.org/a|b"] }],
        ["B", { results: 5, others: [] }],
        ["C", { results: 0, others: [] }],
      ]),
    );
    expect(row(markdown, bluff.address)).toMatch(
      /\| Search found no own site; other results: \[liveatluminaduq\.com\]\(https:\/\/liveatluminaduq\.com\/\), \[example\.org\]\(https:\/\/example\.org\/a%7Cb\) \|$/,
    );
    expect(row(markdown, forbes.address)).toMatch(/\| Possibly listed as `the-pennsylvanian`; Search found only listing sites \|$/);
    expect(row(markdown, waterfront.address)).toMatch(/\| Search found nothing \|$/);
  });

  it("leaves the note empty when there was no search to report", () => {
    const found = candidate("A", "2915 Sidney St, Pittsburgh, PA 15203");
    expect(row(discoverySummary(report([found]), 1), found.address)).toMatch(/\| manual \|  \|$/);
  });
});
