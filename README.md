# CMU Apartment Ranking

A personalized apartment recommendation site for CMU students too busy for a detailed apartment search.
Set how much you care about a quick commute, distance to campus, price, rating and building age, filter by
room type, neighborhood, amenities and current openings, and the site ranks off-campus apartments to match.
Prices, availability, commute times and the list of buildings keep themselves up to date.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript, exported as a static site
- Hosted on GitHub Pages, deployed by GitHub Actions
- Plain CSS in `app/globals.css`, with colour and spacing tokens at the top (text colours meet WCAG AA contrast)
- [MapLibre GL JS](https://maplibre.org) for the `/map` page, on a self-hosted [Protomaps](https://protomaps.com) basemap of
  OpenStreetMap data (no API key)
- [Vitest](https://vitest.dev) for unit tests

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run dev   # http://localhost:3000
```

No API keys are needed. The map's tiles and fonts are committed in `public/basemap/` (see
[The map](#the-map)).

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Static export to `out/` |
| `npm test` | Run unit tests once (`test:watch` to watch) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run refresh -- --only prices` | Update prices and availability (add `--dry-run` to only print) |
| `npm run refresh -- --only transit --gtfs-dir …` | Update commute and walking distance (needs OpenTripPlanner) |
| `npm run discover` | Look for new apartment buildings |
| `npm run candidates:promote` | Apply review decisions in `data/candidates.json` |
| `npm run manual-prices:check` | List hand-entered prices older than 60 days |

## Repository setup (once)

1. **Settings → Pages → Source:** GitHub Actions.
2. **Settings → Actions → General → Workflow permissions:** Read and write, and allow GitHub Actions to create
   and approve pull requests.
3. **Settings → Secrets and variables → Actions:** secret `BRAVE_API_KEY` (optional), which lets discovery look up
   websites for new buildings.
4. **Settings → General → Features → Issues:** on. Failing data jobs open a "Data job failing" issue and the monthly
   reminder lists stale hand-entered prices in one; with Issues off, both go to the run's summary instead.
5. Branch protection on `main`, if added later, must let `github-actions[bot]` push: data refreshes commit there.

## Project layout

```
app/
  layout.tsx                    Root layout: fonts, header and navigation, global styles, data credits
  page.tsx                      Ranking page (server component, loads data)
  map/page.tsx                  Map of every apartment (components/MapExplorer.tsx)
  api/apartments.json/route.ts  /api/apartments.json: every listing with its latest data
  globals.css                   Site styles
components/                     UI; ApartmentFinder holds the ranking page's state, icons.tsx the inline icons
lib/
  ranking.ts                    Scoring, filtering and ranking (pure functions, tested)
  apartments.ts                 Data access: merges listings with the latest snapshot
  schemas.ts                    zod schemas for every data file
  options.ts                    Slider, select and filter options shown in the UI
  map-style.ts, map-area.json   The map's basemap style and the area its tiles cover
public/basemap/                 Self-hosted map tiles (PMTiles) and label fonts, built by the "Map tiles" workflow
data/
  apartments.json               Listing details, reviewed by hand (including how each one's prices are read)
  snapshot.json                 Values fetched on a schedule: prices, availability, commute, walking distance
  routes.json                   The trips behind each commute and the walking routes, for the map
  manual-prices.json            Prices checked by hand, for buildings that can't be scraped
  candidates.json, rejected.json  Discovery's review queue and the buildings turned down
scripts/
  refresh/                      Price and transit refreshes; pricing/ holds one adapter per leasing platform
  discover/                     Finding new buildings
  candidates/                   Applying review decisions
  inspect-sites/                Website survey used to write price scrapers
.github/workflows/              Deploy, data refreshes, discovery (see below)
docs/data-sources.md            Every data source, its license, and what we checked
```

## How ranking works

Each apartment gets a 0–1 score per criterion, where 1 is best: its rank among all listings, so the best
gets 1 and the worst 1/n. Scores come from raw values: rent for the selected room type, commute minutes,
walking miles and year built. Ratings still use the scores carried over from the original 2024 spreadsheet
(student reviews are planned). An apartment missing a value gets the median. The total is the sum of the
scores weighted by the slider positions.

## Data pipeline

Fetched values live in `data/snapshot.json`, separate from the hand-reviewed listing details. Scheduled
workflows refresh them. Each run tests and builds the site with the new data; clean results commit to `main`
and redeploy, while suspicious ones (a price swing over 40%, a building suddenly offering nothing, big commute
changes) open a pull request instead. A value that fails to refresh keeps its previous value, and a job that
fails opens a "Data job failing" issue that closes itself on the next success.

| Workflow | When | What it does |
| --- | --- | --- |
| `deploy.yml` | Push to `main`, or started by a data job | Builds the static site and publishes it to GitHub Pages |
| `refresh-prices.yml` | Daily | Rents and availability, through each building's pricing adapter |
| `refresh-transit.yml` | Mondays | Commute to campus (door-to-door time of the trip that gets you there by 10 AM, for a 10 AM class, on the next regular Tuesday) and walking distance, routed with [OpenTripPlanner](https://www.opentripplanner.org/) on PRT's GTFS feed and OpenStreetMap. The trips themselves (each walk and ride, with stops and paths) go to `data/routes.json` for the map |
| `discover.yml` | Wednesdays | New apartment buildings near campus, as a "Weekly apartment finds" PR |
| `promote-candidates.yml` | After a finds PR merges | Lists approved buildings, remembers rejected ones |
| `manual-prices-reminder.yml` | Monthly | Keeps an issue listing hand-entered prices over 60 days old |
| `inspect-sites.yml` | On demand | Surveys listing websites to help write a price scraper |
| `map-tiles.yml` | When `lib/map-area.json` changes, or on demand | Rebuilds the map's basemap from the latest OpenStreetMap data |
| `ci.yml` | Every push | Lint, typecheck, tests, build |

### Prices

Each listing's `pricing` in `data/apartments.json` names an adapter in `scripts/refresh/pricing/`: `sightmap`,
`entrata-wp` and `page-text` read the building's own website; `manual` reads `data/manual-prices.json`.
Scrapers honor `robots.txt`, identify themselves and fetch each site once a day. Which building uses which,
and why, is in [docs/data-sources.md](docs/data-sources.md#building-websites).

**Updating manual prices:** edit the building's entry in `data/manual-prices.json`. For each room type set
`status` (`available`, `waitlist`, `not-offered` or `unknown`) and `minPrice` (the lowest monthly rent, or
`null`), then set `verifiedOn` to today's date. The next daily refresh publishes it.

### Finding new apartments

`npm run discover` looks for apartment buildings within 3.5 miles of campus (Oakland through downtown, the South
Side and Lawrenceville) that aren't listed yet:

1. Allegheny County parcels coded as large apartment buildings, from the WPRDC open-data API.
2. Parcels at the same address are grouped into one building. Names, websites and construction years come
   from OpenStreetMap; missing websites come from Brave Search when `BRAVE_API_KEY` is set.
3. Listed, recently rejected and tax-exempt buildings (university, public or nonprofit housing) are skipped.
   Rejections are reconsidered after a year. Far buildings are kept, since some students drive; each one's transit
   commute is shown so riders can judge (`--max-commute <minutes>` leaves out longer ones).
4. Each new building's website is checked for a leasing platform we can read prices from.
5. Up to 15 new buildings a week are added to `data/candidates.json` and proposed in a PR: 40+ unit buildings
   first, and within each size the highest county market value first, which puts big modern buildings ahead of
   small old ones.

To review, edit `data/candidates.json` in that PR. Set `decision` to `approve` and fill in `listing`, or to
`reject` with a `rejectReason`, then merge. An approved building needs a price source: the detected platform's
`pricing.url`, or `"pricing": { "adapter": "manual" }` with `manualPrices` for all four room types. The PR
description lists everything that's required. While a finds PR is open, the weekly job skips running so it
can't overwrite your edits.

To add an apartment by hand, add it to `data/apartments.json` (the schema in `lib/schemas.ts` says what's
needed), plus a `data/manual-prices.json` entry if it's priced by hand, and run the refreshes.

## The map

`/map` lists every apartment beside a map of where it sits from campus. Price tags show the rent for the chosen
room type and give way to each other when they'd overlap. Selecting an apartment (in the list or on the map) opens
a card with every rent and draws its route to campus:

- **Commute:** the actual trip behind the commute time, step by step: walk to the stop, which bus (or light rail)
  toward where, how many stops, where to get off, and the walk to campus, with times from PRT's weekday timetable.
  On the map, walking is dotted and the ride is a solid orange line tagged with its route ("71B").
- **Walk:** the shortest walking route along streets and paths, the one the walking distance is measured on.

Both have a Google Maps link with the apartment and campus filled in. The routes come from `data/routes.json`,
which the weekly transit refresh writes; an apartment without one gets a straight line and the link. The room type,
selection and view are in the address (`?apartment=coda-on-centre&room=oneBedroom&route=walk`), and each card on the
rankings page links to its routes.

It's drawn with [MapLibre GL JS](https://maplibre.org) on a basemap the site serves itself, so there's no API key or
tile service to pay for or rate-limit:

- `public/basemap/pittsburgh.pmtiles`: a [Protomaps](https://protomaps.com) vector-tile extract (OpenStreetMap
  data) of the area in `lib/map-area.json`, read with HTTP range requests
- `public/basemap/fonts/`: the Noto Sans glyphs for labels
- `lib/map-style.ts`: Protomaps' light style repainted in the site's palette

The "Map tiles" workflow rebuilds these (and commits them) when `lib/map-area.json` changes; run it by hand to pick
up newer map data. MapLibre's web worker is copied into `public/basemap/` before every dev server and build.

