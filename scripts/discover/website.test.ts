import { afterEach, describe, expect, it, vi } from "vitest";
import { findWebsite, pickWebsite, websiteFinder } from "./website";

const results = (...urls: string[]) => ({ web: { results: urls.map((url) => ({ url })) } });

describe("pickWebsite", () => {
  const chalfont = { name: "The Chalfont", address: "4742 Centre Ave, Pittsburgh, PA 15213" };

  it("skips aggregators and social sites", () => {
    expect(
      pickWebsite(
        results(
          "https://www.apartments.com/the-chalfont-pittsburgh-pa/abc/",
          "https://www.facebook.com/chalfont",
          "not a url",
          "https://www.chalfontapartments.com/",
        ),
        chalfont,
      ),
    ).toBe("https://www.chalfontapartments.com/");
  });

  it("returns null when every result is an aggregator", () => {
    expect(pickWebsite(results("https://www.zillow.com/b/x"), chalfont)).toBeNull();
    expect(pickWebsite({}, chalfont)).toBeNull();
  });

  // The picks from the first run with a Brave key: directories, a map and a news page.
  it.each([
    ["University Square", "4601 5th Ave, Pittsburgh, PA 15213", "https://www.yellowpages.com/pittsburgh-pa/mip/university-square-apts-no-2-8662181"],
    ["Webster Hall", "125 N Dithridge St, Pittsburgh, PA 15213", "https://www.waze.com/live-map/directions/us/pa/pittsburgh/webster-hall-parking-garage?to=place.x"],
    ["Bates Hill Apaertments", "3812 Bates St, Pittsburgh, PA 15213", "https://thevantageai.com/radio/incident/3498748/"],
    ["The Bristol", "154 N Bellefield Ave, Pittsburgh, PA 15213", "https://www.apartmentratings.com/pa/pittsburgh/bristol-apartments_412682912815213/"],
    ["Schenley House", "151-155 N Craig St, Pittsburgh, PA 15213", "https://www.apartmenthomeliving.com/apartment-finder/Schenley-House-Pittsburgh-PA-15213-1971905"],
    [null, "4628 Bayard St, Pittsburgh, PA 15213", "https://www.homes.com/property/aberdeen-apartments-pittsburgh-pa/hrnbhzhhm05he/"],
    [null, "240 Melwood Ave, Pittsburgh, PA 15213", "https://www.rentler.com/places-for-rent/pa/pittsburgh/240-melwood-ave/11961518"],
    ["The Colonnade", "259 Melwood Ave, Pittsburgh, PA 15213", "https://www.homes.com/pittsburgh-pa/north-oakland-neighborhood/homes-for-rent/"],
  ])("skips a directory or unrelated page for %s", (name, address, url) => {
    expect(pickWebsite(results(url), { name, address })).toBeNull();
  });

  // The second run's picks. The hosts are listed now, but the pages are caught by their
  // paths too (city, state or a record number), so the next directory is skipped as well.
  it.each([
    ["The Parklane", "5700 Bunkerhill St, Pittsburgh, PA 15206", "https://www.skydb.net/building/568649895/the-parklane/"],
    [null, "950 Progress St, Pittsburgh, PA 15212", "https://www.rentseeker.com/rent/apartment/pennsylvania/pittsburgh/69913/950-progress-st"],
    [null, "1810-1888 Parkview Blvd, Pittsburgh, PA 15217", "https://www.propertyshark.com/mason/Property/124559398/1810-1888-Parkview-Blvd-Pittsburgh-PA-15217/"],
    [null, "429 Forbes Ave, Pittsburgh, PA 15219", "https://www.highrises.com/rentals/details/429-Forbes-Ave_Pittsburgh_PA_15219_M97220-27203"],
    [null, "1315 Bluff St, Pittsburgh, PA 15282", "https://rehold.com/Pittsburgh+PA/BLUFF+ST/1315"],
  ])("skips the listing-site page for %s", (name, address, url) => {
    expect(pickWebsite(results(url), { name, address })).toBeNull();
    const elsewhere = url.replace(/^https:\/\/[^/]+/, "https://some-new-directory.com");
    expect(pickWebsite(results(elsewhere), { name, address })).toBeNull();
  });

  it("still takes a site named after the building, whatever its path", () => {
    expect(
      pickWebsite(results("https://www.theparklane.com/pittsburgh-pa/floor-plans/"), {
        name: "The Parklane",
        address: "5700 Bunkerhill St, Pittsburgh, PA 15206",
      }),
    ).toBe("https://www.theparklane.com/");
  });

  it("moves on to the next result after a directory page", () => {
    expect(
      pickWebsite(
        results("https://www.example-listings.com/pa/pittsburgh/950-progress-st", "https://www.mozartrents.com/properties/950-progress-st/"),
        { name: null, address: "950 Progress St, Pittsburgh, PA 15212" },
      ),
    ).toBe("https://www.mozartrents.com/properties/950-progress-st/");
  });

  it("gives the home page of a site named after the building", () => {
    expect(
      pickWebsite(results("https://cathedralmansions.com/contact-us/"), {
        name: "Cathedral Mansions",
        address: "4716 Ellsworth Ave, Pittsburgh, PA 15213",
      }),
    ).toBe("https://cathedralmansions.com/");
  });

  it("keeps a page about the building on its operator's site", () => {
    expect(
      pickWebsite(results("http://www.rentdelta.com/Hampshire_hall.asp"), {
        name: "Hampshire Hall",
        address: "4730 Centre Ave, Pittsburgh, PA 15213",
      }),
    ).toBe("http://www.rentdelta.com/Hampshire_hall.asp");
  });

  it("skips pages that don't name the building", () => {
    expect(
      pickWebsite(results("https://www.pghcitypaper.com/news/rent-is-rising/", "https://www.chalfontapartments.com/"), chalfont),
    ).toBe("https://www.chalfontapartments.com/");
  });

  it("matches by street address when there is no distinctive name", () => {
    const building = { name: "University Square", address: "4601 5th Ave, Pittsburgh, PA 15213" };
    expect(pickWebsite(results("https://www.universityrealty.com/"), building)).toBeNull();
    expect(pickWebsite(results("https://www.mozartrents.com/properties/4601-5th-ave/"), building)).toBe(
      "https://www.mozartrents.com/properties/4601-5th-ave/",
    );
    expect(
      pickWebsite(results("https://www.kampmanagement.com/bayard-4628"), { name: null, address: "4628 Bayard St, Pittsburgh, PA 15213" }),
    ).toBe("https://www.kampmanagement.com/bayard-4628");
    expect(
      pickWebsite(results("https://example.com/151-craig-street"), { name: null, address: "151-155 N Craig St, Pittsburgh, PA 15213" }),
    ).toBe("https://example.com/151-craig-street");
  });
});

describe("findWebsite", () => {
  afterEach(() => vi.unstubAllGlobals());

  const query = (fetchMock: ReturnType<typeof vi.fn>) =>
    new URL((fetchMock.mock.calls[0] as unknown as [string])[0]).searchParams.get("q");

  it("searches a named building by its name alone and sends the key", async () => {
    const fetchMock = vi.fn(async () => Response.json(results("https://fairfaxpgh.com/")));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.fn();
    expect(await findWebsite("key-123", "Fairfax Apartments", "4614-4630 5th Ave, Pittsburgh, PA 15213", log)).toBe(
      "https://fairfaxpgh.com/",
    );
    expect(query(fetchMock)).toBe('"Fairfax Apartments" apartments Pittsburgh');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("key-123");
    expect(log).not.toHaveBeenCalled();
  });

  it("searches a building without a name by its street address", async () => {
    const fetchMock = vi.fn(async () => Response.json(results("https://www.mozartrents.com/properties/950-progress-st/")));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findWebsite("key", null, "950 Progress St, Pittsburgh, PA 15212", vi.fn())).toBe(
      "https://www.mozartrents.com/properties/950-progress-st/",
    );
    expect(query(fetchMock)).toBe('"950 Progress St" apartments Pittsburgh');
  });

  it("searches a name made only of common words by street address", async () => {
    const fetchMock = vi.fn(async () => Response.json(results("https://www.mozartrents.com/properties/4601-5th-ave/")));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findWebsite("key", "University Square", "4601 5th Ave, Pittsburgh, PA 15213", vi.fn())).toBe(
      "https://www.mozartrents.com/properties/4601-5th-ave/",
    );
    expect(query(fetchMock)).toBe('"4601 5th Ave" apartments Pittsburgh');
  });

  it("logs which sites came back when none of them is the building's", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          results(
            "https://www.apartments.com/hot-metal-flats-pittsburgh-pa/abc/",
            "https://www.apartments.com/other/",
            "https://www.pghcitypaper.com/news/south-side/",
            "not a url",
          ),
        ),
      ),
    );
    const log = vi.fn();
    expect(await findWebsite("key", "Hot Metal Flats", "2915 Sidney St, Pittsburgh, PA 15203", log)).toBeNull();
    expect(log).toHaveBeenCalledWith(
      "No website picked for 2915 Sidney St, Pittsburgh, PA 15203: results from apartments.com, pghcitypaper.com",
    );
  });

  it("logs a search with no results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    const log = vi.fn();
    expect(await findWebsite("key", "Lot 24", "2404 Railroad St, Pittsburgh, PA 15222", log)).toBeNull();
    expect(log).toHaveBeenCalledWith("No website picked for 2404 Railroad St, Pittsburgh, PA 15222: no results");
  });
});

describe("websiteFinder", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A clock that only moves when the finder sleeps. */
  function fakeClock() {
    let time = 0;
    const waits: number[] = [];
    return {
      now: () => time,
      sleep: async (ms: number) => {
        waits.push(ms);
        time += ms;
      },
      waits,
    };
  }

  it("spaces searches out to stay under the rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(results("https://fairfaxpgh.com/"))));
    const clock = fakeClock();
    const find = websiteFinder("key", { gapMs: 1100, ...clock, log: vi.fn() });
    await find("Fairfax Apartments", "4614 5th Ave, Pittsburgh, PA 15213");
    await find("Fairfax Apartments", "4614 5th Ave, Pittsburgh, PA 15213");
    expect(clock.waits).toEqual([1100]);
  });

  it("retries once when rate limited, then reports a second refusal", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(Response.json(results("https://fairfaxpgh.com/")))
      .mockResolvedValue(new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const find = websiteFinder("key", { ...fakeClock(), log: vi.fn() });
    expect(await find("Fairfax Apartments", "4614 5th Ave, Pittsburgh, PA 15213")).toBe("https://fairfaxpgh.com/");
    await expect(find("Fairfax Apartments", "4614 5th Ave, Pittsburgh, PA 15213")).rejects.toThrow("429");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("doesn't retry other errors", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(websiteFinder("bad-key", fakeClock())("X", "1 Main St")).rejects.toThrow("401");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
