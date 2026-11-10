"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ROOM_TYPES } from "@/lib/options";
import { priceParts, staleSince } from "@/lib/price-format";
import { offeredPrice } from "@/lib/ranking";
import type { Apartment, Place, RoomType } from "@/lib/types";
import ApartmentMap, { type ApartmentMapHandle, type MapPoint } from "./ApartmentMap";
import CommuteRoute from "./CommuteRoute";
import RentTable from "./RentTable";
import { Close, ExternalLink, Frame, MapPin, Walk } from "./icons";

type Sort = "commute" | "rent";

const SORTS: { value: Sort; label: string }[] = [
  { value: "commute", label: "Shortest commute" },
  { value: "rent", label: "Lowest rent" },
];

const WIDE = "(min-width: 900px)";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const minutes = (apartment: Apartment) => (apartment.commuteMinutes ? Math.round(apartment.commuteMinutes.value) : null);
/** Nulls last, then by name. */
const byValue = (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity);

// The room type and selected apartment live in the address (?room=…&apartment=…), so any view
// can be shared and the rankings page can link straight to an apartment.
const urlListeners = new Set<() => void>();

function subscribeToUrl(listener: () => void) {
  urlListeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    urlListeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function setUrlParams(changes: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(window.history.state, "", url);
  urlListeners.forEach((listener) => listener());
}

/** Google Maps transit directions to campus (a plain link: nothing is fetched from Google). */
function directionsUrl(from: Apartment, to: Place): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.location.lat},${from.location.lng}`,
    destination: `${to.location.lat},${to.location.lng}`,
    travelmode: "transit",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

/**
 * The map page: a list of every apartment beside a map of where each sits from campus.
 * Selecting one in either place frames it with campus and opens its card. The room type
 * sets the rents shown, and `?apartment=…&room=…` links straight to an apartment.
 */
export default function MapExplorer({ apartments, campus }: { apartments: Apartment[]; campus: Place }) {
  // The static page renders with no parameters; the real ones apply right after hydration.
  const search = useSyncExternalStore(subscribeToUrl, () => window.location.search, () => "");
  const params = new URLSearchParams(search);
  // One bedroom by default: nearly every building offers it, so most tags show a rent.
  const roomType = ROOM_TYPES.find((option) => option.value === params.get("room"))?.value ?? "oneBedroom";
  const selectedId = apartments.find((apartment) => apartment.id === params.get("apartment"))?.id ?? null;
  const setRoomType = (room: RoomType) => setUrlParams({ room });
  const setSelectedId = (id: string | null) => setUrlParams({ apartment: id });

  const [sort, setSort] = useState<Sort>("commute");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const mapRef = useRef<ApartmentMapHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const rows = useMemo(
    () =>
      apartments
        .map((apartment) => ({ apartment, parts: priceParts(apartment, roomType), commute: minutes(apartment) }))
        .sort(
          (a, b) =>
            (sort === "rent"
              ? byValue(offeredPrice(a.apartment, roomType), offeredPrice(b.apartment, roomType))
              : byValue(a.commute, b.commute)) || a.apartment.name.localeCompare(b.apartment.name),
        ),
    [apartments, roomType, sort],
  );

  const points = useMemo<MapPoint[]>(
    () =>
      rows.map(({ apartment, parts }, index) => ({
        id: apartment.id,
        shortName: apartment.shortName,
        location: apartment.location,
        price: parts.price,
        priority: index,
      })),
    [rows],
  );

  const selected = apartments.find((apartment) => apartment.id === selectedId) ?? null;
  const roomLabel = ROOM_TYPES.find((room) => room.value === roomType)!;

  // Frame the selection with campus, clear of the card that covers part of the map.
  useEffect(() => {
    if (!selectedId) return;
    const card = cardRef.current;
    const wide = window.matchMedia(WIDE).matches;
    mapRef.current?.focus(selectedId, wide ? { right: (card?.offsetWidth ?? 0) + 16 } : { bottom: (card?.offsetHeight ?? 0) + 16 });
    if (wide) {
      listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  const chooseFromList = (id: string) => {
    setSelectedId(id);
    // On phones the list sits under the map: bring the map back into view.
    if (!window.matchMedia(WIDE).matches) {
      stageRef.current?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  };

  const commute = selected ? minutes(selected) : null;
  const selectedParts = selected ? priceParts(selected, roomType) : null;
  const selectedStale = selected ? staleSince(selected) : null;
  const selectedStatus =
    selectedParts?.price && selectedStale
      ? { text: `Price from ${selectedStale}`, tone: "stale" }
      : selectedParts?.price && selectedParts.status
        ? { text: selectedParts.status, tone: selectedParts.tone }
        : null;

  return (
    <div className="map-explorer">
      <div className="map-head">
        <h1 className="map-title">Apartments near CMU</h1>
        <p className="page-lede">Where each apartment sits from campus. Select one to see its rents and commute.</p>
        <div className="map-controls">
          <label className="map-room">
            Rent for a{" "}
            <select
              className="inline-select"
              value={roomType}
              onChange={(event) => setRoomType(event.target.value as RoomType)}
            >
              {ROOM_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div ref={stageRef} className="map-stage">
        <ApartmentMap
          ref={mapRef}
          campus={campus}
          points={points}
          selectedId={selectedId}
          hoveredId={hoveredId}
          connectorLabel={commute === null ? null : `${commute} min commute`}
          onSelect={setSelectedId}
          onHover={setHoveredId}
        />
        <button type="button" className="map-overlay-button" onClick={() => mapRef.current?.showAll()}>
          <Frame />
          Show all
        </button>
        <p className="map-key" aria-hidden="true">
          Tags show the lowest rent for a {roomLabel.label}
        </p>

        {selected && (
          <section ref={cardRef} className="map-card" aria-labelledby="map-card-title">
            <div className="map-card-head">
              <h2 id="map-card-title">{selected.name}</h2>
              <button type="button" className="icon-button" onClick={() => setSelectedId(null)} aria-label="Close">
                <Close />
              </button>
            </div>
            <p className="map-card-place">
              {selected.neighborhood} · {selected.address}
            </p>
            {/* Phones get the chosen room's rent in one line; wider screens the full table. */}
            <p className="map-card-rent">
              {selectedParts?.price ? (
                <>
                  <strong>{selectedParts.price}</strong>/mo for a {roomLabel.label}
                </>
              ) : (
                <>No {roomLabel.label} here</>
              )}
              {selectedStatus && <span className={`tag tone-${selectedStatus.tone}`}>{selectedStatus.text}</span>}
            </p>
            <div className="map-card-rents">
              <RentTable apartment={selected} roomType={roomType} />
            </div>
            <p className="map-card-travel">
              {commute !== null && <CommuteRoute minutes={commute} />}
              {selected.walkMiles && (
                <span>
                  <Walk className="meta-icon" />
                  {selected.walkMiles.value.toFixed(1)} mi walk
                </span>
              )}
              {selected.yearBuilt && <span className="map-card-built">Built {selected.yearBuilt}</span>}
            </p>
            <div className="card-actions">
              <a className="button button-primary" href={selected.website} target="_blank" rel="noopener noreferrer">
                Website
                <ExternalLink />
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
              <a className="button" href={directionsUrl(selected, campus)} target="_blank" rel="noopener noreferrer">
                Transit directions
                <ExternalLink />
                <span className="visually-hidden"> (Google Maps, opens in a new tab)</span>
              </a>
            </div>
          </section>
        )}
      </div>

      <div className="map-list-area">
        <div className="map-list-head">
          <p className="result-count">{apartments.length} apartments</p>
          <fieldset className="segmented">
            <legend className="visually-hidden">Sort the list by</legend>
            {SORTS.map(({ value, label }) => (
              <label key={value} className="segmented-option">
                <input type="radio" name="sort" value={value} checked={sort === value} onChange={() => setSort(value)} />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
        <ol ref={listRef} className="map-list" aria-label="Apartments">
          {rows.map(({ apartment, parts, commute: itemCommute }) => {
            const stale = staleSince(apartment);
            const status = parts.price ? (stale ? `Price from ${stale}` : parts.status) : null;
            const tone = parts.price && stale ? "stale" : parts.tone;
            return (
              <li key={apartment.id}>
                <button
                  type="button"
                  className="map-item"
                  data-id={apartment.id}
                  aria-current={apartment.id === selectedId ? "true" : undefined}
                  onClick={() => chooseFromList(apartment.id)}
                  onMouseEnter={() => setHoveredId(apartment.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(apartment.id)}
                  onBlur={() => setHoveredId(null)}
                >
                  <span className="map-item-main">
                    <span className="map-item-name">{apartment.name}</span>
                    <span className="apartment-meta">
                      <span>
                        <MapPin className="meta-icon" />
                        {apartment.neighborhood}
                      </span>
                      {itemCommute !== null && <CommuteRoute minutes={itemCommute} />}
                    </span>
                  </span>
                  <span className="map-item-rent">
                    {parts.price ? (
                      <span className="map-item-price">{parts.price}</span>
                    ) : (
                      <span className="map-item-price is-missing">No {roomLabel.shortLabel.toLowerCase()}</span>
                    )}
                    {status && <span className={`map-item-status tone-${tone}`}>{status}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
