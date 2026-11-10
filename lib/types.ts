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

/** The criteria a student can weight. Price is scored from `prices`, the rest from `scores`. */
export type Criterion = "commute" | "distance" | "price" | "rating" | "newness";

export type StoredCriterion = Exclude<Criterion, "price">;

export interface Apartment extends Place {
  /** Stable, URL-safe identifier. */
  id: string;
  neighborhood: string;
  address: string;
  phone: string;
  imageUrl: string;
  openToUndergrad: boolean;
  amenities: Record<Amenity, boolean>;
  /** Monthly rent in USD; `null` when that room type isn't offered. */
  prices: Record<RoomType, number | null>;
  /** 0–1 rank scores where 1 is best. See data/apartments.ts. */
  scores: Record<StoredCriterion, number>;
}
