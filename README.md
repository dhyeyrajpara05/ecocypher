# EcoCypher

A sustainability capture-the-flag with a Shark Tank twist. Teams are startups in the tank, every flag
they capture is investment from the sharks, and challenges are released in **funding rounds** (waves).

- **Players**: each member has their own login, sees the open rounds, submits flags, and adds points to the team.
- **Scoreboard**: teams ranked by points. On equal points, the team that reached that score **first** ranks higher.
  Each team's row expands to show every member's contribution. Admins can hide or freeze it.
- **Sharks' Desk (admin)**: live monitor, funding rounds with scheduled or manual release, bulk "upload a wave"
  from CSV/JSON, challenge editor, four renameable challenge types, teams and member logins (with CSV import and
  printable credentials), submission log with shared-answer flags, announcements, settings and backups.

Built with React, TypeScript, Vite, Tailwind CSS and Framer Motion.

## Try it

Live demo: **https://dhyeyrajpara05.github.io/ecocypher/**

The demo opens with sample data:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `EcoCypher@2026` (you'll be asked to change it) |
| Player | `kelp-capital-1` (also `reef-ventures-2`, `driftwood-co-3`, ...) | `dive-in-2026` |

Demo flags for testing: `ECO{straw-1840}`, `ECO{42676160}`, `ECO{bins-on-tuesday}`, `ECO{pump-3_18}`, `ECO{2029}`.

## Important: GitHub Pages mode is for demos and dry runs

GitHub Pages only serves static files, so this version keeps all data in **each browser's localStorage**:

- Every browser has its own copy. Teams on different laptops will **not** see each other's scores.
- Passwords and flags are hashed, but a technical player could still read or edit their own browser's data.

That's fine for showing the site, rehearsing the admin flow and testing challenges. For the real event, deploy
to Vercel with a server backend: see [docs/VERCEL.md](docs/VERCEL.md). The UI only talks to the `Backend`
interface in `src/data/backend.ts`, so moving to a server means writing one new class, not changing pages.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/ecocypher/
npm test         # 17 unit tests: scoring, tie-breaks, flags, waves, permissions
npm run build    # production build in dist/
```

## Setting up a real event (admin)

1. Log in as `admin` and go to **Settings > Clear everything and start fresh**. Save the new admin login it shows.
2. **Challenge types**: rename the four types and pick colours.
3. **Funding rounds**: create your rounds (e.g. Seed round, Series A, Series B, The final pitch).
4. **Upload a wave** into each round from a CSV or JSON file (download the template from the upload dialog), or
   add challenges one by one under **Challenges**.
5. **Teams & members**: create teams or import a CSV (`team,member1,member2,member3`). Download or print the
   logins; temporary passwords are shown only once.
6. **Settings**: set start and end times. On the day, open or schedule rounds from **Funding rounds** and watch
   the **Live monitor**.

### Wave upload format

```csv
title,type,points,flag,description,hint,files
"Bin Day",OSINT,100,ECO{example},"Which photo was taken at the dock?","Check the metadata",photos.zip|files/photos.zip
```

`type` is one of your four type names. `files` is `name|url;name|url`. Put challenge files in `public/files/`
and link them as `files/<name>`. JSON: an array of objects with the same keys.

## Scoring

- Each challenge has its own points, awarded once per team, credited to the member who submitted the flag.
- Team score = sum of its solves. Ties go to the team whose last scoring solve came earlier.
- Wrong flags cost nothing, but attempts are rate-limited (default 10 per member per minute).

## Project layout

```
src/data/types.ts        data model
src/data/scoring.ts      scoring, ranking, round status (pure functions, unit-tested)
src/data/backend.ts      Backend interface + LocalBackend (browser storage)
src/data/seed.ts         demo data
src/pages/               Landing, Login, Play, Scoreboard
src/pages/admin/         Sharks' Desk
src/components/Tank.tsx  the animated tank in the hero
.github/workflows/       GitHub Pages deployment
```
