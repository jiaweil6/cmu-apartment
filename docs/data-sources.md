# Data sources

Where each ranking input comes from, how it's licensed, and what we checked. Update this file
before adding or changing a source. A scraper may only be enabled once its row in
[Building websites](#building-websites) is approved.

## Open data

| Source | Used for | License | Access |
| --- | --- | --- | --- |
| [PRT GTFS](https://www.rideprt.org/developerresources/GTFS.zip) | Transit commute (via OpenTripPlanner) | Published by Pittsburgh Regional Transit for developers; terms page at rideprt.org/business-resources (not yet reviewed) | Direct download, about 20 MB. The current feed runs 2026-10-18 to 2027-02-20, so refresh when it changes. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via [Geofabrik](https://download.geofabrik.de/north-america/us/pennsylvania.html) | Street network for walking and transit routing, building names, websites and `start_date` | ODbL: credit "© OpenStreetMap contributors" on the site | Pennsylvania extract clipped to Pittsburgh's East End with `osmium` |
| [Protomaps](https://docs.protomaps.com/basemaps/downloads) daily build (OpenStreetMap data) | The map page's basemap: a vector-tile extract of the area in `lib/map-area.json`, self-hosted as `public/basemap/pittsburgh.pmtiles`, with Noto Sans label fonts from [basemaps-assets](https://github.com/protomaps/basemaps-assets) | ODbL for the map data; the map credits "Protomaps © OpenStreetMap" | `pmtiles extract` from `build.protomaps.com` in the "Map tiles" workflow, about 9 MB; no API key |
| [WPRDC Property Assessments](https://data.wprdc.org/dataset/property-assessments) | Discovering apartment buildings (land use, ZIP, neighborhood, tax status) | CC0 | CKAN `datastore_search_sql`, API resource `65855e14-549e-4992-b5be-d629afc676fa`, about 585k parcels |
| [WPRDC Parcel Centroids](https://data.wprdc.org/dataset/parcel-centroids-in-allegheny-county-with-geographic-identifiers) | Parcel coordinates and city neighborhood | CC0 | Resource `3fab7152-3f11-4788-8372-4c33f86ea813` (March 2025); join on `PIN` = `PARID` |

### What the county data can and can't tell us

- **Apartment land-use codes** (`USECODE`, `USEDESC`):
  - 401 "APART: 5-19 UNITS"
  - 402 "APART:20-39 UNITS"
  - 403 "APART:40+ UNITS"
  - 404 "RETL/APT'S OVER" (mixed-use with apartments over retail, e.g. Eastside Bond, Walnut on Highland)
  - 431 "OFFICE/APARTMENTS OVER"
- **Candidates within 2.5 miles of campus** (the search radius until November 2026):
  - 155 parcels coded 403 and 134 coded 402
  - 11 coded 404 and 3 coded 431 with a fair market value of at least $3M
  - Owner type: 258 corporate taxable, 26 corporate tax-exempt (likely university, public or nonprofit housing), 19 individuals.
- **Candidates within 3.5 miles** (the current radius, which adds downtown, the North Shore, Station Square and more of
  the South Side and Lawrenceville), counted November 2026:
  - 195 parcels coded 403 and 168 coded 402
  - 19 coded 404 and 4 coded 431 with a fair market value of at least $3M
  - 30 tax-exempt; 339 taxable buildings once parcels at the same address are grouped.
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
| Webster Hall | 0027M00161000A00 | 4415 Fifth Ave, the building's street address (404). The listing's address is the leasing office on N Dithridge St. |
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

## Year built for current listings

The county doesn't publish year built for large apartment buildings, so these come from public listings
and histories (researched November 2026). Their order matches the 2024 spreadsheet's newness ranks except
Bakery Living (see note). New buildings get theirs from OpenStreetMap `start_date` or the reviewer.

| Apartment | Year | Source | Note |
| --- | --- | --- | --- |
| SkyVue | 2016 | [LoopNet](https://www.loopnet.ca/Listing/3333-Forbes-Ave-Pittsburgh-PA/30026401/) | |
| One on Centre | 2018 | [Rentable](https://www.rentable.co/pittsburgh-pa/one-on-centre) | |
| The Bridge on Forbes | 2019 | [Yardi Matrix](https://www.yardimatrix.com/property-types/multifamily/pittsburgh/the-bridge-on-forbes-3423-forbes-avenue-pa-15213--171963), [Multi-Housing News](https://www.multihousingnews.com/post/jv-to-open-473-bed-pa-student-housing-community/) | Opened fall 2019 |
| Sherwood Towers | 1970 | [Apartments.com](https://apartments.com/sherwood-towers-apartments-pittsburgh-pa/97vth06) | Single source |
| Webster Hall | 1926 | [Father Pitt](https://fatherpitt.com/2014/01/16/webster-hall-2/) | Henry Hornbostel |
| Amberson Gardens | 1969 | [Apartments.com](https://www.apartments.com/profile/w2vgfbj/) | Single source |
| Essex House | 1974 | [Yardi Matrix](https://yardimatrix.com/property-types/multifamily/pittsburgh/essex-house-5701-centre-avenue-pa-15206--138286) | |
| Claybourne | 1968 | [PadMapper](https://www.padmapper.com/buildings/1434842/claybourne-apartments-at-5435-claybourne-st-pittsburgh-pa-15232) | Yardi Matrix says 1974 |
| Coda on Centre | 2018 | [McCaffery / Pittsburgh Business Times](https://www.mccafferyinc.com/news/oxford-sets-opening-date-east-liberty-residences) | |
| Industry Pittsburgh | 2023 | [Point2](https://www.point2homes.com/US/Apartment-Buildings/PA/Pittsburgh/Industry-Pittsburgh.html) | Single source |
| Walnut on Highland | 2013 | [RentCafe](https://www.rentcafe.com/apartments/pa/pittsburgh/walnut-on-highland/default.aspx) | Apartment conversion of the 1909 Highland Building |
| Eastside Bond | 2015 | [LoopNet](https://loopnet.com/Listing/6105-Spirit-St-Pittsburgh-PA/22507740) | |
| Bakery Living | 2014 | [Yardi Matrix](https://www.yardimatrix.com/property-types/multifamily/pittsburgh/bakery-living-orange-6480-living-place-pa-15206--137663) | 6480 Living Pl is the Orange building; Blue (6454) opened 2016 |
| Kenmawr | 1956 | [Apartments.com](https://apartments.com/kenmawr-apartments-pittsburgh-pa/n9b9zrp) | |
| Maxon Towers | 1966 | [CityFeet](https://www.cityfeet.com/cont/listing/6315-forbes-ave-squirrel-hill-pa-15217/cs36504434) | |
| Negley Court | 1960 | [Yardi Matrix](https://www.yardimatrix.com/property-types/multifamily/pittsburgh/negley-court-5620-5th-avenue-pa-15232--137955) | Single source |
| Camelot | 1964 | [Apartments.com](https://apartments.com/camelot-apartments-pittsburgh-pa/eks9d4q) | |

## Definitions

- **Commute:** door-to-door time from the apartment to the campus point in `data/apartments.json`, for getting to a 10 AM class: we ask OpenTripPlanner for trips arriving by 10:00 AM on the next regular Tuesday (one with no service exceptions in the GTFS feed) and take the one you'd actually catch, the latest-departing itinerary, by transit or on foot. The deadline is `ARRIVE_BY` in `lib/commute.ts`; discovery uses the same one.
- **Walking distance:** length of the shortest walking route to the same campus point, along streets and paths
  (OpenStreetMap), not a straight line.
- **Routes on the map** (`data/routes.json`): for the commute, the trip behind the commute time, with each leg's
  stops, line, headsign, scheduled times and path; for walking, the route
  the walking distance is measured on. Times are the timetable's, not live arrivals.

## Building websites

Surveyed November 2026 with `scripts/inspect-sites` (run it from the "Inspect building websites" workflow).
We only scrape where `robots.txt` allows the page and no terms forbid automated access: none of these sites
publish terms that do. Requests identify themselves (`cmu-apartment-rankings`), wait about a second between
pages on one host, and happen once a day.

| Apartment | Where prices are | Adapter |
| --- | --- | --- |
| Coda on Centre | SightMap map API (`sightmap.com/app/api/v1/…`), allowed by robots.txt | `sightmap` |
| Industry Pittsburgh | SightMap map API | `sightmap` |
| The Bridge on Forbes | Entrata floor plans at `/wp-json/theme/entrata/v1/floor-plans`; rents are per bed, multiplied by bedrooms as in 2024 | `entrata-wp` (`perBed`) |
| Kenmawr | Property page text: "1-BR from $1630" | `page-text` |
| Essex House | McQuarters Realty page: "1 Bed + 1 Bath … $1,595-$1,895" | `page-text` |
| Claybourne | McQuarters Realty page | `page-text` |
| SkyVue | Entrata site; robots.txt disallows `/wp-`, which includes its JSON | `manual` |
| Walnut on Highland, Bakery Living | RentCafe-style sites; robots.txt disallows `*.ashx`, where availability is served | `manual` |
| One on Centre, Sherwood Towers, Webster Hall, Eastside Bond, Maxon Towers, Camelot | No prices in the page or in data the page loads | `manual` |
| Amberson Gardens, Negley Court | Only an apartments.com listing, whose terms forbid scraping | `manual` |

Manual prices live in `data/manual-prices.json`; a monthly issue lists those not checked in 60 days.

### Adding a scraper for a building

1. Run the "Inspect building websites" workflow and download its report.
2. If the building uses a platform an adapter already reads (`scripts/refresh/pricing/`), set its `pricing`
   in `data/apartments.json`. For SightMap, `url` is the `sightmap.com/app/api/v1/…/sightmaps/…` request the
   site's map makes (visible in the browser's network tab).
3. Otherwise add an adapter with a recorded fixture and a test, and register it in `pricing/index.ts`.

## Website search (discovery)

When a newly discovered building has no website in OpenStreetMap, discovery asks the
[Brave Search API](https://brave.com/search/api/) (secret `BRAVE_API_KEY`; about 15 searches a week, inside
the free monthly credit). Listing aggregators and social sites are skipped, and the PR marks these websites
"from search: check it".

## Not used

- **Google Maps Platform** (Places, Routes): its terms only allow storing `place_id`, not ratings or route results, so it can't feed a stored snapshot. The map page only links to Google Maps for transit directions; nothing is fetched from Google.
- **Hosted map tiles that need a key** (HERE, Mapbox, Google): the self-hosted Protomaps extract needs no key, has no usage limits and is served with the site.
- **apartments.com, Zillow, Craigslist:** terms forbid scraping.
