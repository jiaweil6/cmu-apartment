import { ROOM_TYPE_KEYS, type Listings, type Snapshot, type UnitInfo } from "@/lib/schemas";
import type { RoomType } from "@/lib/types";
import type { PricingAdapter, PricingContext } from "./pricing/types";

/** Plausible monthly rent. Readings outside this range are treated as scraper errors. */
export const PRICE_RANGE = { min: 500, max: 10_000 };
/** A bigger move than this between runs needs a human to confirm it. */
export const MAX_CHANGE = 0.4;

const LABEL: Record<RoomType, string> = { studio: "Studio", oneBedroom: "1BR", twoBedroom: "2BR", threeBedroom: "3BR" };

export interface PriceResult {
  id: string;
  name: string;
  adapter: string;
  outcome: "updated" | "unchanged" | "failed";
  /** When this source last read successfully (the previous value's date if it failed). */
  checkedAt: string | null;
  changes: string[];
  anomalies: string[];
  error?: string;
}

const UNKNOWN: Omit<UnitInfo, "observedAt" | "source"> = { status: "unknown", minPrice: null };
const offered = (unit: Pick<UnitInfo, "status" | "minPrice">) => unit.status !== "not-offered" && unit.minPrice !== null;
const money = (value: number | null) => (value === null ? "—" : `$${value}`);

function describe(unit: Pick<UnitInfo, "status" | "minPrice" | "available">): string {
  if (unit.status === "not-offered") return "not offered";
  const extra = unit.status === "waitlist" ? " (waitlist)" : unit.available ? ` (${unit.available} open)` : "";
  return money(unit.minPrice) + extra;
}

/**
 * Reads every listing's prices through its adapter and merges them into the
 * snapshot. A failed read keeps the previous values; implausible or large
 * changes are reported as anomalies so the run goes to review.
 */
export async function refreshPrices(options: {
  listings: Listings;
  snapshot: Snapshot;
  adapters: Map<string, PricingAdapter>;
  context: PricingContext;
  now: string;
}): Promise<{ apartments: Snapshot["apartments"]; results: PriceResult[] }> {
  const { listings, snapshot, adapters, context, now } = options;
  const apartments: Snapshot["apartments"] = { ...snapshot.apartments };
  const results: PriceResult[] = [];

  for (const listing of listings.apartments) {
    const previousMetrics = snapshot.apartments[listing.id];
    const previous = Object.fromEntries(
      ROOM_TYPE_KEYS.map((room) => [room, previousMetrics?.units[room] ?? { ...UNKNOWN, observedAt: now, source: "none" }]),
    ) as Record<RoomType, UnitInfo>;
    const lastChecked = Object.values(previous).filter((u) => u.source !== "none").map((u) => u.observedAt).sort().at(-1) ?? null;
    const result: PriceResult = {
      id: listing.id,
      name: listing.name,
      adapter: listing.pricing.adapter,
      outcome: "unchanged",
      checkedAt: lastChecked,
      changes: [],
      anomalies: [],
    };
    results.push(result);

    const adapter = adapters.get(listing.pricing.adapter);
    let reading;
    try {
      if (!adapter) throw new Error(`Unknown pricing adapter "${listing.pricing.adapter}"`);
      reading = await adapter.read(listing, context);
    } catch (error) {
      result.outcome = "failed";
      result.error = error instanceof Error ? error.message : String(error);
      if (!previousMetrics) apartments[listing.id] = { units: previous };
      continue;
    }

    const observedAt = reading.observedAt ?? now;
    const units = { ...previous };
    for (const room of ROOM_TYPE_KEYS) {
      const read = reading.units[room];
      if (!read) continue;
      const before = previous[room];
      if (read.minPrice !== null && (read.minPrice < PRICE_RANGE.min || read.minPrice > PRICE_RANGE.max)) {
        result.anomalies.push(`${LABEL[room]} read as ${money(read.minPrice)}, outside ${money(PRICE_RANGE.min)}–${money(PRICE_RANGE.max)}; kept ${describe(before)}`);
        continue;
      }
      // With nothing open, keep the last known rent so the building still ranks on price.
      const minPrice = read.minPrice ?? (read.status === "waitlist" ? before.minPrice : null);
      const next: UnitInfo = { ...read, minPrice, observedAt, source: adapter!.id };
      if (before.minPrice !== null && minPrice !== null && Math.abs(minPrice - before.minPrice) / before.minPrice > MAX_CHANGE) {
        result.anomalies.push(`${LABEL[room]} moved ${money(before.minPrice)} → ${money(minPrice)}`);
      }
      if (describe(before) !== describe(next)) result.changes.push(`${LABEL[room]} ${describe(before)} → ${describe(next)}`);
      units[room] = next;
    }

    if (ROOM_TYPE_KEYS.some((room) => offered(previous[room])) && !ROOM_TYPE_KEYS.some((room) => offered(units[room]))) {
      result.anomalies.push("No room types offered any more");
    }
    result.outcome = result.changes.length ? "updated" : "unchanged";
    result.checkedAt = observedAt;
    apartments[listing.id] = { ...previousMetrics, units };
  }

  return { apartments, results };
}

/** Markdown for the run summary and review PR, plus whether a human should look. */
export function priceSummary(results: PriceResult[]): { markdown: string; needsReview: boolean } {
  const failed = results.filter((r) => r.outcome === "failed");
  const flagged = results.filter((r) => r.anomalies.length);
  const lines = [
    "## Price refresh",
    "",
    `${results.length} buildings: ${results.filter((r) => r.outcome === "updated").length} updated, ` +
      `${results.filter((r) => r.outcome === "unchanged").length} unchanged, ${failed.length} failed.`,
  ];
  if (flagged.length) {
    lines.push("", `**Needs review:** ${flagged.length} building(s) with suspicious readings.`);
    for (const r of flagged) for (const a of r.anomalies) lines.push(`- ${r.name}: ${a}`);
  }
  const changed = results.filter((r) => r.changes.length);
  if (changed.length) {
    lines.push("", "### Changes", "");
    for (const r of changed) lines.push(`- ${r.name}: ${r.changes.join("; ")}`);
  }
  lines.push("", "### Source health", "", "| Building | Source | Result | Last checked |", "| --- | --- | --- | --- |");
  for (const r of results) {
    const outcome = r.outcome === "failed" ? `Failed: ${r.error}` : r.outcome;
    lines.push(`| ${r.name} | ${r.adapter} | ${outcome} | ${r.checkedAt?.slice(0, 10) ?? "never"} |`);
  }
  return { markdown: lines.join("\n") + "\n", needsReview: flagged.length > 0 };
}
