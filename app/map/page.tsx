import type { Metadata } from "next";
import ApartmentMap from "@/components/ApartmentMap";
import { getApartments, getCampus } from "@/lib/apartments";
import { HERE_UI_STYLESHEET } from "@/lib/here-maps";

export const metadata: Metadata = {
  title: "Locations of Apartments Near CMU",
};

export default async function MapPage() {
  const [campus, apartments] = await Promise.all([getCampus(), getApartments()]);

  return (
    <div className="container">
      <link rel="stylesheet" href={HERE_UI_STYLESHEET} precedence="default" />
      <h1 className="map-title">Locations of Apartments Near CMU</h1>
      <div className="row justify-content-center">
        <div className="col-md-12">
          <ApartmentMap apiKey={process.env.NEXT_PUBLIC_HERE_API_KEY} places={[campus, ...apartments]} />
        </div>
      </div>
    </div>
  );
}
