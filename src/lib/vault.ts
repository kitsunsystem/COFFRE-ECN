// Coffre operations. Each sub-section has its own key (SSK); the owner's vault key (VMK) wraps them all.
// A card holder only ever receives the SSKs the owner attributed to them, sealed to their card.
// Each file has its own key, kept inside its (encrypted) element: changing a sub-section key never re-uploads files.
import { del, get, set as idbSet } from "idb-keyval";
import { closeProcedureRemote, loadHolderView, remote, trustOfCard } from "./api";
import { holderKeys, keyFrom, purposeOf, type Enrolled, type Tap } from "./cards";
import { fromB64, na, newKey, newSalt, open, openBytes, openFrom, openJson, seal, sealBytes, sealJson, sealTo, toB64, type Sealed } from "./crypto";
import { PROD } from "./env";
import { isReleased, type Moment } from "./rules";
import { ALL_SUBSECTIONS, SECTIONS } from "./sections";
import { now, ownerCards, packOf, uid, useApp, useSession, type Card, type Envelope, type OpenSession, type VaultItem } from "./store";

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  k?: string; // the file's own key (base64), only ever stored encrypted inside the element
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

// Where the Coffre being read lives: the owner's own data, or (production) the part of someone else's that was released.
function src() {
  const st = useApp.getState();
  const h = useSession.getState().session.mode === "holder" ? st.holder : undefined;
  return h ? { items: h.items, envelopes: h.envelopes, procedures: h.procedures, ownerId: h.ownerId } : { items: st.vault.items, envelopes: st.vault.envelopes, procedures: st.procedures, ownerId: st.me?.userId ?? "local" };
}

/* ---------- Encrypted files: IndexedDB in the demo, private bucket in production ---------- */

const putBlob = async (subId: string, id: string, bytes: Uint8Array) => (PROD ? remote.putBlob(src().ownerId, subId, id, bytes) : idbSet(`blob:${id}`, bytes));
const getBlob = async (subId: string, id: string) => (PROD ? remote.getBlob(src().ownerId, subId, id) : get<Uint8Array>(`blob:${id}`));
const delBlobs = async (subId: string, ids: string[]) => (PROD ? remote.delBlobs(src().ownerId, subId, ids) : Promise.all(ids.map((f) => del(`blob:${f}`))).then(() => undefined));

/* ---------- Cards ---------- */

async function newSubsectionKeys(vmk: Uint8Array, ids: string[]) {
  const ssk: Record<string, Sealed> = {};
  for (const id of ids) ssk[id] = await seal(vmk, await newKey(), sskAad(id));
  return ssk;
}

export async function activateOwnerCard(card: Card, enrolled: Enrolled, pin?: string) {
  const st = useApp.getState();
  const session = useSession.getState().session;
  let vmk: Uint8Array;
  let salt = st.vault.salt;
  if (session.mode === "owner") vmk = session.vmk;
  else if (!salt || !ownerCards(st).some((c) => c.status === "active")) {
    // First card ever (or every card lost): the vault is born here, with one key per sub-section.
    // Anything left from a previous vault could never be opened again, so it goes.
    vmk = await newKey();
    salt = await newSalt();
    const ssk = await newSubsectionKeys(vmk, ALL_SUBSECTIONS.map((s) => s.id));
    for (const it of st.vault.items) {
      await remote.deleteItem(it.id);
      await delBlobs(it.subsectionId, it.fileIds);
    }
    await remote.vaultInit(salt, ssk);
    st.set((s) => ({ vault: { salt, ssk, items: [], envelopes: s.vault.envelopes } }));
  } else throw new Error("Ouvrez d'abord votre Coffre avec une carte déjà activée.");

  const kek = await keyFrom(enrolled.secret, enrolled.kind, pin, salt!);
  const wrappedVmk = await seal(kek, vmk, vmkAad(card.id));
  await remote.activateOwnerCard(card.id, enrolled.kind, enrolled.chipId, wrappedVmk);
  useApp.getState().set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? { ...c, status: "active", activatedAt: now(), wrappedVmk, kind: enrolled.kind, chipId: enrolled.chipId } : c)) }));
  useSession.getState().setSession({ mode: "owner", cardId: card.id, vmk });
}

// A beneficiary's card: from the owner's phone (pack handed over in person) or from the beneficiary's own account.
export async function activateHolderCard(card: Card, enrolled: Enrolled, pin?: string) {
  const salt = await newSalt();
  const keys = await holderKeys(enrolled.secret, enrolled.kind, pin, salt);
  await remote.activateHolderCard(card.id, enrolled.kind, enrolled.chipId, keys.publicKeyB64, salt);
  const update = (c: Card): Card => (c.id === card.id ? { ...c, status: "active", activatedAt: now(), boxPk: keys.publicKeyB64, salt, kind: enrolled.kind, chipId: enrolled.chipId } : c);
  useApp.getState().set((s) => ({ cards: s.cards.map(update), trusts: s.trusts.map((t) => ({ ...t, cards: t.cards.map(update) })) }));
  // The new card inherits its person's rights now if the Coffre is open, otherwise the next time the owner opens it.
  if (useSession.getState().session.mode === "owner") await syncEnvelopes();
}

// The keys a card and its code give, without opening anything here: the phone uses them to approve a computer.
export async function cardKeys(tap: Tap, pin?: string): Promise<OpenSession> {
  if (Date.now() < lockedUntil) throw new Error("Trop d'essais. Patientez quelques minutes.");
  const st = useApp.getState();
  const card = tap.card;
  if (card.status !== "active") throw new Error("Cette carte n'est pas encore activée.");
  try {
    let keys: OpenSession;
    if (purposeOf(card) === "unlock") {
      const kek = await keyFrom(tap.secret, card.kind, pin, st.vault.salt!);
      keys = { mode: "owner", cardId: card.id, vmk: await open(kek, card.wrappedVmk!, vmkAad(card.id)) };
    } else {
      const k = await holderKeys(tap.secret, card.kind, pin, card.salt!);
      if (k.publicKeyB64 !== card.boxPk) throw new Error("bad code");
      keys = { mode: "holder", cardId: card.id, publicKey: k.publicKey, privateKey: k.privateKey };
    }
    failedAttempts = 0;
    return keys;
  } catch {
    if (++failedAttempts >= 5) {
      lockedUntil = Date.now() + 5 * 60_000;
      failedAttempts = 0;
    }
    throw new Error(pin ? "Code incorrect. Réessayez." : "Cette carte n'ouvre pas ce Coffre.");
  }
}

// Opens the Coffre on this device with keys from a card, or sent by the phone to a trusted computer.
export async function openSession(keys: OpenSession): Promise<"owner" | "holder"> {
  useSession.getState().setSession(keys);
  // Never reported as a wrong code: the Coffre is open, these only bring it up to date.
  if (keys.mode === "owner") await ensureSubsectionKeys().then(syncEnvelopes).catch(console.error);
  else if (PROD) {
    const trust = trustOfCard(keys.cardId);
    const card = trust?.cards.find((c) => c.id === keys.cardId);
    if (trust && card) await loadHolderView(trust, card);
  }
  return keys.mode;
}

export const unlock = async (tap: Tap, pin?: string) => openSession(await cardKeys(tap, pin));

export const lock = () => {
  useSession.getState().setSession({ mode: "locked" });
  if (useApp.getState().holder) useApp.getState().set({ holder: undefined });
};

// New sub-sections added to the product after the vault was created get their key at the next opening.
async function ensureSubsectionKeys() {
  const vmk = ownerVmk();
  const st = useApp.getState();
  const missing = ALL_SUBSECTIONS.map((s) => s.id).filter((id) => !st.vault.ssk[id]);
  if (!missing.length || !st.vault.salt) return;
  const ssk = { ...st.vault.ssk, ...(await newSubsectionKeys(vmk, missing)) };
  await remote.putSsk(ssk);
  st.set((s) => ({ vault: { ...s.vault, ssk } }));
}

export async function subsectionKey(subId: string): Promise<Uint8Array | null> {
  const ses = useSession.getState().session;
  const st = useApp.getState();
  if (ses.mode === "owner") return st.vault.ssk[subId] ? open(ses.vmk, st.vault.ssk[subId], sskAad(subId)) : null;
  if (ses.mode === "holder") {
    const { envelopes, procedures } = src();
    const env = envelopes.find((e) => e.cardId === ses.cardId && e.subsectionId === subId && isReleased(e.moment, procedures, now()));
    return env ? openFrom(env.sealed, ses.publicKey, ses.privateKey) : null;
  }
  return null;
}

export function visibleSubsections(): string[] {
  const ses = useSession.getState().session;
  if (ses.mode === "owner") return ALL_SUBSECTIONS.map((s) => s.id);
  if (ses.mode === "holder") {
    const { envelopes, procedures } = src();
    return envelopes.filter((e) => e.cardId === ses.cardId && isReleased(e.moment, procedures, now())).map((e) => e.subsectionId);
  }
  return [];
}

// The items of the Coffre being read (own, or released to the holder's card), for counts and lists.
export const coffreItems = () => src().items;

export async function readItems(subId: string): Promise<{ item: VaultItem; payload: ItemPayload }[]> {
  const key = await subsectionKey(subId);
  if (!key) return [];
  const items = src().items.filter((i) => i.subsectionId === subId);
  return Promise.all(items.map(async (item) => ({ item, payload: await openJson<ItemPayload>(key, item.data, itemAad(item.id)) })));
}

// Discovery phase: no personal document may be stored before the official launch (HDS hosting, final encryption).
function assertLaunched() {
  if (useApp.getState().phase !== "lancement") throw new Error("L'ajout de documents ouvrira au lancement officiel.");
}

export async function saveItem(subId: string, payload: ItemPayload, id = uid()) {
  ownerVmk();
  assertLaunched();
  const key = (await subsectionKey(subId))!;
  const data = await sealJson(key, payload, itemAad(id));
  const item: VaultItem = { id, subsectionId: subId, data, fileIds: payload.files.map((f) => f.id), updatedAt: now() };
  await remote.putItem(item);
  const removed = (useApp.getState().vault.items.find((i) => i.id === id)?.fileIds ?? []).filter((f) => !payload.files.some((x) => x.id === f));
  await delBlobs(subId, removed).catch(console.error);
  useApp.getState().set((s) => ({ vault: { ...s.vault, items: [...s.vault.items.filter((i) => i.id !== id), item] } }));
  return id;
}

export async function deleteItem(id: string) {
  ownerVmk();
  const st = useApp.getState();
  const item = st.vault.items.find((i) => i.id === id);
  await remote.deleteItem(id);
  if (item) await delBlobs(item.subsectionId, item.fileIds).catch(console.error);
  st.set((s) => ({ vault: { ...s.vault, items: s.vault.items.filter((i) => i.id !== id) } }));
}

export async function encryptFile(subId: string, file: File): Promise<FileMeta> {
  assertLaunched();
  ownerVmk();
  const s = await na();
  const fk = await newKey();
  const id = uid();
  await putBlob(subId, id, await sealBytes(fk, new Uint8Array(await file.arrayBuffer()), fileAad(id)));
  return { id, name: file.name, size: file.size, type: file.type || "application/octet-stream", k: toB64(s, fk) };
}

export async function decryptFile(subId: string, meta: FileMeta) {
  const [s, bytes] = await Promise.all([na(), getBlob(subId, meta.id)]);
  if (!bytes || !meta.k || !(await subsectionKey(subId))) throw new Error("Document introuvable.");
  const plain = await openBytes(fromB64(s, meta.k), bytes, fileAad(meta.id));
  return new Blob([plain.slice().buffer], { type: meta.type });
}

// New key for a sub-section: used when someone loses access, so they cannot read anything written afterwards.
// The elements are re-encrypted and the envelopes resealed in one database transaction (all or nothing).
export async function rotate(subId: string) {
  const vmk = ownerVmk();
  const st = useApp.getState();
  if (!st.vault.ssk[subId]) return;
  const oldKey = await open(vmk, st.vault.ssk[subId], sskAad(subId));
  const fresh = await newKey();
  const items: VaultItem[] = [];
  for (const it of st.vault.items) {
    if (it.subsectionId !== subId) items.push(it);
    else items.push({ ...it, data: await sealJson(fresh, await openJson<ItemPayload>(oldKey, it.data, itemAad(it.id)), itemAad(it.id)) });
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
  await remote.rotate(subId, wrapped, items, envelopes);
  st.set((s) => ({ vault: { ...s.vault, items, envelopes, ssk: { ...s.vault.ssk, [subId]: wrapped } } }));
}

// Rights belong to a person and apply to every active card of their 2-card pack.
export async function setRight(personId: string, subId: string, moment: Moment) {
  ownerVmk();
  const st = useApp.getState();
  const prev = st.rights[personId]?.[subId] ?? "jamais";
  if (prev === moment) return;
  const cards = packOf(st, personId).filter((c) => c.status === "active" && c.boxPk);
  const others = st.vault.envelopes.filter((e) => !(cards.some((c) => c.id === e.cardId) && e.subsectionId === subId));
  const key = moment === "jamais" ? null : (await subsectionKey(subId))!;
  const added: Envelope[] = key ? await Promise.all(cards.map(async (c) => ({ cardId: c.id, subsectionId: subId, moment: moment as Envelope["moment"], sealed: await sealTo(c.boxPk!, key) }))) : [];
  await remote.setRight(personId, subId, moment, moment === "jamais" ? cards.map((c) => c.id) : [], added);
  st.set((s) => ({ rights: { ...s.rights, [personId]: { ...s.rights[personId], [subId]: moment } }, vault: { ...s.vault, envelopes: [...others, ...added] } }));
  if (moment === "jamais" && prev !== "jamais") await rotate(subId);
}

export async function setSectionRight(personId: string, sectionId: string, moment: Moment) {
  const section = SECTIONS.find((s) => s.id === sectionId)!;
  for (const sub of section.subsections) await setRight(personId, sub.id, moment);
}

// Seals the missing envelopes, e.g. for a card activated while the Coffre was closed (keys are only available when it is open).
export async function syncEnvelopes() {
  ownerVmk();
  const st = useApp.getState();
  const missing: Envelope[] = [];
  for (const [personId, subs] of Object.entries(st.rights))
    for (const card of packOf(st, personId).filter((c) => c.status === "active" && c.boxPk))
      for (const [subId, m] of Object.entries(subs)) {
        if (m === "jamais" || st.vault.envelopes.some((e) => e.cardId === card.id && e.subsectionId === subId)) continue;
        const key = await subsectionKey(subId);
        if (key) missing.push({ cardId: card.id, subsectionId: subId, moment: m, sealed: await sealTo(card.boxPk!, key) });
      }
  if (!missing.length) return;
  await remote.addEnvelopes(missing);
  st.set((s) => ({ vault: { ...s.vault, envelopes: [...s.vault.envelopes, ...missing] } }));
}

// Demo only (production: the server functions "procedures-tick" and "relances" do it).
// The end of a Coffre: after the post-death access period, or at the end of the grace period for an unpaid subscription.
export async function eraseCoffre() {
  const st = useApp.getState();
  await Promise.all(st.vault.items.flatMap((i) => i.fileIds).map((f) => del(`blob:${f}`)));
  st.set({ vault: { ssk: {}, items: [], envelopes: [] }, rights: {} });
  lock();
}

// After a coup dur, the owner takes the keys back: every sub-section opened for that case gets a new key.
export async function closeCoupDur(procedureId: string) {
  ownerVmk();
  const st = useApp.getState();
  const subs = [...new Set(st.vault.envelopes.filter((e) => e.moment === "coup_dur").map((e) => e.subsectionId))];
  for (const sub of subs) await rotate(sub);
  await closeProcedureRemote(procedureId);
  st.set((s) => ({ procedures: s.procedures.map((p) => (p.id === procedureId ? { ...p, closedAt: now() } : p)) }));
}

// Demo only. Death finalized: "À effacer" disappears without ever being read (its key was never given to anyone).
export async function destroyPrivate() {
  const st = useApp.getState();
  const doomed = st.vault.items.filter((i) => i.subsectionId === "prive");
  await Promise.all(doomed.flatMap((i) => i.fileIds).map((f) => del(`blob:${f}`)));
  const { prive: _gone, ...ssk } = st.vault.ssk;
  st.set((s) => ({ vault: { ...s.vault, ssk, items: s.vault.items.filter((i) => i.subsectionId !== "prive") } }));
}

// Concierge: it only sees what the family explicitly shares, sealed to its own key.
// Demo: a key pair kept in this browser. Production: the partner's public key (app_settings); its private key never comes here.
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
  const publicKeyB64 = PROD ? useApp.getState().conciergeKey : (await conciergeKeys()).publicKeyB64;
  if (!publicKeyB64) throw new Error("La conciergerie n'est pas encore raccordée.");
  const sealed = await sealTo(publicKeyB64, new TextEncoder().encode(JSON.stringify({ subsectionId: item.subsectionId, ...payload, files: payload.files.map((f) => f.name) })));
  await remote.shareConcierge(caseId, item.id, sealed);
  useApp.getState().set((s) => ({
    concierge: s.concierge.map((c) => (c.id === caseId ? { ...c, shared: [...c.shared.filter((x) => x.itemId !== item.id), { itemId: item.id, sealed }] } : c)),
  }));
}
