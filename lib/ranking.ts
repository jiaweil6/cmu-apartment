import type { Amenity, Apartment, Criterion, RoomType, StudentType } from "./types";

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

/**
 * Price scores for one room type, keyed by apartment id. Apartments that don't
 * offer the room type are left out.
 *
 * Like the other criteria, this is a rank score: the cheapest gets 1 and the
 * most expensive gets 1/n, where n is the number of apartments offering the
 * room type; equal prices share the lower score. Scores are rounded to two
 * decimals, as in the original spreadsheet, so rankings match the original site.
 */
export function priceScores(apartments: Apartment[], roomType: RoomType): Map<string, number> {
  const prices = apartments
    .map((apartment) => apartment.prices[roomType])
    .filter((price): price is number => price !== null);

  const scores = new Map<string, number>();
  for (const apartment of apartments) {
    const price = apartment.prices[roomType];
    if (price === null) continue;
    const pricier = prices.filter((other) => other > price).length;
    scores.set(apartment.id, Math.round(((pricier + 1) / prices.length) * 100) / 100);
  }
  return scores;
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
    (studentType === "graduate" || apartment.openToUndergrad)
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

  // Price ranks are relative to every listing, not just the filtered ones.
  const price = priceScores(apartments, filters.roomType);
  const weight = (criterion: keyof Priorities) => priorities[criterion] / 100;

  return apartments
    .filter((apartment) => matchesFilters(apartment, filters) && price.has(apartment.id))
    .map((apartment) => {
      const { scores } = apartment;
      // Summed in a fixed order so equal totals tie exactly; ties keep data order.
      let score = 0;
      score += weight("commute") * scores.commute;
      score += weight("distance") * scores.distance;
      score += weight("price") * price.get(apartment.id)!;
      score += weight("rating") * scores.rating;
      score += weight("newness") * scores.newness;
      return { apartment, score };
    })
    .sort((a, b) => b.score - a.score);
}
