import routesFile from "@/data/routes.json";
import { routesFileSchema, type RoutesFile } from "./schemas";

const routes = routesFileSchema.parse(routesFile);

/** The trips behind each commute and the walking routes (data/routes.json). Only the map page loads these. */
export async function getRoutes(): Promise<RoutesFile> {
  return routes;
}
