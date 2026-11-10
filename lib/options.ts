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
    description: "Public transportation duration on google maps",
  },
  {
    key: "distance",
    inputId: "closeToSchool",
    label: "Close to School",
    description: "Distance to school (For those who want to walk or drive to school)",
  },
  {
    key: "price",
    inputId: "lowPrice",
    label: "Low Price",
    description: "Average price for selected room type",
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

export const ROOM_TYPES: (Option<RoomType> & { priceLabel: string })[] = [
  { value: "studio", label: "studio", priceLabel: "Studio Price" },
  { value: "oneBedroom", label: "1 bedroom", priceLabel: "1 Bedroom Price" },
  { value: "twoBedroom", label: "2 bedrooms", priceLabel: "2 Bedrooms Price" },
  { value: "threeBedroom", label: "3 bedrooms", priceLabel: "3 Bedrooms Price" },
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
