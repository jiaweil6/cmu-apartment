import { ROOM_TYPE_KEYS } from "@/lib/schemas";
import type { RoomType } from "@/lib/types";
import { requireUrl, type PricingAdapter, type UnitReading } from "./types";

/**
 * Entrata floor plans exposed by a WordPress leasing theme at
 * /wp-json/theme/entrata/v1/floor-plans (set as `pricing.url`).
 *
 * Student buildings often rent by the bed: set `options.perBed: true` to turn
 * per-bed rates into whole-apartment prices (rate × bedrooms), comparable with
 * other listings.
 */
interface EntrataFloorPlan {
  beds: string | number;
  units_available: string | number;
  entrata_api_id?: string;
  rates: { value: string | number; sold_out?: boolean }[];
}

interface EntrataResponse {
  categories: Record<string, { min_beds: string | number; floorplans: EntrataFloorPlan[] }>;
  units?: Record<string, { floorplanID: number; availableOn?: string | null }>;
}

/** "8/1" → the next August 1st on or after today, as YYYY-MM-DD. */
export function nextMonthDay(monthDay: string, today: string): string | null {
  const match = monthDay.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [month, day] = [Number(match[1]), Number(match[2])];
  const year = Number(today.slice(0, 4));
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisYear = `${year}-${pad(month)}-${pad(day)}`;
  return thisYear >= today ? thisYear : `${year + 1}-${pad(month)}-${pad(day)}`;
}

export function readEntrata(body: EntrataResponse, options: { perBed: boolean; today: string }): Partial<Record<RoomType, UnitReading>> {
  const readings: Partial<Record<RoomType, UnitReading>> = {};
  const categories = Object.values(body.categories);
  const units = Object.values(body.units ?? {});

  ROOM_TYPE_KEYS.forEach((room, beds) => {
    const plans = categories.filter((c) => Number(c.min_beds) === beds).flatMap((c) => c.floorplans);
    if (plans.length === 0) {
      readings[room] = { status: "not-offered", minPrice: null, available: null, availableFrom: null };
      return;
    }
    const multiplier = options.perBed ? Math.max(beds, 1) : 1;
    const lowestRate = (list: EntrataFloorPlan[]) => {
      const rates = list.flatMap((plan) => plan.rates.map((rate) => Number(rate.value))).filter((v) => v > 0);
      return rates.length ? Math.min(...rates) * multiplier : null;
    };
    const open = plans.filter((plan) => Number(plan.units_available) > 0);
    const available = open.reduce((sum, plan) => sum + Number(plan.units_available), 0);
    const ids = new Set(open.map((plan) => String(plan.entrata_api_id)));
    const moveIns = units
      .filter((unit) => ids.has(String(unit.floorplanID)) && unit.availableOn)
      .map((unit) => nextMonthDay(unit.availableOn!, options.today))
      .filter((date): date is string => date !== null)
      .sort();

    readings[room] =
      available > 0
        ? { status: "available", minPrice: lowestRate(open), available, availableFrom: moveIns[0] && moveIns[0] > options.today ? moveIns[0] : null }
        : { status: "waitlist", minPrice: lowestRate(plans), available: 0, availableFrom: null };
  });
  return readings;
}

export const entrataWp: PricingAdapter = {
  id: "entrata-wp",
  detect: (html) => /wp-json\/theme\/entrata/i.test(html),
  async read(listing, { http, today }) {
    const body = await http.json<EntrataResponse>(requireUrl(listing));
    return { units: readEntrata(body, { perBed: listing.pricing.options?.perBed === true, today }) };
  },
};
