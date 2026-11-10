import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import MapExplorer from "@/components/MapExplorer";
import { getApartments, getCampus } from "@/lib/apartments";
import { getRoutes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Apartments near CMU on a map",
};

export default async function MapPage() {
  const [campus, apartments, routes] = await Promise.all([getCampus(), getApartments(), getRoutes()]);
  return <MapExplorer apartments={apartments} campus={campus} routes={routes.apartments} serviceDate={routes.serviceDate} />;
}
