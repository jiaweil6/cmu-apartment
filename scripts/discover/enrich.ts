import type { Candidate } from "@/lib/schemas";
import type { PricingAdapter } from "../refresh/pricing/types";
import type { WebsiteSearch } from "./website";

/** A website search that found nothing to take: what it did return, for the reviewer. */
export type SearchMiss = Pick<WebsiteSearch, "results" | "others">;

/**
 * Fills in what reviewers would otherwise look up by hand for this week's new
 * finds: the building's website (via search, when it isn't in OpenStreetMap)
 * and the leasing platform its site uses (so a price scraper can be suggested).
 * Failures are logged, never fatal: the reviewer can fill the gaps. Returns the
 * searches that found no website, by candidate key, so the PR can list their other results.
 */
export async function enrichCandidates(
  candidates: Candidate[],
  deps: {
    findWebsite?: (name: string | null, address: string) => Promise<WebsiteSearch>;
    fetchHomepage: (url: string) => Promise<string>;
    adapters: PricingAdapter[];
    log?: (message: string) => void;
  },
): Promise<Map<string, SearchMiss>> {
  const log = deps.log ?? console.warn;
  const misses = new Map<string, SearchMiss>();
  for (const candidate of candidates) {
    if (!candidate.listing.website && deps.findWebsite) {
      try {
        const { website, results, others } = await deps.findWebsite(
          candidate.listing.name ?? candidate.osm?.name ?? null,
          candidate.address,
        );
        if (website) {
          candidate.listing.website = website;
          candidate.websiteSource = "search";
        } else {
          misses.set(candidate.key, { results, others });
          log(`No website picked for ${candidate.address}: ${results} results${others.length ? `, others: ${others.join(", ")}` : ""}`);
        }
      } catch (error) {
        log(`Website search failed for ${candidate.address}: ${(error as Error).message}`);
      }
    }

    if (candidate.listing.website) {
      try {
        const html = await deps.fetchHomepage(candidate.listing.website);
        const platform = deps.adapters.find((adapter) => adapter.detect?.(html));
        if (platform) {
          candidate.detectedPlatform = platform.id;
          candidate.listing.pricing = { adapter: platform.id };
        }
      } catch (error) {
        log(`Couldn't check ${candidate.listing.website}: ${(error as Error).message}`);
      }
    }
  }
  return misses;
}
