import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Footer } from "../components/chrome";
import { SiteHeader } from "../components/SiteHeader";
import { clockName } from "../data/scoring";
import { useDB, useUser } from "../data/store";

/**
 * FAQ & guidelines: how the event works, the rules, a starter toolkit per challenge type and answers to the
 * questions players ask most. Numbers (clock length, team size, rate limit) come from the live settings.
 */

type Tool = { name: string; url: string; what: string };
type Kit = { id: string; title: string; colour: string; tips: string[]; tools: Tool[] };

const KITS: Kit[] = [
  {
    id: "osint", title: "OSINT", colour: "#1E5B7A",
    tips: [
      "Read every word of the brief: names, dates, places and usernames are your search terms.",
      "Check a photo's metadata before anything else. Then reverse-search the image.",
      "Pages change. If something is gone, look for an archived copy, and check a repo's commit history, not just its latest files.",
    ],
    tools: [
      { name: "Google search operators", url: "https://support.google.com/websearch/answer/2466433", what: "site:, filetype:, \"exact phrase\", -exclude" },
      { name: "Google Lens", url: "https://lens.google/", what: "Reverse image search" },
      { name: "TinEye", url: "https://tineye.com/", what: "Reverse image search, finds older copies" },
      { name: "Jimpl", url: "https://jimpl.com/", what: "Photo metadata (EXIF, GPS, camera, date) in the browser" },
      { name: "Wayback Machine", url: "https://web.archive.org/", what: "Old versions of web pages" },
      { name: "GitHub search syntax", url: "https://docs.github.com/en/search-github/searching-on-github", what: "Search code, commits and users" },
      { name: "OSINT Framework", url: "https://osintframework.com/", what: "Directory of OSINT tools by topic" },
    ],
  },
  {
    id: "crypto", title: "Crypto", colour: "#8E4B7A",
    tips: [
      "Identify before you decode: Base64 often ends in =, hex uses only 0-9 and a-f, binary is 0s and 1s.",
      "Many challenges stack layers. Decode one step, look at the result, then decode again.",
      "Letters shifted or swapped? Try a Caesar/ROT shift first, then a substitution solver.",
    ],
    tools: [
      { name: "CyberChef", url: "https://gchq.github.io/CyberChef/", what: "Decode, decrypt and convert almost anything. Try the Magic operation" },
      { name: "dCode cipher identifier", url: "https://www.dcode.fr/cipher-identifier", what: "Guesses which cipher a text uses" },
      { name: "dCode tools list", url: "https://www.dcode.fr/en", what: "Solvers for Caesar, Vigenère, Atbash and hundreds more" },
      { name: "quipqiup", url: "https://quipqiup.com/", what: "Solves substitution ciphers automatically" },
      { name: "Aperi'Solve", url: "https://www.aperisolve.com/", what: "Looks for data hidden inside images" },
    ],
  },
  {
    id: "python", title: "Python", colour: "#1F7A5C",
    tips: [
      "If a challenge has a Python workspace, open its files by name, e.g. open(\"data.csv\") or pd.read_csv(\"data.csv\").",
      "Print small pieces first (df.head(), len(rows)) before you write the full solution.",
      "Each run in the workspace stops after 30 seconds. Loop over less data, or press Stop and try again.",
    ],
    tools: [
      { name: "Python 3 docs", url: "https://docs.python.org/3/", what: "Official reference and tutorial" },
      { name: "pandas getting started", url: "https://pandas.pydata.org/docs/getting_started/index.html", what: "Load, filter and group tables" },
      { name: "pandas user guide", url: "https://pandas.pydata.org/docs/user_guide/index.html", what: "Cleaning, merging, dates, strings" },
      { name: "regex101", url: "https://regex101.com/", what: "Build and test regular expressions (pick the Python flavour)" },
      { name: "Python sqlite3", url: "https://docs.python.org/3/library/sqlite3.html", what: "Query a .db file from Python" },
    ],
  },
  {
    id: "sql", title: "Data & SQL", colour: "#B88A1F",
    tips: [
      "Look at the schema first: list the tables, then SELECT * FROM table LIMIT 5 on each one.",
      "Messy data is the point. Watch for spaces, different spellings, mixed case and NULLs; TRIM() and LOWER() help.",
      "Check your count with a second query before you build a flag from it.",
    ],
    tools: [
      { name: "SQLBolt", url: "https://sqlbolt.com/", what: "Short interactive SQL lessons" },
      { name: "SQLite SQL reference", url: "https://www.sqlite.org/lang.html", what: "Every SQLite keyword and function" },
      { name: "DB Browser for SQLite", url: "https://sqlitebrowser.org/", what: "Free desktop app to open and query .db files" },
      { name: "SQL Online IDE", url: "https://sqliteonline.com/", what: "Open a .db file and run SQL in the browser" },
    ],
  },
];

type Qa = { q: string; a: ReactNode; tags: string };

export default function Faq() {
  const db = useDB();
  const user = useUser();
  const s = db.settings;
  const [query, setQuery] = useState("");
  const m = s.durationMinutes;
  const clock = !m ? null : m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} minutes`;

  const faqs: { group: string; items: Qa[] }[] = [
    {
      group: "Getting in",
      items: [
        { q: "How do I log in?", tags: "login sign in password team member", a: <>Go to <Link className="lnk" to="/login">Log in</Link>, pick your team, tap your own name, then type the password from your team sheet. Each member has their own login, so don't share one between you.</> },
        { q: "It asks me for a new password straight away. Is that normal?", tags: "password change first login temporary", a: <>Yes. The password on your team sheet is temporary. Choose your own (and remember it) and you'll go straight to the challenges.</> },
        { q: "My password doesn't work, or I forgot it.", tags: "password forgot reset locked wrong login", a: <>Check you picked the right team and the right name first. If it still fails, ask an organiser: they can reset it and give you a new temporary password in a minute.</> },
        { q: "My team or name isn't in the list.", tags: "team missing name list registration", a: <>Teams are registered by the organisers before the event. Ask an organiser to add you rather than logging in as a teammate.</> },
        { q: "Which device and browser should we use?", tags: "browser laptop phone chrome firefox", a: <>A laptop with an up-to-date Chrome, Edge or Firefox. Phones work for checking the scoreboard, but files, the Python workspace and long flags are much easier on a laptop.</> },
      ],
    },
    {
      group: "During the event",
      items: [
        { q: "I'm logged in but I can't see any challenges.", tags: "no challenges empty hidden start clock", a: <>Challenges stay hidden until the organisers start the {clockName(s.durationMinutes)}. When they press Start, every released challenge appears within a few seconds. You don't need to refresh.</> },
        { q: "New challenges appeared in the middle of the event. Why?", tags: "wave new release single surprise", a: <>Organisers release challenges in waves of five, plus single surprise challenges. New ones get a <b>New</b> badge and an announcement on the <Link className="lnk" to="/notifications">Notifications</Link> page, so keep an eye on it.</> },
        { q: "How long do we have?", tags: "time clock duration end", a: clock ? <>{clock}, from the moment the organisers start the clock. The countdown is at the top of every page. When it hits zero, flags and hints close; you can still read the challenges.</> : <>This event has no fixed time limit. The clock counts up, and the organisers end the event. Flags and hints close when they do.</> },
        { q: "How do we download a challenge's files?", tags: "files download zip attachment", a: <>Open the challenge and click the file buttons under <b>Files</b>. If a file opens in a new tab instead of downloading, right-click the button and choose "Save link as". Unzip .zip files before you start.</> },
        { q: "What's the Python workspace?", tags: "python workspace code editor pyodide", a: <>Some challenges have a code editor in the challenge window. It runs Python 3 in your browser with numpy, pandas and the standard library (sqlite3, csv, json…), and the challenge's files are ready to open by name. Each run stops after 30 seconds. Your code never leaves your browser, and you can use your own Python setup instead if you prefer.</> },
        { q: "Where do announcements appear?", tags: "notifications announcements updates popup", a: <>On the <Link className="lnk" to="/notifications">Notifications</Link> page, with a pop-up and an unread badge while you play. Organisers post corrections, new waves and time warnings there.</> },
      ],
    },
    {
      group: "Flags",
      items: [
        { q: "What does a flag look like?", tags: "flag format ECO braces", a: <>Flags look like <code className="code">ECO{"{...}"}</code>. Submit the whole thing, including <code className="code">ECO{"{"}</code> and the closing <code className="code">{"}"}</code>, unless the challenge says otherwise.</> },
        { q: "Are flags case-sensitive? What about spaces?", tags: "case sensitive uppercase lowercase spaces", a: <>Spaces before and after the flag are ignored. Most flags are not case-sensitive. If a challenge needs exact capitals, its description tells you.</> },
        { q: "I'm sure my flag is right but it's rejected.", tags: "wrong rejected correct not accepted", a: <>Check the format (prefix and braces), typos such as 0 vs O or l vs 1, extra characters inside the braces, and whether the challenge asks for a specific format (for example a date as YYYY-MM-DD or a number with no commas). Then re-read the question: most "right but rejected" flags answer a slightly different question.</> },
        { q: "How many attempts do we get?", tags: "attempts limit guesses out of attempts", a: <>Each challenge shows its limit. Attempts are shared by the whole team, so a teammate's wrong guess uses one of yours. When they run out, the flag box closes for your team. Organisers can add attempts for everyone if a challenge turns out too tight.</> },
        { q: "It says \"Too many attempts. Wait a minute.\"", tags: "rate limit too many wait minute", a: <>Your team can submit {s.submissionsPerMinute} flags per minute on each challenge. Wait a minute and try again. Guessing fast rarely helps; re-reading the challenge usually does.</> },
        { q: "What's the loud \"FAAAAAA\" pop-up?", tags: "sound popup meme mute wrong", a: <>That's a wrong flag. You can turn the sound off with the sound switch in the challenge window.</> },
      ],
    },
    {
      group: "Points, hints and the scoreboard",
      items: [
        { q: "Do points go to me or to my team?", tags: "points team member score", a: <>To the team. Each challenge scores once per team, credited to whoever solved it. Expand your team on the <Link className="lnk" to="/scoreboard">Scoreboard</Link> to see each member's points.</> },
        { q: "How do hints work?", tags: "hints cost points open", a: <>Some hints are free, others cost points. The cost is shown before you open one, and it comes off your team's score straight away. Everyone on your team then sees the hint, and your team is only charged once for it. Hints open only while the clock is running.</> },
        { q: "Two teams have the same points. Who's ahead?", tags: "tie break ranking equal", a: <>The team that reached that score first.</> },
        { q: "The scoreboard isn't changing, or it's hidden.", tags: "scoreboard frozen hidden freeze", a: <>Organisers can freeze or hide the scoreboard, usually near the end to keep the finish exciting. Your own team's points still count and still show for your team.</> },
      ],
    },
    {
      group: "Rules and fair play",
      items: [
        { q: "Can we use AI tools?", tags: "ai chatgpt claude llm allowed", a: <>Use AI to learn, not to solve. Asking how SQL joins work is fine; pasting the challenge in and asking for the flag is not. Every team must be able to explain how it got each flag, and organisers may ask.</> },
        { q: "Can we use our own tools and scripts?", tags: "tools software scripts own laptop", a: <>Yes. Anything on your own laptop and any public website is fine, including everything in the toolkit on this page.</> },
        { q: "Can we work with other teams?", tags: "share flags other teams collaborate", a: <>No. Keep flags and answers inside your team. Every submission is logged, and shared answers show up in the organisers' logs.</> },
        { q: "Is attacking the website part of the game?", tags: "hack platform attack ddos scan", a: <>No. The challenges are the only targets. Don't attack, scan or overload this website, other teams or the organisers' machines. If you find a bug in the site, tell an organiser.</> },
        { q: "Team size?", tags: "team size members how many", a: <>Teams have up to {s.teamSize} members, each with their own login.</> },
      ],
    },
  ];

  const q = query.trim().toLowerCase();
  const filtered = faqs.map((g) => ({ ...g, items: q ? g.items.filter((it) => `${it.q} ${it.tags}`.toLowerCase().includes(q)) : g.items })).filter((g) => g.items.length);
  const count = filtered.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-kelp">Before you dive in</p>
        <h1 className="mt-1 text-[32px] font-bold leading-tight sm:text-[40px]">FAQ &amp; guidelines</h1>
        <p className="mt-2 max-w-2xl text-[15.5px] text-deep/75">Everything you need to get started fast: how the event works, the rules, a starter toolkit for each challenge type, and answers to the questions teams ask most.</p>

        <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
          {[["#quick-start", "Quick start"], ["#rules", "The rules"], ["#toolkit", "Toolkit"], ["#faq", "FAQ"], ["#help", "Need help?"]].map(([href, label]) => (
            <a key={href} href={href} onClick={(e) => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }); }} className="btn btn-line btn-sm">{label}</a>
          ))}
        </nav>

        <section id="quick-start" className="scroll-mt-6 border-t border-fin-200/70 pt-10 mt-10">
          <h2 className="text-[26px] font-bold">Quick start</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Log in before kickoff", <>Each member logs in with their own name and the password from the team sheet, then sets a new password. Do it early so login problems are fixed before the clock starts.</>],
              ["Split the work", <>Challenges come in four types. Let each member take the type they're strongest in, and keep talking: one person's dead end is another's clue.</>],
              ["Read, then solve", <>Read the whole brief and open every file before you start. Check the hints' costs, and the attempts left, before you guess.</>],
              ["Watch the notifications", <>New waves, surprise challenges and corrections are announced on the Notifications page. Unread ones get a red badge.</>],
            ].map(([t, d], i) => (
              <li key={i} className="panel p-5">
                <span className="font-display text-[30px] font-bold leading-none text-kelp-300">{i + 1}</span>
                <h3 className="mt-2 font-sans text-[16.5px] font-semibold">{t}</h3>
                <p className="mt-1.5 text-[14.5px] text-deep/75">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            {user?.role === "player" ? <Link to="/play" className="btn btn-kelp">Go to challenges</Link> : !user ? <Link to="/login" className="btn btn-kelp">Log in to your team</Link> : null}
            <Link to="/scoreboard" className="btn btn-line">See the scoreboard</Link>
          </div>
        </section>

        <section id="rules" className="scroll-mt-6 mt-14 border-t border-fin-200/70 pt-10">
          <h2 className="text-[26px] font-bold">The rules at a glance</h2>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Flag format", <><code className="code">ECO{"{...}"}</code>. Submit the whole thing, braces included. Not case-sensitive unless the challenge says so.</>],
              ["Clock", clock ? <>{clock}. Challenges, hints and the flag box open when the organisers start the clock and close when it hits zero.</> : <>No fixed limit this time. Challenges, hints and flags open at the start; the organisers end the event.</>],
              ["Teams", <>Up to {s.teamSize} members, each with their own login. Every point goes to the team.</>],
              ["Scoring", <>Each challenge scores its points once per team. Paid hints take points off. On equal points, the team that got there first ranks higher.</>],
              ["Attempts", <>Shared across your team. Some challenges have a limit; it's shown on the card. Your team can submit up to {s.submissionsPerMinute} flags a minute on each challenge.</>],
              ["Fair play", <>Use AI to learn, not to solve. Keep flags inside your team. The website itself is not a target.</>],
            ].map(([t, d]) => (
              <div key={String(t)} className="rounded-2xl bg-aqua-200/70 p-5">
                <dt className="font-sans text-[15px] font-semibold text-deep">{t}</dt>
                <dd className="mt-1 text-[14.5px] text-deep/80">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="toolkit" className="scroll-mt-6 mt-14 border-t border-fin-200/70 pt-10">
          <h2 className="text-[26px] font-bold">Starter toolkit</h2>
          <p className="mt-1 max-w-2xl text-[15px] text-deep/70">Free tools and guides for each challenge type. All of them run in the browser or install in a minute. Bookmark the ones for your type before the clock starts.</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {KITS.map((k) => (
              <article key={k.id} className="panel overflow-hidden">
                <header className="border-l-[6px] px-5 py-4" style={{ borderColor: k.colour }}>
                  <h3 className="font-sans text-[19px] font-semibold">{k.title}</h3>
                </header>
                <div className="px-5 pb-5">
                  <ul className="space-y-1.5 text-[14.5px] text-deep/80">
                    {k.tips.map((t) => <li key={t} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: k.colour }} />{t}</li>)}
                  </ul>
                  <ul className="mt-4 divide-y divide-fin-200/60 border-t border-fin-200/60">
                    {k.tools.map((t) => (
                      <li key={t.url} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                        <a href={t.url} target="_blank" rel="noopener noreferrer" className="lnk font-semibold">{t.name} <span aria-hidden>↗</span></a>
                        <span className="text-[13.5px] text-deep/65">{t.what}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-6 mt-14 border-t border-fin-200/70 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[26px] font-bold">Frequently asked questions</h2>
            <div className="w-full sm:w-80">
              <label htmlFor="faq-search" className="sr-only">Search the FAQ</label>
              <input id="faq-search" type="search" className="field" placeholder="Search, e.g. hint, password, flag" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          {count === 0 ? (
            <p className="mt-6 text-[15px] text-deep/70">No questions match "{query}". Try another word, or ask an organiser.</p>
          ) : (
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              {filtered.map((g) => (
                <div key={g.group}>
                  <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-fin">{g.group}</h3>
                  <div className="space-y-2">
                    {g.items.map((it) => (
                      <details key={it.q} className="faq panel group" open={!!q}>
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-3.5 font-semibold text-deep">
                          <span>{it.q}</span>
                          <span aria-hidden className="mt-0.5 text-kelp transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <div className="px-5 pb-4 text-[14.5px] text-deep/80">{it.a}</div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="help" className="scroll-mt-6 mt-14 rounded-3xl bg-deep px-6 py-8 text-aqua sm:px-10">
          <h2 className="text-[24px] font-bold text-white">Still stuck?</h2>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><b className="text-white">Login or website problem:</b> ask an organiser in the room. They can reset passwords and check what went wrong.</li>
            <li><b className="text-white">Think a challenge is broken?</b> Tell an organiser. If it is, the fix goes out on the <Link to="/notifications" className="text-brass underline underline-offset-4">Notifications</Link> page for every team.</li>
            <li><b className="text-white">Stuck on the puzzle itself?</b> Organisers won't give answers, but the challenge's hints will. Weigh the points first.</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
