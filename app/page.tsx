import ApartmentFinder from "@/components/ApartmentFinder";
import { getApartments } from "@/lib/apartments";

export default async function HomePage() {
  const apartments = await getApartments();
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Off-campus housing for CMU students</p>
        <h1>Find the apartment that fits your priorities</h1>
        <p className="hero-lede">
          Weigh commute, walking distance, price, rating and building age, and we&rsquo;ll rank{" "}
          {apartments.length} apartments near campus for you.
        </p>
      </section>
      <ApartmentFinder apartments={apartments} />
    </>
  );
}
