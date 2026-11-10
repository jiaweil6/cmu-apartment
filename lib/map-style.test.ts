import { describe, expect, it } from "vitest";
import area from "./map-area.json";
import { MAP_BOUNDS, basemapStyle } from "./map-style";

describe("basemap style", () => {
  const style = basemapStyle("https://example.org/cmu-apartment");

  it("reads the self-hosted tiles and fonts under the site's base path", () => {
    expect(style.glyphs).toBe("https://example.org/cmu-apartment/basemap/fonts/{fontstack}/{range}.pbf");
    expect(style.sources.protomaps).toMatchObject({
      type: "vector",
      url: "pmtiles://https://example.org/cmu-apartment/basemap/pittsburgh.pmtiles",
    });
  });

  it("leaves out icon layers, which would need a sprite, and house numbers", () => {
    const ids = style.layers.map((layer) => layer.id);
    for (const hidden of ["pois", "roads_oneway", "roads_shields", "address_label"]) expect(ids).not.toContain(hidden);
    expect(ids).toContain("places_subplace"); // neighbourhood names stay
  });

  it("only uses fonts that are served", () => {
    const fonts = new Set(JSON.stringify(style.layers).match(/Noto Sans [A-Za-z]+(?: v1)?/g));
    fonts.delete("Noto Sans Devanagari"); // only for Devanagari script, which this area doesn't have
    expect([...fonts].sort()).toEqual(["Noto Sans Italic", "Noto Sans Medium", "Noto Sans Regular"]);
  });

  it("covers every listing", async () => {
    const { apartments, campus } = (await import("@/data/apartments.json")).default;
    const [west, south, east, north] = MAP_BOUNDS;
    expect(MAP_BOUNDS).toEqual(area.bbox);
    for (const { location } of [campus, ...apartments]) {
      expect(location.lng).toBeGreaterThan(west);
      expect(location.lng).toBeLessThan(east);
      expect(location.lat).toBeGreaterThan(south);
      expect(location.lat).toBeLessThan(north);
    }
  });
});
