import { afterEach, describe, expect, it, vi } from "vitest";
import { findWebsite, pickWebsite } from "./website";

describe("pickWebsite", () => {
  it("skips aggregators and social sites", () => {
    expect(
      pickWebsite({
        web: {
          results: [
            { url: "https://www.apartments.com/the-chalfont-pittsburgh-pa/abc/" },
            { url: "https://www.facebook.com/chalfont" },
            { url: "not a url" },
            { url: "https://www.chalfontapartments.com/" },
          ],
        },
      }),
    ).toBe("https://www.chalfontapartments.com/");
  });

  it("returns null when every result is an aggregator", () => {
    expect(pickWebsite({ web: { results: [{ url: "https://www.zillow.com/b/x" }] } })).toBeNull();
    expect(pickWebsite({})).toBeNull();
  });
});

describe("findWebsite", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("searches by name and street address and sends the key", async () => {
    const fetchMock = vi.fn(async () => Response.json({ web: { results: [{ url: "https://fairfaxpgh.com/" }] } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findWebsite("key-123", "Fairfax Apartments", "4614-4630 5th Ave, Pittsburgh, PA 15213")).toBe("https://fairfaxpgh.com/");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).searchParams.get("q")).toBe('"Fairfax Apartments" "4614-4630 5th Ave" apartments Pittsburgh');
    expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("key-123");
  });
});
