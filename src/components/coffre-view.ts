"use client";
// The Coffre being read: the owner's own, or (beneficiary card) the part of someone else's that was released to it.
import { personName, useApp, useSession } from "@/lib/store";

export function useCoffreView() {
  const session = useSession((s) => s.session);
  const holder = useApp((s) => s.holder);
  const vault = useApp((s) => s.vault);
  const procedures = useApp((s) => s.procedures);
  const account = useApp((s) => s.account);
  const people = useApp((s) => s.people);
  const cards = useApp((s) => s.cards);
  const owner = session.mode === "owner";
  if (session.mode === "holder" && holder)
    return { owner, items: holder.items, envelopes: holder.envelopes, procedures: holder.procedures, ownerName: holder.ownerName, holderName: holder.holderName, business: true };
  const holderName = session.mode === "holder" ? personName(people, cards.find((c) => c.id === session.cardId)?.holderId ?? "") : "";
  return {
    owner,
    items: vault.items,
    envelopes: vault.envelopes,
    procedures,
    ownerName: account ? `${account.firstName} ${account.lastName}` : "votre proche",
    holderName,
    // A beneficiary sees "Entreprise" if something in it was released to them; the owner only if they run a business.
    business: !owner || !!account?.isBusinessOwner,
  };
}
