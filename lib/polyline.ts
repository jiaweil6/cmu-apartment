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

const METERS_PER_DEGREE = 111_320;

/**
 * Drops the short out-and-back spurs transit paths make into each stop (a few meters off
 * the street and back), which would otherwise draw as blobs along the line.
 * `points` are [lng, lat]; spurs up to `maxMeters` long are removed.
 */
export function removeSpurs(points: [number, number][], maxMeters = 15): [number, number][] {
  const result: [number, number][] = [];
  for (const point of points) {
    result.push(point);
    while (result.length >= 3) {
      const [a, b, c] = result.slice(-3);
      const scale = Math.cos((b[1] * Math.PI) / 180);
      const ab: [number, number] = [(b[0] - a[0]) * scale, b[1] - a[1]];
      const bc: [number, number] = [(c[0] - b[0]) * scale, c[1] - b[1]];
      const lengthAb = Math.hypot(...ab) * METERS_PER_DEGREE;
      const lengthBc = Math.hypot(...bc) * METERS_PER_DEGREE;
      const turnsBack = ab[0] * bc[0] + ab[1] * bc[1] < -0.5 * Math.hypot(...ab) * Math.hypot(...bc);
      if (!(turnsBack && lengthAb <= maxMeters && lengthBc <= maxMeters)) break;
      result.splice(-2, 1); // drop the spur's tip
    }
  }
  return result;
}
