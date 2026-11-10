import { entrataWp } from "./entrata-wp";
import { manual } from "./manual";
import { pageTextAdapter } from "./page-text";
import { sightmap } from "./sightmap";
import type { PricingAdapter } from "./types";

/** Every pricing adapter, by the id listings use in `pricing.adapter`. */
export const ADAPTERS = new Map<string, PricingAdapter>(
  [manual, sightmap, entrataWp, pageTextAdapter].map((adapter) => [adapter.id, adapter]),
);
