"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { googleDirectionsUrl } from "@/lib/directions";
import { ROOM_TYPES } from "@/lib/options";
import { decodePolyline } from "@/lib/polyline";
import { priceParts, staleSince } from "@/lib/price-format";
import { offeredPrice } from "@/lib/ranking";
import { formatClock, miles, modeName, wholeMinutes } from "@/lib/route-format";
import type { RoutesFile } from "@/lib/schemas";
import type { Apartment, Place, RoomType } from "@/lib/types";
import ApartmentMap, { type ApartmentMapHandle, type MapPoint, type RouteView } from "./ApartmentMap";
import CommuteRoute from "./CommuteRoute";
import CommuteSteps, { CommuteSummary } from "./CommuteSteps";
import RentTable from "./RentTable";
import { Close, ExternalLink, Frame, MapPin, Walk } from "./icons";

type Trip = "commute" | "walk";

const serviceDayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

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

const lngLat = ({ lat, lng }: { lat: number; lng: number }): [number, number] => [lng, lat];

/** The selected trip as paths for the map: walking legs dotted, rides solid and named. */
function routeView(routes: RoutesFile["apartments"][string] | null, trip: Trip): RouteView | null {
  if (trip === "walk") {
    if (!routes?.walk) return null;
    return {
      segments: routes.walk.geometry.map((path) => ({ mode: "walk", coordinates: decodePolyline(path), label: null })),
      stops: [],
    };
  }
  if (!routes?.commute) return null;
  const rides = routes.commute.legs.filter((leg) => leg.mode !== "WALK");
  return {
    segments: routes.commute.legs.map((leg) => ({
      mode: leg.mode === "WALK" ? "walk" : "ride",
      coordinates: decodePolyline(leg.geometry),
      label: leg.mode === "WALK" ? null : (leg.route?.shortName ?? modeName(leg.mode)),
    })),
    stops: rides.flatMap((leg) => [lngLat(leg.from.location), lngLat(leg.to.location)]),
  };
}

interface Props {
  apartments: Apartment[];
  campus: Place;
  /** Commute trips and walking routes from the weekly transit refresh (data/routes.json). */
  routes: RoutesFile["apartments"];
  /** The weekday whose timetable the trips use (YYYY-MM-DD). */
  serviceDate: string;
}

/**
 * The map page: a list of every apartment beside a map of where each sits from campus.
 * Selecting one in either place frames it with its route to campus and opens its card,
 * with the commute step by step (or the walk). The room type sets the rents shown, and
 * `?apartment=…&room=…&route=walk` links straight to a view.
 */
export default function MapExplorer({ apartments, campus, routes, serviceDate }: Props) {
  // The static page renders with no parameters; the real ones apply right after hydration.
  const search = useSyncExternalStore(subscribeToUrl, () => window.location.search, () => "");
  const params = new URLSearchParams(search);
  // One bedroom by default: nearly every building offers it, so most tags show a rent.
  const roomType = ROOM_TYPES.find((option) => option.value === params.get("room"))?.value ?? "oneBedroom";
  const selectedId = apartments.find((apartment) => apartment.id === params.get("apartment"))?.id ?? null;
  const setRoomType = (room: RoomType) => setUrlParams({ room });
  const setSelectedId = (id: string | null) => setUrlParams({ apartment: id });
  const trip: Trip = params.get("route") === "walk" ? "walk" : "commute";
  const setTrip = (value: Trip) => setUrlParams({ route: value === "walk" ? "walk" : null });

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
  const selectedRoutes = selectedId ? (routes[selectedId] ?? null) : null;
  const route = useMemo(() => routeView(selectedRoutes, trip), [selectedRoutes, trip]);

  // Frame the selection with campus, clear of the card that covers part of the map.
  useEffect(() => {
    if (!selectedId) return;
    const card = cardRef.current;
    const wide = window.matchMedia(WIDE).matches;
    mapRef.current?.focus(selectedId, wide ? { right: (card?.offsetWidth ?? 0) + 16 } : { bottom: (card?.offsetHeight ?? 0) + 16 });
    if (wide) {
      listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [selectedId, trip]);

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
  const walkMiles = selected?.walkMiles ? `${selected.walkMiles.value.toFixed(1)} mi` : null;
  const commuteTrip = selectedRoutes?.commute ?? null;
  const walkTrip = selectedRoutes?.walk ?? null;
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
          route={route}
          connectorLabel={trip === "walk" ? (walkMiles && `${walkMiles} walk`) : commute === null ? null : `${commute} min commute`}
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
              {selected.yearBuilt && <> · Built {selected.yearBuilt}</>}
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
            <div className="map-card-trip">
              <fieldset className="segmented">
                <legend className="visually-hidden">Route to campus</legend>
                {(["commute", "walk"] as const).map((value) => (
                  <label key={value} className="segmented-option">
                    <input type="radio" name="trip" value={value} checked={trip === value} onChange={() => setTrip(value)} />
                    {value === "commute" ? "Commute" : "Walk"}
                  </label>
                ))}
              </fieldset>

              {trip === "commute" ? (
                <>
                  <p className="trip-headline">
                    {commute !== null ? <CommuteRoute minutes={commute} /> : <span>No commute time yet</span>}
                    <a href={googleDirectionsUrl(selected.location, campus.location, "transit")} target="_blank" rel="noopener noreferrer">
                      Google Maps
                      <ExternalLink />
                      <span className="visually-hidden"> transit directions (opens in a new tab)</span>
                    </a>
                  </p>
                  {commuteTrip && (
                    <>
                      {/* Phones: one line, with the steps behind a disclosure so the map stays in view. */}
                      <details className="trip-steps-compact">
                        <summary>
                          <CommuteSummary commute={commuteTrip} />
                        </summary>
                        <CommuteSteps commute={commuteTrip} from={selected.shortName} to="Carnegie Mellon" />
                      </details>
                      <div className="trip-steps">
                        <CommuteSteps commute={commuteTrip} from={selected.shortName} to="Carnegie Mellon" />
                      </div>
                      <p className="trip-note">
                        {serviceDayFormat.format(new Date(`${serviceDate}T00:00:00Z`))} timetable, arriving by{" "}
                        {formatClock(commuteTrip.arriveBy)}
                      </p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="trip-headline">
                    <span>
                      <Walk className="meta-icon" />
                      {walkTrip ? miles(walkTrip.meters) : (walkMiles ?? "No walking route yet")}
                      {walkTrip && <>, about {wholeMinutes(walkTrip.minutes)} min</>}
                    </span>
                    <a href={googleDirectionsUrl(selected.location, campus.location, "walking")} target="_blank" rel="noopener noreferrer">
                      Google Maps
                      <ExternalLink />
                      <span className="visually-hidden"> walking directions (opens in a new tab)</span>
                    </a>
                  </p>
                  <p className="trip-note">The shortest walk along streets and paths</p>
                </>
              )}
            </div>
            <div className="card-actions">
              <a className="button button-primary" href={selected.website} target="_blank" rel="noopener noreferrer">
                Website
                <ExternalLink />
                <span className="visually-hidden"> (opens in a new tab)</span>
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
