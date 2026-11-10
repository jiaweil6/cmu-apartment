import { ROOM_TYPES } from "@/lib/options";
import type { Apartment, RoomType } from "@/lib/types";
import { priceParts } from "@/lib/price-format";

// Fixed locale and time zone so the server and browser render the same text.
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** Rent and availability for every room type, the chosen one highlighted, and when prices were checked. */
export default function RentTable({ apartment, roomType }: { apartment: Apartment; roomType: RoomType }) {
  const checkedAt = apartment.pricesCheckedAt ? new Date(apartment.pricesCheckedAt) : null;
  return (
    <>
      <dl className="rent-grid" aria-label="Monthly rent">
        {ROOM_TYPES.map(({ value, shortLabel }) => {
          const parts = priceParts(apartment, value);
          return (
            <div key={value} className={`rent-tile${value === roomType ? " is-selected" : ""}`}>
              <dt>{shortLabel}</dt>
              <dd className={parts.price ? "rent-price" : "rent-price is-missing"}>{parts.price ?? parts.status}</dd>
              {parts.price && parts.status && <dd className={`rent-status tone-${parts.tone}`}>{parts.status}</dd>}
            </div>
          );
        })}
      </dl>
      {checkedAt && (
        <p className={`data-note${apartment.pricesStale ? " is-stale" : ""}`}>
          Prices as of {dateFormat.format(checkedAt)}
          {apartment.pricesStale && " (may be out of date)"}
        </p>
      )}
    </>
  );
}
