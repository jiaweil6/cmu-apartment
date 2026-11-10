import type { NeighborhoodFilter } from "./ranking";
import type { Amenity, Criterion, RoomType, StudentType } from "./types";

interface Option<T> {
  value: T;
  label: string;
}

/** The priority sliders, in display order. */
export const CRITERIA: { key: Criterion; inputId: string; label: string; description: string }[] = [
  {
    key: "commute",
    inputId: "quickCommute",
    label: "Quick Commute",
    description: "Door-to-door time by bus or on foot, weekday mornings",
  },
  {
    key: "distance",
    inputId: "closeToSchool",
    label: "Close to School",
    description: "Walking distance to campus",
  },
  {
    key: "price",
    inputId: "lowPrice",
    label: "Low Price",
    description: "Lowest listed rent for the selected room type",
  },
  {
    key: "rating",
    inputId: "goodRating",
    label: "Good Rating",
    description: "Rating from Google Maps",
  },
  {
    key: "newness",
    inputId: "newBuilding",
    label: "New Building",
    description: "Construction year of the building",
  },
];

/** `label` completes "You are looking for a … apartment"; `shortLabel` heads a card's rent table. */
export const ROOM_TYPES: (Option<RoomType> & { shortLabel: string })[] = [
  { value: "studio", label: "studio", shortLabel: "Studio" },
  { value: "oneBedroom", label: "1 bedroom", shortLabel: "1 bed" },
  { value: "twoBedroom", label: "2 bedrooms", shortLabel: "2 beds" },
  { value: "threeBedroom", label: "3 bedrooms", shortLabel: "3 beds" },
];

export const STUDENT_TYPES: Option<StudentType>[] = [
  { value: "undergraduate", label: "undergraduate" },
  { value: "graduate", label: "graduate" },
];

export const NEIGHBORHOOD_OPTIONS: Option<NeighborhoodFilter>[] = [
  { value: "Oakland", label: "Oakland" },
  { value: "Squirrel Hill", label: "Squirrel Hill" },
  { value: "Shadyside", label: "Shadyside" },
  { value: "Others", label: "Others" },
];

export const AMENITY_OPTIONS: Option<Amenity>[] = [
  { value: "inUnitLaundry", label: "In-unit washer/dryer" },
  { value: "fitness", label: "Fitness room" },
  { value: "parking", label: "Parking" },
];

/** Shown in the Amenities dropdown: only apartments with open units of the chosen room type. */
export const OPENINGS_OPTION = { value: "openingsOnly", label: "Open units now" } as const;
