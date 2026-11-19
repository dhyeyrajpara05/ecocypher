# EcoCypher

A three-hour sustainability capture-the-flag with a Shark Tank twist. Teams are startups in the tank, and
every flag they capture is investment from the sharks.

Created by **DEAKIN RESEARCH & TECHNOLOGY CLUB**.

## Features

- **Team login**: each team is registered with its members (3 by default). A member picks their team, then their
  own name, then types their own password. Every point they score goes to the team.
- **3-hour clock**: started by the admin at kickoff and shown on every page. Submissions close when it hits zero.
- **Challenges in two formats**: post a **wave of 5** challenges together, or a **single challenge** on its own.
  Each can go live now, be scheduled, or be saved as a draft.
- **Sustainability-themed cards**: every challenge carries a theme (plastics, energy, water, e-waste, food waste,
  climate) with its own illustration, colour and fact.
- **Notifications page**: the admin posts updates; players get a pop-up and an unread badge.
- **Scoreboard**: teams ranked by points; on equal points, the team that got there first ranks higher. Expand a
  team to see each member's points. Admins can hide or freeze it.
- **Admin dashboard**: clock controls, live numbers, solves over time and by type, live feed, leaderboard, what's
  coming up next, challenge health, posting forms, challenge library, teams, notifications, submissions, settings.

Built with React, TypeScript, Vite, Tailwind CSS and Framer Motion.

## Try it

Live: **https://dhyeyrajpara05.github.io/ecocypher/**

The demo opens with sample teams. Team members' password: `dive-in-2026`. Organiser: `admin` / `EcoCypher@2026`
(you'll be asked to change it). Demo flags are not published; ask the organisers.

## Security

- **Flags are never stored or shipped as text.** Each flag is stored only as a salted PBKDF2-SHA256 hash
  (150,000 iterations). The site checks a guess by hashing it, so neither the code, the repo nor the browser's data
  contains the answers. Correct submissions are logged as "(correct flag)", never as typed.
- **Passwords** are salted PBKDF2 hashes too.
- **Stored data is encrypted** with AES-256-GCM. The key is created in the browser as a non-extractable Web Crypto
  key, so DevTools shows only ciphertext and the key can't be copied out.
- **Unreleased challenges are never shown**: drafts and scheduled challenges don't render for players.
- **Content Security Policy** in the built site blocks inline and third-party scripts. GitHub Pages serves over HTTPS.
- **Notice to AI agents**: every page carries a notice asking AI tools not to help solve the challenges. It is in the
  HTML comments, a meta tag, `/llms.txt`, and in the page text clipped to an invisible 1x1 pixel and hidden from
  screen readers. People browsing never see it.

**Limits of the GitHub Pages version.** It has no server, so all data lives in each browser, and teams on different
laptops won't see each other's scores. Challenge text that an admin types in their browser stays in their browser,
but any page code can be inspected by a determined person, and the AI notice is a request that well-behaved tools
follow, not a lock. For the real event, deploy the server version on Vercel: see [docs/VERCEL.md](docs/VERCEL.md).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/ecocypher/
npm test         # 20 unit tests: scoring, tie-breaks, team login, flags, waves, timer, encryption
npm run build
```

## Setting up a real event (admin)

1. Log in as the organiser and go to **Settings > Clear everything and start fresh**. Save the new admin login.
2. **Settings**: rename the four challenge types, set members per team (default 3) and the clock length (default 180).
3. **Teams & members**: register each team with its members, or import a CSV (`team,member1,member2,member3`).
   Download or print the logins; temporary passwords are shown once.
4. **Post challenges**: build a wave of 5 (or load it from the CSV template), or post single challenges. Schedule
   them or keep them as drafts.
5. On the day, press **Start the 3-hour clock** on the dashboard. Release waves from the **Challenge library** and
   send updates from **Notifications**. If a challenge is too tight, press **+3 attempts** on it in the library;
   every team gets three more guesses straight away.

### Hints and attempts

- Each challenge can have any number of hints, each with its own cost. Opening a hint takes that cost off the
  team's score immediately, it's shown to the whole team, and a team is only ever charged once per hint.
- Attempts are counted per team, across all its members. When they run out, the flag box closes for that team.
- A wrong flag sets off the "FAAAAAA!!!!!!!!" pop-up and sound. Players can switch the sound off in the challenge window.

### CSV format for challenges

```csv
title,type,theme,points,flag,description,hint,hint_cost,attempts,files
"Bin Day",OSINT,plastics,100,ECO{...},"Which photo was taken at the dock?","Check the metadata",10,10,photos.zip|files/photos.zip
```

`type` is one of your four type names; `theme` is plastics, energy, water, ewaste, food or climate; `files` is
`name|url;name|url`. `hint_cost` is the points a team loses when it opens the hint (0 = free). `attempts` is the
number of wrong guesses each team gets (0 = unlimited). Add more hints, or more attempts, in the challenge editor. Put challenge files in `public/files/` and link them as `files/<name>`.
