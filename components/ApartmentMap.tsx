"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { FeatureCollection, LineString, Point } from "geojson";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  PaddingOptions,
  PointLike,
  SymbolLayerSpecification,
} from "maplibre-gl";
import type { LatLng, Place } from "@/lib/types";

/** One apartment as the map shows it. */
export interface MapPoint {
  id: string;
  shortName: string;
  location: LatLng;
  /** Rent for the chosen room type, like "$1,849", or null when it isn't offered or known. */
  price: string | null;
  /** Position in the list: when price tags collide, the lower number stays visible. */
  priority: number;
}

export interface ApartmentMapHandle {
  /** Frames an apartment together with campus, keeping `padding` clear for overlays. */
  focus(id: string, padding?: Partial<PaddingOptions>): void;
  /** Frames every apartment and campus. */
  showAll(): void;
}

interface Props {
  ref?: Ref<ApartmentMapHandle>;
  campus: Place;
  points: MapPoint[];
  selectedId: string | null;
  hoveredId: string | null;
  /** Shown halfway along the line from the selected apartment to campus, like "22 min commute". */
  connectorLabel: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

// Colours from app/globals.css (MapLibre needs literal values).
const INK = "#2b2724";
const SECONDARY = "#5c554e";
const MUTED = "#716a63";
const ACCENT_STRONG = "#c2410c";

const BASE_URL = () => `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
const HIT_LAYERS = ["apartment-selected", "apartment-hover", "apartment-pills", "apartment-selected-dot", "apartment-dots", "apartment-names"];
/** Space kept clear around framed places: less on small maps. */
const edgeFor = (map: MapLibreMap | null) => ((map?.getContainer().clientWidth ?? 0) < 600 ? 24 : 48);

let protocolAdded = false;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lngLat = ({ lat, lng }: LatLng): [number, number] => [lng, lat];

function boundsOf(locations: LatLng[]): LngLatBoundsLike {
  const lngs = locations.map((l) => l.lng);
  const lats = locations.map((l) => l.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

function apartmentData(points: MapPoint[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: lngLat(p.location) },
      // `price` is left out when there's none, so filters can test for it with "has".
      properties: { id: p.id, shortName: p.shortName, priority: p.priority, offered: p.price !== null, ...(p.price ? { price: p.price } : {}) },
    })),
  };
}

function connectorData(from: LatLng | null, to: LatLng, label: string | null): FeatureCollection<LineString | Point> {
  if (!from) return { type: "FeatureCollection", features: [] };
  const middle: LatLng = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: [lngLat(from), lngLat(to)] }, properties: {} },
      { type: "Feature", geometry: { type: "Point", coordinates: lngLat(middle) }, properties: { label: label ?? "" } },
    ],
  };
}

/**
 * A price tag drawn on a canvas and registered as a stretchable image, so MapLibre can
 * fit it around each label and hide tags that would overlap.
 */
function tagImage(fill: string, stroke: string | null): ImageData {
  const ratio = 2;
  const width = 24 * ratio;
  const height = 20 * ratio;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.beginPath();
  context.roundRect(ratio / 2, ratio / 2, width - ratio, height - ratio, 6 * ratio);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.lineWidth = ratio;
    context.strokeStyle = stroke;
    context.stroke();
  }
  return context.getImageData(0, 0, width, height);
}

const TAG_IMAGE_OPTIONS = {
  pixelRatio: 2,
  stretchX: [[12, 36]] as [number, number][],
  stretchY: [[12, 28]] as [number, number][],
  content: [12, 8, 36, 32] as [number, number, number, number],
};

/**
 * MapLibre map of the apartments around campus, on the self-hosted basemap (lib/map-style.ts).
 * Apartments are price tags that give way to each other when they'd overlap (each keeps a dot),
 * and the selected one is linked to campus by a dashed line labelled with its commute.
 */
export default function ApartmentMap({ ref, campus, points, selectedId, hoveredId, connectorLabel, onSelect, onHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  // Latest values for the map's event handlers, which are bound once.
  const latest = useRef({ onSelect, onHover, points, campus });
  useEffect(() => {
    latest.current = { onSelect, onHover, points, campus };
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;

    (async () => {
      const [maplibregl, { Protocol }, { basemapStyle, MAP_BOUNDS }] = await Promise.all([
        import("maplibre-gl"),
        import("pmtiles"),
        import("@/lib/map-style"),
      ]);
      if (cancelled || !containerRef.current) return;

      maplibregl.setWorkerUrl(`${BASE_URL()}/basemap/maplibre-gl-worker.mjs`);
      if (!protocolAdded) {
        maplibregl.addProtocol("pmtiles", new Protocol().tile);
        protocolAdded = true;
      }

      const { points: initialPoints, campus: initialCampus } = latest.current;
      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: basemapStyle(BASE_URL()),
          bounds: boundsOf([initialCampus.location, ...initialPoints.map((p) => p.location)]),
          fitBoundsOptions: { padding: containerRef.current.clientWidth < 600 ? 24 : 48 },
          maxBounds: MAP_BOUNDS,
          maxZoom: 18,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: { compact: true },
        });
      } catch {
        setFailed(true);
        return;
      }
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

      map.on("load", () => {
        if (!map) return;
        map.addImage("tag", tagImage("#ffffff", "rgba(43, 39, 36, 0.24)"), TAG_IMAGE_OPTIONS);
        map.addImage("tag-selected", tagImage(INK, null), TAG_IMAGE_OPTIONS);

        map.addSource("apartments", { type: "geojson", data: apartmentData(initialPoints), promoteId: "id" });
        map.addSource("campus", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "Point", coordinates: lngLat(initialCampus.location) }, properties: {} },
        });
        map.addSource("connector", { type: "geojson", data: connectorData(null, initialCampus.location, null) });

        const hovered: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
        const tagLayout: SymbolLayerSpecification["layout"] = {
          "text-font": ["Noto Sans Medium"],
          "text-size": 12,
          "text-anchor": "bottom",
          "text-offset": [0, -0.9],
          "icon-text-fit": "both",
          "icon-text-fit-padding": [1, 2, 1, 2],
          "symbol-sort-key": ["get", "priority"],
        };

        map.addLayer({
          id: "connector-line",
          type: "line",
          source: "connector",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round" },
          paint: { "line-color": SECONDARY, "line-width": 1.5, "line-dasharray": [2, 2] },
        });
        map.addLayer({
          id: "apartment-dots",
          type: "circle",
          source: "apartments",
          paint: {
            "circle-radius": ["case", hovered, 6, 4.5],
            "circle-color": ["case", ["get", "offered"], INK, "#ffffff"],
            "circle-stroke-color": ["case", ["get", "offered"], "#ffffff", MUTED],
            "circle-stroke-width": 1.5,
          },
        });
        map.addLayer({
          id: "apartment-names",
          type: "symbol",
          source: "apartments",
          minzoom: 14.5,
          layout: {
            "text-field": ["get", "shortName"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 11,
            "text-anchor": "top",
            "text-offset": [0, 0.7],
            "symbol-sort-key": ["get", "priority"],
          },
          paint: { "text-color": SECONDARY, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
        });
        map.addLayer({
          id: "apartment-pills",
          type: "symbol",
          source: "apartments",
          filter: ["has", "price"],
          layout: { ...tagLayout, "text-field": ["get", "price"], "icon-image": "tag" },
          paint: { "text-color": INK },
        });
        // The apartment under the pointer (or focused in the list) always shows its tag.
        map.addLayer({
          id: "apartment-hover",
          type: "symbol",
          source: "apartments",
          filter: ["==", ["get", "id"], ""],
          layout: {
            ...tagLayout,
            "text-field": ["coalesce", ["get", "price"], ["get", "shortName"]],
            "icon-image": "tag",
            "text-allow-overlap": true,
            "icon-allow-overlap": true,
          },
          paint: { "text-color": ACCENT_STRONG },
        });
        map.addLayer({
          id: "campus-dot",
          type: "circle",
          source: "campus",
          paint: { "circle-radius": 7, "circle-color": ACCENT_STRONG, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 },
        });
        map.addLayer({
          id: "campus-label",
          type: "symbol",
          source: "campus",
          layout: {
            "text-field": "Carnegie Mellon",
            "text-font": ["Noto Sans Medium"],
            "text-size": 13,
            "text-anchor": "left",
            "text-offset": [0.9, 0],
            "text-allow-overlap": true,
          },
          paint: { "text-color": ACCENT_STRONG, "text-halo-color": "#ffffff", "text-halo-width": 2 },
        });
        // The selected apartment: an open dot (the apartment end of the route line) and a dark tag.
        map.addLayer({
          id: "apartment-selected-dot",
          type: "circle",
          source: "apartments",
          filter: ["==", ["get", "id"], ""],
          paint: { "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": INK, "circle-stroke-width": 2.5 },
        });
        map.addLayer({
          id: "apartment-selected",
          type: "symbol",
          source: "apartments",
          filter: ["==", ["get", "id"], ""],
          layout: {
            ...tagLayout,
            "text-field": ["coalesce", ["get", "price"], ["get", "shortName"]],
            "icon-image": "tag-selected",
            "text-allow-overlap": true,
            "icon-allow-overlap": true,
          },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "connector-label",
          type: "symbol",
          source: "connector",
          filter: ["==", ["geometry-type"], "Point"],
          layout: {
            "text-field": ["get", "label"],
            "text-font": ["Noto Sans Medium"],
            "text-size": 12,
            "text-allow-overlap": true,
          },
          paint: { "text-color": INK, "text-halo-color": "#ffffff", "text-halo-width": 2 },
        });

        const featureAt = (point: { x: number; y: number }) => {
          const box: [PointLike, PointLike] = [
            [point.x - 8, point.y - 8],
            [point.x + 8, point.y + 8],
          ];
          return map!.queryRenderedFeatures(box, { layers: HIT_LAYERS })[0]?.properties?.id as string | undefined;
        };
        map.on("mousemove", (event) => {
          const id = featureAt(event.point) ?? null;
          map!.getCanvas().style.cursor = id ? "pointer" : "";
          latest.current.onHover(id);
        });
        map.on("mouseout", () => latest.current.onHover(null));
        map.on("click", (event) => latest.current.onSelect(featureAt(event.point) ?? null));

        setReady(true);
        pending.current?.();
        pending.current = null;
      });
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => {
    const whenReady = (action: () => void) => {
      if (mapRef.current?.loaded() || ready) action();
      else pending.current = action;
    };
    return {
      focus(id, padding = {}) {
        whenReady(() => {
          const { points: current, campus: place } = latest.current;
          const point = current.find((p) => p.id === id);
          if (!point || !mapRef.current) return;
          const edge = edgeFor(mapRef.current);
          mapRef.current.fitBounds(boundsOf([point.location, place.location]), {
            padding: {
              // Room above for the apartment's tag.
              top: edge + 24 + (padding.top ?? 0),
              right: edge + (padding.right ?? 0),
              bottom: edge + (padding.bottom ?? 0),
              left: edge + (padding.left ?? 0),
            },
            maxZoom: 15.5,
            duration: reducedMotion() ? 0 : 600,
          });
        });
      },
      showAll() {
        whenReady(() => {
          const { points: current, campus: place } = latest.current;
          mapRef.current?.fitBounds(boundsOf([place.location, ...current.map((p) => p.location)]), {
            padding: edgeFor(mapRef.current),
            duration: reducedMotion() ? 0 : 600,
          });
        });
      },
    };
  }, [ready]);

  // Rents change with the room type.
  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource("apartments") as GeoJSONSource | undefined)?.setData(apartmentData(points));
  }, [ready, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const filter: ExpressionSpecification = ["==", ["get", "id"], selectedId ?? ""];
    map.setFilter("apartment-selected", filter);
    map.setFilter("apartment-selected-dot", filter);
    const from = points.find((p) => p.id === selectedId)?.location ?? null;
    (map.getSource("connector") as GeoJSONSource).setData(connectorData(from, campus.location, connectorLabel));
  }, [ready, selectedId, points, campus, connectorLabel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const shown = hoveredId && hoveredId !== selectedId ? hoveredId : "";
    map.setFilter("apartment-hover", ["==", ["get", "id"], shown]);
    if (!hoveredId) return;
    map.setFeatureState({ source: "apartments", id: hoveredId }, { hover: true });
    return () => {
      if (map.getSource("apartments")) map.setFeatureState({ source: "apartments", id: hoveredId }, { hover: false });
    };
  }, [ready, hoveredId, selectedId]);

  return (
    <div className="map-container" role="region" aria-label="Map of apartments near Carnegie Mellon">
      <div ref={containerRef} className="map-canvas" />
      {failed && (
        <p className="map-notice">The map couldn&rsquo;t load in this browser. The list still has every apartment.</p>
      )}
    </div>
  );
}
