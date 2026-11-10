import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import MapExplorer from "@/components/MapExplorer";
import { getApartments, getCampus } from "@/lib/apartments";

export const metadata: Metadata = {
  title: "Apartments near CMU on a map",
};

export default async function MapPage() {
  const [campus, apartments] = await Promise.all([getCampus(), getApartments()]);
  return <MapExplorer apartments={apartments} campus={campus} />;
}
