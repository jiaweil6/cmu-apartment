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

export const apartmentInfoSchema = placeSchema.extend({
  /** Stable, URL-safe identifier. */
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  neighborhood: z.string().min(1),
  address: z.string().min(1),
  phone: z.string(),
  imageUrl: z.url(),
  openToUndergrad: z.boolean(),
  amenities: z.strictObject({ inUnitLaundry: z.boolean(), fitness: z.boolean(), parking: z.boolean() }),
  /** Allegheny County parcel IDs (see docs/data-sources.md). */
  parcelIds: z.array(z.string().regex(/^[0-9A-Z]{16}$/)),
  yearBuilt: z.int().min(1800).max(2100).nullable(),
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

export const unitSchema = z
  .strictObject({
    status: z.enum(["available", "waitlist", "not-offered", "unknown"]),
    /** Lowest advertised monthly rent in USD. */
    minPrice: z.number().min(100).max(20000).nullable(),
    ...provenance,
  })
  .refine((unit) => unit.status !== "not-offered" || unit.minPrice === null, {
    message: "A room type that isn't offered can't have a price",
  });

const observation = <T extends z.ZodType>(value: T) => z.strictObject({ value, ...provenance });

export const metricsSchema = z.strictObject({
  units: z.strictObject({
    studio: unitSchema,
    oneBedroom: unitSchema,
    twoBedroom: unitSchema,
    threeBedroom: unitSchema,
  }),
  /** Door-to-door transit (or walking) minutes to campus on a weekday morning. */
  commuteMinutes: observation(z.number().min(1).max(180)).optional(),
  /** Walking-route distance to campus in miles. */
  walkMiles: observation(z.number().min(0).max(20)).optional(),
});

export const snapshotSchema = z.strictObject({
  generatedAt: timestamp,
  apartments: z.record(z.string(), metricsSchema),
});

export type Listings = z.infer<typeof listingsSchema>;
export type ApartmentInfo = z.infer<typeof apartmentInfoSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type ApartmentMetrics = z.infer<typeof metricsSchema>;
export type UnitInfo = z.infer<typeof unitSchema>;
