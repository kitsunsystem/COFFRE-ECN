// Coffre operations. Each sub-section has its own key (SSK); the owner's vault key (VMK) wraps them all.
// A card holder only ever receives the SSKs the owner attributed to them, sealed to their card.
import { del, get, set as idbSet } from "idb-keyval";
import { cardAndCode, demoChip, holderKeys } from "./cards";
import { na, newKey, newSalt, open, openFrom, openJson, seal, sealJson, sealTo, toB64, type Sealed } from "./crypto";
import { isReleased, type Moment } from "./rules";
import { ALL_SUBSECTIONS, SECTIONS } from "./sections";
import { now, uid, useApp, useSession, type Envelope, type VaultItem } from "./store";

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
}
export interface ItemPayload {
  title: string;
  fields: Record<string, string>;
  files: FileMeta[];
}

const vmkAad = (cardId: string) => `vmk:${cardId}`;
const sskAad = (subId: string) => `ssk:${subId}`;
const itemAad = (id: string) => `item:${id}`;
const fileAad = (id: string) => `file:${id}`;

let failedAttempts = 0;
let lockedUntil = 0;

function ownerVmk() {
  const s = useSession.getState().session;
  if (s.mode !== "owner") throw new Error("Seul le titulaire peut modifier son Coffre.");
  return s.vmk;
}

export async function activateOwnerCard(cardId: string, pin: string) {
  const st = useApp.getState();
  const session = useSession.getState().session;
  let vmk: Uint8Array;
  let salt = st.vault.salt;
  if (session.mode === "owner") vmk = session.vmk;
  else if (!salt) {
    // First card ever: the vault is born here, with one key per sub-section.
    vmk = await newKey();
    salt = await newSalt();
    const ssk: Record<string, Sealed> = {};
    for (const sub of ALL_SUBSECTIONS) ssk[sub.id] = await seal(vmk, await newKey(), sskAad(sub.id));
    st.set((s) => ({ vault: { ...s.vault, salt, ssk } }));
  } else throw new Error("Ouvrez d'abord votre Coffre avec une carte déjà activée.");

  const kek = await cardAndCode(await demoChip(cardId), "unlock", pin, salt!);
  const wrappedVmk = await seal(kek, vmk, vmkAad(cardId));
  useApp.getState().set((s) => ({ cards: s.cards.map((c) => (c.id === cardId ? { ...c, status: "active", activatedAt: now(), wrappedVmk } : c)) }));
  useSession.getState().setSession({ mode: "owner", cardId, vmk });
}

export async function activateHolderCard(cardId: string, pin: string) {
  const salt = await newSalt();
  const keys = await holderKeys(await demoChip(cardId), pin, salt);
  useApp.getState().set((s) => ({ cards: s.cards.map((c) => (c.id === cardId ? { ...c, status: "active", activatedAt: now(), boxPk: keys.publicKeyB64, salt } : c)) }));
}

export async function unlock(cardId: string, pin: string): Promise<"owner" | "holder"> {
  if (Date.now() < lockedUntil) throw new Error("Trop d'essais. Patientez quelques minutes.");
  const st = useApp.getState();
  const card = st.cards.find((c) => c.id === cardId);
  if (!card || card.status !== "active") throw new Error("Cette carte n'est pas encore activée.");
  const chip = await demoChip(cardId);
  try {
    if (card.holderId === "owner") {
      const kek = await cardAndCode(chip, "unlock", pin, st.vault.salt!);
      const vmk = await open(kek, card.wrappedVmk!, vmkAad(cardId));
      useSession.getState().setSession({ mode: "owner", cardId, vmk });
    } else {
      const keys = await holderKeys(chip, pin, card.salt!);
      if (keys.publicKeyB64 !== card.boxPk) throw new Error("bad code");
      useSession.getState().setSession({ mode: "holder", cardId, publicKey: keys.publicKey, privateKey: keys.privateKey });
    }
    failedAttempts = 0;
    return card.holderId === "owner" ? "owner" : "holder";
  } catch {
    if (++failedAttempts >= 5) {
      lockedUntil = Date.now() + 5 * 60_000;
      failedAttempts = 0;
    }
    throw new Error("Code incorrect. Réessayez.");
  }
}

export const lock = () => useSession.getState().setSession({ mode: "locked" });

export async function subsectionKey(subId: string): Promise<Uint8Array | null> {
  const ses = useSession.getState().session;
  const st = useApp.getState();
  if (ses.mode === "owner") return st.vault.ssk[subId] ? open(ses.vmk, st.vault.ssk[subId], sskAad(subId)) : null;
  if (ses.mode === "holder") {
    const env = st.vault.envelopes.find((e) => e.cardId === ses.cardId && e.subsectionId === subId && isReleased(e.moment, st.procedures, now()));
    return env ? openFrom(env.sealed, ses.publicKey, ses.privateKey) : null;
  }
  return null;
}

export function visibleSubsections(): string[] {
  const ses = useSession.getState().session;
  const st = useApp.getState();
  if (ses.mode === "owner") return ALL_SUBSECTIONS.map((s) => s.id);
  if (ses.mode === "holder")
    return st.vault.envelopes.filter((e) => e.cardId === ses.cardId && isReleased(e.moment, st.procedures, now())).map((e) => e.subsectionId);
  return [];
}

export async function readItems(subId: string): Promise<{ item: VaultItem; payload: ItemPayload }[]> {
  const key = await subsectionKey(subId);
  if (!key) return [];
  const items = useApp.getState().vault.items.filter((i) => i.subsectionId === subId);
  return Promise.all(items.map(async (item) => ({ item, payload: await openJson<ItemPayload>(key, item.data, itemAad(item.id)) })));
}

export async function saveItem(subId: string, payload: ItemPayload, id = uid(), remind = true) {
  ownerVmk();
  const key = (await subsectionKey(subId))!;
  const data = await sealJson(key, payload, itemAad(id));
  const expiry = Object.entries(payload.fields).find(([k, v]) => (k === "expiry" || k === "date") && v)?.[1];
  const removed = (useApp.getState().vault.items.find((i) => i.id === id)?.fileIds ?? []).filter((f) => !payload.files.some((x) => x.id === f));
  await Promise.all(removed.map((f) => del(`blob:${f}`)));
  useApp.getState().set((s) => ({
    vault: { ...s.vault, items: [...s.vault.items.filter((i) => i.id !== id), { id, subsectionId: subId, data, fileIds: payload.files.map((f) => f.id), updatedAt: now() }] },
    // Only the date leaves the Coffre, so the e-mail reminder can be sent without knowing what it is about.
    reminders: [...s.reminders.filter((r) => r.itemId !== id), ...(remind && expiry ? [{ itemId: id, date: expiry }] : [])],
  }));
  return id;
}

export async function deleteItem(id: string) {
  ownerVmk();
  const st = useApp.getState();
  await Promise.all((st.vault.items.find((i) => i.id === id)?.fileIds ?? []).map((f) => del(`blob:${f}`)));
  st.set((s) => ({ vault: { ...s.vault, items: s.vault.items.filter((i) => i.id !== id) }, reminders: s.reminders.filter((r) => r.itemId !== id) }));
}

export async function encryptFile(subId: string, file: File): Promise<FileMeta> {
  const key = (await subsectionKey(subId))!;
  const id = uid();
  await idbSet(`blob:${id}`, await seal(key, new Uint8Array(await file.arrayBuffer()), fileAad(id)));
  return { id, name: file.name, size: file.size, type: file.type || "application/octet-stream" };
}

export async function decryptFile(subId: string, meta: FileMeta) {
  const key = await subsectionKey(subId);
  const sealed = await get<Sealed>(`blob:${meta.id}`);
  if (!key || !sealed) throw new Error("Document introuvable.");
  const bytes = await open(key, sealed, fileAad(meta.id));
  return new Blob([bytes.slice().buffer], { type: meta.type });
}

// New key for a sub-section: used when someone loses access, so they cannot read anything written afterwards.
export async function rotate(subId: string) {
  const vmk = ownerVmk();
  const st = useApp.getState();
  const oldKey = await open(vmk, st.vault.ssk[subId], sskAad(subId));
  const fresh = await newKey();
  const items: VaultItem[] = [];
  for (const it of st.vault.items) {
    if (it.subsectionId !== subId) {
      items.push(it);
      continue;
    }
    const payload = await openJson<ItemPayload>(oldKey, it.data, itemAad(it.id));
    for (const f of payload.files) {
      const blob = await get<Sealed>(`blob:${f.id}`);
      if (blob) await idbSet(`blob:${f.id}`, await seal(fresh, await open(oldKey, blob, fileAad(f.id)), fileAad(f.id)));
    }
    items.push({ ...it, data: await sealJson(fresh, payload, itemAad(it.id)) });
  }
  const envelopes: Envelope[] = [];
  for (const e of st.vault.envelopes) {
    if (e.subsectionId !== subId) envelopes.push(e);
    else {
      const card = st.cards.find((c) => c.id === e.cardId);
      if (card?.boxPk && card.status === "active") envelopes.push({ ...e, sealed: await sealTo(card.boxPk, fresh) });
    }
  }
  const wrapped = await seal(vmk, fresh, sskAad(subId));
  st.set((s) => ({ vault: { ...s.vault, items, envelopes, ssk: { ...s.vault.ssk, [subId]: wrapped } } }));
}

export async function setRight(cardId: string, subId: string, moment: Moment) {
  ownerVmk();
  const st = useApp.getState();
  const card = st.cards.find((c) => c.id === cardId);
  if (!card?.boxPk) throw new Error("Cette carte doit d'abord être activée par son porteur.");
  const prev = st.rights[cardId]?.[subId] ?? "jamais";
  if (prev === moment) return;
  const others = st.vault.envelopes.filter((e) => !(e.cardId === cardId && e.subsectionId === subId));
  const envelopes = moment === "jamais" ? others : [...others, { cardId, subsectionId: subId, moment, sealed: await sealTo(card.boxPk, (await subsectionKey(subId))!) }];
  st.set((s) => ({ rights: { ...s.rights, [cardId]: { ...s.rights[cardId], [subId]: moment } }, vault: { ...s.vault, envelopes } }));
  if (moment === "jamais" && prev !== "jamais") await rotate(subId);
}

export async function setSectionRight(cardId: string, sectionId: string, moment: Moment) {
  for (const sub of SECTIONS.find((s) => s.id === sectionId)!.subsections) await setRight(cardId, sub.id, moment);
}

// After a coup dur, the owner takes the keys back: every sub-section opened for that case gets a new key.
export async function closeCoupDur(procedureId: string) {
  ownerVmk();
  const st = useApp.getState();
  const subs = [...new Set(st.vault.envelopes.filter((e) => e.moment === "coup_dur").map((e) => e.subsectionId))];
  for (const sub of subs) await rotate(sub);
  st.set((s) => ({ procedures: s.procedures.map((p) => (p.id === procedureId ? { ...p, closedAt: now() } : p)) }));
}

// Death finalized: "À effacer" disappears without ever being read (its key was never given to anyone).
export async function destroyPrivate() {
  const st = useApp.getState();
  const doomed = st.vault.items.filter((i) => i.subsectionId === "prive");
  await Promise.all(doomed.flatMap((i) => i.fileIds).map((f) => del(`blob:${f}`)));
  const { prive: _gone, ...ssk } = st.vault.ssk;
  st.set((s) => ({ vault: { ...s.vault, ssk, items: s.vault.items.filter((i) => i.subsectionId !== "prive") } }));
}

// Concierge: it only sees what the family explicitly shares, sealed to its own key.
export async function conciergeKeys() {
  const s = await na();
  let kp = await get<{ publicKey: Uint8Array; privateKey: Uint8Array }>("concierge-keys");
  if (!kp) {
    kp = s.crypto_box_keypair();
    await idbSet("concierge-keys", kp);
  }
  return { ...kp, publicKeyB64: toB64(s, kp.publicKey) };
}

export async function shareWithConcierge(caseId: string, item: VaultItem, payload: ItemPayload) {
  const { publicKeyB64 } = await conciergeKeys();
  const sealed = await sealTo(publicKeyB64, new TextEncoder().encode(JSON.stringify({ subsectionId: item.subsectionId, ...payload, files: payload.files.map((f) => f.name) })));
  useApp.getState().set((s) => ({
    concierge: s.concierge.map((c) => (c.id === caseId ? { ...c, shared: [...c.shared.filter((x) => x.itemId !== item.id), { itemId: item.id, sealed }] } : c)),
  }));
}
