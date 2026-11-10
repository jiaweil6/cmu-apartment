import type { Amenity, Apartment, Criterion, RoomType, StoredCriterion, StudentType } from "./types";

/** Slider positions, 0–100, keyed by criterion. */
export type Priorities = Record<Criterion, number>;

/** Neighborhoods offered as filters; every other neighborhood counts as "Others". */
export const NAMED_NEIGHBORHOODS = ["Oakland", "Squirrel Hill", "Shadyside"] as const;

export type NeighborhoodFilter = (typeof NAMED_NEIGHBORHOODS)[number] | "Others";

export interface Filters {
  roomType: RoomType;
  studentType: StudentType;
  /** Empty means any neighborhood. */
  neighborhoods: NeighborhoodFilter[];
  /** Every listed amenity is required. */
  amenities: Amenity[];
  /** Only apartments with open units of the chosen room type. */
  openingsOnly?: boolean;
}

export interface RankedApartment {
  apartment: Apartment;
  score: number;
}

export const NO_PRIORITIES: Priorities = {
  commute: 0,
  distance: 0,
  price: 0,
  rating: 0,
  newness: 0,
};

export function hasPriorities(priorities: Priorities): boolean {
  return Object.values(priorities).some((value) => value > 0);
}

/** Each priority as a whole-number share of the total, for the summary bars. */
export function priorityShares(priorities: Priorities): Priorities {
  const total = Object.values(priorities).reduce((sum, value) => sum + value, 0);
  const share = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  return {
    commute: share(priorities.commute),
    distance: share(priorities.distance),
    price: share(priorities.price),
    rating: share(priorities.rating),
    newness: share(priorities.newness),
  };
}

export type Better = "lower" | "higher";

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Turns raw values (keyed by apartment id) into 0–1 rank scores: the best value
 * gets 1 and the worst 1/n; equal values share the lower score. Scores are
 * rounded to two decimals, like the original spreadsheet's.
 */
export function rankScores(values: Map<string, number>, better: Better): Map<string, number> {
  const all = [...values.values()];
  const scores = new Map<string, number>();
  for (const [id, value] of values) {
    const worse = all.filter((other) => (better === "lower" ? other > value : other < value)).length;
    scores.set(id, round2((worse + 1) / all.length));
  }
  return scores;
}

/** The advertised rent for a room type, or null if the apartment doesn't offer it. */
export function offeredPrice(apartment: Apartment, roomType: RoomType): number | null {
  const unit = apartment.units[roomType];
  return unit.status === "not-offered" ? null : unit.minPrice;
}

/** Price scores for one room type, keyed by apartment id. Apartments without a price are left out. */
export function priceScores(apartments: Apartment[], roomType: RoomType): Map<string, number> {
  const prices = new Map<string, number>();
  for (const apartment of apartments) {
    const price = offeredPrice(apartment, roomType);
    if (price !== null) prices.set(apartment.id, price);
  }
  return rankScores(prices, "lower");
}

const RAW_VALUES: Record<StoredCriterion, { value: (apartment: Apartment) => number | null; better: Better }> = {
  commute: { value: (a) => a.commuteMinutes?.value ?? null, better: "lower" },
  distance: { value: (a) => a.walkMiles?.value ?? null, better: "lower" },
  // Student reviews will supply this; until then the 2024 scores are used.
  rating: { value: () => null, better: "higher" },
  newness: { value: (a) => a.yearBuilt, better: "higher" },
};

function median(values: number[]): number {
  if (values.length === 0) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Scores for one non-price criterion, keyed by apartment id. Live values are
 * ranked once every apartment with a 2024 score also has a live value; until
 * then the 2024 scores are used, so a few new values can't reshuffle everyone.
 * Apartments missing a value get the median score.
 */
export function criterionScores(apartments: Apartment[], criterion: StoredCriterion): Map<string, number> {
  const { value, better } = RAW_VALUES[criterion];
  const raw = new Map<string, number>();
  const legacy = new Map<string, number>();
  for (const apartment of apartments) {
    const rawValue = value(apartment);
    if (rawValue !== null) raw.set(apartment.id, rawValue);
    if (apartment.legacyScores) legacy.set(apartment.id, apartment.legacyScores[criterion]);
  }

  const liveCoversLegacy = [...legacy.keys()].every((id) => raw.has(id));
  const scores = raw.size > 0 && liveCoversLegacy ? rankScores(raw, better) : legacy;
  const fallback = median([...scores.values()]);
  return new Map(apartments.map((apartment) => [apartment.id, scores.get(apartment.id) ?? fallback]));
}

export function matchesFilters(apartment: Apartment, filters: Filters): boolean {
  const { neighborhoods, amenities, studentType } = filters;

  const isNamed = (NAMED_NEIGHBORHOODS as readonly string[]).includes(apartment.neighborhood);
  const neighborhoodMatch =
    neighborhoods.length === 0 ||
    (neighborhoods as string[]).includes(apartment.neighborhood) ||
    (!isNamed && neighborhoods.includes("Others"));

  return (
    neighborhoodMatch &&
    amenities.every((amenity) => apartment.amenities[amenity]) &&
    (studentType === "graduate" || apartment.openToUndergrad) &&
    (!filters.openingsOnly || apartment.units[filters.roomType].status === "available")
  );
}

/**
 * Apartments that match the filters and offer the chosen room type, best first.
 * The score is the sum of each criterion's score weighted by its slider
 * position. Returns an empty list when no priorities are set.
 */
export function rankApartments(
  apartments: Apartment[],
  priorities: Priorities,
  filters: Filters,
): RankedApartment[] {
  if (!hasPriorities(priorities)) return [];

  // Scores are relative to every listing, not just the filtered ones.
  const price = priceScores(apartments, filters.roomType);
  const commute = criterionScores(apartments, "commute");
  const distance = criterionScores(apartments, "distance");
  const rating = criterionScores(apartments, "rating");
  const newness = criterionScores(apartments, "newness");
  const weight = (criterion: keyof Priorities) => priorities[criterion] / 100;

  return apartments
    .filter((apartment) => matchesFilters(apartment, filters) && price.has(apartment.id))
    .map((apartment) => {
      const { id } = apartment;
      // Summed in a fixed order so equal totals tie exactly; ties keep data order.
      let score = 0;
      score += weight("commute") * commute.get(id)!;
      score += weight("distance") * distance.get(id)!;
      score += weight("price") * price.get(id)!;
      score += weight("rating") * rating.get(id)!;
      score += weight("newness") * newness.get(id)!;
      return { apartment, score };
    })
    .sort((a, b) => b.score - a.score);
}
