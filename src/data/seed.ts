// Demo data so the site is explorable right away. Admins can wipe it from Settings > Start fresh.
//
// Demo flags are NOT in this file: only their salted PBKDF2 hashes are, so the public repo and the
// built site never reveal them. The organisers keep the demo flags separately.
import { hashPassword, randomSalt } from "./crypto";
import { defaultSoundboard } from "./sounds";
import type { Challenge, DB, Hint, Submission, ThemeKey, User } from "./types";

export const DEMO_ADMIN = { username: "admin", password: "EcoCypher@2026" };
export const DEMO_PLAYER_PASSWORD = "dive-in-2026";

const DEMO_FLAG_HASHES: Record<string, [salt: string, hash: string]> = {
  c1: ["demo-c1-avhjmyio", "562a485bb1d1002d903bdc077c0c2196a9029120964a49dc8cfe737dcf3e79e1"],
  c2: ["demo-c2-h5cc88tm", "58e83e867ca4f894331723262a140b4581927cc5b67a42856c775d56a9397727"],
  c3: ["demo-c3-crqham1z", "cb06ac6acaf53734cc7c9bb3bd759287b7d14ce02b8ddc688646a84a4cee1798"],
  c4: ["demo-c4-6iv74dmb", "923ff320f1077e3df70c643538ae80f9d33a67a9a41a401d5e3c429b49bfc3f5"],
  c5: ["demo-c5-b19xyesg", "fe6ec00d76613df6d4dd0a3e957ef57935401424efefde7dc5d231217dcd95b8"],
  c6: ["demo-c6-7gmxc9c8", "85b6ab3a9fde03106268da4970257b960b499fb71ba15c48c213e1c74b907cd7"],
  c7: ["demo-c7-gc472tvy", "6e3f0f8667f5aff29623f6062b104b6c3784b4dbc311ec094f5faaf2e3c00d23"],
  c8: ["demo-c8-4pgf69lk", "a2f5361bc3446cd107a619f13afa73d786227c465550c1204f724c8358f38126"],
};

const iso = (minsFromNow: number) => new Date(Date.now() + minsFromNow * 60_000).toISOString();

export async function makeUser(p: Omit<User, "passwordHash" | "passwordSalt" | "createdAt"> & { password: string }): Promise<User> {
  const passwordSalt = randomSalt();
  const { password, ...rest } = p;
  return { ...rest, passwordSalt, passwordHash: await hashPassword(password, passwordSalt), createdAt: new Date().toISOString() };
}

export function emptyDB(): DB {
  return {
    version: 4,
    soundboard: defaultSoundboard(),
    demo: false,
    settings: {
      eventName: "EcoCypher",
      tagline: "Crack the waste trail. Win over the sharks.",
      startsAt: null,
      endsAt: null,
      durationMinutes: 180,
      teamSize: 3,
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
    waves: [],
    challenges: [],
    submissions: [],
    hintUnlocks: [],
    notifications: [],
  };
}

/** Admin only, no demo content. */
export async function freshDB(admin = DEMO_ADMIN): Promise<DB> {
  const db = emptyDB();
  db.users.push(await makeUser({ id: "u-admin", username: admin.username, displayName: "Event admin", role: "admin", teamId: null, mustChangePassword: true, password: admin.password }));
  return db;
}

export async function demoDB(): Promise<DB> {
  const db = await freshDB();
  db.demo = true;
  db.settings.startsAt = iso(-110);
  db.settings.endsAt = iso(180 - 110);
  db.waves = [{ id: "w1", number: 1, createdAt: iso(-110) }];
  const ch = (id: string, waveId: string | null, typeId: string, theme: ThemeKey, title: string, points: number, releaseIn: number | null, description: string, hints: Hint[] = [], maxAttempts = 0): Challenge => {
    const [flagSalt, flagHash] = DEMO_FLAG_HASHES[id];
    return { id, waveId, typeId, theme, title, points, description, hints, maxAttempts, flagSalt, flagHash, caseSensitive: false, files: [], hidden: false,
      releaseAt: releaseIn === null ? null : iso(releaseIn), createdAt: iso(-120) };
  };
  db.challenges = [
    ch("c1", "w1", "type-3", "plastics", "The Receipt Trail", 100, -110,
      "Procurement says campus went plastic-free in January. The canteen receipts say otherwise.\n\nHow many plastic straws were bought in March? Submit as ECO{straw-<number>}.",
      [{ text: "Look at the unit, not just the quantity.", cost: 10 }, { text: "A box holds 40 straws.", cost: 30 }], 10),
    ch("c2", "w1", "type-1", "ewaste", "Who Runs the Recycler?", 150, -110,
      "Three companies share the name Oakhollow. Only one could have shipped the campus e-waste.\n\nSubmit its registration number as ECO{number}.",
      [{ text: "A company that no longer exists can't ship anything.", cost: 15 }], 5),
    ch("c3", "w1", "type-4", "plastics", "Smudged Memo", 80, -110,
      "A memo left in the photocopier reads: IPUZ-VU-ABLZKHF. The sender liked shifting things by seven.\n\nSubmit as ECO{...} in lower case with hyphens.",
      [{ text: "Shift each letter back by seven.", cost: 20 }], 8),
    ch("c4", "w1", "type-2", "water", "Night Shift Load", 200, -110,
      "The pump house log mixes two timestamp formats. Which pump started most often at night, and how many times?\n\nSubmit as ECO{pump-<n>_<count>}."),
    ch("c5", "w1", "type-3", "water", "Meter Never Lies", 250, -110,
      "Hauliers bill by the kilolitre. Gauges say what arrived. Find the gap in kilolitres.",
      [{ text: "Duplicate gauge rows count once.", cost: 25 }, { text: "Ignore the haulier in the estates memo.", cost: 40 }], 6),
    ch("c7", null, "type-2", "food", "Takeaway Tally", 120, -40,
      "The canteens swear they switched to leaf boxes. The waste audit says otherwise. How many kilograms of plastic boxes left campus last month? Submit as ECO{<n>kg}."),
    ch("c6", null, "type-1", "ewaste", "Ship Spotting", 300, 25, "A container left the port with campus e-waste inside. Which one?"),
    ch("c8", null, "type-3", "plastics", "Straw Margins", 180, null, "Draft: work out the steel-straw margin."),
  ];
  const teams = [
    ["t1", "Kelp Capital", ["Aarav Shah", "Meera Iyer", "Kabir Rao"]],
    ["t2", "Reef Ventures", ["Ananya Patel", "Rohan Das", "Isha Nair"]],
    ["t3", "Tidepool Labs", ["Vihaan Mehta", "Diya Kapoor", "Arjun Pillai"]],
    ["t4", "Driftwood & Co", ["Saanvi Joshi", "Neel Desai", "Tara Menon"]],
  ] as const;
  const demoSalt = randomSalt();
  const demoHash = await hashPassword(DEMO_PLAYER_PASSWORD, demoSalt); // one hash shared by all demo players
  for (const [tid, name, members] of teams) {
    db.teams.push({ id: tid, name, createdAt: iso(-200) });
    for (let i = 0; i < members.length; i++) {
      const uname = `${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-+$/, "")}-${i + 1}`;
      db.users.push({ id: `${tid}-u${i + 1}`, username: uname, displayName: members[i], role: "player", teamId: tid, mustChangePassword: false,
        passwordSalt: demoSalt, passwordHash: demoHash, createdAt: iso(-200) });
    }
  }
  const sub = (team: string, member: number, challenge: string, mins: number, correct = true): Submission =>
    ({ id: `s-${team}-${challenge}-${mins}`, userId: `${team}-u${member}`, teamId: team, challengeId: challenge, value: correct ? "(correct flag)" : "ECO{wrong}", correct, at: iso(mins) });
  db.submissions = [
    sub("t1", 1, "c1", -100), sub("t1", 2, "c3", -92), sub("t1", 3, "c2", -75), sub("t1", 1, "c4", -20),
    sub("t2", 2, "c1", -98), sub("t2", 1, "c2", -80, false), sub("t2", 1, "c2", -78), sub("t2", 3, "c3", -70), sub("t2", 2, "c5", -12),
    sub("t3", 1, "c3", -105), sub("t3", 2, "c1", -90), sub("t3", 3, "c2", -60), sub("t3", 1, "c4", -15),
    sub("t4", 3, "c1", -86), sub("t4", 1, "c3", -81, false), sub("t4", 2, "c3", -64),
  ];
  db.hintUnlocks = [
    { id: "h1", teamId: "t4", userId: "t4-u3", challengeId: "c1", index: 0, cost: 10, at: iso(-88) },
    { id: "h2", teamId: "t2", userId: "t2-u1", challengeId: "c5", index: 0, cost: 15, at: iso(-82) },
  ];
  db.notifications = [
    { id: "n1", title: "New challenge live", body: "Takeaway Tally (120 points) is now open. Another single challenge drops in about 25 minutes.", level: "info", at: iso(-40) },
    { id: "n2", title: "Play fair", body: "Flags look like ECO{...}. Every team must be able to explain how it got each flag.", level: "important", at: iso(-108) },
  ];
  return db;
}
