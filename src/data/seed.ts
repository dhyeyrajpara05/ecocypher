// Demo data so the site is explorable right away. Admins can wipe it from Settings > Start fresh.
import { hashFlag, hashPassword, randomSalt } from "./crypto";
import type { Challenge, DB, Submission, User } from "./types";

export const DEMO_ADMIN = { username: "admin", password: "EcoCypher@2026" };
export const DEMO_PLAYER_PASSWORD = "dive-in-2026";

const iso = (minsFromNow: number) => new Date(Date.now() + minsFromNow * 60_000).toISOString();

export async function makeUser(p: Omit<User, "passwordHash" | "passwordSalt" | "createdAt"> & { password: string }): Promise<User> {
  const passwordSalt = randomSalt();
  const { password, ...rest } = p;
  return { ...rest, passwordSalt, passwordHash: await hashPassword(password, passwordSalt), createdAt: new Date().toISOString() };
}

export async function makeChallenge(c: Omit<Challenge, "flagHash" | "flagSalt" | "createdAt"> & { flag: string }): Promise<Challenge> {
  const flagSalt = randomSalt();
  const { flag, ...rest } = c;
  return { ...rest, flagSalt, flagHash: await hashFlag(flag, flagSalt, c.caseSensitive), createdAt: new Date().toISOString() };
}

export function emptyDB(): DB {
  return {
    version: 1,
    demo: false,
    settings: {
      eventName: "EcoCypher",
      tagline: "Crack the waste trail. Win over the sharks.",
      startsAt: null,
      endsAt: null,
      scoreboardVisible: true,
      freezeAt: null,
      submissionsPerMinute: 10,
    },
    users: [],
    teams: [],
    types: [
      { id: "type-1", name: "OSINT", colour: "#1E5B7A", description: "Open-source investigation" },
      { id: "type-2", name: "Python", colour: "#1F7A5C", description: "Scripting and data wrangling" },
      { id: "type-3", name: "Data & SQL", colour: "#B88A1F", description: "Querying messy records" },
      { id: "type-4", name: "Crypto", colour: "#8E4B7A", description: "Ciphers and encodings" },
    ],
    rounds: [],
    challenges: [],
    submissions: [],
    announcements: [],
  };
}

/** Admin only, no demo content. */
export async function freshDB(admin = DEMO_ADMIN): Promise<DB> {
  const db = emptyDB();
  db.users.push(await makeUser({ id: "u-admin", username: admin.username, displayName: "Event admin", role: "admin", teamId: null, mustChangePassword: true, password: admin.password }));
  db.rounds.push({ id: "r-seed", name: "Seed round", order: 1, state: "draft", opensAt: null, closesAt: null });
  return db;
}

export async function demoDB(): Promise<DB> {
  const db = await freshDB();
  db.demo = true;
  db.settings.startsAt = iso(-95);
  db.settings.endsAt = iso(60 * 4);
  db.rounds = [
    { id: "r-seed", name: "Seed round", order: 1, state: "scheduled", opensAt: iso(-90), closesAt: null },
    { id: "r-a", name: "Series A", order: 2, state: "scheduled", opensAt: iso(-30), closesAt: null },
    { id: "r-b", name: "Series B", order: 3, state: "scheduled", opensAt: iso(45), closesAt: null },
    { id: "r-final", name: "The final pitch", order: 4, state: "draft", opensAt: null, closesAt: null },
  ];
  const ch = (id: string, roundId: string, typeId: string, title: string, points: number, flag: string, description: string, hint = "") =>
    makeChallenge({ id, roundId, typeId, title, points, flag, description, hint, caseSensitive: false, files: [], hidden: false });
  db.challenges = await Promise.all([
    ch("c1", "r-seed", "type-3", "The Receipt Trail", 100, "ECO{straw-1840}",
      "Procurement says campus went plastic-free in January. The canteen receipts say otherwise.\n\nHow many plastic straws were bought in March? Submit as ECO{straw-<number>}.\n\n(Demo challenge. The flag is listed in the README.)",
      "Look at the unit, not just the quantity."),
    ch("c2", "r-seed", "type-1", "Who Runs the Recycler?", 150, "ECO{42676160}",
      "Three companies share the name Oakhollow. Only one could have shipped the campus e-waste.\n\nSubmit its registration number as ECO{number}. (Demo.)"),
    ch("c3", "r-seed", "type-4", "Smudged Memo", 80, "ECO{bins-on-tuesday}",
      "A memo left in the photocopier reads: IPUZ-VU-ABLZKHF. The sender liked shifting things by seven.\n\nSubmit as ECO{...} in lower case with hyphens. (Demo.)"),
    ch("c4", "r-a", "type-2", "Night Shift Load", 200, "ECO{pump-3_18}",
      "The pump house log mixes two timestamp formats. Which pump started most often at night, and how many times?\n\nSubmit as ECO{pump-<n>_<count>}. (Demo.)"),
    ch("c5", "r-a", "type-3", "Meter Never Lies", 250, "ECO{2029}",
      "Hauliers bill by the kilolitre. Gauges say what arrived. Find the gap. (Demo.)"),
    ch("c6", "r-b", "type-1", "Ship Spotting", 300, "ECO{OKHU3054124}", "Opens with Series B. (Demo.)"),
  ]);
  const teams = [
    ["t1", "Kelp Capital", ["Aarav Shah", "Meera Iyer", "Kabir Rao"]],
    ["t2", "Reef Ventures", ["Ananya Patel", "Rohan Das", "Isha Nair"]],
    ["t3", "Tidepool Labs", ["Vihaan Mehta", "Diya Kapoor", "Arjun Pillai"]],
    ["t4", "Driftwood & Co", ["Saanvi Joshi", "Neel Desai", "Tara Menon"]],
  ] as const;
  for (const [tid, name, members] of teams) {
    db.teams.push({ id: tid, name, createdAt: iso(-200) });
    for (let i = 0; i < members.length; i++) {
      const uname = `${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-+$/, "")}-${i + 1}`;
      db.users.push(await makeUser({ id: `${tid}-u${i + 1}`, username: uname, displayName: members[i], role: "player", teamId: tid, mustChangePassword: false, password: DEMO_PLAYER_PASSWORD }));
    }
  }
  const sub = (team: string, member: number, challenge: string, mins: number, correct = true): Submission =>
    ({ id: `s-${team}-${challenge}-${mins}`, userId: `${team}-u${member}`, teamId: team, challengeId: challenge, value: correct ? "(demo correct flag)" : "ECO{wrong}", correct, at: iso(mins) });
  db.submissions = [
    sub("t1", 1, "c1", -80), sub("t1", 2, "c3", -72), sub("t1", 3, "c2", -55), sub("t1", 1, "c4", -20),
    sub("t2", 2, "c1", -78), sub("t2", 1, "c2", -60, false), sub("t2", 1, "c2", -58), sub("t2", 3, "c3", -50), sub("t2", 2, "c5", -12),
    sub("t3", 1, "c3", -85), sub("t3", 2, "c1", -70), sub("t3", 3, "c2", -40), sub("t3", 1, "c4", -15),
    sub("t4", 3, "c1", -66), sub("t4", 1, "c3", -61, false), sub("t4", 2, "c3", -44),
  ];
  db.announcements = [
    { id: "a1", text: "Series A is open: two new challenges are live.", at: iso(-30) },
    { id: "a2", text: "Reminder: flags look like ECO{...}. You must be able to explain how you got every flag.", at: iso(-88) },
  ];
  return db;
}
