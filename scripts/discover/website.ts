/**
 * Finds a building's own website with the Brave Search API. Results from
 * listing aggregators, directories and social sites are skipped: we want the
 * operator's site, which is where prices can be read from. A result must also
 * name the building (or, without a name, its street address) in its address,
 * so unrelated pages that merely mention it are skipped. Reviewers confirm the result,
 * and when nothing is taken they get the other results to look through.
 *
 * Brave's free plan allows one search a second, so searches go through
 * websiteFinder, which spaces them out and retries once when rate limited.
 */

const SEARCH_API = "https://api.search.brave.com/res/v1/web/search";

/** Sites that list many buildings, or that we can't use as a source. */
const AGGREGATORS =
  /(^|\.)(apartments\.com|zillow\.com|trulia\.com|hotpads\.com|realtor\.com|redfin\.com|rent\.com|rentcafe\.com|apartmentlist\.com|apartmentfinder\.com|apartmentguide\.com|forrent\.com|forrentuniversity\.com|padmapper\.com|zumper\.com|rentable\.co|veryapt\.com|uhomes\.com|craigslist\.org|yelp\.com|facebook\.com|instagram\.com|linkedin\.com|google\.com|mapquest\.com|loopnet\.com|yardimatrix\.com|wikipedia\.org|pitt\.edu|cmu\.edu|point2homes\.com|apartmentiq\.io|corporatehousing\.com|nationalcorporatehousing\.com|homes\.com|yellowpages\.com|apartmentratings\.com|apartmenthomeliving\.com|rentler\.com|waze\.com|rentals\.com|showmetherent\.com|rentberry\.com|bbb\.org|manta\.com|mapcarta\.com|nextdoor\.com|reddit\.com|skydb\.net|rentseeker\.com|propertyshark\.com|highrises\.com|rehold\.com|blockshopper\.com|emporis\.com|city-data\.com|movoto\.com|rentometer\.com|xome\.com|walkscore\.com|citysquares\.com)$/i;

/** Words in building names that don't identify a building on their own. */
const GENERIC_WORDS = new Set([
  "the", "a", "an", "at", "of", "on", "and", "apartments", "apartment", "apts", "apt", "residences",
  "residence", "lofts", "flats", "house", "hall", "place", "tower", "towers", "building", "condominiums",
  "condos", "pittsburgh", "north", "south", "east", "west", "university", "square", "court", "gardens",
  "manor", "village", "commons", "park", "plaza", "terrace", "street", "avenue",
]);

interface BraveResponse {
  web?: { results?: { url: string; title?: string }[] };
}

/** Letters and digits only, lower case: "Hampshire_hall.asp" → "hampshirehallasp". */
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The distinctive words of a building name: "The Chalfont" → ["chalfont"]. */
function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !GENERIC_WORDS.has(word));
}

const BLOG_WORDS = new Set(["blog", "blogs", "news", "story", "stories", "article", "articles"]);

/**
 * A page about the building that isn't its operator's ("/properties/4601-5th-ave/",
 * "/Hampshire_hall.asp"): a directory's, whose path names the city or state or
 * carries a long record number ("/pa/pittsburgh/69913/950-progress-st"), or a
 * blog or news post ("/blog/…", "/2015/01/29/the-parklane/").
 */
function isThirdPartyPage(pathname: string): boolean {
  if (/\/(19|20)\d\d\/\d{1,2}\//.test(pathname)) return true;
  return pathname
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some(
      (part) =>
        part === "pittsburgh" || part === "pa" || part === "pennsylvania" || BLOG_WORDS.has(part) || /^\d{5,}$/.test(part),
    );
}

/** "4628 Bayard St, Pittsburgh…" → { number: "4628", street: "bayard" }. */
function streetParts(address: string): { number: string; street: string } | null {
  const match = /^(\d+)(?:-\d+)?\s+(?:[nsew]\.?\s+)?(.+?)(?:\s+(?:st|ave|rd|blvd|dr|pl|way|ln|ct|ter|sq))?\.?(?:,|$)/i.exec(address.trim());
  return match ? { number: match[1], street: squash(match[2]) } : null;
}

export interface Building {
  name: string | null;
  address: string;
}

/**
 * The first result that isn't an aggregator and names the building. A site
 * named after the building ("chalfontapartments.com") gives its home page; a
 * page about it on an operator's site ("rentdelta.com/Hampshire_hall.asp") is kept as is.
 */
export function pickWebsite(body: BraveResponse, building: Building): string | null {
  // A name made only of common words ("University Square") is matched by its street address instead.
  const words = building.name ? nameWords(building.name) : [];
  const street = streetParts(building.address);
  for (const result of body.web?.results ?? []) {
    let url: URL;
    try {
      url = new URL(result.url);
    } catch {
      continue; // Not a URL.
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (AGGREGATORS.test(url.hostname)) continue;

    const host = squash(url.hostname.replace(/^www\./, ""));
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      pathname = url.pathname; // Malformed escapes.
    }
    const path = squash(pathname);
    if (words.length && words.some((word) => host.includes(word))) return `${url.origin}/`;
    // A page about the building, rather than a site named after it, must be on its operator's site.
    if (isThirdPartyPage(pathname)) continue;
    if (words.length) {
      if (words.some((word) => path.includes(word))) return url.toString();
    } else if (street && (host + path).includes(street.number) && (host + path).includes(street.street)) {
      return url.toString();
    }
  }
  return null;
}

class RateLimited extends Error {}

export interface WebsiteSearch {
  /** The building's own site, or null. */
  website: string | null;
  /** How many results the search returned. */
  results: number;
  /** When no site was taken: up to three results that aren't listing sites, for a reviewer to look through. */
  others: string[];
}

/** Results that aren't listing sites, one per host. */
function otherResults(body: BraveResponse, count = 3): string[] {
  const byHost = new Map<string, string>();
  for (const result of body.web?.results ?? []) {
    let url: URL;
    try {
      url = new URL(result.url);
    } catch {
      continue; // Not a URL.
    }
    if ((url.protocol === "https:" || url.protocol === "http:") && !AGGREGATORS.test(url.hostname) && !byHost.has(url.hostname)) {
      byHost.set(url.hostname, url.toString());
    }
  }
  return [...byHost.values()].slice(0, count);
}

/**
 * Searches for the building's own website. A named building is searched by
 * name alone: pages giving both its name and street address are nearly all
 * directories. One without a name, or with only common words in it
 * ("University Square"), is searched by street address, as pickWebsite matches it by that.
 */
export async function findWebsite(apiKey: string, name: string | null, address: string): Promise<WebsiteSearch> {
  const term = name && nameWords(name).length ? name : address.split(",")[0];
  const query = `"${term}" apartments Pittsburgh`;
  const response = await fetch(`${SEARCH_API}?${new URLSearchParams({ q: query, count: "10" })}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
  });
  if (response.status === 429) throw new RateLimited("Brave Search responded 429 (rate limited)");
  if (!response.ok) throw new Error(`Brave Search responded ${response.status}`);
  const body = (await response.json()) as BraveResponse;
  const website = pickWebsite(body, { name, address });
  return { website, results: body.web?.results?.length ?? 0, others: website ? [] : otherResults(body) };
}

/**
 * findWebsite with searches at least `gapMs` apart (Brave's free plan allows one
 * a second), retrying a search once if it is rate limited anyway.
 */
export function websiteFinder(
  apiKey: string,
  {
    gapMs = 1100,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
  }: { gapMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): (name: string | null, address: string) => Promise<WebsiteSearch> {
  let last = -Infinity;
  const search = async (name: string | null, address: string) => {
    const wait = last + gapMs - now();
    if (wait > 0) await sleep(wait);
    last = now();
    return findWebsite(apiKey, name, address);
  };
  return async (name, address) => {
    try {
      return await search(name, address);
    } catch (error) {
      if (!(error instanceof RateLimited)) throw error;
      await sleep(gapMs);
      return search(name, address);
    }
  };
}
