import type { PricingAdapter } from "./types";

/** Prices someone checked by hand, from data/manual-prices.json. */
export const manual: PricingAdapter = {
  id: "manual",
  async read(listing, { manual: prices }) {
    const entry = prices[listing.id];
    if (!entry) throw new Error(`No entry for "${listing.id}" in data/manual-prices.json`);
    return { units: entry.units, observedAt: `${entry.verifiedOn}T00:00:00Z` };
  },
};
