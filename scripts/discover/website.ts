/**
 * Finds a building's own website with the Brave Search API. Results from
 * listing aggregators, directories and social sites are skipped: we want the
 * operator's site, which is where prices can be read from. A result must also
 * name the building (or, without a name, its street address) in its address,
 * so unrelated pages that merely mention it are skipped. Reviewers confirm the result.
 *
 * Brave's free plan allows one search a second, so searches go through
 * websiteFinder, which spaces them out and retries once when rate limited.
 */

const SEARCH_API = "https://api.search.brave.com/res/v1/web/search";

/** Sites that list many buildings, or that we can't use as a source. */
const AGGREGATORS =
  /(^|\.)(apartments\.com|zillow\.com|trulia\.com|hotpads\.com|realtor\.com|redfin\.com|rent\.com|rentcafe\.com|apartmentlist\.com|apartmentfinder\.com|apartmentguide\.com|forrent\.com|forrentuniversity\.com|padmapper\.com|zumper\.com|rentable\.co|veryapt\.com|uhomes\.com|craigslist\.org|yelp\.com|facebook\.com|instagram\.com|linkedin\.com|google\.com|mapquest\.com|loopnet\.com|yardimatrix\.com|wikipedia\.org|pitt\.edu|cmu\.edu|point2homes\.com|apartmentiq\.io|corporatehousing\.com|nationalcorporatehousing\.com|homes\.com|yellowpages\.com|apartmentratings\.com|apartmenthomeliving\.com|rentler\.com|waze\.com|rentals\.com|showmetherent\.com|rentberry\.com|bbb\.org|manta\.com|mapcarta\.com|nextdoor\.com|reddit\.com|skydb\.net|rentseeker\.com|propertyshark\.com|highrises\.com|rehold\.com|blockshopper\.com|emporis\.com|city-data\.com|movoto\.com|rentometer\.com)$/i;

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

/**
 * A path that names the city or state, or carries a long record number, is a
 * directory's page about the building ("/pa/pittsburgh/69913/950-progress-st"),
 * not its operator's ("/properties/4601-5th-ave/", "/Hampshire_hall.asp").
 */
function looksLikeDirectory(pathname: string): boolean {
  return pathname
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((part) => part === "pittsburgh" || part === "pa" || part === "pennsylvania" || /^\d{5,}$/.test(part));
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
    if (looksLikeDirectory(pathname)) continue;
    if (words.length) {
      if (words.some((word) => path.includes(word))) return url.toString();
    } else if (street && (host + path).includes(street.number) && (host + path).includes(street.street)) {
      return url.toString();
    }
  }
  return null;
}

class RateLimited extends Error {}

/** The hosts of a search's first results, for the log: "hotmetalflats.com, apartments.com". */
function resultHosts(body: BraveResponse, count = 5): string {
  const hosts = new Set<string>();
  for (const result of body.web?.results ?? []) {
    try {
      hosts.add(new URL(result.url).hostname.replace(/^www\./, ""));
    } catch {
      // Not a URL.
    }
  }
  return [...hosts].slice(0, count).join(", ");
}

/**
 * The building's own website from a web search, or null. A named building is
 * searched by name alone: pages giving both its name and street address are
 * nearly all directories. One without a name, or with only common words in it
 * ("University Square"), is searched by street address, as pickWebsite matches it by that.
 */
export async function findWebsite(
  apiKey: string,
  name: string | null,
  address: string,
  log: (message: string) => void = console.warn,
): Promise<string | null> {
  const term = name && nameWords(name).length ? name : address.split(",")[0];
  const query = `"${term}" apartments Pittsburgh`;
  const response = await fetch(`${SEARCH_API}?${new URLSearchParams({ q: query, count: "10" })}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
  });
  if (response.status === 429) throw new RateLimited("Brave Search responded 429 (rate limited)");
  if (!response.ok) throw new Error(`Brave Search responded ${response.status}`);
  const body = (await response.json()) as BraveResponse;
  const website = pickWebsite(body, { name, address });
  if (!website) {
    const hosts = resultHosts(body);
    log(`No website picked for ${address}: ${hosts ? `results from ${hosts}` : "no results"}`);
  }
  return website;
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
    log,
  }: { gapMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number; log?: (message: string) => void } = {},
): (name: string | null, address: string) => Promise<string | null> {
  let last = -Infinity;
  const search = async (name: string | null, address: string) => {
    const wait = last + gapMs - now();
    if (wait > 0) await sleep(wait);
    last = now();
    return findWebsite(apiKey, name, address, log);
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
