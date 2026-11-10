import Link from "next/link";
import { ROOM_TYPES } from "@/lib/options";
import type { Apartment } from "@/lib/types";

interface Props {
  apartment: Apartment;
  rank: number;
  isOpen: boolean;
  onToggle: () => void;
}

function formatPrice(price: number | null): string {
  return price === null ? "Not available" : `$${price}`;
}

export default function ApartmentCard({ apartment, rank, isOpen, onToggle }: Props) {
  const detailsId = `apartment-details-${apartment.id}`;

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
                    {priceLabel}: {formatPrice(apartment.prices[value])}
                  </p>
                ))}
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
