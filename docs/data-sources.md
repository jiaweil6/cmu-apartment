# Data sources

Where each ranking input comes from, how it's licensed, and what we checked. Update this file
before adding or changing a source. A scraper may only be enabled once its row in
[Building websites](#building-websites) is approved.

## Open data

| Source | Used for | License | Access |
| --- | --- | --- | --- |
| [PRT GTFS](https://www.rideprt.org/developerresources/GTFS.zip) | Transit commute (via OpenTripPlanner) | Published by Pittsburgh Regional Transit for developers; terms page at rideprt.org/business-resources (not yet reviewed) | Direct download, about 20 MB. The current feed runs 2026-10-18 to 2027-02-20, so refresh when it changes. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via [Geofabrik](https://download.geofabrik.de/north-america/us/pennsylvania.html) | Street network for walking and transit routing, building names, websites and `start_date` | ODbL: credit "© OpenStreetMap contributors" on the site | Pennsylvania extract clipped to Pittsburgh's East End with `osmium` |
| [WPRDC Property Assessments](https://data.wprdc.org/dataset/property-assessments) | Discovering apartment buildings (land use, ZIP, neighborhood, tax status) | CC0 | CKAN `datastore_search_sql`, API resource `65855e14-549e-4992-b5be-d629afc676fa`, about 585k parcels |
| [WPRDC Parcel Centroids](https://data.wprdc.org/dataset/parcel-centroids-in-allegheny-county-with-geographic-identifiers) | Parcel coordinates and city neighborhood | CC0 | Resource `3fab7152-3f11-4788-8372-4c33f86ea813` (March 2025); join on `PIN` = `PARID` |

### What the county data can and can't tell us

- **Apartment land-use codes** (`USECODE`, `USEDESC`):
  - 401 "APART: 5-19 UNITS"
  - 402 "APART:20-39 UNITS"
  - 403 "APART:40+ UNITS"
  - 404 "RETL/APT'S OVER" (mixed-use with apartments over retail, e.g. Eastside Bond, Walnut on Highland)
  - 431 "OFFICE/APARTMENTS OVER"
- **Candidates within 2.5 miles of campus:**
  - 155 parcels coded 403 and 134 coded 402
  - 11 coded 404 and 3 coded 431 with a fair market value of at least $3M
  - Owner type: 258 corporate taxable, 26 corporate tax-exempt (likely university, public or nonprofit housing), 19 individuals.
- **Year built is not available for these buildings.** `YEARBLT` is filled for 0 of 594 parcels coded 403 countywide, and for under 2% of the other apartment codes. The county only publishes building characteristics for residential dwellings. Year built is therefore entered once per building, with OSM `start_date` or city permits as hints. It never needs refreshing.
- **No owner names** are published, only `OWNERDESC` (corporation, regular, and so on) and `TAXDESC` (taxable or exempt).

## Parcel IDs for current listings

Matched in November 2026 by exact address, or by a parcel centroid within 15 m where noted.
Several buildings span more than one parcel; only the residential ones are listed.

| Apartment | Parcel IDs | How matched |
| --- | --- | --- |
| SkyVue | 0028J00097000200 | Address (403) |
| One on Centre | 0027D00060000000 | Address (403) |
| The Bridge on Forbes | (none yet) | No apartment-coded parcel near the address. Needs a manual lookup. |
| Sherwood Towers | 0027D00190000000 | Address (403) |
| Webster Hall | (none yet) | Address not found. Needs a manual lookup. |
| Amberson Gardens | 0051P00300000000 | Address (403) |
| Essex House | 0051H00308000000 | Address (403) |
| Claybourne | 0051M00223000000 | Address (403) |
| Coda on Centre | 0084E00266000000 | Address (403) |
| Industry Pittsburgh | 0084E00262000000 | Centroid 15 m away (5809 Centre Ave, 403) |
| Walnut on Highland | 0084B00068000000, 0084B00078000000 | Address (403 and 404) |
| Eastside Bond | 0084B00080000000 | Centroid 13 m away (5993 Centre Ave, 404) |
| Bakery Living | 0084M00206000A00 | Address (403) |
| Kenmawr | 0084L00192000000 | Address (403) |
| Maxon Towers | 0086H00069000000, 0086H00071000000, 0086H00074000000 | Address (403) |
| Negley Court | (none yet) | Address not found; nearby parcels are other buildings. Needs a manual lookup. |
| Camelot | 0027D00061000000 | Address (402) |

## Definitions

- **Commute:** fastest door-to-door trip (transit or walking) from the apartment to the campus point in `data/apartments.json`. It is the median of trips arriving by 8:30, 9:00 and 9:30 AM on the next regular Tuesday (one with no service exceptions in the GTFS feed).
- **Walking distance:** length of the shortest walking route to the same campus point.

## Building websites

To be filled in before Phase 2 (price scrapers). For each building, record:
- the platform (RentCafe, Entrata, SightMap, RealPage, plain HTML)
- where prices appear (server HTML or a JSON request)
- `robots.txt` and terms-of-use status
- the adapter, and whether it's approved

apartments.com and Craigslist are never scraped: their terms forbid it. Amberson Gardens and Negley Court currently link to apartments.com, so they need their operator's own site or manual prices.

## Not used

- **Google Maps Platform** (Places, Routes): its terms only allow storing `place_id`, not ratings or route results, so it can't feed a stored snapshot.
- **apartments.com, Zillow, Craigslist:** terms forbid scraping.
