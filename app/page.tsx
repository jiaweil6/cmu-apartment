import ApartmentFinder from "@/components/ApartmentFinder";
import { getApartments } from "@/lib/apartments";

export default async function HomePage() {
  const apartments = await getApartments();
  return <ApartmentFinder apartments={apartments} />;
}
