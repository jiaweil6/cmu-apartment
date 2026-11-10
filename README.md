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
  layout.tsx              Root layout: fonts, Bootstrap, global styles
  page.tsx                Ranking page (server component, loads data)
  map/page.tsx            Map of every apartment
  api/apartments/route.ts GET /api/apartments: listings as JSON
  globals.css             Site styles
components/               UI; ApartmentFinder holds the ranking page's state
lib/
  ranking.ts              Scoring, filtering and ranking (pure functions, tested)
  apartments.ts           Data access; swap in a database here later
  options.ts              Slider, select and filter options shown in the UI
  here-maps.ts            Loads the HERE Maps SDK
  types.ts                Shared types
data/apartments.ts        Apartment listings
```

## How ranking works

Each apartment has a 0–1 score per criterion, where 1 is best. Commute, distance, rating and building-age
scores are stored in `data/apartments.ts`. They are ranks carried over from the original spreadsheet. Price
scores are computed from the listed rents for the selected room type. An apartment's total is the sum of
its scores weighted by the slider positions, and the list is sorted by that total.

To add or update an apartment, edit `data/apartments.ts`. Price scores update automatically. The stored
rank scores of every apartment need recomputing when one is added.
