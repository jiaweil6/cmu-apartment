import type { Metadata } from "next";
import ApartmentMap from "@/components/ApartmentMap";
import { getApartments, getCampus } from "@/lib/apartments";
import { HERE_UI_STYLESHEET } from "@/lib/here-maps";

export const metadata: Metadata = {
  title: "Apartments near CMU on a map",
};

export default async function MapPage() {
  const [campus, apartments] = await Promise.all([getCampus(), getApartments()]);

  return (
    <div className="page">
      <link rel="stylesheet" href={HERE_UI_STYLESHEET} precedence="default" />
      <div className="page-head">
        <h1 className="map-title">Apartments near CMU on a map</h1>
        <p className="page-lede">Every apartment in the rankings, with campus for reference. Select a name to open the building&rsquo;s website.</p>
      </div>
      <ApartmentMap apiKey={process.env.NEXT_PUBLIC_HERE_API_KEY} places={[campus, ...apartments]} />
    </div>
  );
}
