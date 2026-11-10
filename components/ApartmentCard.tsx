"use client";

import Link from "next/link";
import { useState } from "react";
import { priceParts, staleSince } from "@/lib/price-format";
import type { Apartment, RoomType } from "@/lib/types";
import CommuteRoute from "./CommuteRoute";
import RentTable from "./RentTable";
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
export default function ApartmentCard({ apartment, rank, roomType, isOpen, onToggle }: Props) {
  // Listing photos are hotlinked from other sites; hide the frame if one fails to load.
  const [imageFailed, setImageFailed] = useState(false);

  const detailsId = `apartment-details-${apartment.id}`;
  const stale = staleSince(apartment);
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
            {(selected.status || stale) && (
              <span className="apartment-tags">
                {selected.status && <span className={`tag tone-${selected.tone}`}>{selected.status}</span>}
                {stale && (
                  <span className="tag tone-stale">Price from {stale}</span>
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

            <RentTable apartment={apartment} roomType={roomType} />

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
              <Link className="button" href={{ pathname: "/map", query: { apartment: apartment.id, room: roomType } }}>
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
