import { getApartments } from "@/lib/apartments";

// Written to out/api/apartments.json at build time (static export).
export const dynamic = "force-static";

/** GET /api/apartments.json: every listing with its latest data. */
export async function GET() {
  return Response.json(await getApartments());
}
