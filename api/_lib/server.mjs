// src/data/crypto.ts
var enc = new TextEncoder();
var FLAG_ITERATIONS = 15e4;
var PASSWORD_ITERATIONS = 15e4;
function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomId(prefix = "") {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return prefix + [...a].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}
function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return hex(a.buffer);
}
function tempPassword() {
  const words = ["kelp", "reef", "tide", "fin", "coral", "drift", "shoal", "brine", "gull", "dune", "moss", "fern", "pearl", "wave"];
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  return `${words[a[0] % words.length]}-${words[a[1] % words.length]}-${1e3 + a[2] % 9e3}`;
}
async function pbkdf2(secret, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256);
  return hex(bits);
}
function hashPassword(password, salt) {
  return pbkdf2(password, salt, PASSWORD_ITERATIONS);
}
function normaliseFlag(value, caseSensitive) {
  const v = value.trim();
  return caseSensitive ? v : v.toLowerCase();
}
function hashFlag(value, salt, caseSensitive) {
  return pbkdf2(normaliseFlag(value, caseSensitive), `flag:${salt}`, FLAG_ITERATIONS);
}
function sameHash(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// src/data/sounds.ts
var BUILTIN_SOUNDS = [
  { ref: "builtin:faaah", name: "FAAAAH", file: "sounds/faaah.mp3" },
  { ref: "builtin:abhi-maza", name: "Abhi maza aayega", file: "sounds/abhi-maza.mp3" },
  { ref: "builtin:game-over", name: "Game over", file: "sounds/game-over.mp3" },
  { ref: "builtin:deal", name: "Deal cha-ching (generated)" }
];
var CUE_LABELS = {
  wrong: { title: "Wrong flag", when: "Any wrong guess (when more than one attempt is left, or attempts are unlimited)", defaultText: "FAAAAAA!!!!!!!!" },
  lastAttempt: { title: "Last attempt left", when: "A wrong guess that leaves the team exactly one attempt", defaultText: "ABHI MAZA AAYEGA!" },
  outOfAttempts: { title: "Out of attempts", when: "The wrong guess that uses the team's final attempt", defaultText: "GAME OVER" },
  correct: { title: "Correct flag", when: "The team captures the flag", defaultText: "DEAL!" }
};
var CUE_KEYS = Object.keys(CUE_LABELS);
function defaultSoundboard() {
  return {
    cues: {
      wrong: { sound: "builtin:faaah", text: "", seconds: 4 },
      lastAttempt: { sound: "builtin:abhi-maza", text: "", seconds: 6 },
      outOfAttempts: { sound: "builtin:game-over", text: "", seconds: 8 },
      correct: { sound: "builtin:deal", text: "", seconds: 3 }
    },
    sounds: []
  };
}
var MAX_SOUND_BYTES = 600 * 1024;

// src/data/seed.ts
var DEMO_ADMIN = { username: "admin", password: "EcoCypher@2026" };
var DEMO_PLAYER_PASSWORD = "dive-in-2026";
var DEMO_FLAG_HASHES = {
  c1: ["demo-c1-avhjmyio", "562a485bb1d1002d903bdc077c0c2196a9029120964a49dc8cfe737dcf3e79e1"],
  c2: ["demo-c2-h5cc88tm", "58e83e867ca4f894331723262a140b4581927cc5b67a42856c775d56a9397727"],
  c3: ["demo-c3-crqham1z", "cb06ac6acaf53734cc7c9bb3bd759287b7d14ce02b8ddc688646a84a4cee1798"],
  c4: ["demo-c4-6iv74dmb", "923ff320f1077e3df70c643538ae80f9d33a67a9a41a401d5e3c429b49bfc3f5"],
  c5: ["demo-c5-b19xyesg", "fe6ec00d76613df6d4dd0a3e957ef57935401424efefde7dc5d231217dcd95b8"],
  c6: ["demo-c6-7gmxc9c8", "85b6ab3a9fde03106268da4970257b960b499fb71ba15c48c213e1c74b907cd7"],
  c7: ["demo-c7-gc472tvy", "6e3f0f8667f5aff29623f6062b104b6c3784b4dbc311ec094f5faaf2e3c00d23"],
  c8: ["demo-c8-4pgf69lk", "a2f5361bc3446cd107a619f13afa73d786227c465550c1204f724c8358f38126"]
};
var iso = (minsFromNow) => new Date(Date.now() + minsFromNow * 6e4).toISOString();
async function makeUser(p) {
  const passwordSalt = randomSalt();
  const { password, ...rest } = p;
  return { ...rest, passwordSalt, passwordHash: await hashPassword(password, passwordSalt), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function emptyDB() {
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
      submissionsPerMinute: 10
    },
    users: [],
    teams: [],
    types: [
      { id: "type-1", name: "OSINT", colour: "#1E5B7A", description: "Open-source investigation" },
      { id: "type-2", name: "Python", colour: "#1F7A5C", description: "Scripting and data wrangling" },
      { id: "type-3", name: "Data & SQL", colour: "#B88A1F", description: "Querying messy records" },
      { id: "type-4", name: "Crypto", colour: "#8E4B7A", description: "Ciphers and encodings" }
    ],
    waves: [],
    challenges: [],
    submissions: [],
    hintUnlocks: [],
    notifications: []
  };
}
async function freshDB(admin = DEMO_ADMIN) {
  const db = emptyDB();
  db.users.push(await makeUser({ id: "u-admin", username: admin.username, displayName: "Event admin", role: "admin", teamId: null, mustChangePassword: true, password: admin.password }));
  return db;
}
async function demoDB() {
  const db = await freshDB();
  db.demo = true;
  db.settings.startsAt = iso(-110);
  db.settings.endsAt = iso(180 - 110);
  db.waves = [{ id: "w1", number: 1, createdAt: iso(-110) }];
  const ch = (id, waveId, typeId, theme, title, points, releaseIn, description, hints = [], maxAttempts = 0) => {
    const [flagSalt, flagHash] = DEMO_FLAG_HASHES[id];
    return {
      id,
      waveId,
      typeId,
      theme,
      title,
      points,
      description,
      hints,
      maxAttempts,
      flagSalt,
      flagHash,
      caseSensitive: false,
      files: [],
      hidden: false,
      releaseAt: releaseIn === null ? null : iso(releaseIn),
      createdAt: iso(-120)
    };
  };
  db.challenges = [
    ch(
      "c1",
      "w1",
      "type-3",
      "plastics",
      "The Receipt Trail",
      100,
      -110,
      "Procurement says campus went plastic-free in January. The canteen receipts say otherwise.\n\nHow many plastic straws were bought in March? Submit as ECO{straw-<number>}.",
      [{ text: "Look at the unit, not just the quantity.", cost: 10 }, { text: "A box holds 40 straws.", cost: 30 }],
      10
    ),
    ch(
      "c2",
      "w1",
      "type-1",
      "ewaste",
      "Who Runs the Recycler?",
      150,
      -110,
      "Three companies share the name Oakhollow. Only one could have shipped the campus e-waste.\n\nSubmit its registration number as ECO{number}.",
      [{ text: "A company that no longer exists can't ship anything.", cost: 15 }],
      5
    ),
    ch(
      "c3",
      "w1",
      "type-4",
      "plastics",
      "Smudged Memo",
      80,
      -110,
      "A memo left in the photocopier reads: IPUZ-VU-ABLZKHF. The sender liked shifting things by seven.\n\nSubmit as ECO{...} in lower case with hyphens.",
      [{ text: "Shift each letter back by seven.", cost: 20 }],
      8
    ),
    ch(
      "c4",
      "w1",
      "type-2",
      "water",
      "Night Shift Load",
      200,
      -110,
      "The pump house log mixes two timestamp formats. Which pump started most often at night, and how many times?\n\nSubmit as ECO{pump-<n>_<count>}."
    ),
    ch(
      "c5",
      "w1",
      "type-3",
      "water",
      "Meter Never Lies",
      250,
      -110,
      "Hauliers bill by the kilolitre. Gauges say what arrived. Find the gap in kilolitres.",
      [{ text: "Duplicate gauge rows count once.", cost: 25 }, { text: "Ignore the haulier in the estates memo.", cost: 40 }],
      6
    ),
    ch(
      "c7",
      null,
      "type-2",
      "food",
      "Takeaway Tally",
      120,
      -40,
      "The canteens swear they switched to leaf boxes. The waste audit says otherwise. How many kilograms of plastic boxes left campus last month? Submit as ECO{<n>kg}."
    ),
    ch("c6", null, "type-1", "ewaste", "Ship Spotting", 300, 25, "A container left the port with campus e-waste inside. Which one?"),
    ch("c8", null, "type-3", "plastics", "Straw Margins", 180, null, "Draft: work out the steel-straw margin.")
  ];
  const teams = [
    ["t1", "Kelp Capital", ["Aarav Shah", "Meera Iyer", "Kabir Rao"]],
    ["t2", "Reef Ventures", ["Ananya Patel", "Rohan Das", "Isha Nair"]],
    ["t3", "Tidepool Labs", ["Vihaan Mehta", "Diya Kapoor", "Arjun Pillai"]],
    ["t4", "Driftwood & Co", ["Saanvi Joshi", "Neel Desai", "Tara Menon"]]
  ];
  const demoSalt = randomSalt();
  const demoHash = await hashPassword(DEMO_PLAYER_PASSWORD, demoSalt);
  for (const [tid, name, members] of teams) {
    db.teams.push({ id: tid, name, createdAt: iso(-200) });
    for (let i = 0; i < members.length; i++) {
      const uname = `${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-+$/, "")}-${i + 1}`;
      db.users.push({
        id: `${tid}-u${i + 1}`,
        username: uname,
        displayName: members[i],
        role: "player",
        teamId: tid,
        mustChangePassword: false,
        passwordSalt: demoSalt,
        passwordHash: demoHash,
        createdAt: iso(-200)
      });
    }
  }
  const sub = (team, member, challenge, mins, correct = true) => ({ id: `s-${team}-${challenge}-${mins}`, userId: `${team}-u${member}`, teamId: team, challengeId: challenge, value: correct ? "(correct flag)" : "ECO{wrong}", correct, at: iso(mins) });
  db.submissions = [
    sub("t1", 1, "c1", -100),
    sub("t1", 2, "c3", -92),
    sub("t1", 3, "c2", -75),
    sub("t1", 1, "c4", -20),
    sub("t2", 2, "c1", -98),
    sub("t2", 1, "c2", -80, false),
    sub("t2", 1, "c2", -78),
    sub("t2", 3, "c3", -70),
    sub("t2", 2, "c5", -12),
    sub("t3", 1, "c3", -105),
    sub("t3", 2, "c1", -90),
    sub("t3", 3, "c2", -60),
    sub("t3", 1, "c4", -15),
    sub("t4", 3, "c1", -86),
    sub("t4", 1, "c3", -81, false),
    sub("t4", 2, "c3", -64)
  ];
  db.hintUnlocks = [
    { id: "h1", teamId: "t4", userId: "t4-u3", challengeId: "c1", index: 0, cost: 10, at: iso(-88) },
    { id: "h2", teamId: "t2", userId: "t2-u1", challengeId: "c5", index: 0, cost: 15, at: iso(-82) }
  ];
  db.notifications = [
    { id: "n1", title: "New challenge live", body: "Takeaway Tally (120 points) is now open. Another single challenge drops in about 25 minutes.", level: "info", at: iso(-40) },
    { id: "n2", title: "Play fair", body: "Flags look like ECO{...}. Every team must be able to explain how it got each flag.", level: "important", at: iso(-108) }
  ];
  return db;
}

// src/data/scoring.ts
function releaseStatus(c, now = /* @__PURE__ */ new Date()) {
  if (!c.releaseAt) return "draft";
  return Date.parse(c.releaseAt) > now.getTime() ? "scheduled" : "live";
}
function eventStatus(db, now = /* @__PURE__ */ new Date()) {
  const { startsAt, endsAt } = db.settings;
  if (!startsAt || now.getTime() < Date.parse(startsAt)) return "not-started";
  if (endsAt && now.getTime() >= Date.parse(endsAt)) return "ended";
  return "live";
}
function solves(db, until) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const cutoff = until ? until.getTime() : Infinity;
  const sorted = [...db.submissions].filter((s) => s.correct && Date.parse(s.at) <= cutoff).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const s of sorted) {
    const k = `${s.teamId}:${s.challengeId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}
function wrongAttempts(db, teamId, challengeId) {
  return db.submissions.filter((s) => s.teamId === teamId && s.challengeId === challengeId && !s.correct).length;
}
function attemptsLeft(db, teamId, c) {
  return c.maxAttempts > 0 ? Math.max(0, c.maxAttempts - wrongAttempts(db, teamId, c.id)) : Infinity;
}
function unlockedHints(db, teamId, challengeId) {
  return new Set(db.hintUnlocks.filter((h) => h.teamId === teamId && h.challengeId === challengeId).map((h) => h.index));
}
var WAVE_SIZE = 5;

// src/data/vault.ts
var plainCipher = { seal: async (s) => s, open: async (s) => s };

// src/data/backend.ts
var KEY = "ecocypher:data";
var SESSION = "ecocypher:session";
var THEMES = ["plastics", "energy", "water", "ewaste", "food", "climate"];
var BackendError = class extends Error {
};
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "team";
}
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}
function migrate(d) {
  if (d?.version === 2) {
    for (const c of d.challenges ?? []) {
      c.hints = c.hint ? [{ text: c.hint, cost: 0 }] : [];
      c.maxAttempts = 0;
      delete c.hint;
    }
    d.hintUnlocks = [];
    d.version = 3;
  }
  if (d?.version === 3) {
    d.soundboard = defaultSoundboard();
    d.version = 4;
  }
  return d?.version === 4 ? d : null;
}
function parseChallengeText(text, types) {
  let rows = [];
  const t = text.trim();
  if (t.startsWith("[")) {
    try {
      rows = JSON.parse(t);
    } catch {
      throw new BackendError("That JSON could not be read. Check for a missing comma or bracket.");
    }
  } else {
    const csv = parseCSV(t);
    if (csv.length < 2) throw new BackendError("The CSV needs a header row and at least one challenge.");
    const head = csv[0].map((h) => h.toLowerCase());
    rows = csv.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
  }
  const items = [];
  const errors = [];
  rows.forEach((it, i) => {
    const n = `Row ${i + 1}`;
    const key = String(it.type ?? "").toLowerCase();
    const type = types.find((x) => x.id.toLowerCase() === key || x.name.toLowerCase() === key);
    const theme = String(it.theme ?? "plastics").toLowerCase().replace(/[^a-z]/g, "");
    const points = Number(it.points);
    if (!String(it.title ?? "").trim()) return errors.push(`${n}: missing title`);
    if (!type) return errors.push(`${n}: unknown type "${it.type ?? ""}"`);
    if (!(points > 0)) return errors.push(`${n}: points must be a number above 0`);
    if (!String(it.flag ?? "").trim()) return errors.push(`${n}: missing flag`);
    const files = Array.isArray(it.files) ? it.files : String(it.files ?? "").split(";").map((p) => p.split("|")).filter((p) => p[0]?.trim() && p[1]?.trim()).map(([name, url]) => ({ name: name.trim(), url: url.trim() }));
    items.push({
      typeId: type.id,
      theme: THEMES.includes(theme) ? theme : "plastics",
      title: String(it.title).trim(),
      description: String(it.description ?? ""),
      points,
      flag: String(it.flag).trim(),
      caseSensitive: String(it.caseSensitive ?? it.case_sensitive ?? "").toLowerCase() === "true",
      files,
      hidden: false,
      maxAttempts: Math.max(0, Math.round(Number(it.attempts ?? it.max_attempts ?? 0)) || 0),
      hints: Array.isArray(it.hints) ? it.hints : String(it.hint ?? "").trim() ? [{ text: String(it.hint).trim(), cost: Math.max(0, Number(it.hint_cost ?? it.hintCost ?? 0) || 0) }] : []
    });
  });
  return { items, errors };
}
var baseUrl = () => {
  try {
    return import.meta.env.BASE_URL ?? "/";
  } catch {
    return "/";
  }
};
function soundMetaFor(name, dataUrl) {
  const m = /^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new BackendError("That file isn't an audio file. Use an MP3, WAV, OGG or M4A.");
  const bytes = Math.floor(m[2].length * 3 / 4) - (m[2].endsWith("==") ? 2 : m[2].endsWith("=") ? 1 : 0);
  if (bytes > MAX_SOUND_BYTES) throw new BackendError(`That sound is ${Math.round(bytes / 1024)} KB. The limit is ${MAX_SOUND_BYTES / 1024} KB; trim it to a few seconds.`);
  const clean = name.replace(/\.[a-z0-9]+$/i, "").trim().slice(0, 60) || "Sound";
  return { id: randomId("snd-"), name: clean, bytes, mime: m[1], addedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function checkCue(cue, sounds) {
  const sound = String(cue?.sound ?? "none");
  const ok = sound === "none" || BUILTIN_SOUNDS.some((b) => b.ref === sound) || sound.startsWith("upload:") && sounds.some((s) => `upload:${s.id}` === sound);
  if (!ok) throw new BackendError("That sound isn't on the soundboard any more.");
  const seconds = Math.min(30, Math.max(1, Math.round(Number(cue.seconds) || 4)));
  return { sound, text: String(cue.text ?? "").trim().slice(0, 40), seconds };
}
function cleanCues(cues) {
  if (!cues) return void 0;
  const out = {};
  for (const k of CUE_KEYS) {
    const c = cues[k];
    if (c) out[k] = { sound: String(c.sound), text: String(c.text ?? "").trim().slice(0, 40), seconds: Math.min(30, Math.max(1, Math.round(Number(c.seconds) || 4))) };
  }
  return Object.keys(out).length ? out : void 0;
}
var LocalBackend = class {
  constructor(storage = window.localStorage, cipher = plainCipher) {
    this.storage = storage;
    this.loading = this.load(cipher);
  }
  state;
  listeners = /* @__PURE__ */ new Set();
  loading;
  writing = Promise.resolve();
  cipher;
  async load(cipherP) {
    this.cipher = await cipherP;
    const raw = this.storage.getItem(KEY);
    if (raw) {
      try {
        const d = migrate(JSON.parse(await this.cipher.open(raw)));
        if (d) {
          this.state = d;
          this.persist();
          this.listen();
          return;
        }
      } catch {
      }
    }
    this.storage.removeItem("ecocypher:v1");
    this.state = await demoDB();
    this.persist();
    this.listen();
  }
  listen() {
    if (typeof window === "undefined") return;
    window.addEventListener("storage", async (e) => {
      if (e.key === KEY && e.newValue) {
        try {
          this.state = JSON.parse(await this.cipher.open(e.newValue));
          this.emit();
        } catch {
        }
      }
      if (e.key === SESSION) this.emit();
    });
  }
  ready() {
    return this.loading;
  }
  /** Resolves when the latest change has been encrypted and saved. */
  flushed() {
    return this.writing;
  }
  db() {
    return this.state;
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  emit() {
    this.listeners.forEach((f) => f());
  }
  persist() {
    const snapshot = JSON.stringify(this.state);
    this.writing = this.writing.then(async () => this.storage.setItem(KEY, await this.cipher.seal(snapshot)));
  }
  commit(mut) {
    const next = structuredClone(this.state);
    mut(next);
    this.state = next;
    this.persist();
    this.emit();
  }
  currentUser() {
    const id = this.storage.getItem(SESSION);
    return this.state?.users.find((u) => u.id === id) ?? null;
  }
  requireUser() {
    const u = this.currentUser();
    if (!u) throw new BackendError("Log in first.");
    return u;
  }
  requireAdmin() {
    const u = this.requireUser();
    if (u.role !== "admin") throw new BackendError("Only admins can do that.");
    return u;
  }
  async checkPassword(u, password, msg) {
    if (!u || !sameHash(await hashPassword(password, u.passwordSalt), u.passwordHash)) throw new BackendError(msg);
    this.storage.setItem(SESSION, u.id);
    this.emit();
    return u;
  }
  login(username, password) {
    const u = this.state.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    return this.checkPassword(u, password, "That username and password don't match.");
  }
  loginMember(teamId, userId, password) {
    const u = this.state.users.find((x) => x.id === userId && x.teamId === teamId && x.role === "player");
    return this.checkPassword(u, password, "That password isn't right for this member. Check your team sheet.");
  }
  logout() {
    this.storage.removeItem(SESSION);
    this.emit();
  }
  async changePassword(current, next) {
    const u = this.requireUser();
    if (!sameHash(await hashPassword(current, u.passwordSalt), u.passwordHash)) throw new BackendError("Your current password is not right.");
    if (next.length < 8) throw new BackendError("Use at least 8 characters.");
    const salt = randomSalt();
    const hash = await hashPassword(next, salt);
    this.commit((d) => {
      const x = d.users.find((y) => y.id === u.id);
      x.passwordSalt = salt;
      x.passwordHash = hash;
      x.mustChangePassword = false;
    });
  }
  async submitFlag(challengeId, value) {
    const u = this.requireUser();
    if (u.role !== "player" || !u.teamId) return { ok: false, correct: false, message: "Only team members can submit flags." };
    const d = this.state;
    const ev = eventStatus(d);
    if (ev === "not-started") return { ok: false, correct: false, message: "The timer hasn't started yet." };
    if (ev === "ended") return { ok: false, correct: false, message: "Time's up. Submissions are closed." };
    const c = d.challenges.find((x) => x.id === challengeId);
    if (!c || c.hidden || releaseStatus(c) !== "live") return { ok: false, correct: false, message: "That challenge isn't available." };
    if (solves(d).some((s) => s.teamId === u.teamId && s.challengeId === c.id)) {
      return { ok: true, correct: true, alreadySolved: true, message: "Your team already solved this one." };
    }
    if (!value.trim()) return { ok: false, correct: false, message: "Type a flag first." };
    if (attemptsLeft(d, u.teamId, c) <= 0) return { ok: false, correct: false, message: "Your team has used all its attempts on this challenge. Ask an organiser if you think that's unfair." };
    const since = Date.now() - 6e4;
    if (d.submissions.filter((s) => s.userId === u.id && Date.parse(s.at) > since).length >= d.settings.submissionsPerMinute) {
      return { ok: false, correct: false, message: "Too many attempts. Wait a minute and try again." };
    }
    const correct = sameHash(await hashFlag(value, c.flagSalt, c.caseSensitive), c.flagHash);
    this.commit((x) => x.submissions.push({ id: randomId("s-"), userId: u.id, teamId: u.teamId, challengeId: c.id, value: correct ? "(correct flag)" : value.trim().slice(0, 200), correct, at: (/* @__PURE__ */ new Date()).toISOString() }));
    return correct ? { ok: true, correct: true, points: c.points, message: `Deal! The sharks invested ${c.points} points in your team.` } : { ok: true, correct: false, message: "Not quite. That flag isn't right." };
  }
  /** Opens a hint for the whole team. Its cost comes off the team's score straight away. */
  async unlockHint(challengeId, index) {
    const u = this.requireUser();
    if (u.role !== "player" || !u.teamId) throw new BackendError("Only team members can open hints.");
    const c = this.state.challenges.find((x) => x.id === challengeId);
    if (!c || c.hidden || releaseStatus(c) !== "live") throw new BackendError("That challenge isn't available.");
    const hint = c.hints[index];
    if (!hint) throw new BackendError("That hint doesn't exist.");
    if (unlockedHints(this.state, u.teamId, c.id).has(index)) return hint;
    if (eventStatus(this.state) !== "live") throw new BackendError("Hints open while the clock is running.");
    this.commit((d) => d.hintUnlocks.push({ id: randomId("h-"), teamId: u.teamId, userId: u.id, challengeId: c.id, index, cost: hint.cost, at: (/* @__PURE__ */ new Date()).toISOString() }));
    return hint;
  }
  // ---------------------------------------------------------------- admin: event
  async updateSettings(patch) {
    this.requireAdmin();
    this.commit((d) => {
      d.settings = { ...d.settings, ...patch };
    });
  }
  async startTimer() {
    this.requireAdmin();
    const now = Date.now();
    this.commit((d) => {
      d.settings.startsAt = new Date(now).toISOString();
      d.settings.endsAt = d.settings.durationMinutes > 0 ? new Date(now + d.settings.durationMinutes * 6e4).toISOString() : null;
    });
  }
  async extendTimer(minutes) {
    this.requireAdmin();
    if (!this.state.settings.startsAt) throw new BackendError("Start the timer first.");
    if (!this.state.settings.endsAt) throw new BackendError("The event has no time limit, so there's nothing to extend.");
    this.commit((d) => {
      d.settings.endsAt = new Date(Date.parse(d.settings.endsAt) + minutes * 6e4).toISOString();
    });
  }
  async endEventNow() {
    this.requireAdmin();
    this.commit((d) => {
      d.settings.endsAt = (/* @__PURE__ */ new Date()).toISOString();
    });
  }
  async resetTimer() {
    this.requireAdmin();
    this.commit((d) => {
      d.settings.startsAt = null;
      d.settings.endsAt = null;
    });
  }
  async updateType(id, patch) {
    this.requireAdmin();
    this.commit((d) => {
      const t = d.types.find((x) => x.id === id);
      if (t) Object.assign(t, patch, { id });
    });
  }
  // ---------------------------------------------------------------- admin: challenges
  validate(input, needFlag, label = "") {
    const p = label ? `${label}: ` : "";
    if (!input.title.trim()) throw new BackendError(`${p}give the challenge a title.`);
    if (!(input.points > 0)) throw new BackendError(`${p}points must be more than 0.`);
    if (needFlag && !input.flag?.trim()) throw new BackendError(`${p}add a flag.`);
    if (!this.state.types.some((t) => t.id === input.typeId)) throw new BackendError(`${p}pick a challenge type.`);
    if (!(input.maxAttempts >= 0)) throw new BackendError(`${p}attempts must be 0 (unlimited) or more.`);
    if (input.hints.some((h) => h.text.trim() && !(h.cost >= 0))) throw new BackendError(`${p}hint costs can't be negative.`);
  }
  async build(input, existing, waveId, releaseAt) {
    let flagSalt = existing?.flagSalt ?? randomSalt();
    let flagHash = existing?.flagHash ?? "";
    if (input.flag?.trim()) {
      flagSalt = randomSalt();
      flagHash = await hashFlag(input.flag, flagSalt, input.caseSensitive);
    } else if (existing && existing.caseSensitive !== input.caseSensitive) throw new BackendError("Re-enter the flag when you change case sensitivity.");
    const { flag: _omit, ...rest } = input;
    return {
      id: existing?.id ?? randomId("c-"),
      createdAt: existing?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
      ...rest,
      title: rest.title.trim(),
      files: rest.files.filter((f) => f.name.trim() && f.url.trim()),
      hints: rest.hints.filter((h) => h.text.trim()).map((h) => ({ text: h.text.trim(), cost: Math.round(h.cost) || 0 })),
      maxAttempts: Math.round(rest.maxAttempts) || 0,
      cues: cleanCues(rest.cues),
      waveId,
      releaseAt,
      flagSalt,
      flagHash
    };
  }
  /** Posts exactly five challenges together as the next wave. */
  async postWave(items, releaseAt) {
    this.requireAdmin();
    if (items.length !== WAVE_SIZE) throw new BackendError(`A wave has exactly ${WAVE_SIZE} challenges. You have ${items.length}.`);
    items.forEach((it, i) => this.validate(it, true, `Challenge ${i + 1}`));
    const wave = { id: randomId("w-"), number: Math.max(0, ...this.state.waves.map((w) => w.number)) + 1, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    const built = await Promise.all(items.map((it) => this.build(it, void 0, wave.id, releaseAt)));
    this.commit((d) => {
      d.waves.push(wave);
      d.challenges.push(...built);
    });
    return built;
  }
  /** Puts exactly five single challenges into a new wave. Each keeps its own release status. */
  async groupIntoWave(ids) {
    this.requireAdmin();
    const unique = [...new Set(ids)];
    if (unique.length !== WAVE_SIZE) throw new BackendError(`Pick exactly ${WAVE_SIZE} challenges for a wave. You picked ${unique.length}.`);
    const picked = unique.map((id) => this.state.challenges.find((c) => c.id === id));
    if (picked.some((c) => !c)) throw new BackendError("One of those challenges no longer exists.");
    const inWave = picked.find((c) => c.waveId);
    if (inWave) throw new BackendError(`"${inWave.title}" is already in a wave. Split that wave first.`);
    const wave = { id: randomId("w-"), number: Math.max(0, ...this.state.waves.map((w) => w.number)) + 1, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.commit((d) => {
      d.waves.push(wave);
      for (const c of d.challenges) if (unique.includes(c.id)) c.waveId = wave.id;
    });
  }
  /** Turns a wave's challenges back into single challenges and removes the wave. */
  async splitWave(waveId) {
    this.requireAdmin();
    if (!this.state.waves.some((w) => w.id === waveId)) throw new BackendError("That wave no longer exists.");
    this.commit((d) => {
      for (const c of d.challenges) if (c.waveId === waveId) c.waveId = null;
      d.waves = d.waves.filter((w) => w.id !== waveId);
    });
  }
  /** Creates a single challenge (id = null) or edits any challenge, keeping its wave. */
  async saveChallenge(id, input, releaseAt) {
    this.requireAdmin();
    const existing = id ? this.state.challenges.find((c2) => c2.id === id) : void 0;
    if (id && !existing) throw new BackendError("That challenge no longer exists.");
    this.validate(input, !existing);
    const c = await this.build(input, existing, existing?.waveId ?? null, releaseAt === void 0 ? existing?.releaseAt ?? null : releaseAt);
    this.commit((d) => {
      const i = d.challenges.findIndex((x) => x.id === c.id);
      if (i >= 0) d.challenges[i] = c;
      else d.challenges.push(c);
    });
    return c;
  }
  async setRelease(id, releaseAt) {
    this.requireAdmin();
    this.commit((d) => {
      const c = d.challenges.find((x) => x.id === id);
      if (c) c.releaseAt = releaseAt;
    });
  }
  /** Gives every team more wrong guesses on a challenge. Also works if the limit was 0 (it becomes a limit). */
  async addAttempts(id, extra) {
    this.requireAdmin();
    const c = this.state.challenges.find((x) => x.id === id);
    if (!c) throw new BackendError("That challenge no longer exists.");
    if (c.maxAttempts === 0) throw new BackendError("This challenge already has unlimited attempts.");
    this.commit((d) => {
      const x = d.challenges.find((y) => y.id === id);
      x.maxAttempts = Math.max(1, x.maxAttempts + extra);
    });
  }
  // ---------------------------------------------------------------- admin: soundboard
  async updateCue(key, cue) {
    this.requireAdmin();
    if (!CUE_KEYS.includes(key)) throw new BackendError("Unknown moment.");
    const c = checkCue(cue, this.state.soundboard.sounds);
    this.commit((d) => {
      d.soundboard.cues[key] = c;
    });
  }
  /** Browser-only version: the audio is kept in this browser's storage. The server stores it in the database instead. */
  async uploadSound(name, dataUrl) {
    this.requireAdmin();
    const meta = soundMetaFor(name, dataUrl);
    try {
      this.storage.setItem(`ecocypher:sound:${meta.id}`, dataUrl);
    } catch {
      throw new BackendError("This browser has no room left for that sound. Try a shorter clip.");
    }
    await this.registerSound(meta);
    return meta;
  }
  /** Records an uploaded sound's details. Called after the audio itself has been stored. */
  async registerSound(meta) {
    this.requireAdmin();
    this.commit((d) => {
      d.soundboard.sounds.push(meta);
    });
  }
  async deleteSound(id) {
    this.requireAdmin();
    const ref = `upload:${id}`;
    this.commit((d) => {
      d.soundboard.sounds = d.soundboard.sounds.filter((s) => s.id !== id);
      for (const k of CUE_KEYS) if (d.soundboard.cues[k].sound === ref) d.soundboard.cues[k] = defaultSoundboard().cues[k];
      for (const c of d.challenges) for (const k of CUE_KEYS) if (c.cues?.[k]?.sound === ref) delete c.cues[k];
    });
    try {
      this.storage.removeItem(`ecocypher:sound:${id}`);
    } catch {
    }
  }
  soundSrc(ref) {
    if (ref.startsWith("builtin:")) {
      const b = BUILTIN_SOUNDS.find((x) => x.ref === ref);
      return b?.file ? `${baseUrl()}${b.file}` : null;
    }
    if (ref.startsWith("upload:")) {
      try {
        return this.storage.getItem(`ecocypher:sound:${ref.slice(7)}`);
      } catch {
        return null;
      }
    }
    return null;
  }
  async deleteChallenge(id) {
    this.requireAdmin();
    this.commit((d) => {
      d.challenges = d.challenges.filter((c) => c.id !== id);
      d.submissions = d.submissions.filter((s) => s.challengeId !== id);
      d.hintUnlocks = d.hintUnlocks.filter((h) => h.challengeId !== id);
      d.waves = d.waves.filter((w) => d.challenges.some((c) => c.waveId === w.id));
    });
  }
  /**
   * Reads challenges from CSV (header: title,type,theme,points,flag,description,hint,hint_cost,attempts,files) or a JSON array.
   * `type` is a type name or id; `theme` one of plastics, energy, water, ewaste, food, climate; `files` is "name|url;name|url".
   * Returns the parsed challenges so the admin can review them in the form before posting.
   */
  parseChallengeFile(text) {
    return parseChallengeText(text, this.state.types);
  }
  // ---------------------------------------------------------------- admin: people
  async newMember(teamId, teamName, displayName, index, taken) {
    const base = `${slug(teamName)}-${index}`;
    let username = base, n = 2;
    while (taken.has(username)) username = `${base}-${n++}`;
    taken.add(username);
    const password = tempPassword();
    const user = await makeUser({ id: randomId("u-"), username, displayName: displayName.trim() || `${teamName} member ${index}`, role: "player", teamId, mustChangePassword: true, password });
    return { user, cred: { team: teamName, displayName: user.displayName, username, password } };
  }
  async createTeam(name, members) {
    this.requireAdmin();
    const teamName = name.trim();
    const size = this.state.settings.teamSize;
    if (!teamName) throw new BackendError("Give the team a name.");
    if (this.state.teams.some((t) => t.name.toLowerCase() === teamName.toLowerCase())) throw new BackendError(`A team called "${teamName}" already exists.`);
    const names = members.map((m) => m.trim()).filter(Boolean);
    if (names.length === 0) throw new BackendError("Add the team's members.");
    if (names.length > size) throw new BackendError(`Teams have up to ${size} members. Change the team size in Settings if you need more.`);
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) throw new BackendError("Two members have the same name. Add a surname or initial so they can find themselves at login.");
    const team = { id: randomId("t-"), name: teamName, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    const taken = new Set(this.state.users.map((u) => u.username));
    const created = [];
    for (const [i, m] of names.entries()) created.push(await this.newMember(team.id, teamName, m, i + 1, taken));
    this.commit((d) => {
      d.teams.push(team);
      d.users.push(...created.map((c) => c.user));
    });
    return created.map((c) => c.cred);
  }
  /** CSV: team,member1,member2,member3 (header optional). */
  async importTeams(csv) {
    this.requireAdmin();
    const rows = parseCSV(csv);
    const start = rows[0]?.[0]?.toLowerCase().startsWith("team") ? 1 : 0;
    const credentials = [];
    const errors = [];
    for (const r of rows.slice(start)) {
      try {
        credentials.push(...await this.createTeam(r[0], r.slice(1)));
      } catch (e) {
        errors.push(`${r[0] || "(blank)"}: ${e.message}`);
      }
    }
    return { credentials, errors };
  }
  async renameTeam(id, name) {
    this.requireAdmin();
    if (!name.trim()) throw new BackendError("Team name can't be empty.");
    this.commit((d) => {
      const t = d.teams.find((x) => x.id === id);
      if (t) t.name = name.trim();
    });
  }
  async deleteTeam(id) {
    this.requireAdmin();
    this.commit((d) => {
      d.teams = d.teams.filter((t) => t.id !== id);
      d.users = d.users.filter((u) => u.teamId !== id);
      d.submissions = d.submissions.filter((s) => s.teamId !== id);
      d.hintUnlocks = d.hintUnlocks.filter((h) => h.teamId !== id);
    });
  }
  async addMember(teamId, displayName) {
    this.requireAdmin();
    const team = this.state.teams.find((t) => t.id === teamId);
    if (!team) throw new BackendError("Team not found.");
    const count = this.state.users.filter((u) => u.teamId === teamId).length;
    if (count >= this.state.settings.teamSize) throw new BackendError(`${team.name} already has ${count} members, the team size limit.`);
    const x = await this.newMember(teamId, team.name, displayName, count + 1, new Set(this.state.users.map((u) => u.username)));
    this.commit((d) => d.users.push(x.user));
    return x.cred;
  }
  async resetPassword(userId) {
    this.requireAdmin();
    const u = this.state.users.find((x) => x.id === userId);
    if (!u) throw new BackendError("User not found.");
    const password = tempPassword();
    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    this.commit((d) => {
      const x = d.users.find((y) => y.id === userId);
      x.passwordSalt = salt;
      x.passwordHash = hash;
      x.mustChangePassword = true;
    });
    return { team: this.state.teams.find((t) => t.id === u.teamId)?.name ?? "(admin)", displayName: u.displayName, username: u.username, password };
  }
  async deleteUser(userId) {
    const me = this.requireAdmin();
    if (userId === me.id) throw new BackendError("You can't delete your own account while logged in.");
    this.commit((d) => {
      d.users = d.users.filter((u) => u.id !== userId);
    });
  }
  // ---------------------------------------------------------------- admin: notifications and data
  async postNotification(title, body, level) {
    this.requireAdmin();
    if (!title.trim() && !body.trim()) throw new BackendError("Write a title or a message.");
    this.commit((d) => d.notifications.unshift({ id: randomId("n-"), title: title.trim(), body: body.trim(), level, at: (/* @__PURE__ */ new Date()).toISOString() }));
  }
  async deleteNotification(id) {
    this.requireAdmin();
    this.commit((d) => {
      d.notifications = d.notifications.filter((a) => a.id !== id);
    });
  }
  async exportJSON() {
    this.requireAdmin();
    return JSON.stringify(this.state, null, 2);
  }
  async importJSON(text) {
    this.requireAdmin();
    let d;
    try {
      d = JSON.parse(text);
    } catch {
      throw new BackendError("That file isn't a valid EcoCypher backup.");
    }
    const m = migrate(d);
    if (!m || !Array.isArray(m.users)) throw new BackendError("That file isn't a valid EcoCypher backup.");
    d = m;
    if (!d.users.some((u) => u.role === "admin")) throw new BackendError("The backup has no admin account, so you'd be locked out.");
    this.state = d;
    this.persist();
    this.emit();
  }
  async startFresh() {
    this.requireAdmin();
    const password = tempPassword();
    const d = await freshDB({ username: "admin", password });
    this.state = d;
    this.persist();
    this.storage.setItem(SESSION, d.users[0].id);
    this.emit();
    return { team: "(admin)", displayName: "Event admin", username: "admin", password };
  }
  async loadDemo() {
    this.state = await demoDB();
    this.persist();
    this.storage.removeItem(SESSION);
    this.emit();
  }
};

// src/data/view.ts
var omit = (o, keys) => {
  const c = { ...o };
  for (const k of keys) delete c[k];
  return c;
};
var SECRET_USER = ["passwordHash", "passwordSalt"];
var SECRET_CHALLENGE = ["flagHash", "flagSalt"];
var publicUser = (u) => ({ id: u.id, displayName: u.displayName, role: u.role, teamId: u.teamId });
var stubChallenge = (c) => ({
  id: c.id,
  waveId: c.waveId,
  typeId: c.typeId,
  theme: c.theme,
  points: c.points,
  releaseAt: c.releaseAt,
  title: "",
  description: "",
  files: [],
  hints: [],
  maxAttempts: 0,
  hidden: false,
  caseSensitive: false
});
var publicSolve = (s) => ({ teamId: s.teamId, userId: s.userId, challengeId: s.challengeId, correct: true, at: s.at });
function publicView(db, me, now = /* @__PURE__ */ new Date()) {
  const v = structuredClone(db);
  if (me?.role === "admin") {
    v.users = v.users.map((u) => omit(u, SECRET_USER));
    v.challenges = v.challenges.map((c) => omit(c, SECRET_CHALLENGE));
    return v;
  }
  const team = me?.teamId ?? null;
  const t = now.getTime();
  const frozen = db.settings.freezeAt && Date.parse(db.settings.freezeAt) <= t ? Date.parse(db.settings.freezeAt) : null;
  const othersVisible = (teamId, at) => teamId === team || db.settings.scoreboardVisible && (frozen === null || Date.parse(at) <= frozen);
  v.users = db.users.filter((u) => u.role === "player" || u.id === me?.id).map((u) => u.id === me?.id ? omit(u, SECRET_USER) : publicUser(u));
  const live = db.challenges.filter((c) => !c.hidden && releaseStatus(c, now) === "live");
  v.challenges = me ? live.map((c) => {
    const open = team ? unlockedHints(db, team, c.id) : /* @__PURE__ */ new Set();
    return { ...omit(c, SECRET_CHALLENGE), hints: c.hints.map((h, i) => ({ cost: h.cost, text: open.has(i) ? h.text : "" })) };
  }) : live.map(stubChallenge);
  const liveIds = new Set(live.map((c) => c.id));
  v.submissions = db.submissions.filter((s) => liveIds.has(s.challengeId) && othersVisible(s.teamId, s.at) && (s.correct || team !== null && s.teamId === team)).map((s) => team !== null && s.teamId === team ? { ...s } : publicSolve(s));
  v.hintUnlocks = db.hintUnlocks.filter((h) => othersVisible(h.teamId, h.at)).map((h) => team !== null && h.teamId === team ? { ...h } : { teamId: h.teamId, challengeId: h.challengeId, index: h.index, cost: h.cost, at: h.at });
  const liveWaves = new Set(live.map((c) => c.waveId).filter(Boolean));
  v.waves = db.waves.filter((w) => liveWaves.has(w.id));
  return v;
}
function viewChangeTimes(db) {
  const out = db.challenges.map((c) => c.releaseAt).filter((r) => !!r);
  if (db.settings.freezeAt) out.push(db.settings.freezeAt);
  return out;
}

// src/server/engine.ts
var METHODS = /* @__PURE__ */ new Set([
  "login",
  "loginMember",
  "changePassword",
  "submitFlag",
  "unlockHint",
  "updateSettings",
  "startTimer",
  "extendTimer",
  "endEventNow",
  "resetTimer",
  "updateType",
  "postWave",
  "saveChallenge",
  "setRelease",
  "groupIntoWave",
  "splitWave",
  "addAttempts",
  "deleteChallenge",
  "createTeam",
  "importTeams",
  "renameTeam",
  "deleteTeam",
  "addMember",
  "resetPassword",
  "deleteUser",
  "postNotification",
  "deleteNotification",
  "exportJSON",
  "importJSON",
  "startFresh",
  "loadDemo",
  "updateCue",
  "uploadSound",
  "deleteSound"
]);
var ADMIN_ONLY = /* @__PURE__ */ new Set(["loadDemo"]);
var TOKEN_HOURS = 14;
var MemStorage = class {
  m = /* @__PURE__ */ new Map();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k) {
    return this.m.get(k) ?? null;
  }
  key(i) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k) {
    this.m.delete(k);
  }
  setItem(k, v) {
    this.m.set(k, v);
  }
};
var enc2 = new TextEncoder();
var b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc2.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc2.encode(msg)));
}
function secretOf(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) throw new Error("SESSION_SECRET is not set (use at least 16 random characters).");
  return env.SESSION_SECRET;
}
async function sign(env, u) {
  const body = `${u.id}.${Date.now() + TOKEN_HOURS * 36e5}.${u.passwordHash.slice(0, 12)}`;
  return `${body}.${await hmac(secretOf(env), body)}`;
}
async function verify(env, db, token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, exp, fp, sig] = parts;
  if (Number(exp) < Date.now()) return null;
  const want = await hmac(secretOf(env), `${id}.${exp}.${fp}`);
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  const u = db.users.find((x) => x.id === id);
  return u && u.passwordHash.slice(0, 12) === fp ? u : null;
}
async function load(kv2, env) {
  const got = await kv2.read();
  if (got.data) {
    const db2 = migrate(JSON.parse(got.data));
    if (!db2) throw new Error("The saved event data couldn't be read.");
    return { db: db2, raw: got.data, v: got.v };
  }
  let db;
  if (env.SEED === "demo") db = await demoDB();
  else {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 8) throw new Error("ADMIN_PASSWORD is not set (at least 8 characters).");
    db = await freshDB({ username: "admin", password: env.ADMIN_PASSWORD });
  }
  const raw = JSON.stringify(db);
  if (await kv2.write(got.v, raw, viewChangeTimes(db))) return { db, raw, v: got.v + 1 };
  return load(kv2, env);
}
function scrub(x) {
  if (Array.isArray(x)) return x.map(scrub);
  if (x && typeof x === "object") {
    const o = {};
    for (const [k, v] of Object.entries(x)) if (!["passwordHash", "passwordSalt", "flagHash", "flagSalt"].includes(k)) o[k] = scrub(v);
    return o;
  }
  return x;
}
async function getState(kv2, env, token, clientV, since) {
  if (clientV > 0) {
    const meta = await kv2.meta();
    const now = Date.now();
    const timeChange = meta.times.some((t) => {
      const x = Date.parse(t);
      return x > since && x <= now;
    });
    if (meta.v === clientV && !timeChange) return { status: 204 };
  }
  const { db, v } = await load(kv2, env);
  const me = await verify(env, db, token);
  return { status: 200, body: { v, now: Date.now(), me: me?.id ?? null, view: publicView(db, me), tokenValid: !token || !!me } };
}
async function getSound(kv2, id) {
  if (!/^snd-[a-z0-9]+$/i.test(id)) return { status: 404 };
  const dataUrl = await kv2.getBlob(`sound:${id}`);
  const m = dataUrl && /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return { status: 404 };
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { status: 200, mime: m[1], bytes };
}
async function rpc(kv2, env, token, method, args) {
  if (!METHODS.has(method) || !Array.isArray(args)) return { status: 400, body: { error: "Unknown action." } };
  if (method === "uploadSound" || method === "deleteSound") {
    const { db } = await load(kv2, env);
    const me = await verify(env, db, token);
    if (me?.role !== "admin") return { status: 403, body: { error: "Only admins can do that." } };
    if (method === "uploadSound") {
      let meta;
      try {
        meta = soundMetaFor(String(args[0] ?? ""), String(args[1] ?? ""));
      } catch (e) {
        if (e instanceof BackendError) return { status: 400, body: { error: e.message } };
        throw e;
      }
      await kv2.putBlob(`sound:${meta.id}`, String(args[1]));
      const r2 = await rpcCore(kv2, env, token, "registerSound", [meta]);
      if (r2.status === 200) r2.body.result = meta;
      return r2;
    }
    const r = await rpcCore(kv2, env, token, "deleteSound", args);
    if (r.status === 200) await kv2.delBlob(`sound:${String(args[0])}`);
    return r;
  }
  return rpcCore(kv2, env, token, method, args);
}
async function rpcCore(kv2, env, token, method, args) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { db, raw, v } = await load(kv2, env);
    const me = await verify(env, db, token);
    if (ADMIN_ONLY.has(method) && me?.role !== "admin") return { status: 403, body: { error: "Only admins can do that." } };
    const mem = new MemStorage();
    mem.setItem(KEY, raw);
    if (me) mem.setItem(SESSION, me.id);
    const be = new LocalBackend(mem);
    await be.ready();
    let result;
    try {
      result = await be[method](...args);
    } catch (e) {
      if (e instanceof BackendError) return { status: 400, body: { error: e.message } };
      throw e;
    }
    await be.flushed();
    const next = be.db();
    const nextRaw = JSON.stringify(next);
    let nv = v;
    if (nextRaw !== JSON.stringify(db)) {
      if (!await kv2.write(v, nextRaw, viewChangeTimes(next))) continue;
      nv = v + 1;
    }
    const sid = mem.getItem(SESSION);
    const who = next.users.find((u) => u.id === sid) ?? null;
    const newToken = sid !== (me?.id ?? null) || method.startsWith("login") || method === "changePassword" ? who ? await sign(env, who) : "" : void 0;
    return { status: 200, body: {
      result: method === "exportJSON" ? result : scrub(result),
      v: nv,
      now: Date.now(),
      me: who?.id ?? null,
      view: publicView(next, who),
      token: newToken
    } };
  }
  return { status: 503, body: { error: "The server is busy. Try again in a moment." } };
}

// src/server/http.ts
async function handle(kv2, env, req) {
  const token = req.auth?.startsWith("Bearer ") ? req.auth.slice(7) : null;
  try {
    if (req.path.endsWith("/api/state") && req.method === "GET") {
      return await getState(kv2, env, token, Number(req.query.get("v")) || 0, Number(req.query.get("t")) || 0);
    }
    if (req.path.endsWith("/api/sound") && req.method === "GET") {
      const s = await getSound(kv2, req.query.get("id") ?? "");
      return s.status === 200 ? { status: 200, raw: { mime: s.mime, bytes: s.bytes } } : { status: 404, body: { error: "Sound not found." } };
    }
    if (req.path.endsWith("/api/rpc") && req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
      return await rpc(kv2, env, token, String(b.method), b.args ?? []);
    }
    return { status: 404, body: { error: "Not found." } };
  } catch (e) {
    console.error(e);
    return { status: 500, body: { error: e.message || "Server error." } };
  }
}
function nodeHandler(getKV) {
  return async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const auth = req.headers.authorization;
    let out;
    try {
      out = await handle(getKV(), process.env, {
        method: req.method ?? "GET",
        path: url.pathname,
        query: url.searchParams,
        auth: Array.isArray(auth) ? auth[0] : auth ?? null,
        body: req.body
      });
    } catch (e) {
      out = { status: 500, body: { error: e.message } };
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (out.raw) {
      res.setHeader("Content-Type", out.raw.mime);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.status(200).end(Buffer.from(out.raw.bytes));
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (out.body === void 0) res.status(out.status).end();
    else res.status(out.status).json(out.body);
  };
}

// src/server/kv.ts
var DATA = "ecocypher:data";
var META = "ecocypher:meta";
var encodeMeta = (v, times) => `${v}|${times.join(",")}`;
var decodeMeta = (s) => {
  if (!s) return { v: 0, times: [] };
  const [v, t] = s.split("|");
  return { v: Number(v) || 0, times: t ? t.split(",") : [] };
};
var CAS = `local m = redis.call('GET', KEYS[2])
local cur = 0
if m then cur = tonumber(string.match(m, '^(%d+)')) end
if cur ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1`;
var UpstashKV = class {
  constructor(url, token) {
    this.url = url;
    this.token = token;
  }
  async call(path, body) {
    const r = await fetch(this.url.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`Database error ${r.status}: ${await r.text()}`);
    return r.json();
  }
  async read() {
    const [d, m] = await this.call("/pipeline", [["GET", DATA], ["GET", META]]);
    return { data: d.result, v: decodeMeta(m.result).v };
  }
  async meta() {
    const r = await this.call("", ["GET", META]);
    return decodeMeta(r.result);
  }
  async write(expectV, data, times) {
    const r = await this.call("", ["EVAL", CAS, "2", DATA, META, String(expectV), data, encodeMeta(expectV + 1, times)]);
    return r.result === 1;
  }
  async getBlob(name) {
    return (await this.call("", ["GET", `ecocypher:blob:${name}`])).result;
  }
  async putBlob(name, value) {
    await this.call("", ["SET", `ecocypher:blob:${name}`, value]);
  }
  async delBlob(name) {
    await this.call("", ["DEL", `ecocypher:blob:${name}`]);
  }
};
function kvFromEnv(env) {
  const keys = Object.keys(env).sort();
  const find = (...ends) => {
    for (const end of ends) {
      if (env[end]) return env[end];
      const key = keys.find((k) => k.endsWith(`_${end}`) && !k.includes("READ_ONLY") && env[k]);
      if (key) return env[key];
    }
    return void 0;
  };
  let url = find("KV_REST_API_URL", "REST_API_URL", "UPSTASH_REDIS_REST_URL", "REDIS_REST_URL");
  let token = find("KV_REST_API_TOKEN", "REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN", "REDIS_REST_TOKEN");
  if (!url || !token) {
    for (const k of keys) {
      const v = env[k] ?? "";
      if (/^https:\/\/[^/]+\.upstash\.io/.test(v)) {
        const t = env[k.replace(/URL$/, "TOKEN")];
        if (t && !k.includes("READ_ONLY")) {
          url = v;
          token = t;
          break;
        }
      }
    }
  }
  if (!url || !token) {
    for (const k of keys) {
      const v = env[k] ?? "";
      if (!/^rediss?:\/\//.test(v)) continue;
      try {
        const u = new URL(v);
        if (u.password && u.hostname.endsWith("upstash.io")) {
          url = `https://${u.hostname}`;
          token = decodeURIComponent(u.password);
          break;
        }
      } catch {
      }
    }
  }
  if (!url || !token) {
    const seen = keys.filter((k) => /KV|REDIS|UPSTASH|STORAGE/.test(k));
    throw new Error(`No database connected. In Vercel, add Upstash Redis from the Storage tab, then redeploy.${seen.length ? ` (Database variables found: ${seen.join(", ")})` : " (No database variables found in this deployment.)"}`);
  }
  return new UpstashKV(url, token);
}

// src/server/vercel.ts
var kv = null;
var vercel_default = nodeHandler(() => kv ??= kvFromEnv(process.env));
export {
  vercel_default as default
};
