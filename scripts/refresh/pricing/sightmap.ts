import { ROOM_TYPE_KEYS } from "@/lib/schemas";
import type { RoomType } from "@/lib/types";
import { fromOpenUnits, requireUrl, type PricingAdapter, type UnitReading } from "./types";

/**
 * SightMap (Engrain) interactive maps, used by many leasing sites. Configure
 * `pricing.url` with the map's API URL, e.g.
 * https://sightmap.com/app/api/v1/<asset>/sightmaps/<id> (the site's map
 * requests it). It lists floor plans with bedroom counts and the units that
 * are open, with rent and move-in date.
 */
interface SightMapResponse {
  data: {
    floor_plans: { id: string; bedroom_count: number }[];
    units: { floor_plan_id: string; price: number | null; available_on: string | null }[];
  };
}

export function readSightMap(body: SightMapResponse, today: string): Partial<Record<RoomType, UnitReading>> {
  const bedrooms = new Map(body.data.floor_plans.map((plan) => [plan.id, plan.bedroom_count]));
  const readings: Partial<Record<RoomType, UnitReading>> = {};
  ROOM_TYPE_KEYS.forEach((room, beds) => {
    const plans = [...bedrooms].filter(([, count]) => count === beds).map(([id]) => id);
    if (plans.length === 0) {
      readings[room] = { status: "not-offered", minPrice: null, available: null, availableFrom: null };
      return;
    }
    const open = body.data.units
      .filter((unit) => plans.includes(unit.floor_plan_id) && unit.price !== null && unit.price > 0)
      .map((unit) => ({ price: unit.price!, availableOn: unit.available_on }));
    readings[room] = fromOpenUnits(open, today);
  });
  return readings;
}

export const sightmap: PricingAdapter = {
  id: "sightmap",
  detect: (html) => /sightmap\.com\/(embed|app)/i.test(html),
  async read(listing, { http, today }) {
    return { units: readSightMap(await http.json<SightMapResponse>(requireUrl(listing)), today) };
  },
};
