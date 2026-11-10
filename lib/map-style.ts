import { layers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "maplibre-gl";
import area from "./map-area.json";

/** [west, south, east, north] covered by the self-hosted tiles (public/basemap/pittsburgh.pmtiles). */
export const MAP_BOUNDS = area.bbox as [number, number, number, number];

/**
 * Protomaps' light basemap repainted in the site's warm paper palette: quiet land,
 * white streets, muted water and parks, and neighbourhood names a step darker so
 * Oakland, Shadyside and Squirrel Hill read at a glance.
 */
const PAPER: Flavor = {
  ...namedFlavor("light"),
  background: "#f1ece4",
  earth: "#f3eee6",
  park_a: "#e3e8d6",
  park_b: "#d5dec4",
  wood_a: "#dfe5d1",
  wood_b: "#cfd9bd",
  scrub_a: "#e3e8d6",
  scrub_b: "#d5dec4",
  hospital: "#f0e6e1",
  industrial: "#ece7de",
  school: "#f2e6d9",
  pedestrian: "#ede7dd",
  beach: "#efe7d4",
  zoo: "#e3e7d7",
  aerodrome: "#ebe6de",
  military: "#ebe6de",
  water: "#c6d7dd",
  buildings: "#e7e0d5",
  pier: "#e7e0d5",
  railway: "#cbc2b6",
  boundaries: "#cbc2b6",
  other: "#f8f5f0",
  minor_service: "#f8f5f0",
  minor_a: "#fbf9f5",
  minor_b: "#ffffff",
  link: "#ffffff",
  major: "#ffffff",
  highway: "#fffaf2",
  minor_service_casing: "#e6dfd4",
  minor_casing: "#e6dfd4",
  link_casing: "#e2d9cc",
  major_casing_early: "#e2d9cc",
  major_casing_late: "#e2d9cc",
  highway_casing_early: "#ddd2c3",
  highway_casing_late: "#ddd2c3",
  tunnel_other_casing: "#e6dfd4",
  tunnel_minor_casing: "#e6dfd4",
  tunnel_link_casing: "#e6dfd4",
  tunnel_major_casing: "#e6dfd4",
  tunnel_highway_casing: "#e6dfd4",
  tunnel_other: "#efe9e1",
  tunnel_minor: "#efe9e1",
  tunnel_link: "#efe9e1",
  tunnel_major: "#efe9e1",
  tunnel_highway: "#efe9e1",
  bridges_other_casing: "#e2d9cc",
  bridges_minor_casing: "#e2d9cc",
  bridges_link_casing: "#e2d9cc",
  bridges_major_casing: "#e2d9cc",
  bridges_highway_casing: "#ddd2c3",
  bridges_other: "#f8f5f0",
  bridges_minor: "#ffffff",
  bridges_link: "#ffffff",
  bridges_major: "#ffffff",
  bridges_highway: "#fffaf2",
  roads_label_minor: "#8a8279",
  roads_label_minor_halo: "#f8f5f0",
  roads_label_major: "#716a63",
  roads_label_major_halo: "#ffffff",
  ocean_label: "#6b8590",
  subplace_label: "#5c554e",
  subplace_label_halo: "#f3eee6",
  city_label: "#2b2724",
  city_label_halo: "#f3eee6",
  state_label: "#8a8279",
  state_label_halo: "#f3eee6",
  country_label: "#8a8279",
  address_label: "#8a8279",
  address_label_halo: "#f8f5f0",
  landcover: {
    barren: "#efe9df",
    farmland: "#e6e9d9",
    forest: "#dbe3cd",
    glacier: "#f7f5f2",
    grassland: "#e3e8d6",
    scrub: "#e3e8d6",
    urban_area: "#f0eae1",
  },
};

/** Icons and clutter left out: points of interest, one-way arrows, route shields and house numbers. */
const HIDDEN_LAYERS = new Set(["pois", "roads_oneway", "roads_shields", "address_label"]);

/**
 * The basemap style. `baseUrl` is the site's origin plus its base path; the tiles and
 * label fonts are served from public/basemap/ (built by .github/workflows/map-tiles.yml).
 */
export function basemapStyle(baseUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: `${baseUrl}/basemap/fonts/{fontstack}/{range}.pbf`,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${baseUrl}/basemap/pittsburgh.pmtiles`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: layers("protomaps", PAPER, { lang: "en" }).filter((layer) => !HIDDEN_LAYERS.has(layer.id)),
  };
}
