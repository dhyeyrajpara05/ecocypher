import { useRef, useState } from "react";
import { DealPopup, playDeal } from "../../components/Deal";
import { DEFAULT_TEXT, MemePopup, playSound } from "../../components/Faaah";
import { useRun, useToast } from "../../components/ui";
import { BUILTIN_SOUNDS, CUE_KEYS, CUE_LABELS, MAX_SOUND_BYTES } from "../../data/sounds";
import { useBackend, useDB } from "../../data/store";
import type { Cue, CueKey } from "../../data/types";
import { PageHead } from "./Admin";

const DEFAULT = "__default__";

/** Plays a cue's sound and shows its pop-up, exactly as players will get it. */
export function usePreview() {
  const be = useBackend();
  const [p, setP] = useState<{ n: number; key: CueKey; text: string }>({ n: 0, key: "wrong", text: "" });
  const preview = (key: CueKey, cue: Cue) => {
    playSound(be.soundSrc(cue.sound), cue.seconds, cue.sound === "builtin:deal" ? playDeal : undefined);
    setP((x) => ({ n: x.n + 1, key, text: cue.text }));
  };
  const popups = (
    <>
      <MemePopup trigger={p.key === "correct" ? 0 : p.n} mood={p.key === "correct" ? "wrong" : p.key} text={p.text} />
      <DealPopup trigger={p.key === "correct" ? p.n : 0} points={100} title="this challenge" text={p.text} />
    </>
  );
  return { preview, popups };
}

/** Sound + pop-up text + length for one moment. With `allowDefault`, it can follow the event default. */
export function CueEditor({ k, value, onChange, allowDefault, onPreview, idPrefix }: {
  k: CueKey; value: Cue | undefined; onChange: (c: Cue | undefined) => void; allowDefault?: boolean; onPreview: (c: Cue) => void; idPrefix: string;
}) {
  const db = useDB();
  const fallback = db.soundboard.cues[k];
  const usingDefault = allowDefault && !value;
  const cue = value ?? fallback;
  const set = (patch: Partial<Cue>) => onChange({ ...cue, ...patch });
  const id = (s: string) => `${idPrefix}-${k}-${s}`;
  return (
    <div className="grid gap-3 sm:grid-cols-[1.4fr_1.4fr_5.5rem_auto] sm:items-end">
      <div>
        <label className="label" htmlFor={id("s")}>Sound</label>
        <select id={id("s")} className="field" value={usingDefault ? DEFAULT : cue.sound}
          onChange={(e) => (e.target.value === DEFAULT ? onChange(undefined) : set({ sound: e.target.value }))}>
          {allowDefault && <option value={DEFAULT}>Event default ({labelOf(fallback.sound, db.soundboard.sounds)})</option>}
          <option value="none">No sound</option>
          <optgroup label="Built in">{BUILTIN_SOUNDS.map((b) => <option key={b.ref} value={b.ref}>{b.name}</option>)}</optgroup>
          {db.soundboard.sounds.length > 0 && <optgroup label="Uploaded">{db.soundboard.sounds.map((s) => <option key={s.id} value={`upload:${s.id}`}>{s.name}</option>)}</optgroup>}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={id("t")}>Pop-up text</label>
        <input id={id("t")} className="field" maxLength={40} disabled={usingDefault} placeholder={k === "correct" ? "DEAL!" : DEFAULT_TEXT[k]}
          value={usingDefault ? "" : cue.text} onChange={(e) => set({ text: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor={id("n")}>Max secs</label>
        <input id={id("n")} type="number" min={1} max={30} className="field" disabled={usingDefault} value={cue.seconds}
          onChange={(e) => set({ seconds: Number(e.target.value) })} />
      </div>
      <button type="button" className="btn btn-line" onClick={() => onPreview(cue)}>Preview</button>
    </div>
  );
}

function labelOf(ref: string, sounds: { id: string; name: string }[]) {
  if (ref === "none") return "no sound";
  return BUILTIN_SOUNDS.find((b) => b.ref === ref)?.name ?? sounds.find((s) => `upload:${s.id}` === ref)?.name ?? "missing";
}

export default function Soundboard() {
  const be = useBackend();
  const db = useDB();
  const run = useRun();
  const toast = useToast();
  const { preview, popups } = usePreview();
  const [draft, setDraft] = useState<Partial<Record<CueKey, Cue>>>({});
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const usedBy = (ref: string) =>
    CUE_KEYS.filter((k) => db.soundboard.cues[k].sound === ref).length + db.challenges.filter((c) => CUE_KEYS.some((k) => c.cues?.[k]?.sound === ref)).length;

  async function upload(f: File) {
    if (f.size > MAX_SOUND_BYTES) { toast(`That file is ${Math.round(f.size / 1024)} KB. The limit is ${MAX_SOUND_BYTES / 1024} KB; trim it to a few seconds.`, "bad"); return; }
    setBusy(true);
    const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
    await run(be.uploadSound(f.name, dataUrl), `"${f.name}" added to the soundboard`);
    setBusy(false);
    if (file.current) file.current.value = "";
  }

  return (
    <div className="max-w-4xl space-y-8">
      <PageHead title="Soundboard">
        Pick the meme sound and pop-up for each moment. These are the event defaults; any challenge can override them in its editor
        (Challenge library, then Edit, then Meme sounds).
      </PageHead>

      <section className="space-y-4">
        {CUE_KEYS.map((k) => {
          const changed = draft[k] !== undefined;
          return (
            <div key={k} className="panel p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[17px] font-semibold">{CUE_LABELS[k].title}</h2>
                <p className="text-[13px] text-deep/60">{CUE_LABELS[k].when}</p>
              </div>
              <CueEditor k={k} idPrefix="board" value={draft[k] ?? db.soundboard.cues[k]} onChange={(c) => c && setDraft((d) => ({ ...d, [k]: c }))} onPreview={(c) => preview(k, c)} />
              {changed && (
                <div className="mt-3 flex justify-end gap-2">
                  <button className="btn btn-line btn-sm" onClick={() => setDraft((d) => { const n = { ...d }; delete n[k]; return n; })}>Undo</button>
                  <button className="btn btn-kelp btn-sm" onClick={() => run(be.updateCue(k, draft[k]!), `${CUE_LABELS[k].title} saved`).then((ok) => { if (ok) setDraft((d) => { const n = { ...d }; delete n[k]; return n; }); })}>Save</button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold">Sound library</h2>
            <p className="text-[13px] text-deep/60">MP3, WAV, OGG or M4A, up to {MAX_SOUND_BYTES / 1024} KB. Short clips work best.</p>
          </div>
          <label className={`btn btn-kelp btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? "Uploading…" : "Upload a sound"}
            <input ref={file} type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          </label>
        </div>
        <ul className="divide-y divide-fin-200/70">
          {[...BUILTIN_SOUNDS.map((b) => ({ ref: b.ref, name: b.name, info: "Built in", del: false })),
            ...db.soundboard.sounds.map((s) => ({ ref: `upload:${s.id}`, name: s.name, info: `${Math.round(s.bytes / 1024)} KB, uploaded`, del: true }))].map((s) => (
            <li key={s.ref} className="flex flex-wrap items-center gap-3 py-3">
              <button className="grid h-9 w-9 place-items-center rounded-full bg-deep text-white" aria-label={`Play ${s.name}`}
                onClick={() => playSound(be.soundSrc(s.ref), 6, s.ref === "builtin:deal" ? playDeal : undefined)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
              </button>
              <span className="min-w-[10rem] flex-1"><b>{s.name}</b><span className="block text-[13px] text-deep/60">{s.info}{usedBy(s.ref) ? `, used ${usedBy(s.ref)}×` : ""}</span></span>
              {s.del && <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete "${s.name}"? Moments using it go back to their default sound.`)) void run(be.deleteSound(s.ref.slice(7)), "Sound deleted"); }}>Delete</button>}
            </li>
          ))}
        </ul>
      </section>
      {popups}
    </div>
  );
}
