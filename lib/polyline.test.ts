import { describe, expect, it } from "vitest";
import { decodePolyline, removeSpurs } from "./polyline";

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

describe("tidyName", () => {
  it("turns PRT's capitals into readable stop and destination names", async () => {
    const { tidyName } = await import("./route-format");
    expect(tidyName("FORBES AVE + MOREWOOD AVE FS (CARNEGIE MELLON)")).toBe("Forbes Ave & Morewood Ave (Carnegie Mellon)");
    expect(tidyName("ELLSWORTH AVE+ SPAHR")).toBe("Ellsworth Ave & Spahr");
    expect(tidyName("HIGHLAND PARK TO DOWNTOWN VIA OAKLAND")).toBe("Highland Park to Downtown via Oakland");
    expect(tidyName("EAST BUSWAY-OAKLAND")).toBe("East Busway-Oakland");
    expect(tidyName("Coda on Centre")).toBe("Coda on Centre");
  });
});

describe("removeSpurs", () => {
  it("drops a short detour into a stop and keeps real turns", () => {
    const street: [number, number][] = [
      [-79.95, 40.45],
      [-79.949, 40.45],
      [-79.94895, 40.45004], // 5 m off the street to the stop…
      [-79.94899, 40.45001], // …and back
      [-79.948, 40.45],
      [-79.948, 40.451], // a real corner
    ];
    expect(removeSpurs(street)).toEqual([
      [-79.95, 40.45],
      [-79.949, 40.45],
      [-79.94899, 40.45001],
      [-79.948, 40.45],
      [-79.948, 40.451],
    ]);
  });
});

