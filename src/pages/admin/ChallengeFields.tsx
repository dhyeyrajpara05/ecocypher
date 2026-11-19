import { THEME_INFO, ThemeArt } from "../../components/themes";
import { THEMES, type ChallengeInput } from "../../data/backend";
import { useDB } from "../../data/store";

export function blankChallenge(typeId: string): ChallengeInput {
  return { typeId, theme: "plastics", title: "", description: "", points: 100, flag: "", caseSensitive: false, files: [], hint: "", hidden: false };
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
      <div className="sm:col-span-3"><label className="label" htmlFor={id("h")}>Hint (optional, free)</label><input id={id("h")} className="field" value={value.hint} onChange={(e) => set("hint", e.target.value)} /></div>
      <div className="sm:col-span-6">
        <p className="label">File links (optional)</p>
        {value.files.map((x, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input className="field w-1/3" placeholder="Name" value={x.name} onChange={(e) => set("files", value.files.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} aria-label="File name" />
            <input className="field" placeholder="https://… or files/name.zip" value={x.url} onChange={(e) => set("files", value.files.map((y, j) => j === i ? { ...y, url: e.target.value } : y))} aria-label="File link" />
            <button type="button" className="btn btn-line btn-sm" onClick={() => set("files", value.files.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-line btn-sm" onClick={() => set("files", [...value.files, { name: "", url: "" }])}>Add a file link</button>
      </div>
    </div>
  );
}
