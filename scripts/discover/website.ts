/**
 * Finds a building's own website with the Brave Search API. Results from
 * listing aggregators and social sites are skipped: we want the operator's
 * site, which is where prices can be read from. Reviewers confirm the result.
 */

const SEARCH_API = "https://api.search.brave.com/res/v1/web/search";

/** Sites that list many buildings, or that we can't use as a source. */
const AGGREGATORS =
  /(^|\.)(apartments\.com|zillow\.com|trulia\.com|hotpads\.com|realtor\.com|redfin\.com|rent\.com|rentcafe\.com|apartmentlist\.com|apartmentfinder\.com|apartmentguide\.com|forrent\.com|forrentuniversity\.com|padmapper\.com|zumper\.com|rentable\.co|veryapt\.com|uhomes\.com|craigslist\.org|yelp\.com|facebook\.com|instagram\.com|linkedin\.com|google\.com|mapquest\.com|loopnet\.com|yardimatrix\.com|wikipedia\.org|pitt\.edu|cmu\.edu|point2homes\.com|apartmentiq\.io|corporatehousing\.com|nationalcorporatehousing\.com)$/i;

interface BraveResponse {
  web?: { results?: { url: string; title?: string }[] };
}

export function pickWebsite(body: BraveResponse): string | null {
  for (const result of body.web?.results ?? []) {
    try {
      const url = new URL(result.url);
      if (url.protocol === "https:" || url.protocol === "http:") {
        if (!AGGREGATORS.test(url.hostname)) return url.toString();
      }
    } catch {
      // Not a URL; skip.
    }
  }
  return null;
}

/** The first non-aggregator result for the building, or null. */
export async function findWebsite(apiKey: string, name: string | null, address: string): Promise<string | null> {
  const query = `${name ? `"${name}" ` : ""}"${address.split(",")[0]}" apartments Pittsburgh`;
  const response = await fetch(`${SEARCH_API}?${new URLSearchParams({ q: query, count: "10" })}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
  });
  if (!response.ok) throw new Error(`Brave Search responded ${response.status}`);
  return pickWebsite((await response.json()) as BraveResponse);
}
