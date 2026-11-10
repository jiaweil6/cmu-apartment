import { describe, expect, it } from "vitest";
import { decodePolyline } from "./polyline";

describe("decodePolyline", () => {
  it("decodes Google's documented example as [lng, lat] pairs", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it("returns nothing for an empty path", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
