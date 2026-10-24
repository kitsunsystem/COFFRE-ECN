"use client";
import { MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { accessEnd, graceEnd, procedureStatus } from "@/lib/rules";
import { now, personName, useApp } from "@/lib/store";
import { destroyPrivate, eraseCoffre } from "@/lib/vault";

export function useHydrated() {
  // `persist` is missing during the static build (no localStorage on the server).
  const [h, setH] = useState(() => useApp.persist?.hasHydrated() ?? false);
  useEffect(() => {
    if (useApp.persist.hasHydrated()) setH(true);
    return useApp.persist.onFinishHydration(() => setH(true));
  }, []);
  return h;
}

export function useNow(intervalMs = 1000) {
  const offset = useApp((s) => s.clockOffset);
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return t + offset;
}

// Runs the end of each window (server crons "procedures-tick" and "relances" in production).
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

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useApp.persist.rehydrate();
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <ProcedureRunner />
      {children}
    </MotionConfig>
  );
}
