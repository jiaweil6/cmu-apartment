import { getApartments } from "@/lib/apartments";

/** GET /api/apartments: every listing as JSON. */
export async function GET() {
  return Response.json(await getApartments());
}
