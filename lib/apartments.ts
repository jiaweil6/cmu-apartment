import { apartments, campus } from "@/data/apartments";
import type { Apartment, Place } from "./types";

/**
 * Data access for listings. Pages and API routes read through here, so moving
 * the data into a database later only changes this file.
 */
export async function getApartments(): Promise<Apartment[]> {
  return apartments;
}

export async function getCampus(): Promise<Place> {
  return campus;
}
