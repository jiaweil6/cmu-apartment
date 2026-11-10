"use client";

import Link from "next/link";
import { useState } from "react";
import { ROOM_TYPES } from "@/lib/options";
import { offeredPrice } from "@/lib/ranking";
import type { Apartment, RoomType } from "@/lib/types";
import CommuteRoute from "./CommuteRoute";
import { ChevronDown, ExternalLink, MapPin, Walk } from "./icons";

interface Props {
  apartment: Apartment;
  rank: number;
  /** The room type chosen in "About You": its rent is shown in the summary and highlighted. */
  roomType: RoomType;
  isOpen: boolean;
  onToggle: () => void;
}

// Fixed locale and time zone so the server and browser render the same text.
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const moveInFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** open: units to rent; waitlist: offered but full; muted: not offered or no data. */
export type PriceTone = "open" | "waitlist" | "muted";

export interface PriceParts {
  /** "$1,849", or null when there's no rent to show. */
  price: string | null;
  /** "6 open", "Available Dec 24", "Waitlist", "Not available", "Unknown", or null. */
  status: string | null;
  tone: PriceTone | null;
}

export function priceParts(apartment: Apartment, roomType: RoomType): PriceParts {
  const unit = apartment.units[roomType];
  if (unit.status === "not-offered") return { price: null, status: "Not available", tone: "muted" };
  const amount = offeredPrice(apartment, roomType);
  if (amount === null) {
    return unit.status === "waitlist"
      ? { price: null, status: "Waitlist", tone: "waitlist" }
      : { price: null, status: "Unknown", tone: "muted" };
  }
  const price = money.format(amount);
  if (unit.status === "waitlist") return { price, status: "Waitlist", tone: "waitlist" };
  if (unit.status === "available" && unit.availableFrom) {
    const from = moveInFormat.format(new Date(`${unit.availableFrom}T00:00:00Z`));
    return { price, status: `Available ${from}`, tone: "open" };
  }
  if (unit.status === "available" && unit.available) return { price, status: `${unit.available} open`, tone: "open" };
  return { price, status: null, tone: null };
}

/** "$1,849 · 6 open", "$3,728 · Available Dec 24", "$5,200 · Waitlist", "Not available" or "Unknown". */
export function formatPrice(apartment: Apartment, roomType: RoomType): string {
  const { price, status } = priceParts(apartment, roomType);
  return [price, status].filter(Boolean).join(" · ");
}

export default function ApartmentCard({ apartment, rank, roomType, isOpen, onToggle }: Props) {
  // Listing photos are hotlinked from other sites; hide the frame if one fails to load.
  const [imageFailed, setImageFailed] = useState(false);

  const detailsId = `apartment-details-${apartment.id}`;
  const checkedAt = apartment.pricesCheckedAt ? new Date(apartment.pricesCheckedAt) : null;
  const selected = priceParts(apartment, roomType);
  const commuteMinutes = apartment.commuteMinutes ? Math.round(apartment.commuteMinutes.value) : null;
  const commute = commuteMinutes === null ? null : `${commuteMinutes} min`;
  const walk = apartment.walkMiles ? `${apartment.walkMiles.value.toFixed(1)} mi` : null;
  const phoneHref = apartment.phone ? `tel:${apartment.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <article className={`apartment-card${isOpen ? " is-open" : ""}`}>
      <h3 className="apartment-heading">
        <button
          type="button"
          className="apartment-toggle"
          aria-expanded={isOpen}
          aria-controls={detailsId}
          onClick={onToggle}
        >
          <span className={`rank${rank === 1 ? " is-first" : ""}`}>
            <span className="visually-hidden">Rank </span>
            {rank}
          </span>
          <span className="apartment-summary">
            <span className="apartment-name">{apartment.name}</span>
            <span className="apartment-meta">
              {selected.price && (
                <span className="meta-price">
                  <strong>{selected.price}</strong>/mo
                </span>
              )}
              <span>
                <MapPin className="meta-icon" />
                {apartment.neighborhood}
              </span>
            </span>
            {(commuteMinutes !== null || walk) && (
              <span className="apartment-meta">
                {commuteMinutes !== null && <CommuteRoute minutes={commuteMinutes} />}
                {walk && (
                  <span>
                    <Walk className="meta-icon" />
                    {walk} walk
                  </span>
                )}
              </span>
            )}
            {(selected.status || apartment.pricesStale) && (
              <span className="apartment-tags">
                {selected.status && <span className={`tag tone-${selected.tone}`}>{selected.status}</span>}
                {apartment.pricesStale && checkedAt && (
                  <span className="tag tone-stale">Price from {monthFormat.format(checkedAt)}</span>
                )}
              </span>
            )}
          </span>
          <ChevronDown className="chevron" />
        </button>
      </h3>

      <div id={detailsId} className={`apartment-details${isOpen ? " is-open" : ""}`} inert={!isOpen}>
        <div>
          <div className="apartment-details-content">
            {apartment.imageUrl && !imageFailed && (
              // Remote listing photos of unknown size, so next/image doesn't fit.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="apartment-image"
                src={apartment.imageUrl}
                alt={apartment.name}
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            )}

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

            <dl className="fact-list">
              <div>
                <dt>Address</dt>
                <dd>{apartment.address}</dd>
              </div>
              {phoneHref && (
                <div>
                  <dt>Phone</dt>
                  <dd>
                    <a href={phoneHref}>{apartment.phone}</a>
                  </dd>
                </div>
              )}
              {commute && (
                <div>
                  <dt>Commute to campus</dt>
                  <dd>{commute}</dd>
                </div>
              )}
              {walk && (
                <div>
                  <dt>Walk to campus</dt>
                  <dd>{walk}</dd>
                </div>
              )}
              {apartment.yearBuilt && (
                <div>
                  <dt>Year built</dt>
                  <dd>{apartment.yearBuilt}</dd>
                </div>
              )}
            </dl>

            <div className="card-actions">
              <a className="button button-primary" href={apartment.website} target="_blank" rel="noopener noreferrer">
                Website
                <ExternalLink />
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
              <Link className="button" href="/map">
                <MapPin />
                View on map
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
