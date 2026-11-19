# Moving EcoCypher to Vercel for the real event

The GitHub Pages build stores data in each browser. For a real competition every player must share one
database, and flags must be checked on a server. The plan below keeps every page as it is.

## 1. Add a database

Any hosted Postgres works (e.g. Neon or Supabase, both have free tiers and connect to Vercel in a few clicks).
Create tables matching `src/data/types.ts`: users, teams, types, rounds, challenges, submissions,
announcements, settings.

## 2. Add serverless API routes

Vercel runs any file in `api/` as a serverless function. Suggested routes:

| Route | Who | Does |
| --- | --- | --- |
| `POST /api/login` | anyone | check password hash, set an HTTP-only session cookie |
| `POST /api/logout` | user | clear the cookie |
| `GET /api/state` | anyone | the data the current user may see: public view (scoreboard, rounds, types), player view (+ open challenges without flags), admin view (everything except password and flag hashes) |
| `POST /api/submit` | player | check round/event status, rate limit, compare flag hash **on the server**, store submission |
| `POST /api/admin/*` | admin | one route per admin action in the `Backend` interface |

Reuse `src/data/scoring.ts` and `src/data/crypto.ts` on the server: they have no browser dependencies.

## 3. Write `RemoteBackend`

Implement the `Backend` interface in `src/data/backend.ts` with `fetch` calls to those routes, and poll
`/api/state` every few seconds (or use server-sent events) so the scoreboard and live monitor update.
Then swap `new LocalBackend()` for `new RemoteBackend()` in `src/data/store.tsx`.

## 4. Deploy

1. Import the GitHub repo in Vercel.
2. Build command `npm run build`, output `dist`, environment variable `BASE_PATH=/`.
3. Add the database connection string and a session secret as environment variables.
4. Switch from `HashRouter` to `BrowserRouter` if you want clean URLs (add a rewrite of all paths to `index.html`).
