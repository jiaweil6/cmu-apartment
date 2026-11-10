import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nextMonthDay, readEntrata } from "./entrata-wp";
import { readPageText } from "./page-text";

const fixture = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

describe("Entrata (WordPress theme) adapter", () => {
  const body = JSON.parse(fixture("entrata-bridge.json"));

  it("turns per-bed rates into apartment prices and counts open units", () => {
    const rooms = readEntrata(body, { perBed: true, today: "2026-11-10" });
    expect(rooms.threeBedroom).toEqual({ status: "available", minPrice: 1499 * 3, available: 4, availableFrom: "2027-06-17" });
    expect(rooms.twoBedroom).toEqual({ status: "waitlist", minPrice: 1819 * 2, available: 0, availableFrom: null });
    expect(rooms.studio).toMatchObject({ status: "waitlist", minPrice: 1979 });
  });

  it("leaves per-unit rates alone without perBed", () => {
    expect(readEntrata(body, { perBed: false, today: "2026-11-10" }).threeBedroom?.minPrice).toBe(1499);
  });

  it("finds the next occurrence of a month/day move-in", () => {
    expect(nextMonthDay("8/1", "2026-11-10")).toBe("2027-08-01");
    expect(nextMonthDay("12/24", "2026-11-10")).toBe("2026-12-24");
    expect(nextMonthDay("soon", "2026-11-10")).toBeNull();
  });
});

describe("page-text adapter", () => {
  it('reads "N-BR from $X" lists', () => {
    expect(readPageText(fixture("page-kenmawr.html"))).toEqual({
      oneBedroom: { status: "available", minPrice: 1630, available: null, availableFrom: null },
      twoBedroom: { status: "available", minPrice: 1940, available: null, availableFrom: null },
      threeBedroom: { status: "available", minPrice: 2645, available: null, availableFrom: null },
    });
  });

  it('reads "N Bed … $low-$high" cards, keeping the low end', () => {
    const rooms = readPageText(fixture("page-essex.html"));
    expect(rooms.oneBedroom?.minPrice).toBe(1595);
    expect(rooms.twoBedroom?.minPrice).toBe(2050);
    expect(rooms.studio).toBeUndefined();
  });

  it("ignores amounts that don't follow a room type", () => {
    expect(readPageText("<p>Application fee $50. Parking $1,200 per year.</p><p>Studio from $1,450</p>")).toEqual({
      studio: { status: "available", minPrice: 1450, available: null, availableFrom: null },
    });
  });
});
