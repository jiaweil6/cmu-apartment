import { describe, expect, it } from "vitest";
import { ARRIVE_BY, arriveByLabel } from "./commute";

describe("arriveByLabel", () => {
  it("labels the commute deadline for page text", () => {
    expect(ARRIVE_BY).toBe("10:00");
    expect(arriveByLabel()).toBe("10 AM");
    expect(arriveByLabel("09:30")).toBe("9:30 AM");
    expect(arriveByLabel("12:00")).toBe("12 PM");
  });
});
