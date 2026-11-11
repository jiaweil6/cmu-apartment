import { z } from "zod";

/**
 * Schemas for the data files. Scripts validate before writing and the app
 * validates on load, so a bad refresh can't reach the site.
 *
 * - data/apartments.json: hand-reviewed listing details (changes rarely)
 * - data/snapshot.json: values fetched on a schedule (prices, commute, walking distance)
 */

export const ROOM_TYPE_KEYS = ["studio", "oneBedroom", "twoBedroom", "threeBedroom"] as const;

const score = z.number().min(0).max(1);
const timestamp = z.iso.datetime({ offset: true });

const latLngSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const placeSchema = z.strictObject({
  name: z.string().min(1),
  /** Compact label used on the map. */
  shortName: z.string().min(1),
  website: z.url(),
  location: latLngSchema,
});

/**
 * How a listing's prices are read: an adapter in scripts/refresh/pricing/
 * ("manual" reads data/manual-prices.json). `url` and `options` are passed to
 * the adapter, which validates them.
 */
export const pricingSchema = z.strictObject({
  adapter: z.string().min(1),
  url: z.url().optional(),
  options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const apartmentInfoSchema = placeSchema.extend({
  /** Stable, URL-safe identifier. */
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  neighborhood: z.string().min(1),
  address: z.string().min(1),
  phone: z.string(),
  imageUrl: z.url().nullable(),
  openToUndergrad: z.boolean(),
  amenities: z.strictObject({ inUnitLaundry: z.boolean(), fitness: z.boolean(), parking: z.boolean() }),
  /** Allegheny County parcel IDs (see docs/data-sources.md). */
  parcelIds: z.array(z.string().regex(/^[0-9A-Z]{16}$/)),
  yearBuilt: z.int().min(1800).max(2100).nullable(),
  pricing: pricingSchema.default({ adapter: "manual" }),
  /**
   * 0–1 rank scores from the original 2024 spreadsheet (1 = best). Used for a
   * criterion until live values exist; null for apartments added later.
   */
  legacyScores: z
    .strictObject({ commute: score, distance: score, rating: score, newness: score })
    .nullable(),
});

export const listingsSchema = z
  .strictObject({
    campus: placeSchema,
    apartments: z.array(apartmentInfoSchema),
  })
  .superRefine(({ apartments }, ctx) => {
    const seen = new Set<string>();
    for (const [index, { id }] of apartments.entries()) {
      if (seen.has(id)) ctx.addIssue({ code: "custom", message: `Duplicate id "${id}"`, path: ["apartments", index, "id"] });
      seen.add(id);
    }
  });

const provenance = { observedAt: timestamp, source: z.string().min(1) };

const unitFields = {
  /**
   * available: units open now (or soon, see availableFrom); waitlist: offered
   * but none open; not-offered: the building has no such units; unknown: no data.
   */
  status: z.enum(["available", "waitlist", "not-offered", "unknown"]),
  /** Lowest advertised monthly rent in USD. */
  minPrice: z.number().min(100).max(20000).nullable(),
  /** How many units are open, when the source says. */
  available: z.int().min(0).nullable().optional(),
  /** Earliest move-in date (YYYY-MM-DD), when it's in the future. */
  availableFrom: z.iso.date().nullable().optional(),
};

const notOfferedHasNoPrice = {
  check: (unit: { status: string; minPrice: number | null }) => unit.status !== "not-offered" || unit.minPrice === null,
  message: "A room type that isn't offered can't have a price",
};

export const unitSchema = z
  .strictObject({ ...unitFields, ...provenance })
  .refine(notOfferedHasNoPrice.check, { message: notOfferedHasNoPrice.message });

const manualUnitSchema = z
  .strictObject(unitFields)
  .refine(notOfferedHasNoPrice.check, { message: notOfferedHasNoPrice.message });

/**
 * Prices entered by hand for buildings that can't be scraped
 * (data/manual-prices.json). `verifiedOn` is when someone last checked them.
 */
export const manualPricesSchema = z.record(
  z.string(),
  z.strictObject({
    verifiedOn: z.iso.date(),
    note: z.string().optional(),
    units: z.strictObject({
      studio: manualUnitSchema,
      oneBedroom: manualUnitSchema,
      twoBedroom: manualUnitSchema,
      threeBedroom: manualUnitSchema,
    }),
  }),
);

const observation = <T extends z.ZodType>(value: T) => z.strictObject({ value, ...provenance });

export const metricsSchema = z.strictObject({
  units: z.strictObject({
    studio: unitSchema,
    oneBedroom: unitSchema,
    twoBedroom: unitSchema,
    threeBedroom: unitSchema,
  }),
  /** Door-to-door transit (or walking) minutes of the weekday trip that reaches campus by 10 AM (lib/commute.ts). */
  commuteMinutes: observation(z.number().min(1).max(180)).optional(),
  /** Walking-route distance to campus in miles. */
  walkMiles: observation(z.number().min(0).max(20)).optional(),
});

export const snapshotSchema = z.strictObject({
  generatedAt: timestamp,
  apartments: z.record(z.string(), metricsSchema),
});

/** Local time of day, 24-hour "08:41". */
const clockTime = z.string().regex(/^\d{2}:\d{2}$/);
/** A path as a Google encoded polyline (precision 5). */
const encodedPath = z.string();

const routePlaceSchema = z.strictObject({
  name: z.string().min(1),
  /** The transit stop's code, when the place is a stop. */
  stopCode: z.string().nullable(),
  location: latLngSchema,
});

/** One leg of a commute: a walk or a ride. */
export const routeLegSchema = z.strictObject({
  /** OpenTripPlanner mode: WALK, BUS, TRAM (the T light rail), and so on. */
  mode: z.string().min(1),
  from: routePlaceSchema,
  to: routePlaceSchema,
  departAt: clockTime,
  arriveAt: clockTime,
  minutes: z.number().min(0),
  meters: z.number().min(0),
  /** Rides only: the line ("71B" and its long name), where it's headed, and how many stops you ride. */
  route: z.strictObject({ shortName: z.string().nullable(), longName: z.string().nullable() }).nullable(),
  headsign: z.string().nullable(),
  stops: z.int().min(1).nullable(),
  geometry: encodedPath,
});

/**
 * The trip behind an apartment's commute time (the one that reaches campus by
 * ARRIVE_BY in lib/commute.ts), and its shortest walking route, from the weekly transit refresh
 * (data/routes.json). Kept apart from the snapshot so only the map page loads paths.
 */
export const apartmentRoutesSchema = z.strictObject({
  commute: z
    .strictObject({
      arriveBy: clockTime,
      departAt: clockTime,
      arriveAt: clockTime,
      minutes: z.number().min(0),
      legs: z.array(routeLegSchema).min(1),
    })
    .nullable(),
  walk: z
    .strictObject({
      meters: z.number().min(0),
      minutes: z.number().min(0),
      /** One path per leg (a walk is usually a single leg). */
      geometry: z.array(encodedPath).min(1),
    })
    .nullable(),
});

export const routesFileSchema = z.strictObject({
  generatedAt: timestamp,
  /** The weekday whose timetable the trips use. */
  serviceDate: z.iso.date(),
  source: z.string(),
  apartments: z.record(z.string(), apartmentRoutesSchema),
});

const parcelId = z.string().regex(/^[0-9A-Z]{16}$/);
const nullableBool = z.boolean().nullable();

/**
 * A building found by discovery (scripts/discover), waiting for review in
 * data/candidates.json. Reviewers fill `listing` and set `decision`.
 */
export const candidateSchema = z.strictObject({
  /** Stable key: the first parcel ID. */
  key: z.string().min(1),
  decision: z.enum(["pending", "approve", "reject"]),
  rejectReason: z.string().optional(),
  foundAt: timestamp,
  parcelIds: z.array(parcelId).min(1),
  address: z.string().min(1),
  /** City neighborhood from county data, e.g. "North Oakland". */
  neighborhood: z.string().nullable(),
  location: latLngSchema,
  size: z.string().min(1),
  marketValue: z.number(),
  distanceMiles: z.number(),
  commuteMinutes: z.number().nullable(),
  osm: z
    .strictObject({ id: z.string(), name: z.string().nullable(), website: z.url().nullable(), yearBuilt: z.int().nullable() })
    .nullable(),
  /** A listing that may be the same building (same name in OpenStreetMap, or nearby without parcel IDs). */
  possibleDuplicateOf: z.string().nullable(),
  /** Where `listing.website` came from; "search" results need checking. */
  websiteSource: z.enum(["osm", "search"]).nullable().default(null),
  /** Leasing platform recognized on the website, if any (a pricing adapter id). */
  detectedPlatform: z.string().nullable().default(null),
  /** Filled in by the reviewer before approving. */
  listing: z.strictObject({
    name: z.string().nullable(),
    shortName: z.string().nullable(),
    phone: z.string().nullable(),
    website: z.url().nullable(),
    imageUrl: z.url().nullable(),
    openToUndergrad: nullableBool,
    amenities: z.strictObject({ inUnitLaundry: nullableBool, fitness: nullableBool, parking: nullableBool }),
    yearBuilt: z.int().min(1800).max(2100).nullable(),
    /** How prices are read once listed. A scraped platform needs `url`; "manual" needs `manualPrices`. */
    pricing: pricingSchema.default({ adapter: "manual" }),
    /** Current rents, for buildings priced by hand. */
    manualPrices: z
      .strictObject({
        studio: manualUnitSchema,
        oneBedroom: manualUnitSchema,
        twoBedroom: manualUnitSchema,
        threeBedroom: manualUnitSchema,
      })
      .nullable()
      .default(null),
  }),
});

export const candidatesFileSchema = z.strictObject({
  updatedAt: timestamp,
  candidates: z.array(candidateSchema),
});

export const rejectedFileSchema = z.strictObject({
  rejected: z.array(
    z.strictObject({ key: z.string(), parcelIds: z.array(parcelId), address: z.string(), reason: z.string(), rejectedAt: timestamp }),
  ),
});

export type Listings = z.infer<typeof listingsSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type CandidatesFile = z.infer<typeof candidatesFileSchema>;
export type RejectedFile = z.infer<typeof rejectedFileSchema>;
export type ApartmentInfo = z.infer<typeof apartmentInfoSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type ApartmentMetrics = z.infer<typeof metricsSchema>;
export type UnitInfo = z.infer<typeof unitSchema>;
export type Pricing = z.infer<typeof pricingSchema>;
export type ManualPrices = z.infer<typeof manualPricesSchema>;
export type RoutesFile = z.infer<typeof routesFileSchema>;
export type ApartmentRoutes = z.infer<typeof apartmentRoutesSchema>;
export type RouteLeg = z.infer<typeof routeLegSchema>;
