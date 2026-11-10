import type { Candidate } from "@/lib/schemas";
import type { PricingAdapter } from "../refresh/pricing/types";

/**
 * Fills in what reviewers would otherwise look up by hand for this week's new
 * finds: the building's website (via search, when it isn't in OpenStreetMap)
 * and the leasing platform its site uses (so a price scraper can be suggested).
 * Failures are logged, never fatal: the reviewer can fill the gaps.
 */
export async function enrichCandidates(
  candidates: Candidate[],
  deps: {
    findWebsite?: (name: string | null, address: string) => Promise<string | null>;
    fetchHomepage: (url: string) => Promise<string>;
    adapters: PricingAdapter[];
    log?: (message: string) => void;
  },
): Promise<void> {
  const log = deps.log ?? console.warn;
  for (const candidate of candidates) {
    if (!candidate.listing.website && deps.findWebsite) {
      try {
        const website = await deps.findWebsite(candidate.listing.name ?? candidate.osm?.name ?? null, candidate.address);
        if (website) {
          candidate.listing.website = website;
          candidate.websiteSource = "search";
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
}
