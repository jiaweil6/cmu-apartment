import { describe, expect, it } from "vitest";
import { nextRegularTuesday, readCsv, zonedTime } from "./service-date";

const feed = { startDate: "20261018", endDate: "20270220", exceptionDates: new Set<string>() };

describe("nextRegularTuesday", () => {
  it("picks the first Tuesday at least two days out", () => {
    expect(nextRegularTuesday(new Date("2026-11-10T12:00:00Z"), feed)).toBe("2026-11-17"); // from a Tuesday
    expect(nextRegularTuesday(new Date("2026-11-08T12:00:00Z"), feed)).toBe("2026-11-10"); // from a Sunday
  });

  it("skips Tuesdays with service exceptions", () => {
    const withHoliday = { ...feed, exceptionDates: new Set(["20261117"]) };
    expect(nextRegularTuesday(new Date("2026-11-10T12:00:00Z"), withHoliday)).toBe("2026-11-24");
  });

  it("waits for the feed to start and fails once it has ended", () => {
    expect(nextRegularTuesday(new Date("2026-10-01T12:00:00Z"), feed)).toBe("2026-10-20");
    expect(() => nextRegularTuesday(new Date("2027-02-19T12:00:00Z"), feed)).toThrow(/No regular Tuesday/);
  });
});

describe("zonedTime", () => {
  it("applies Pittsburgh's offset for the date", () => {
    expect(zonedTime("2026-11-17", "09:00")).toBe("2026-11-17T09:00:00-05:00");
    expect(zonedTime("2027-06-15", "09:00")).toBe("2027-06-15T09:00:00-04:00");
  });
});

describe("readCsv", () => {
  it("maps rows to header names and ignores a byte-order mark", () => {
    expect(readCsv("﻿service_id,date,exception_type\r\nW,20261126,2\r\n")).toEqual([
      { service_id: "W", date: "20261126", exception_type: "2" },
    ]);
  });
});
