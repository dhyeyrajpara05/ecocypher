import { motion } from "framer-motion";
import { useEffect } from "react";
import { Footer } from "../components/chrome";
import { SiteHeader, useUnread } from "../components/SiteHeader";
import { Empty } from "../components/ui";
import { useDB, useNow } from "../data/store";
import { ago, clock } from "../lib/format";

export default function Notifications() {
  const db = useDB();
  const now = useNow(15000);
  const { markRead } = useUnread();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { markRead(); }, [db.notifications.length]);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-[32px] font-bold">Notifications</h1>
        <p className="mt-1 text-[15px] text-deep/70">Updates from the organisers. New ones also pop up while you play.</p>
        {db.notifications.length === 0 ? (
          <div className="mt-8"><Empty title="No notifications yet">Check back here during the event.</Empty></div>
        ) : (
          <ol className="mt-8 space-y-3">
            {db.notifications.map((n, i) => (
              <motion.li key={n.id} initial={i === 0 ? { opacity: 0, y: -8 } : false} animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-5 ${n.level === "important" ? "border-coral/40 bg-coral-100/60" : "border-fin-200/70 bg-white"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-sans text-[17px] font-semibold">
                    {n.level === "important" && <span className="chip mr-2 bg-coral text-white">Important</span>}
                    {n.title || "Update"}
                  </h2>
                  <span className="text-[13px] text-deep/55"><span className="tabular">{clock(n.at)}</span>, {ago(n.at, now)}</span>
                </div>
                {n.body && <p className="mt-2 whitespace-pre-line text-[15px] text-deep/85">{n.body}</p>}
              </motion.li>
            ))}
          </ol>
        )}
      </main>
      <Footer />
    </div>
  );
}
