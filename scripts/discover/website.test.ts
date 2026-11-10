import { afterEach, describe, expect, it, vi } from "vitest";
import { findWebsite, pickWebsite } from "./website";

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

  it("searches by name and street address and sends the key", async () => {
    const fetchMock = vi.fn(async () => Response.json(results("https://fairfaxpgh.com/")));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findWebsite("key-123", "Fairfax Apartments", "4614-4630 5th Ave, Pittsburgh, PA 15213")).toBe("https://fairfaxpgh.com/");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).searchParams.get("q")).toBe('"Fairfax Apartments" "4614-4630 5th Ave" apartments Pittsburgh');
    expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("key-123");
  });
});
