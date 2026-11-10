// Copies MapLibre's web worker next to the map tiles so the static site can serve it
// (MapLibre 6 loads its worker from a separate file; see components/ApartmentMap.tsx).
// Runs before `npm run dev` and `npm run build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const source = path.join(path.dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs");
const target = path.join(import.meta.dirname, "..", "..", "public", "basemap", "maplibre-gl-worker.mjs");
mkdirSync(path.dirname(target), { recursive: true });
copyFileSync(source, target);
