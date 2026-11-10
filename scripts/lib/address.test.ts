import { describe, expect, it } from "vitest";
import { parseAddress, sameAddress, titleCase } from "./address";

describe("parseAddress", () => {
  it("normalizes street words, ranges and unit suffixes", () => {
    expect(parseAddress("4614-4630 Fifth Avenue, Pittsburgh, PA 15213")).toEqual({ low: 4614, high: 4630, street: "5TH AVE" });
    expect(parseAddress("101 N Dithridge St Suite 130, Pittsburgh")).toEqual({ low: 101, high: 101, street: "N DITHRIDGE ST" });
    expect(parseAddress("6315 Forbes Ave l100, Pittsburgh, PA 15217")).toEqual({ low: 6315, high: 6315, street: "FORBES AVE" });
    expect(parseAddress("230 North Craig Street")).toEqual({ low: 230, high: 230, street: "N CRAIG ST" });
  });

  it("returns null without a house number", () => {
    expect(parseAddress("Kenmawr Apartments, 401 Shady Ave")).toBeNull();
  });
});

describe("sameAddress", () => {
  it("matches a number inside a range on the same street", () => {
    expect(sameAddress(parseAddress("4620 5th Ave"), parseAddress("4614-4630 FIFTH AVE"))).toBe(true);
    expect(sameAddress(parseAddress("4631 5th Ave"), parseAddress("4614-4630 FIFTH AVE"))).toBe(false);
    expect(sameAddress(parseAddress("4620 Centre Ave"), parseAddress("4620 5th Ave"))).toBe(false);
  });
});

describe("titleCase", () => {
  it("keeps ordinals lowercase", () => {
    expect(titleCase("4614-4630 5TH AVE")).toBe("4614-4630 5th Ave");
    expect(titleCase("135 N CRAIG ST")).toBe("135 N Craig St");
  });
});
