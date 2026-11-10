/**
 * Decodes a Google encoded polyline (the format OpenTripPlanner uses for leg paths)
 * into [lng, lat] pairs, the order GeoJSON and MapLibre expect.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    const deltas: number[] = [];
    for (let axis = 0; axis < 2; axis++) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      deltas.push(result & 1 ? ~(result >> 1) : result >> 1);
    }
    lat += deltas[0];
    lng += deltas[1];
    points.push([lng / factor, lat / factor]);
  }
  return points;
}
