import { THEME_INFO, ThemeArt } from "../../components/themes";
import { isPrivateFile, THEMES, type ChallengeInput } from "../../data/backend";
import { useRun } from "../../components/ui";
import { useState } from "react";
import { CUE_KEYS, CUE_LABELS } from "../../data/sounds";
import { useBackend, useDB } from "../../data/store";
import { CueEditor, usePreview } from "./Soundboard";

export function blankChallenge(typeId: string): ChallengeInput {
  return { typeId, theme: "plastics", title: "", description: "", points: 100, flag: "", caseSensitive: false, files: [], hints: [], maxAttempts: 0, hidden: false };
}

/** The editable fields of one challenge. Used for wave slots, single challenges and edits. */
export function ChallengeFields({ value, onChange, idPrefix, editing = false }: { value: ChallengeInput; onChange: (v: ChallengeInput) => void; idPrefix: string; editing?: boolean }) {
  const db = useDB();
  const set = <K extends keyof ChallengeInput>(k: K, v: ChallengeInput[K]) => onChange({ ...value, [k]: v });
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <div className="sm:col-span-4"><label className="label" htmlFor={id("t")}>Title</label><input id={id("t")} className="field" value={value.title} onChange={(e) => set("title", e.target.value)} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor={id("p")}>Points</label><input id={id("p")} type="number" min={1} className="field" value={value.points} onChange={(e) => set("points", Number(e.target.value))} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor={id("ty")}>Type</label>
        <select id={id("ty")} className="field" value={value.typeId} onChange={(e) => set("typeId", e.target.value)}>{db.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div className="sm:col-span-4">
        <p className="label">Sustainability theme</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sustainability theme">
          {THEMES.map((k) => (
            <button type="button" key={k} role="radio" aria-checked={value.theme === k} onClick={() => set("theme", k)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium ${value.theme === k ? "border-transparent" : "border-fin-200 bg-white text-deep/70"}`}
              style={value.theme === k ? { background: THEME_INFO[k].tint, color: THEME_INFO[k].ink, boxShadow: `inset 0 0 0 1.5px ${THEME_INFO[k].ink}` } : undefined}>
              <ThemeArt theme={k} size={18} />{THEME_INFO[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="sm:col-span-6"><label className="label" htmlFor={id("d")}>Description</label><textarea id={id("d")} className="field h-28" value={value.description} onChange={(e) => set("description", e.target.value)} placeholder="The story and the task. Line breaks are kept." /></div>
      <div className="sm:col-span-3"><label className="label" htmlFor={id("f")}>Flag</label>
        <input id={id("f")} className="field font-mono" value={value.flag ?? ""} onChange={(e) => set("flag", e.target.value)} placeholder={editing ? "Leave empty to keep the current flag" : "ECO{...}"} autoComplete="off" spellCheck={false} />
        <label className="mt-1.5 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={value.caseSensitive} onChange={(e) => set("caseSensitive", e.target.checked)} />Case-sensitive</label></div>
      <div className="sm:col-span-3"><label className="label" htmlFor={id("a")}>Attempts per team</label>
        <input id={id("a")} type="number" min={0} className="field" value={value.maxAttempts} onChange={(e) => set("maxAttempts", Math.max(0, Number(e.target.value)))} />
        <p className="mt-1.5 text-[13px] text-deep/60">{value.maxAttempts > 0 ? `Each team gets ${value.maxAttempts} wrong guess${value.maxAttempts === 1 ? "" : "es"}. You can add more later.` : "0 means unlimited."}</p></div>
      <div className="sm:col-span-6">
        <p className="label">Hints (optional)</p>
        {value.hints.map((h, i) => (
          <div key={i} className="mb-2 flex flex-wrap gap-2 sm:flex-nowrap">
            <input className="field" placeholder={`Hint ${i + 1}`} value={h.text} aria-label={`Hint ${i + 1} text`}
              onChange={(e) => set("hints", value.hints.map((y, j) => j === i ? { ...y, text: e.target.value } : y))} />
            <label className="flex shrink-0 items-center gap-2 text-[13px] text-deep/70">Costs
              <input type="number" min={0} className="field w-24" value={h.cost} aria-label={`Hint ${i + 1} cost in points`}
                onChange={(e) => set("hints", value.hints.map((y, j) => j === i ? { ...y, cost: Math.max(0, Number(e.target.value)) } : y))} />points</label>
            <button type="button" className="btn btn-line btn-sm" onClick={() => set("hints", value.hints.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-line btn-sm" onClick={() => set("hints", [...value.hints, { text: "", cost: Math.round(value.points * 0.1) }])}>Add a hint</button>
        {value.hints.length > 0 && <p className="mt-1.5 text-[13px] text-deep/60">Opening a hint takes its cost off the team's score. Set 0 for a free hint.</p>}
      </div>
      <div className="sm:col-span-6">
        <p className="label">Files (optional)</p>
        {value.files.map((x, i) => (
          <div key={i} className="mb-2 flex flex-wrap gap-2 sm:flex-nowrap">
            <input className="field sm:w-1/3" placeholder="Name" value={x.name} onChange={(e) => set("files", value.files.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} aria-label="File name" />
            {isPrivateFile(x.url)
              ? <span className="field flex items-center gap-2 text-[14px] text-deep/70"><span className="chip bg-kelp-100 text-kelp-600">Private upload</span>only teams who can see this challenge can download it</span>
              : <input className="field" placeholder="https://… or files/name.zip" value={x.url} onChange={(e) => set("files", value.files.map((y, j) => j === i ? { ...y, url: e.target.value } : y))} aria-label="File link" />}
            <button type="button" className="btn btn-line btn-sm" onClick={() => set("files", value.files.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <PrivateUpload onAdd={(f) => set("files", [...value.files, f])} />
          <button type="button" className="btn btn-line btn-sm" onClick={() => set("files", [...value.files, { name: "", url: "" }])}>Add a file link</button>
        </div>
        <p className="mt-1.5 text-[13px] text-deep/60">Uploads (up to 3 MB) stay off the public site: they download only for logged-in teams once the challenge is live, and on the testing page. Links to files/… in the repo are public to anyone.</p>
      </div>
      <div className="sm:col-span-6 rounded-xl border border-fin-200 px-4 py-3">
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" checked={!!value.python?.enabled} onChange={(e) => set("python", { enabled: e.target.checked, starter: value.python?.starter ?? "" })} />
          Python workspace in this challenge
        </label>
        <p className="mt-1 text-[13px] text-deep/60">Players get a code editor that runs Python in their browser, with this challenge's files ready to open and numpy, pandas and sqlite3 available.</p>
        {value.python?.enabled && (
          <>
            <label className="label mt-3" htmlFor={id("py")}>Starter code (optional)</label>
            <textarea id={id("py")} className="field h-32 font-mono text-[13px]" spellCheck={false} value={value.python.starter}
              placeholder={'import sqlite3\ncon = sqlite3.connect("plastic_trail.db")\nprint(con.execute("SELECT name FROM sqlite_master").fetchall())'}
              onChange={(e) => set("python", { enabled: true, starter: e.target.value })} />
          </>
        )}
      </div>
      <MemeSounds value={value} onChange={onChange} idPrefix={idPrefix} />
    </div>
  );
}

/** Per-challenge meme sounds. Collapsed by default; every moment follows the event default unless changed. */
function MemeSounds({ value, onChange, idPrefix }: { value: ChallengeInput; onChange: (v: ChallengeInput) => void; idPrefix: string }) {
  const custom = CUE_KEYS.filter((k) => value.cues?.[k]).length;
  const [open, setOpen] = useState(custom > 0);
  const { preview, popups } = usePreview();
  return (
    <div className="sm:col-span-6">
      <button type="button" className="flex w-full items-center justify-between rounded-xl border border-fin-200 px-4 py-3 text-left text-[14px]" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span><b>Meme sounds</b> <span className="text-deep/60">{custom ? `${custom} custom for this challenge` : "using the Soundboard defaults"}</span></span>
        <svg className={`transition-transform ${open ? "rotate-180" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="mt-3 space-y-4 rounded-xl bg-foam p-4">
          {CUE_KEYS.map((k) => (
            <div key={k}>
              <p className="mb-1.5 text-[13.5px] font-semibold">{CUE_LABELS[k].title}</p>
              <CueEditor k={k} idPrefix={idPrefix} allowDefault value={value.cues?.[k]} onPreview={(c) => preview(k, c)}
                onChange={(c) => { const cues = { ...(value.cues ?? {}) }; if (c) cues[k] = c; else delete cues[k]; onChange({ ...value, cues }); }} />
            </div>
          ))}
        </div>
      )}
      {popups}
    </div>
  );
}

/** Uploads a handout into the database as a private file and adds it to the challenge. */
function PrivateUpload({ onAdd }: { onAdd: (f: { name: string; url: string }) => void }) {
  const be = useBackend();
  const run = useRun();
  const [busy, setBusy] = useState(false);
  return (
    <label className={`btn btn-kelp btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
      {busy ? "Uploading…" : "Upload a private file"}
      <input type="file" className="sr-only" disabled={busy} onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setBusy(true);
        await run(async () => {
          const dataUrl = await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(new Error("That file couldn't be read.")); r.readAsDataURL(file); });
          onAdd(await be.uploadFile(file.name, dataUrl));
        }, `"${file.name}" uploaded. Save the challenge to keep it.`);
        setBusy(false);
      }} />
    </label>
  );
}
