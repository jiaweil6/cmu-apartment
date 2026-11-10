/**
 * Allegheny County property data from the Western Pennsylvania Regional Data
 * Center (CC0). See docs/data-sources.md.
 */
import type { LatLng } from "@/lib/types";
import { distanceMiles } from "./geo";

const API = "https://data.wprdc.org/api/3/action/datastore_search_sql";
export const ASSESSMENTS = "65855e14-549e-4992-b5be-d629afc676fa";
export const CENTROIDS = "3fab7152-3f11-4788-8372-4c33f86ea813";

/** Apartment land-use codes and what we call them. */
export const APARTMENT_USE_CODES = {
  "403": "40+ units",
  "402": "20-39 units",
  "404": "apartments over retail",
  "431": "apartments over offices",
} as const;

export type UseCode = keyof typeof APARTMENT_USE_CODES;

/** Mixed-use parcels (404, 431) are mostly corner stores; only large ones are apartment buildings. */
const MIXED_USE_MIN_VALUE = 3_000_000;

export interface Parcel {
  parcelId: string;
  houseNumber: string;
  street: string;
  zip: string;
  useCode: UseCode;
  taxExempt: boolean;
  marketValue: number;
  location: LatLng;
  neighborhood: string | null;
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

export async function sql<T>(query: string): Promise<T[]> {
  const response = await fetch(`${API}?${new URLSearchParams({ sql: query })}`, {
    headers: { "User-Agent": "cmu-apartment-rankings (+https://github.com/jiaweil6/cmu-apartment)" },
  });
  if (!response.ok) throw new Error(`WPRDC responded ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as { success: boolean; result: { records: T[] }; error?: unknown };
  if (!body.success) throw new Error(`WPRDC query failed: ${JSON.stringify(body.error)}`);
  return body.result.records;
}

interface Row {
  PARID: string;
  PROPERTYHOUSENUM: string;
  /** "-4630" for a number range, or "1/2". */
  PROPERTYFRACTION: string | null;
  PROPERTYADDRESS: string;
  PROPERTYZIP: string;
  USECODE: UseCode;
  TAXDESC: string;
  FAIRMARKETTOTAL: number;
  LAT: number;
  LONG: number;
  CITY_NEIGHBORHOOD: string | null;
}

/** Apartment-coded parcels within `radiusMiles` of `center`. */
export async function apartmentParcels(center: LatLng, radiusMiles: number): Promise<Parcel[]> {
  // A bounding box keeps the query fast; the exact radius is applied below.
  const dLat = radiusMiles / 69;
  const dLng = radiusMiles / (69 * Math.cos((center.lat * Math.PI) / 180));
  const codes = Object.keys(APARTMENT_USE_CODES).map((code) => `'${code}'`).join(",");
  const rows = await sql<Row>(`
    SELECT a."PARID", a."PROPERTYHOUSENUM", a."PROPERTYFRACTION", a."PROPERTYADDRESS", a."PROPERTYZIP", a."USECODE", a."TAXDESC",
           a."FAIRMARKETTOTAL", c."LAT", c."LONG", c."CITY_NEIGHBORHOOD"
    FROM "${CENTROIDS}" c JOIN "${ASSESSMENTS}" a ON a."PARID" = c."PIN"
    WHERE c."LAT" BETWEEN ${center.lat - dLat} AND ${center.lat + dLat}
      AND c."LONG" BETWEEN ${center.lng - dLng} AND ${center.lng + dLng}
      AND a."USECODE" IN (${codes})`);

  return rows
    .map(
      (row): Parcel => ({
        parcelId: row.PARID,
        houseNumber: row.PROPERTYHOUSENUM.trim() + (row.PROPERTYFRACTION?.trim().match(/^-\s*\d+$/) ? row.PROPERTYFRACTION.trim() : ""),
        street: row.PROPERTYADDRESS.trim(),
        zip: row.PROPERTYZIP,
        useCode: row.USECODE,
        taxExempt: row.TAXDESC.startsWith("10"),
        marketValue: row.FAIRMARKETTOTAL,
        location: { lat: round6(row.LAT), lng: round6(row.LONG) },
        neighborhood: row.CITY_NEIGHBORHOOD,
      }),
    )
    .filter(
      (parcel) =>
        distanceMiles(center, parcel.location) <= radiusMiles &&
        (parcel.useCode === "402" || parcel.useCode === "403" || parcel.marketValue >= MIXED_USE_MIN_VALUE),
    );
}
