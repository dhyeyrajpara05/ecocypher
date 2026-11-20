# Running EcoCypher for a real event (Vercel)

The GitHub Pages site keeps data in each browser, so it is only good for trying things out: an admin on
one laptop and players on other devices each see their own copy. The Vercel version shares one database,
so every admin change (clock, releases, edits, unpublishing, attempts, notifications) reaches every player
within about 3 seconds, and flags are checked on the server.

The code is already in this repo. You only need to connect the accounts (about 10 minutes, all free tiers).

## 1. Import the repo into Vercel

1. Sign in at vercel.com with GitHub.
2. **Add New → Project**, pick `dhyeyrajpara05/ecocypher`, press **Import**.
3. Leave the build settings alone (they come from `vercel.json`). Don't deploy yet if it offers; if it
   does deploy, that's fine, it will show "The tank is offline" until step 3 is done.

## 2. Add the database

1. In the project, open the **Storage** tab → **Create Database** → **Upstash for Redis** (Marketplace).
2. Pick the free plan and the region closest to your players (e.g. Mumbai / ap-south-1), and connect it
   to the project for **Production** and **Preview**.
3. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) automatically.

## 3. Add two secrets

Project → **Settings → Environment Variables**:

| Name | Value |
| --- | --- |
| `SESSION_SECRET` | a long random string, e.g. the output of `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | the first admin password (8+ characters). You'll be asked to change it on first login. |
| `SEED` (optional) | `demo` to start with the demo teams and challenges instead of an empty event |

Then **Deployments → Redeploy**.

## 4. First login

Open the Vercel URL, go to **Log in → Organiser**, user `admin` and your `ADMIN_PASSWORD`. Set a new
password, then add teams and challenges as usual. The database is created on the first visit.

To wipe everything later: **Settings → Data → Start fresh** in the admin panel (admins only).

## How it works

- `api/state.js` and `api/rpc.js` are the two server routes. Their code lives in `src/server/` and is
  bundled into `api/_lib/server.mjs` (`npm run build:api`; the Vercel build does this for you).
- The server runs the same rules as the browser version, so behaviour is identical.
- Each browser asks `/api/state` every 3 seconds. If nothing changed it gets an empty reply, which keeps
  the free database quota (500,000 commands a month) far away: 100 players for 3 hours is about 220,000.
- Players only receive what they're allowed to see: no flag or password hashes, no drafts or scheduled
  challenges, no hint text until their team opens it, and nothing past a scoreboard freeze.
- Logins are signed tokens (14 hours). Resetting someone's password logs them out everywhere.

## Trying it on your own computer

```bash
npm run api:dev      # terminal 1: API on :8787 with demo data in memory
npm run dev:remote   # terminal 2: the site, talking to that API
```
