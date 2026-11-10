# CMU Apartment Ranking

A personalized apartment recommendation site for CMU students too busy for a detailed apartment search.
Set how much you care about a quick commute, distance to campus, price, rating and building age, filter by
room type, neighborhood and amenities, and the site ranks off-campus apartments to match.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript
- Bootstrap 4 CSS for layout, plus the site's own styles in `app/globals.css`
- [HERE Maps](https://www.here.com/developer) for the `/map` page
- [Vitest](https://vitest.dev) for unit tests

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local   # then add your HERE Maps API key
npm run dev                  # http://localhost:3000
```

The map page needs `NEXT_PUBLIC_HERE_API_KEY`. The key is sent to the browser, so restrict it to your
site's domains (and `localhost` for development) in the HERE console. Without a key the rest of the
site works and the map shows a notice instead.

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Production build                      |
| `npm start`         | Serve the production build            |
| `npm test`          | Run unit tests once (`test:watch` to watch) |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | TypeScript, no emit                   |

## Project layout

```
app/
  layout.tsx              Root layout: fonts, Bootstrap, global styles, data credits
  page.tsx                Ranking page (server component, loads data)
  map/page.tsx            Map of every apartment
  api/apartments/route.ts GET /api/apartments: listings as JSON
  globals.css             Site styles
components/               UI; ApartmentFinder holds the ranking page's state
lib/
  ranking.ts              Scoring, filtering and ranking (pure functions, tested)
  apartments.ts           Data access: merges listings with the latest snapshot
  schemas.ts              zod schemas for the data files
  options.ts              Slider, select and filter options shown in the UI
  here-maps.ts            Loads the HERE Maps SDK
data/
  apartments.json         Listing details, reviewed by hand
  snapshot.json           Values fetched on a schedule: prices, commute, walking distance
scripts/refresh/          `npm run refresh`: updates snapshot.json from live sources
otp/                      OpenTripPlanner config used by the transit refresh
docs/data-sources.md      Every data source, its license, and what we checked
```

## How ranking works

Each apartment gets a 0–1 score per criterion, where 1 is best: its rank among all listings, so the best
gets 1 and the worst 1/n. Scores come from raw values (rent for the selected room type, commute minutes,
walking miles, year built). A criterion with no live values yet uses the scores carried over from the
original 2024 spreadsheet, and an apartment missing a value gets the median. The total is the sum of the
scores weighted by the slider positions.

## Data pipeline

Fetched values live in `data/snapshot.json`, separate from the hand-reviewed listing details. Scheduled
GitHub Actions refresh the snapshot and open a pull request with a summary of what changed. Values that
fail to refresh keep their previous value.

| Workflow | Schedule | What it updates |
| --- | --- | --- |
| `refresh-transit.yml` | Mondays | Commute to campus (median door-to-door time arriving by 8:30, 9:00 and 9:30 AM on the next regular Tuesday) and walking distance, routed with [OpenTripPlanner](https://www.opentripplanner.org/) on PRT's GTFS feed and OpenStreetMap |
| `discover.yml` | Wednesdays | New apartment buildings near campus, as a "Weekly apartment finds" PR (see below) |
| `promote-candidates.yml` | After a finds PR merges | Lists approved buildings, remembers rejected ones |

To run a refresh locally, start OpenTripPlanner the way `.github/actions/opentripplanner` does, then:

```bash
npm run refresh -- --only transit --gtfs-dir otp-run/gtfs --dry-run
```

### Finding new apartments

`npm run discover` looks for apartment buildings within 2.5 miles of campus that aren't listed yet:

1. Allegheny County parcels coded as large apartment buildings, from the WPRDC open-data API.
2. Parcels at the same address are grouped into one building. Names, websites and construction years come
   from OpenStreetMap.
3. Listed, previously rejected and tax-exempt buildings (university, public or nonprofit housing) are
   skipped, as are buildings over a 35-minute commute.
4. Up to 15 new buildings a week, largest and closest first, are added to `data/candidates.json` and
   proposed in a PR.

To review, edit `data/candidates.json` in that PR. Set `decision` to `approve` and fill in `listing`, or to
`reject` with a `rejectReason`, then merge. The PR description lists which fields are required. While a finds
PR is open, the weekly job skips running so it can't overwrite your edits.

To add an apartment by hand, add it to `data/apartments.json` (the schema in `lib/schemas.ts` says what's
needed) and run the refreshes. Ranks are recomputed automatically.
