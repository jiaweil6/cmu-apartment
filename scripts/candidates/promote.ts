import type { ApartmentInfo, Candidate, CandidatesFile, Listings, ManualPrices, RejectedFile, Snapshot, UnitInfo } from "@/lib/schemas";

/** County neighborhood names folded into the site's filter names. */
export function siteNeighborhood(county: string | null): string {
  if (!county) return "Pittsburgh";
  if (/Oakland$/.test(county)) return "Oakland";
  if (county.startsWith("Squirrel Hill")) return "Squirrel Hill";
  return county;
}

export function slugify(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/ apartments?$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "apartment";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** What an approved candidate still needs before it can be listed. */
export function missingFields(candidate: Candidate): string[] {
  const { listing } = candidate;
  const missing: string[] = [];
  if (!listing.name) missing.push("listing.name");
  if (!listing.website) missing.push("listing.website");
  if (listing.openToUndergrad === null) missing.push("listing.openToUndergrad");
  for (const [amenity, value] of Object.entries(listing.amenities)) {
    if (value === null) missing.push(`listing.amenities.${amenity}`);
  }
  // A price source, so the building can rank on price once listed.
  if (listing.pricing.adapter === "manual") {
    if (!listing.manualPrices) missing.push("listing.manualPrices (or a scraped listing.pricing)");
  } else if (!listing.pricing.url) {
    missing.push("listing.pricing.url");
  }
  return missing;
}

function toListing(candidate: Candidate, id: string): ApartmentInfo {
  const { listing } = candidate;
  return {
    id,
    name: listing.name!,
    shortName: listing.shortName ?? listing.name!,
    neighborhood: siteNeighborhood(candidate.neighborhood),
    address: candidate.address,
    phone: listing.phone ?? "",
    website: listing.website!,
    imageUrl: listing.imageUrl,
    location: candidate.location,
    openToUndergrad: listing.openToUndergrad!,
    amenities: {
      inUnitLaundry: listing.amenities.inUnitLaundry!,
      fitness: listing.amenities.fitness!,
      parking: listing.amenities.parking!,
    },
    parcelIds: candidate.parcelIds,
    yearBuilt: listing.yearBuilt ?? candidate.osm?.yearBuilt ?? null,
    pricing: listing.pricing,
    legacyScores: null,
  };
}

/**
 * Applies reviewers' decisions: approved candidates become listings, rejected
 * ones are remembered, and pending ones stay. Manually priced buildings get
 * their prices recorded right away; scraped ones wait for the next price
 * refresh. Approved candidates with missing fields are left in place and reported.
 */
export function promote(options: {
  listings: Listings;
  candidates: CandidatesFile;
  rejected: RejectedFile;
  snapshot: Snapshot;
  manualPrices: ManualPrices;
  now: string;
}): {
  listings: Listings;
  candidates: CandidatesFile;
  rejected: RejectedFile;
  snapshot: Snapshot;
  manualPrices: ManualPrices;
  promoted: ApartmentInfo[];
  rejectedKeys: string[];
  problems: { key: string; address: string; missing: string[] }[];
} {
  const { now } = options;
  const listings: Listings = { ...options.listings, apartments: [...options.listings.apartments] };
  const rejected: RejectedFile = { rejected: [...options.rejected.rejected] };
  const snapshot: Snapshot = { ...options.snapshot, apartments: { ...options.snapshot.apartments } };
  const manualPrices: ManualPrices = { ...options.manualPrices };
  const remaining: Candidate[] = [];
  const promoted: ApartmentInfo[] = [];
  const rejectedKeys: string[] = [];
  const problems: { key: string; address: string; missing: string[] }[] = [];
  const taken = new Set(listings.apartments.map((a) => a.id));

  for (const candidate of options.candidates.candidates) {
    if (candidate.decision === "reject") {
      rejected.rejected.push({
        key: candidate.key,
        parcelIds: candidate.parcelIds,
        address: candidate.address,
        reason: candidate.rejectReason?.trim() || "No reason given",
        rejectedAt: now,
      });
      rejectedKeys.push(candidate.key);
    } else if (candidate.decision === "approve" && missingFields(candidate).length === 0) {
      const listing = toListing(candidate, slugify(candidate.listing.name!, taken));
      taken.add(listing.id);
      listings.apartments.push(listing);
      const manual = candidate.listing.manualPrices;
      if (listing.pricing.adapter === "manual" && manual) {
        manualPrices[listing.id] = { verifiedOn: now.slice(0, 10), note: "Entered when the building was approved", units: manual };
        const stamp = (unit: (typeof manual)["studio"]): UnitInfo => ({ ...unit, observedAt: now, source: "manual" });
        snapshot.apartments[listing.id] = {
          units: { studio: stamp(manual.studio), oneBedroom: stamp(manual.oneBedroom), twoBedroom: stamp(manual.twoBedroom), threeBedroom: stamp(manual.threeBedroom) },
        };
      } else {
        const unknown: UnitInfo = { status: "unknown", minPrice: null, observedAt: now, source: "added" };
        snapshot.apartments[listing.id] = {
          units: { studio: unknown, oneBedroom: unknown, twoBedroom: unknown, threeBedroom: unknown },
        };
      }
      promoted.push(listing);
    } else {
      if (candidate.decision === "approve") {
        problems.push({ key: candidate.key, address: candidate.address, missing: missingFields(candidate) });
      }
      remaining.push(candidate);
    }
  }

  return {
    listings,
    candidates: { ...options.candidates, candidates: remaining },
    rejected,
    snapshot,
    manualPrices,
    promoted,
    rejectedKeys,
    problems,
  };
}
