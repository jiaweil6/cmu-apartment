#!/usr/bin/env bash
# Builds the map's basemap into public/basemap/:
#   - pittsburgh.pmtiles: a Protomaps vector-tile extract (OpenStreetMap data) of the
#     area in lib/map-area.json, served as a static file and read with range requests
#   - fonts/: the label glyphs the style uses
#   - basemap.json: which Protomaps build it came from
# Needs curl, jq and the pmtiles CLI (https://github.com/protomaps/go-pmtiles).
# Runs in the "Map tiles" workflow; set PROTOMAPS_BUILD (e.g. 20261101.pmtiles) to pin a build.
set -euo pipefail

cd "$(dirname "$0")/../.."
OUT=public/basemap
BBOX=$(jq -r '.bbox | join(",")' lib/map-area.json)
MAXZOOM=$(jq -r '.maxzoom' lib/map-area.json)

latest_build() {
  local key
  key=$(curl -fsS https://build-metadata.protomaps.dev/builds.json 2>/dev/null |
    jq -r '[.[] | (.key? // .)] | map(select(type == "string" and endswith(".pmtiles"))) | sort | last // empty' || true)
  if [ -n "$key" ]; then echo "$key"; return; fi
  # Fall back to probing recent daily builds.
  for days in $(seq 0 14); do
    key="$(date -u -d "-$days day" +%Y%m%d).pmtiles"
    if curl -fsSI "https://build.protomaps.com/$key" >/dev/null 2>&1; then echo "$key"; return; fi
  done
  echo "No Protomaps build found" >&2
  exit 1
}

BUILD="${PROTOMAPS_BUILD:-$(latest_build)}"
echo "Protomaps build: $BUILD, bbox $BBOX, maxzoom $MAXZOOM"

mkdir -p "$OUT"
pmtiles extract "https://build.protomaps.com/$BUILD" "$OUT/pittsburgh.pmtiles" --bbox="$BBOX" --maxzoom="$MAXZOOM"
ls -l "$OUT/pittsburgh.pmtiles"

# Latin, Latin Extended-A and general punctuation cover the labels in this area.
for font in "Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic"; do
  mkdir -p "$OUT/fonts/$font"
  for range in 0-255 256-511 8192-8447; do
    curl -fsS "https://protomaps.github.io/basemaps-assets/fonts/${font// /%20}/$range.pbf" -o "$OUT/fonts/$font/$range.pbf"
  done
done

jq -n --arg build "$BUILD" --argjson area "$(jq '{bbox, maxzoom}' lib/map-area.json)" \
  '{build: $build, source: "https://build.protomaps.com", license: "ODbL (© OpenStreetMap contributors)"} + $area' >"$OUT/basemap.json"
cat "$OUT/basemap.json"
