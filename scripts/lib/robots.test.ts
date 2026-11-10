import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttp, RobotsDisallowedError } from "./http";
import { isAllowed, parseRobots } from "./robots";

const robots = `
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /wp-
Disallow: *?lightbox=
Allow: /wp-json/
Disallow: /private$
`;

describe("robots.txt", () => {
  const rules = parseRobots(robots);

  it("reads only the rules for every crawler", () => {
    expect(rules.disallow).toEqual(["/wp-", "*?lightbox=", "/private$"]);
    expect(rules.allow).toEqual(["/wp-json/"]);
  });

  it("lets the longest matching rule win", () => {
    expect(isAllowed(rules, "https://x.com/wp-admin/")).toBe(false);
    expect(isAllowed(rules, "https://x.com/wp-json/theme/v1/floor-plans")).toBe(true);
    expect(isAllowed(rules, "https://x.com/floorplans/")).toBe(true);
  });

  it("supports wildcards and end anchors", () => {
    expect(isAllowed(rules, "https://x.com/gallery?lightbox=1")).toBe(false);
    expect(isAllowed(rules, "https://x.com/private")).toBe(false);
    expect(isAllowed(rules, "https://x.com/private/page")).toBe(true);
  });
});

describe("createHttp", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refuses URLs robots.txt disallows, without fetching them", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/robots.txt") ? new Response("User-agent: *\nDisallow: /private") : new Response("page"),
    );
    vi.stubGlobal("fetch", fetchMock);
    const http = createHttp({ minIntervalMs: 0 });
    await expect(http.text("https://x.com/private/rents")).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(await http.text("https://x.com/floorplans")).toBe("page");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://x.com/robots.txt", "https://x.com/floorplans"]);
  });

  it("retries server errors but not client errors", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
        if (url.endsWith("/flaky")) return ++calls < 2 ? new Response("", { status: 503 }) : Response.json({ ok: true });
        return new Response("", { status: 404 });
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1000 });
    const http = createHttp({ minIntervalMs: 0 });
    await expect(http.json("https://x.com/flaky")).resolves.toEqual({ ok: true });
    await expect(http.text("https://x.com/missing")).rejects.toThrow(/responded 404/);
    vi.useRealTimers();
  });
});
