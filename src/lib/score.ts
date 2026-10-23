// Completeness score (brief §2, "le côté ludique"). Computed only from plain metadata, so the server can
// compute it too for the e-mail reminders without ever reading the Coffre.
import { ESSENTIALS, SECTIONS } from "./sections";
import type { useApp } from "./store";

type S = Pick<ReturnType<typeof useApp.getState>, "account" | "cards" | "guarantors" | "vault">;

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
  const steps: Step[] = [
    { id: "kyc", label: "Vérifier votre identité", hint: "Avec le système de votre conseiller", done: s.account?.kyc === "verifie", href: "/espace/compte" },
    { id: "cartes", label: ownerOrdered ? "Activer vos cartes" : "Commander vos cartes", hint: "Trois cartes ouvrent votre Coffre", done: ownerActive, href: "/espace/cartes" },
    { id: "garants", label: "Choisir vos garants", hint: "Ceux qui préviendront si quelque chose arrive", done: s.guarantors.length > 0, href: "/espace/famille" },
    { id: "essentiels", label: "Remplir l'essentiel", hint: `${essentialsDone(s)} sur ${ESSENTIALS.length} éléments`, done: essentialsDone(s) === ESSENTIALS.length, href: "/coffre/essentiels" },
    { id: "droits", label: "Choisir qui voit quoi", hint: "Pour chaque proche, et à quel moment", done: s.vault.envelopes.length > 0, href: "/coffre/droits" },
  ];
  const subs = SECTIONS.filter((x) => !x.optional).flatMap((x) => x.subsections);
  const filled = subs.filter((sub) => s.vault.items.some((i) => i.subsectionId === sub.id)).length;
  const score = Math.round(
    (s.account ? 5 : 0) +
      (steps[0].done ? 10 : 0) +
      (steps[1].done ? 15 : 0) +
      (steps[2].done ? 10 : 0) +
      (essentialsDone(s) / ESSENTIALS.length) * 40 +
      (steps[4].done ? 5 : 0) +
      (filled / subs.length) * 15,
  );
  return { score: Math.min(100, score), steps, next: steps.find((x) => !x.done) };
}
