"use client";
import { MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { procedureStatus } from "@/lib/rules";
import { now, personName, useApp } from "@/lib/store";
import { destroyPrivate } from "@/lib/vault";

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

// Runs the end of each cancellation window (server cron "procedures-tick" in production).
function ProcedureRunner() {
  const t = useNow(2000);
  useEffect(() => {
    const st = useApp.getState();
    for (const p of st.procedures) {
      if (p.finalizedAt) continue;
      const status = procedureStatus(p, t);
      if (status !== "terminee" && status !== "active") continue;
      const moments = p.kind === "deces" ? ["coup_dur", "deces"] : ["coup_dur"];
      const cardIds = new Set(st.vault.envelopes.filter((e) => moments.includes(e.moment)).map((e) => e.cardId));
      const owner = st.account ? `${st.account.firstName} ${st.account.lastName}` : "Votre proche";
      for (const id of cardIds) {
        const card = st.cards.find((c) => c.id === id);
        const person = st.people.find((x) => x.id === card?.holderId);
        if (person?.email) st.email(person.email, "acces-ouvert", { ownerName: owner });
        else st.email(personName(st.people, card?.holderId ?? ""), "acces-ouvert", { ownerName: owner });
      }
      if (p.kind === "deces") void destroyPrivate();
      st.set((s) => ({ procedures: s.procedures.map((x) => (x.id === p.id ? { ...x, finalizedAt: now() } : x)) }));
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
