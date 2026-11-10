import type { LatLng } from "./types";

/**
 * Google Maps directions between two places, opened in a new tab. This is a plain
 * link: nothing is fetched from Google, so its terms on storing results don't apply.
 */
export function googleDirectionsUrl(from: LatLng, to: LatLng, travelmode: "transit" | "walking" = "transit"): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
