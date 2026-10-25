"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { bootstrap } from "@/lib/api";
import { PROD } from "@/lib/env";
import { startI18n } from "@/lib/i18n";
import { accessEnd, graceEnd, procedureStatus } from "@/lib/rules";
import { now, personName, useApp } from "@/lib/store";
import { destroyPrivate, eraseCoffre } from "@/lib/vault";

// Demo: local data loaded. Production: session restored and data fetched from the server.
export const useHydrated = () => useApp((s) => s.ready);

export function useNow(intervalMs = 1000) {
  const offset = useApp((s) => s.clockOffset);
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return t + offset;
}

// Demo only: runs the end of each window. In production the server does it (crons "procedures-tick" and "relances").
function ProcedureRunner() {
  const t = useNow(2000);
  useEffect(() => {
    const st = useApp.getState();
    const owner = st.account ? `${st.account.firstName} ${st.account.lastName}` : "Votre proche";
    const day = (ms: number) => new Date(ms).toLocaleDateString("fr-FR", { dateStyle: "long" });
    for (const p of st.procedures) {
      // After a death, the beneficiaries have a limited time; then the whole Coffre is erased for good.
      const end = accessEnd(p);
      if (p.finalizedAt && !p.erasedAt && end && t >= end) {
        void eraseCoffre();
        st.set((s) => ({ procedures: s.procedures.map((x) => (x.id === p.id ? { ...x, erasedAt: now() } : x)) }));
        continue;
      }
      if (p.finalizedAt) continue;
      const status = procedureStatus(p, t);
      if (status !== "terminee" && status !== "active") continue;
      const moments = p.kind === "deces" ? ["coup_dur", "deces"] : ["coup_dur"];
      // One e-mail per beneficiary, not per card of their pack.
      const holders = new Set(st.vault.envelopes.filter((e) => moments.includes(e.moment)).map((e) => st.cards.find((c) => c.id === e.cardId)?.holderId ?? ""));
      for (const id of holders) {
        const person = st.people.find((x) => x.id === id);
        st.email(person?.email ?? personName(st.people, id), "acces-ouvert", { ownerName: owner, ...(end ? { until: day(end) } : {}) });
      }
      if (p.kind === "deces") void destroyPrivate();
      st.set((s) => ({ procedures: s.procedures.map((x) => (x.id === p.id ? { ...x, finalizedAt: now() } : x)) }));
    }
    // Unpaid subscription: everything is erased at the end of the grace period.
    if (st.billing.status === "impaye" && st.billing.since && t >= graceEnd(st.billing.since)) {
      void eraseCoffre();
      st.set({ billing: { status: "efface", since: st.billing.since } });
    }
  }, [t]);
  return null;
}

function Toast() {
  const toast = useApp((s) => s.toast);
  const set = useApp((s) => s.set);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => set({ toast: undefined }), 5000);
    return () => clearTimeout(id);
  }, [toast, set]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4" aria-live="assertive">
      <AnimatePresence>
        {toast && (
          <motion.button
            key={toast.id}
            type="button"
            onClick={() => set({ toast: undefined })}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-left text-[0.95rem] font-semibold shadow-lift ${toast.tone === "error" ? "bg-coral text-paper" : "bg-sage text-paper"}`}
          >
            {toast.tone === "error" ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />}
            {toast.text}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    void startI18n();
    if (PROD) void bootstrap().finally(() => useApp.getState().set({ ready: true }));
    else void Promise.resolve(useApp.persist.rehydrate()).finally(() => useApp.getState().set({ ready: true }));
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      {!PROD && <ProcedureRunner />}
      <Toast />
      {children}
    </MotionConfig>
  );
}
