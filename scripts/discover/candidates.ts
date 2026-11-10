import type { Candidate, CandidatesFile, Listings, RejectedFile } from "@/lib/schemas";
import type { LatLng } from "@/lib/types";
import { parseAddress, sameAddress, titleCase, type StreetAddress } from "../lib/address";
import { distanceMeters, distanceMiles } from "../lib/geo";
import { APARTMENT_USE_CODES, type Parcel, type UseCode } from "../lib/wprdc";
import type { OsmBuilding } from "./osm";

/** One building: parcels sharing a street address (large complexes often span several). */
export interface Building {
  key: string;
  parcelIds: string[];
  address: string;
  parsed: StreetAddress | null;
  zip: string;
  neighborhood: string | null;
  location: LatLng;
  useCode: UseCode;
  marketValue: number;
  taxExempt: boolean;
  distanceMiles: number;
  osm: OsmBuilding | null;
}

/** Larger buildings first: these are the codes in priority order. */
const SIZE_ORDER: UseCode[] = ["403", "402", "404", "431"];
const OSM_MATCH_METERS = 50;
const POSSIBLE_DUPLICATE_METERS = 200;

export function groupParcels(parcels: Parcel[], campus: LatLng): Building[] {
  const groups: { parsed: StreetAddress | null; parcels: Parcel[] }[] = [];
  for (const parcel of parcels) {
    const parsed = parseAddress(`${parcel.houseNumber} ${parcel.street}`);
    const group = groups.find((g) => sameAddress(g.parsed, parsed));
    if (group) group.parcels.push(parcel);
    else groups.push({ parsed, parcels: [parcel] });
  }

  return groups.map(({ parsed, parcels: members }) => {
    const main = [...members].sort((a, b) => b.marketValue - a.marketValue)[0];
    const parcelIds = members.map((p) => p.parcelId).sort();
    return {
      key: parcelIds[0],
      parcelIds,
      address: `${titleCase(`${main.houseNumber} ${main.street}`)}, Pittsburgh, PA ${main.zip}`,
      parsed,
      zip: main.zip,
      neighborhood: main.neighborhood,
      location: main.location,
      useCode: SIZE_ORDER.find((code) => members.some((p) => p.useCode === code))!,
      marketValue: members.reduce((sum, p) => sum + p.marketValue, 0),
      taxExempt: members.every((p) => p.taxExempt),
      distanceMiles: Math.round(distanceMiles(campus, main.location) * 100) / 100,
      osm: null,
    };
  });
}

/** Attaches the OSM building with the same address, or the nearest one within 50 m. */
export function attachOsm(buildings: Building[], osm: OsmBuilding[]): Building[] {
  return buildings.map((building) => {
    const byAddress = osm.find((o) => o.address && sameAddress(parseAddress(o.address), building.parsed));
    const nearest = osm
      .map((o) => ({ o, meters: distanceMeters(o.location, building.location) }))
      .filter(({ meters }) => meters <= OSM_MATCH_METERS)
      .sort((a, b) => a.meters - b.meters)[0]?.o;
    return { ...building, osm: byAddress ?? nearest ?? null };
  });
}

export type Classification =
  | { kind: "listed"; listingId: string }
  | { kind: "rejected" }
  | { kind: "excluded"; reason: string }
  | { kind: "existing"; candidate: Candidate }
  | { kind: "new" };

const overlaps = (a: string[], b: string[]) => a.some((id) => b.includes(id));

export const REJECTION_EXPIRY_DAYS = 365;

export function classify(
  building: Building,
  context: { listings: Listings; candidates: Candidate[]; rejected: RejectedFile; now: string },
): Classification {
  const listing = context.listings.apartments.find(
    (apt) => overlaps(apt.parcelIds, building.parcelIds) || sameAddress(parseAddress(apt.address), building.parsed),
  );
  if (listing) return { kind: "listed", listingId: listing.id };
  // Rejections expire after a year: buildings change hands and get renovated.
  const expiry = new Date(Date.parse(context.now) - REJECTION_EXPIRY_DAYS * 86_400_000).toISOString();
  const rejectedRecently = context.rejected.rejected.some(
    (r) => r.rejectedAt >= expiry && overlaps(r.parcelIds, building.parcelIds),
  );
  if (rejectedRecently) return { kind: "rejected" };
  const candidate = context.candidates.find((c) => overlaps(c.parcelIds, building.parcelIds));
  if (candidate) return { kind: "existing", candidate };
  if (building.taxExempt) return { kind: "excluded", reason: "Tax-exempt: likely university, public or nonprofit housing" };
  return { kind: "new" };
}

/** "The Webster Hall Apartments" → "webster hall", for comparing building names. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|apartments?|apts?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A listing that may be this building: one with the same name in OpenStreetMap
 * (big buildings span several parcels), or one without parcel IDs nearby.
 */
function possibleDuplicate(building: Building, listings: Listings): string | null {
  const osmName = building.osm?.name ? normalizeName(building.osm.name) : null;
  const match = listings.apartments.find(
    (apt) =>
      (osmName && normalizeName(apt.name) === osmName) ||
      (apt.parcelIds.length === 0 && distanceMeters(apt.location, building.location) <= POSSIBLE_DUPLICATE_METERS),
  );
  return match?.id ?? null;
}

function toCandidate(building: Building, listings: Listings, foundAt: string, commuteMinutes: number | null): Candidate {
  const osm = building.osm;
  return {
    key: building.key,
    decision: "pending",
    foundAt,
    parcelIds: building.parcelIds,
    address: building.address,
    neighborhood: building.neighborhood,
    location: building.location,
    size: APARTMENT_USE_CODES[building.useCode],
    marketValue: building.marketValue,
    distanceMiles: building.distanceMiles,
    commuteMinutes,
    osm: osm && { id: osm.id, name: osm.name, website: osm.website, yearBuilt: osm.yearBuilt },
    possibleDuplicateOf: possibleDuplicate(building, listings),
    websiteSource: osm?.website ? "osm" : null,
    detectedPlatform: null,
    listing: {
      name: osm?.name ?? null,
      shortName: null,
      phone: null,
      website: osm?.website ?? null,
      imageUrl: null,
      openToUndergrad: null,
      amenities: { inUnitLaundry: null, fitness: null, parking: null },
      yearBuilt: osm?.yearBuilt ?? null,
      pricing: { adapter: "manual" },
      manualPrices: null,
    },
  };
}

export interface DiscoveryReport {
  buildings: number;
  listed: number;
  rejected: number;
  excluded: { address: string; reason: string }[];
  existing: number;
  added: Candidate[];
  deferred: number;
}

/**
 * Merges this run's buildings into the candidates file. Existing candidates
 * keep the reviewer's decision and edits; at most `maxNew` new ones are added,
 * largest and closest first, and the rest wait for a later run.
 */
export async function updateCandidates(options: {
  buildings: Building[];
  listings: Listings;
  previous: CandidatesFile;
  rejected: RejectedFile;
  now: string;
  maxNew: number;
  /** Commute minutes for a location, or null when routing isn't available. */
  commute?: (location: LatLng) => Promise<number | null>;
  maxCommuteMinutes?: number;
}): Promise<{ file: CandidatesFile; report: DiscoveryReport }> {
  const { buildings, listings, previous, rejected, now, maxNew, commute, maxCommuteMinutes = 35 } = options;
  const report: DiscoveryReport = { buildings: buildings.length, listed: 0, rejected: 0, excluded: [], existing: 0, added: [], deferred: 0 };
  const candidates = [...previous.candidates];
  const fresh: Building[] = [];

  for (const building of buildings) {
    const result = classify(building, { listings, candidates: previous.candidates, rejected, now });
    if (result.kind === "listed") report.listed++;
    else if (result.kind === "rejected") report.rejected++;
    else if (result.kind === "excluded") report.excluded.push({ address: building.address, reason: result.reason });
    else if (result.kind === "new") fresh.push(building);
    else {
      report.existing++;
      const index = candidates.indexOf(result.candidate);
      // Refresh what the sources say; keep everything the reviewer touched.
      candidates[index] = {
        ...result.candidate,
        parcelIds: building.parcelIds,
        address: building.address,
        marketValue: building.marketValue,
        distanceMiles: building.distanceMiles,
        osm: building.osm && { id: building.osm.id, name: building.osm.name, website: building.osm.website, yearBuilt: building.osm.yearBuilt },
      };
    }
  }

  fresh.sort((a, b) => SIZE_ORDER.indexOf(a.useCode) - SIZE_ORDER.indexOf(b.useCode) || a.distanceMiles - b.distanceMiles);
  for (const building of fresh) {
    if (report.added.length >= maxNew) {
      report.deferred++;
      continue;
    }
    const minutes = commute ? await commute(building.location) : null;
    if (minutes !== null && minutes > maxCommuteMinutes) {
      report.excluded.push({ address: building.address, reason: `Commute ${Math.round(minutes)} min (over ${maxCommuteMinutes})` });
      continue;
    }
    const candidate = toCandidate(building, listings, now, minutes === null ? null : Math.round(minutes));
    candidates.push(candidate);
    report.added.push(candidate);
  }

  return { file: { updatedAt: now, candidates }, report };
}
