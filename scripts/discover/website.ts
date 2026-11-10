/**
 * Finds a building's own website with the Brave Search API. Results from
 * listing aggregators, directories and social sites are skipped: we want the
 * operator's site, which is where prices can be read from. A result must also
 * name the building (or, without a name, its street address) in its address,
 * so unrelated pages that merely mention it are skipped. Reviewers confirm the result.
 */

const SEARCH_API = "https://api.search.brave.com/res/v1/web/search";

/** Sites that list many buildings, or that we can't use as a source. */
const AGGREGATORS =
  /(^|\.)(apartments\.com|zillow\.com|trulia\.com|hotpads\.com|realtor\.com|redfin\.com|rent\.com|rentcafe\.com|apartmentlist\.com|apartmentfinder\.com|apartmentguide\.com|forrent\.com|forrentuniversity\.com|padmapper\.com|zumper\.com|rentable\.co|veryapt\.com|uhomes\.com|craigslist\.org|yelp\.com|facebook\.com|instagram\.com|linkedin\.com|google\.com|mapquest\.com|loopnet\.com|yardimatrix\.com|wikipedia\.org|pitt\.edu|cmu\.edu|point2homes\.com|apartmentiq\.io|corporatehousing\.com|nationalcorporatehousing\.com|homes\.com|yellowpages\.com|apartmentratings\.com|apartmenthomeliving\.com|rentler\.com|waze\.com|rentals\.com|showmetherent\.com|rentberry\.com|bbb\.org|manta\.com|mapcarta\.com|nextdoor\.com|reddit\.com)$/i;

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
    let path: string;
    try {
      path = squash(decodeURIComponent(url.pathname));
    } catch {
      path = squash(url.pathname); // Malformed escapes.
    }
    if (words.length) {
      if (words.some((word) => host.includes(word))) return `${url.origin}/`;
      if (words.some((word) => path.includes(word))) return url.toString();
    } else if (street && (host + path).includes(street.number) && (host + path).includes(street.street)) {
      return url.toString();
    }
  }
  return null;
}

/** The building's own website from a web search, or null. */
export async function findWebsite(apiKey: string, name: string | null, address: string): Promise<string | null> {
  const query = `${name ? `"${name}" ` : ""}"${address.split(",")[0]}" apartments Pittsburgh`;
  const response = await fetch(`${SEARCH_API}?${new URLSearchParams({ q: query, count: "10" })}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
  });
  if (!response.ok) throw new Error(`Brave Search responded ${response.status}`);
  return pickWebsite((await response.json()) as BraveResponse, { name, address });
}
