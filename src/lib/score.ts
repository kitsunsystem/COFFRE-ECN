// Completeness score (brief §2, "le côté ludique"). Computed only from plain metadata, so the server can
// compute it too for the e-mail reminders without ever reading the Coffre.
import { applicable, protectionDone } from "./protection";
import { ESSENTIALS, SECTIONS } from "./sections";
import type { useApp } from "./store";

type S = Pick<ReturnType<typeof useApp.getState>, "account" | "cards" | "guarantors" | "vault" | "rights" | "checklist">;

export interface Step {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

export const essentialsDone = (s: Pick<S, "vault">) => ESSENTIALS.filter((e) => s.vault.items.some((i) => i.subsectionId === e.subsectionId)).length;

export function progress(s: S) {
  const ownerActive = s.cards.some((c) => c.holderId === "owner" && c.status === "active");
  const ownerOrdered = s.cards.some((c) => c.holderId === "owner");
  const business = !!s.account?.isBusinessOwner;
  const protection = protectionDone(s.checklist, business) / applicable(business).length;
  // Rights count as soon as one is chosen: before the launch there is no Coffre yet to seal them in.
  const rights = Object.values(s.rights).some((r) => Object.values(r).some((m) => m !== "jamais"));
  const steps: Step[] = [
    { id: "kyc", label: "Vérifier votre identité", hint: "Avec le système de votre conseiller", done: s.account?.kyc === "verifie", href: "/espace/compte" },
    { id: "cartes", label: ownerOrdered ? "Activer vos cartes" : "Commander vos cartes", hint: "Trois cartes ouvrent votre Coffre", done: ownerActive, href: "/espace/cartes" },
    { id: "garants", label: "Choisir vos garants", hint: "Ceux qui signaleront un décès", done: s.guarantors.length > 0, href: "/espace/famille" },
    { id: "protection", label: "Faire vos démarches de protection", hint: "Procuration, mandat, testament…", done: protection === 1, href: "/espace/protection" },
    { id: "essentiels", label: "Remplir l'essentiel", hint: `${essentialsDone(s)} sur ${ESSENTIALS.length} éléments`, done: essentialsDone(s) === ESSENTIALS.length, href: "/coffre/essentiels" },
    { id: "droits", label: "Choisir qui voit quoi", hint: "Pour chaque proche, et à quel moment", done: rights, href: "/coffre/droits" },
  ];
  const done = (id: string) => steps.find((x) => x.id === id)!.done;
  const subs = SECTIONS.filter((x) => !x.optional).flatMap((x) => x.subsections);
  const filled = subs.filter((sub) => s.vault.items.some((i) => i.subsectionId === sub.id)).length;
  const score = Math.round(
    (s.account ? 5 : 0) +
      (done("kyc") ? 10 : 0) +
      (done("cartes") ? 15 : 0) +
      (done("garants") ? 10 : 0) +
      protection * 10 +
      (essentialsDone(s) / ESSENTIALS.length) * 35 +
      (done("droits") ? 5 : 0) +
      (filled / subs.length) * 10,
  );
  return { score: Math.min(100, score), steps, next: steps.find((x) => !x.done) };
}
