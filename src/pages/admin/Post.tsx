import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { THEME_INFO, ThemeArt } from "../../components/themes";
import { useToast } from "../../components/ui";
import type { ChallengeInput } from "../../data/backend";
import { WAVE_SIZE } from "../../data/scoring";
import { useBackend, useDB } from "../../data/store";
import { downloadText, fromLocalInput } from "../../lib/format";
import { PageHead } from "./Admin";
import { ChallengeFields, blankChallenge } from "./ChallengeFields";

const TEMPLATE = `title,type,theme,points,flag,description,hint,hint_cost,attempts,files
"Bin Day",OSINT,plastics,100,ECO{replace-me-1},"Which photo was taken at the loading dock?","Photos remember more than they show",10,10,photos.zip|files/photos.zip
"Power Down",Python,energy,150,ECO{replace-me-2},"Which meter lies?",,,0,
"Every Drop",Data & SQL,water,150,ECO{replace-me-3},"Find the haulier that billed for water never delivered.","Duplicate rows count once",20,8,
"Dead Circuits",OSINT,ewaste,200,ECO{replace-me-4},"Which company shipped the laptops?",,,5,
"Last Plate",Crypto,food,250,ECO{replace-me-5},"Decode the canteen memo.",,,0,
`;

type When = "now" | "schedule" | "draft";

function ReleasePicker({ when, setWhen, at, setAt }: { when: When; setWhen: (w: When) => void; at: string; setAt: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="label">When should players see it?</legend>
      <div className="flex flex-wrap items-center gap-2">
        {([["now", "Post now"], ["schedule", "Schedule"], ["draft", "Save as draft"]] as const).map(([k, l]) => (
          <label key={k} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[14px] font-medium ${when === k ? "border-deep bg-deep text-white" : "border-fin-200 bg-white"}`}>
            <input type="radio" name="when" className="sr-only" checked={when === k} onChange={() => setWhen(k)} />{l}
          </label>
        ))}
        {when === "schedule" && <input type="datetime-local" className="field w-auto" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Release time" />}
      </div>
    </fieldset>
  );
}

export default function Post() {
  const be = useBackend();
  const db = useDB();
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "single" ? "single" : "wave";
  const firstType = db.types[0].id;
  const [slots, setSlots] = useState<ChallengeInput[]>(() => Array.from({ length: WAVE_SIZE }, () => blankChallenge(firstType)));
  const [single, setSingle] = useState<ChallengeInput>(() => blankChallenge(firstType));
  const [open, setOpen] = useState(0);
  const [when, setWhen] = useState<When>("now");
  const [at, setAt] = useState("");
  const [error, setError] = useState("");
  const [fileMsg, setFileMsg] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const nextWave = Math.max(0, ...db.waves.map((w) => w.number)) + 1;

  function releaseAt(): string | null | false {
    if (when === "now") return new Date().toISOString();
    if (when === "draft") return null;
    if (!at) { setError("Pick a date and time to schedule it."); return false; }
    return fromLocalInput(at);
  }

  async function fill(text: string) {
    setError(""); setFileMsg([]);
    try {
      const r = be.parseChallengeFile(text);
      const msgs = [...r.errors];
      if (mode === "wave") {
        const take = r.items.slice(0, WAVE_SIZE);
        setSlots((s) => s.map((x, i) => take[i] ?? x));
        if (r.items.length > WAVE_SIZE) msgs.push(`Only the first ${WAVE_SIZE} were loaded. A wave has ${WAVE_SIZE} challenges.`);
        msgs.unshift(`Loaded ${take.length} challenge${take.length === 1 ? "" : "s"} into the form. Check them, then post.`);
      } else if (r.items[0]) {
        setSingle(r.items[0]);
        msgs.unshift("Loaded the first challenge into the form.");
      }
      setFileMsg(msgs);
    } catch (e) { setError((e as Error).message); }
  }

  async function post() {
    setError("");
    const rel = releaseAt();
    if (rel === false) return;
    setBusy(true);
    try {
      if (mode === "wave") {
        await be.postWave(slots, rel);
        toast(`Wave ${nextWave} ${when === "now" ? "is live" : when === "draft" ? "saved as a draft" : "is scheduled"}`, "ok");
        if (when === "now" && be.db().settings.startsAt) await be.postNotification(`Wave ${nextWave} is live`, "Five new challenges just dropped. Good luck!", "info");
        setSlots(Array.from({ length: WAVE_SIZE }, () => blankChallenge(firstType)));
      } else {
        const c = await be.saveChallenge(null, single, rel);
        toast(`"${c.title}" ${when === "now" ? "is live" : when === "draft" ? "saved as a draft" : "is scheduled"}`, "ok");
        if (when === "now" && be.db().settings.startsAt) await be.postNotification("New challenge live", `${c.title} (${c.points} points) is now open.`, "info");
        setSingle(blankChallenge(firstType));
      }
      nav("../library");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const filled = slots.filter((s) => s.title.trim() && s.flag?.trim()).length;
  return (
    <div className="max-w-4xl">
      <PageHead title="Post challenges">Post five challenges together as a wave, or one challenge on its own. Flags are hashed the moment you post and are never stored as text.</PageHead>
      <div className="mb-6 inline-flex rounded-full bg-white p-1 ring-1 ring-fin-200" role="tablist">
        {([["wave", `Wave of ${WAVE_SIZE}`], ["single", "Single challenge"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setParams(k === "single" ? { mode: "single" } : {}); setError(""); setFileMsg([]); }}
            className={`rounded-full px-4 py-1.5 text-[14px] font-semibold ${mode === k ? "bg-deep text-white" : "text-deep/70"}`}>{l}</button>
        ))}
      </div>

      <div className="panel mb-6 flex flex-wrap items-center gap-3 p-4 text-[14px]">
        <span className="text-deep/70">Have them in a spreadsheet?</span>
        <label className="btn btn-line btn-sm cursor-pointer">Load CSV or JSON
          <input type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) fill(await f.text()); e.target.value = ""; }} />
        </label>
        <button className="btn btn-line btn-sm" onClick={() => downloadText("ecocypher-wave-template.csv", TEMPLATE, "text/csv")}>Download template</button>
        {fileMsg.length > 0 && <ul className="w-full list-disc pl-5 text-[13.5px] text-deep/80">{fileMsg.map((m) => <li key={m}>{m}</li>)}</ul>}
      </div>

      {mode === "wave" ? (
        <>
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-[19px] font-bold">Wave {nextWave}</h2><span className="text-[13.5px] text-deep/60">{filled} of {WAVE_SIZE} ready</span></div>
          <ol className="space-y-3">
            {slots.map((s, i) => (
              <li key={i} className="panel overflow-hidden">
                <button className="flex w-full items-center gap-4 px-5 py-4 text-left" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-[13px] font-bold ${s.title.trim() && s.flag?.trim() ? "bg-kelp text-white" : "bg-foam text-deep/60"}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.title || `Challenge ${i + 1}`}</span>
                    <span className="text-[13px] text-deep/60">{THEME_INFO[s.theme].label}, {db.types.find((t) => t.id === s.typeId)?.name}, {s.points} points{!s.flag?.trim() && ", no flag yet"}</span>
                  </span>
                  <ThemeArt theme={s.theme} size={30} />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="border-t border-fin-200/60 p-5">
                        <ChallengeFields idPrefix={`w${i}`} value={s} onChange={(v) => setSlots((x) => x.map((y, j) => j === i ? v : y))} />
                        {i < WAVE_SIZE - 1 && <button className="btn btn-line btn-sm mt-4" onClick={() => setOpen(i + 1)}>Next challenge</button>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="panel p-5"><ChallengeFields idPrefix="single" value={single} onChange={setSingle} /></div>
      )}

      <div className="panel mt-6 flex flex-wrap items-end justify-between gap-4 p-5">
        <ReleasePicker when={when} setWhen={setWhen} at={at} setAt={setAt} />
        <button className="btn btn-kelp" disabled={busy || (mode === "wave" && filled < WAVE_SIZE)} onClick={post}>
          {busy ? "Hashing flags…" : mode === "wave" ? (when === "draft" ? `Save wave ${nextWave} as draft` : when === "schedule" ? `Schedule wave ${nextWave}` : `Post wave ${nextWave}`) : when === "draft" ? "Save draft" : when === "schedule" ? "Schedule challenge" : "Post challenge"}
        </button>
      </div>
      {mode === "wave" && filled < WAVE_SIZE && <p className="mt-2 text-[13px] text-deep/60">Fill in a title and flag for all {WAVE_SIZE} challenges to post the wave.</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral">{error}</p>}
    </div>
  );
}
