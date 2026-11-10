import type { ApartmentInfo, UnitInfo } from "./schemas";

export type { UnitInfo } from "./schemas";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Anything that gets a pin on the map. */
export interface Place {
  name: string;
  /** Compact label used on the map. */
  shortName: string;
  website: string;
  location: LatLng;
}

export type RoomType = "studio" | "oneBedroom" | "twoBedroom" | "threeBedroom";

export type Amenity = "inUnitLaundry" | "fitness" | "parking";

export type StudentType = "undergraduate" | "graduate";

/** The criteria a student can weight. */
export type Criterion = "commute" | "distance" | "price" | "rating" | "newness";

export type StoredCriterion = Exclude<Criterion, "price">;

/** A fetched value and where it came from. */
export interface Observation<T> {
  value: T;
  observedAt: string;
  source: string;
}

/** Listing details merged with the latest fetched values. */
export interface Apartment extends ApartmentInfo {
  units: Record<RoomType, UnitInfo>;
  commuteMinutes: Observation<number> | null;
  walkMiles: Observation<number> | null;
  /** When any price was last checked, or null if never. */
  pricesCheckedAt: string | null;
  /** Prices are much older than the latest data refresh. */
  pricesStale: boolean;
}
