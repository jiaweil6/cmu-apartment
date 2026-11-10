import type { LatLng } from "@/lib/types";

const EARTH_RADIUS_METERS = 6_371_000;
export const METERS_PER_MILE = 1609.344;

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export const distanceMiles = (a: LatLng, b: LatLng) => distanceMeters(a, b) / METERS_PER_MILE;
