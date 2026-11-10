import ApartmentFinder from "@/components/ApartmentFinder";
import { getApartments, getCampus } from "@/lib/apartments";

const listFormat = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" });

/** "Shadyside, Oakland, and Squirrel Hill": most listings first, and "… and nearby" past three. */
function describeNeighborhoods(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  const ordered = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
  return ordered.length > 3 ? `${ordered.slice(0, 3).join(", ")} and nearby` : listFormat.format(ordered);
}

export default async function HomePage() {
  const [apartments, campus] = await Promise.all([getApartments(), getCampus()]);
  const neighborhoods = describeNeighborhoods(apartments.map((apartment) => apartment.neighborhood));
  return (
    <>
      <section className="hero">
        <h1>Off-campus apartments near CMU, ranked by what matters to you</h1>
        <p className="hero-lede">
          Weigh commute time, the walk to campus, rent, rating and building age. We rank {apartments.length} apartments
          in {neighborhoods} to match.
        </p>
      </section>
      <ApartmentFinder apartments={apartments} campus={campus.location} />
    </>
  );
}
