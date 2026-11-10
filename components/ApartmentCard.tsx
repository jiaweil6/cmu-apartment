import Link from "next/link";
import { ROOM_TYPES } from "@/lib/options";
import { offeredPrice } from "@/lib/ranking";
import type { Apartment, RoomType } from "@/lib/types";

interface Props {
  apartment: Apartment;
  rank: number;
  isOpen: boolean;
  onToggle: () => void;
}

// Fixed locale and time zone so the server and browser render the same text.
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

function formatPrice(apartment: Apartment, roomType: RoomType): string {
  if (apartment.units[roomType].status === "not-offered") return "Not available";
  const price = offeredPrice(apartment, roomType);
  return price === null ? "Unknown" : `$${price}`;
}

/** The most recent date any price was checked, or null if none were. */
function pricesCheckedOn(apartment: Apartment): string | null {
  const dates = Object.values(apartment.units)
    .filter((unit) => unit.source !== "none")
    .map((unit) => unit.observedAt)
    .sort();
  return dates.length ? dateFormat.format(new Date(dates[dates.length - 1])) : null;
}

export default function ApartmentCard({ apartment, rank, isOpen, onToggle }: Props) {
  const detailsId = `apartment-details-${apartment.id}`;
  const checkedOn = pricesCheckedOn(apartment);

  return (
    <div className="card apartment-card mb-3">
      <div className="card-body">
        <button
          type="button"
          className="card-title apartment-toggle"
          aria-expanded={isOpen}
          aria-controls={detailsId}
          onClick={onToggle}
        >
          {rank}. {apartment.name}
          <ChevronDown />
        </button>
        <div id={detailsId} className={`apartment-details${isOpen ? " is-open" : ""}`} inert={!isOpen}>
          <div>
            <div className="apartment-details-content">
              <div className="card card-body">
                <p>Address: {apartment.address}</p>
                <p>Phone Number: {apartment.phone}</p>
                {ROOM_TYPES.map(({ value, priceLabel }) => (
                  <p key={value}>
                    {priceLabel}: {formatPrice(apartment, value)}
                  </p>
                ))}
                {checkedOn && <p className="data-note">Prices as of {checkedOn}</p>}
                {apartment.commuteMinutes && (
                  <p>Commute to Campus: {Math.round(apartment.commuteMinutes.value)} min</p>
                )}
                {apartment.walkMiles && <p>Walk to Campus: {apartment.walkMiles.value.toFixed(1)} mi</p>}
                {apartment.yearBuilt && <p>Year Built: {apartment.yearBuilt}</p>}
                <a href={apartment.website} target="_blank" rel="noopener noreferrer">
                  Website
                </a>
                <Link href="/map">View on Map</Link>
                <br />
                {/* Remote listing photos of unknown size, so next/image doesn't fit. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="apartment-image"
                  src={apartment.imageUrl}
                  alt={apartment.name}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronDown() {
  return (
    <svg className="chevron" width="0.875em" height="1em" viewBox="0 0 448 512" aria-hidden="true">
      <path
        d="M48 184 224 360 400 184"
        fill="none"
        stroke="currentColor"
        strokeWidth="68"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
