import { manual } from "./manual";
import { sightmap } from "./sightmap";
import type { PricingAdapter } from "./types";

/** Every pricing adapter, by the id listings use in `pricing.adapter`. */
export const ADAPTERS = new Map<string, PricingAdapter>([manual, sightmap].map((adapter) => [adapter.id, adapter]));
