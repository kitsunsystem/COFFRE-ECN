// Every change the app makes goes through here. Demo: the local store only. Production: Supabase first (the database
// checks the rules), then the local store with what the server accepted. Errors are shown to the person, never swallowed.
import { CONCIERGE, OFFER } from "./config";
import { PROD } from "./env";
import { declare, type Moment, type ProcedureKind } from "./rules";
import { envelopeRow, itemRow, personRow, profileRow, toAccount, toCard, toCase, toDevice, toDeviceRequest, toEnvelope, toItem, toPerson, toProcedure, toReminder, toRights, toTrust } from "./rows";
import { sb, q, friendly } from "./supabase";
import { now, personName, toast, uid, useApp, type Account, type Card, type ConciergeCase, type DeviceRequest, type Envelope, type Guarantor, type Person, type Trust, type TrustedDevice, type VaultItem } from "./store";
import type { Sealed } from "./crypto";

const st = () => useApp.getState();
const me = () => {
  const m = st().me;
  if (!m) throw new Error("Votre session a expiré. Reconnectez-vous.");
  return m.userId;
};

// Runs an action and reports failure to the person; returns whether it worked.
async function attempt(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    toast((e as Error).message || "Une erreur est survenue.");
    return false;
  }
}

/* ---------- Session (production) ---------- */

// The Espace opens with an e-mail address and a password; the Coffre never does (card + code, or the phone).
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
const clean = (email: string) => email.trim().toLowerCase();

function authError(e: { message: string }) {
  if (/invalid login/i.test(e.message)) return "Adresse ou mot de passe incorrect.";
  if (/rate|seconds/i.test(e.message)) return "Patientez une minute avant de réessayer.";
  if (/password/i.test(e.message)) return "Mot de passe trop faible : 10 caractères au moins, avec une majuscule, une minuscule et un chiffre.";
  if (/expired|invalid/i.test(e.message)) return "Code incorrect ou expiré.";
  return friendly(e);
}

// New account: the address is confirmed with the 6-digit code it receives (verifyCode).
export async function signUp(email: string, password: string) {
  const { data, error } = await sb().auth.signUp({ email: clean(email), password });
  if (error) throw new Error(authError(error));
  // An address that already has an account receives nothing (Supabase hides it on purpose).
  if (data.user && !data.user.identities?.length) throw new Error("Un compte existe déjà avec cette adresse : connectez-vous.");
}

// "unconfirmed": the account was never confirmed; a new code has just been sent.
export async function signIn(email: string, password: string): Promise<"ok" | "unconfirmed"> {
  const { error } = await sb().auth.signInWithPassword({ email: clean(email), password });
  if (error && /not confirmed/i.test(error.message)) {
    await sb().auth.resend({ type: "signup", email: clean(email) });
    return "unconfirmed";
  }
  if (error) throw new Error(authError(error));
  await loadAll();
  return "ok";
}

export async function verifyCode(email: string, code: string) {
  const { error } = await sb().auth.verifyOtp({ email: clean(email), token: code.trim(), type: "email" });
  if (error) throw new Error(authError(error));
  await loadAll();
}

export async function forgotPassword(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(clean(email));
  if (error) throw new Error(authError(error));
}

export async function resetPassword(email: string, code: string, password: string) {
  const { error } = await sb().auth.verifyOtp({ email: clean(email), token: code.trim(), type: "recovery" });
  if (error) throw new Error(authError(error));
  const { error: e2 } = await sb().auth.updateUser({ password });
  if (e2) throw new Error(authError(e2));
  await loadAll();
}

export async function signOut() {
  if (PROD) {
    await forgetPushToken();
    await sb().auth.signOut().catch(() => {});
  }
  st().reset();
}

// Production start-up: restore the session saved by Supabase Auth, then fetch everything.
export async function bootstrap() {
  const c = sb();
  const { data } = await c.auth.getSession();
  if (data.session) await loadAll().catch((e) => toast((e as Error).message));
  c.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") st().reset();
  });
}

export async function loadAll() {
  const c = sb();
  const { data: auth } = await c.auth.getUser();
  const user = auth.user;
  if (!user) return st().reset();
  // A relative who signs in with the address the owner typed is linked to their records.
  await c.rpc("claim_invitations");
  const id = user.id;
  const [profile, settings, staff, trusts] = await Promise.all([
    q(c.from("profiles").select("*").eq("id", id).maybeSingle()),
    q(c.from("app_settings").select("launched, concierge_public_key").single()),
    q(c.from("staff").select("role").eq("user_id", id).maybeSingle()),
    q(c.rpc("my_trusts")),
  ]);
  const base = {
    ready: true,
    me: { userId: id, email: user.email ?? "" },
    staffRole: (staff as { role?: string } | null)?.role,
    trusts: ((trusts as unknown[]) ?? []).map((t) => toTrust(t as Record<string, unknown>)),
    phase: (settings as { launched: boolean }).launched ? ("lancement" as const) : ("decouverte" as const),
    conciergeKey: (settings as { concierge_public_key?: string }).concierge_public_key ?? undefined,
    holder: undefined,
  };
  if (!profile) {
    st().set({ ...base, account: undefined, people: [], cards: [], guarantors: [], rights: {}, vault: { ssk: {}, items: [], envelopes: [] }, procedures: [], reminders: [], concierge: [], checklist: {} });
    return;
  }
  const own = <T>(table: string, cols = "*") => q<T[]>(c.from(table).select(cols).eq("owner_id", id) as never);
  const [people, guarantors, cards, rights, procedures, reminders, checklist, cases, vault, items, envelopes] = await Promise.all([
    own<Record<string, unknown>>("people"),
    own<Record<string, unknown>>("guarantors"),
    own<Record<string, unknown>>("cards"),
    own<Record<string, unknown>>("rights"),
    own<Record<string, unknown>>("procedures"),
    own<Record<string, unknown>>("reminders"),
    own<Record<string, unknown>>("checklist"),
    own<Record<string, unknown>>("concierge_cases"),
    q(c.from("vaults").select("*").eq("owner_id", id).maybeSingle()),
    own<Record<string, unknown>>("vault_items"),
    own<Record<string, unknown>>("envelopes"),
  ]);
  const shares = cases.length ? await q<Record<string, unknown>[]>(c.from("concierge_shares").select("*").in("case_id", cases.map((x) => x.id as string)) as never) : [];
  const p = profile as Record<string, unknown>;
  st().set({
    ...base,
    account: toAccount(p),
    assistantVoice: p.assistant_voice as boolean,
    reminderConsent: p.reminder_consent as boolean,
    billing: { status: p.billing_status as "a_jour", since: p.billing_since ? new Date(p.billing_since as string).getTime() : undefined },
    people: people.map(toPerson),
    guarantors: guarantors.map((g) => ({ personId: g.person_id as string, role: g.role as string })),
    cards: cards.map(toCard),
    rights: toRights(rights),
    procedures: procedures.map(toProcedure),
    reminders: reminders.map(toReminder),
    checklist: Object.fromEntries(checklist.map((x) => [x.key as string, x.done as boolean])),
    concierge: cases.map((x) => toCase(x, shares)),
    vault: vault
      ? { salt: (vault as Record<string, unknown>).salt as string, ssk: (vault as Record<string, unknown>).ssk as Record<string, Sealed>, items: items.map(toItem), envelopes: envelopes.map(toEnvelope) }
      : { ssk: {}, items: [], envelopes: [] },
  });
}

/* ---------- Inscription ---------- */

export async function createProfile(draft: Omit<Account, "kyc" | "createdAt">, people: Person[]) {
  if (!PROD) {
    st().set({ account: { ...draft, kyc: "verifie", createdAt: Date.now() }, people, tourPending: true });
    st().email(draft.email, "bienvenue", { firstName: draft.firstName });
    return;
  }
  const id = me();
  await q(sb().from("profiles").insert(profileRow(id, draft)));
  if (people.length) await q(sb().from("people").insert(people.map((p) => personRow(p, id))));
  await loadAll();
}

// Manual identity check while the group's KYC system is not connected: the document goes to a private bucket for the team.
export const submitKyc = (file: File) =>
  attempt(async () => {
    const path = `${me()}/${uid()}.${ext(file)}`;
    await q(sb().storage.from("kyc").upload(path, file, { contentType: file.type }));
    await q(sb().rpc("submit_kyc", { doc_path: path }));
    const a = st().account;
    if (a) st().set({ account: { ...a, kyc: "en_cours" } });
  });

const ext = (f: File) => (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);

/* ---------- Compte ---------- */

export const saveAccount = (a: Account) =>
  attempt(async () => {
    if (PROD) {
      await q(sb().from("profiles").update({ phone: a.phone, address: a.address, situation: a.situation, is_business_owner: a.isBusinessOwner }).eq("id", me()));
      const old = st().account?.email;
      if (old && a.email.trim().toLowerCase() !== old.toLowerCase()) {
        const { error } = await sb().auth.updateUser({ email: a.email.trim().toLowerCase() });
        if (error) throw new Error(friendly(error));
        toast("Confirmez la nouvelle adresse avec le lien reçu par e-mail.", "ok");
        a = { ...a, email: old };
      }
    }
    st().set({ account: a });
  });

export const setAssistantVoice = (assistantVoice: boolean) =>
  attempt(async () => {
    if (PROD) await q(sb().from("profiles").update({ assistant_voice: assistantVoice }).eq("id", me()));
    st().set({ assistantVoice });
  });

/* ---------- Famille ---------- */

export const savePerson = (p: Person) =>
  attempt(async () => {
    const person = { ...p, id: p.id || uid() };
    const isNew = !st().people.some((x) => x.id === person.id);
    // Not an upsert: the account link (user_id) and the owner of a relative can never be written by the app.
    if (PROD && isNew) await q(sb().from("people").insert(personRow(person, me())));
    if (PROD && !isNew) {
      const { first_name, last_name, relation, email, phone } = personRow(person, me());
      await q(sb().from("people").update({ first_name, last_name, relation, email, phone }).eq("id", person.id).eq("owner_id", me()));
    }
    st().set((x) => ({ people: isNew ? [...x.people, person] : x.people.map((y) => (y.id === person.id ? person : y)) }));
  });

// Their cards stop opening anything at once (the database deletes the cards and their envelopes with the person).
export const removePerson = (id: string) =>
  attempt(async () => {
    if (PROD) await q(sb().from("people").delete().eq("id", id).eq("owner_id", me()));
    const cardIds = st().cards.filter((c) => c.holderId === id).map((c) => c.id);
    st().set((x) => ({
      people: x.people.filter((p) => p.id !== id),
      guarantors: x.guarantors.filter((g) => g.personId !== id),
      cards: PROD ? x.cards.filter((c) => !cardIds.includes(c.id)) : x.cards.map((c) => (cardIds.includes(c.id) ? { ...c, status: "perdue" as const, boxPk: undefined } : c)),
      rights: Object.fromEntries(Object.entries(x.rights).filter(([k]) => k !== id)),
      vault: { ...x.vault, envelopes: x.vault.envelopes.filter((e) => !cardIds.includes(e.cardId)) },
    }));
  });

export const saveGuarantor = (g: Guarantor) =>
  attempt(async () => {
    const exists = st().guarantors.some((x) => x.personId === g.personId);
    if (PROD) await q(sb().from("guarantors").upsert({ owner_id: me(), person_id: g.personId, role: g.role }));
    st().set((x) => ({ guarantors: exists ? x.guarantors.map((y) => (y.personId === g.personId ? g : y)) : [...x.guarantors, g] }));
    if (!exists && !PROD) {
      const p = st().people.find((x) => x.id === g.personId)!;
      const a = st().account!;
      st().email(p.email || `${p.firstName} ${p.lastName}`, "invitation-garant", { ownerName: `${a.firstName} ${a.lastName}`, role: g.role });
    }
  });

export const removeGuarantor = (personId: string) =>
  attempt(async () => {
    if (PROD) await q(sb().from("guarantors").delete().eq("owner_id", me()).eq("person_id", personId));
    st().set((x) => ({ guarantors: x.guarantors.filter((y) => y.personId !== personId) }));
  });

/* ---------- Cartes ---------- */

const ownerFullName = () => {
  const a = st().account!;
  return `${a.firstName} ${a.lastName}`;
};
const newCard = (holderId: string): Card => ({ id: uid(), holderId, printedName: holderId === "owner" ? ownerFullName() : personName(st().people, holderId), status: "commandee", orderedAt: now(), extra: holderId !== "owner" });

export const orderOwnerCards = () =>
  attempt(async () => {
    if (PROD) {
      const rows = await q<Record<string, unknown>[]>(sb().rpc("order_owner_cards") as never);
      return st().set((x) => ({ cards: [...x.cards, ...rows.map(toCard)] }));
    }
    st().set((x) => ({ cards: [...x.cards, ...Array.from({ length: OFFER.ownerCards }, () => newCard("owner"))] }));
    st().email(st().account!.email, "cartes-commandees", { count: String(OFFER.ownerCards) });
  });

export const orderPack = (personId: string) =>
  attempt(async () => {
    if (PROD) {
      const rows = await q<Record<string, unknown>[]>(sb().rpc("order_pack", { person: personId }) as never);
      return st().set((x) => ({ cards: [...x.cards, ...rows.map(toCard)] }));
    }
    const p = st().people.find((x) => x.id === personId)!;
    st().set((x) => ({ cards: [...x.cards, ...Array.from({ length: OFFER.packCards }, () => newCard(personId))] }));
    st().email(p.email || personName(st().people, personId), "invitation-porteur", { ownerName: ownerFullName() });
  });

export const orderReplacement = (lost: Card) =>
  attempt(async () => {
    if (PROD) {
      const row = await q<Record<string, unknown>>(sb().rpc("order_replacement", { lost: lost.id }) as never);
      return st().set((x) => ({ cards: [...x.cards, toCard(row)] }));
    }
    st().set((x) => ({ cards: [...x.cards, newCard(lost.holderId)] }));
  });

// The card stops opening anything; rights stay with the person, so a replacement card gets them back.
export const declareLost = (c: Card) =>
  attempt(async () => {
    if (PROD) await q(sb().rpc("declare_card_lost", { card: c.id }));
    st().set((x) => ({
      cards: x.cards.map((y) => (y.id === c.id ? { ...y, status: "perdue" as const, wrappedVmk: undefined, boxPk: undefined } : y)),
      vault: { ...x.vault, envelopes: x.vault.envelopes.filter((e) => e.cardId !== c.id) },
      trusts: x.trusts.map((t) => ({ ...t, cards: t.cards.map((y) => (y.id === c.id ? { ...y, status: "perdue" as const } : y)) })),
    }));
  });

/* ---------- Échéances, aide ---------- */

export const setReminderConsent = () =>
  attempt(async () => {
    if (PROD) await q(sb().from("profiles").update({ reminder_consent: true }).eq("id", me()));
    st().set({ reminderConsent: true });
  });

export const addReminder = (label: string, date: string) =>
  attempt(async () => {
    const r = { id: uid(), label: label.trim(), date };
    if (PROD) await q(sb().from("reminders").insert({ id: r.id, owner_id: me(), label: r.label, date: r.date }));
    st().set((x) => ({ reminders: [...x.reminders, r] }));
  });

export const removeReminder = (id: string) =>
  attempt(async () => {
    if (PROD) await q(sb().from("reminders").delete().eq("id", id).eq("owner_id", me()));
    st().set((x) => ({ reminders: x.reminders.filter((y) => y.id !== id) }));
  });

export const toggleChecklist = (key: string) =>
  attempt(async () => {
    const done = !st().checklist[key];
    if (PROD) {
      if (done) await q(sb().from("checklist").upsert({ owner_id: me(), key, done: true }));
      else await q(sb().from("checklist").delete().eq("owner_id", me()).eq("key", key));
    }
    st().set((x) => ({ checklist: { ...x.checklist, [key]: done } }));
  });

/* ---------- Conciergerie ---------- */

export const requestConcierge = (kind: string, message?: string) =>
  attempt(async () => {
    const c: ConciergeCase = { id: uid(), kind, createdAt: now(), partner: CONCIERGE.partner, status: "demande", shared: [], message };
    if (PROD) await q(sb().from("concierge_cases").insert({ id: c.id, owner_id: me(), kind, partner: c.partner, message: message ?? null }));
    st().set((x) => ({ concierge: [c, ...x.concierge] }));
  });

export const signMandate = (caseId: string, name: string) =>
  attempt(async () => {
    if (PROD) await q(sb().rpc("sign_mandate", { case_id: caseId, signer: name }));
    st().set((x) => ({ concierge: x.concierge.map((y) => (y.id === caseId ? { ...y, status: "mandat_signe" as const, mandate: { name, signedAt: now() } } : y)) }));
  });

/* ---------- Procédures ---------- */

export const cancelProcedure = (id: string) =>
  attempt(async () => {
    if (PROD) await q(sb().rpc("cancel_procedure", { proc: id }));
    st().set((x) => ({ procedures: x.procedures.map((y) => (y.id === id ? { ...y, cancelledAt: now() } : y)) }));
  });

export async function closeProcedureRemote(id: string) {
  if (PROD) await q(sb().rpc("close_procedure", { proc: id }));
}

// A guarantor's report. Demo: done from the owner's own screen; production: from the guarantor's own account.
export const declareAsGuarantor = (ownerId: string | null, kind: ProcedureKind, by: string, note: string) =>
  attempt(async () => {
    if (PROD) {
      await q(sb().rpc("declare_procedure", { owner: ownerId, proc_kind: kind, proc_note: note || null }));
      return loadAll();
    }
    const p = declare(kind, "garant", by, now(), { note: note || undefined });
    st().set((x) => ({ procedures: [p, ...x.procedures] }));
    if (p.kind === "coup_dur") st().email(st().account!.email, "coup-dur-declare", { declaredBy: by, endsAt: new Date(p.endsAt!).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) });
  });

// A beneficiary hands in the death certificate and their ID: they go to the verification team, never to the Coffre.
export const declareDeath = (ownerId: string | null, who: string, acte: File, idDoc: File) =>
  attempt(async () => {
    if (PROD) {
      const base = `${me()}/${uid()}`;
      await q(sb().storage.from("verification").upload(`${base}-acte.${ext(acte)}`, acte, { contentType: acte.type }));
      await q(sb().storage.from("verification").upload(`${base}-identite.${ext(idDoc)}`, idDoc, { contentType: idDoc.type }));
      await q(sb().rpc("declare_death_with_certificate", { owner: ownerId, certificate_path: `${base}-acte.${ext(acte)}`, id_path: `${base}-identite.${ext(idDoc)}` }));
      return loadAll();
    }
    // Demo: only the file names are kept.
    const info = { by: who, file: acte.name, idChecked: false, at: now() };
    st().set((s) => {
      const open = s.procedures.find((p) => p.kind === "deces" && !p.verifiedAt && !p.cancelledAt && !p.rejectedAt);
      return open
        ? { procedures: s.procedures.map((p) => (p.id === open.id ? { ...p, acte: info, note: `${p.note ? `${p.note} · ` : ""}Pièce d'identité : ${idDoc.name}` } : p)) }
        : { procedures: [declare("deces", "beneficiaire", who, now(), { acte: info, note: `Pièce d'identité : ${idDoc.name}` }), ...s.procedures] };
    });
  });

/* ---------- Facturation, compte (production) ---------- */

async function invoke<T>(fn: string, body: Record<string, unknown> = {}) {
  const { data, error } = await sb().functions.invoke(fn, { body });
  if (error) throw new Error(friendly(error));
  return data as T;
}

export const openCheckout = () =>
  attempt(async () => {
    const { url } = await invoke<{ url: string }>("billing", { action: "checkout", returnUrl: location.origin + location.pathname });
    location.assign(url);
  });

export const openBillingPortal = () =>
  attempt(async () => {
    const { url } = await invoke<{ url: string }>("billing", { action: "portal", returnUrl: location.origin + location.pathname });
    location.assign(url);
  });

// RGPD: the account, the Espace, the Coffre and its files are deleted for good.
export const deleteAccount = () =>
  attempt(async () => {
    await invoke("account-delete");
    await signOut();
  });

export const reloadTrusts = () =>
  attempt(async () => {
    const rows = await q<unknown[]>(sb().rpc("my_trusts") as never);
    st().set({ trusts: rows.map((t) => toTrust(t as Record<string, unknown>)) });
  });

/* ---------- Appareils de confiance (utilisés par devices.ts) ---------- */

export type Taken = { status: DeviceRequest["status"] | "expired"; sealed?: string; deviceId?: string };

// Demo: requests and computers in this browser's storage, shared by the computer window and the simulated phone window.
type DemoDevice = TrustedDevice & { pk: string };
type DemoRequest = DeviceRequest & { code: number; sealed?: string };
const DEMO_DEVICES = "sillage-appareils";
function demoDevices(): { devices: DemoDevice[]; requests: DemoRequest[] } {
  try {
    return JSON.parse(localStorage.getItem(DEMO_DEVICES) ?? "") as never;
  } catch {
    return { devices: [], requests: [] };
  }
}
const saveDemoDevices = (d: ReturnType<typeof demoDevices>) => localStorage.setItem(DEMO_DEVICES, JSON.stringify(d));
const publicPart = ({ code: _c, sealed: _s, ...r }: DemoRequest): DeviceRequest => r;
// The right number and two decoys, shuffled (same rule as number_choices in the database).
function numberChoices(code: number) {
  const pool = Array.from({ length: 90 }, (_, i) => i + 10).filter((n) => n !== code);
  const all = [code, pool.splice(Math.floor(Math.random() * pool.length), 1)[0], pool[Math.floor(Math.random() * pool.length)]];
  return all.sort(() => Math.random() - 0.5);
}

export const devices = {
  async request(kind: DeviceRequest["kind"], o: { pk?: string; name?: string; device?: string }): Promise<{ id: string; code: number; expiresAt: number }> {
    if (PROD) {
      const r = await q<{ id: string; code: number; expires_at: string }>(sb().rpc("request_device", { req_kind: kind, device_pk: o.pk ?? null, device_name: o.name ?? null, device: o.device ?? null }) as never);
      return { id: r.id, code: r.code, expiresAt: Date.parse(r.expires_at) };
    }
    const d = demoDevices();
    const dev = kind === "open" ? d.devices.find((x) => x.id === o.device && x.expiresAt > Date.now()) : undefined;
    if (kind === "open" && !dev) throw new Error("Appareil inconnu ou à revalider.");
    const code = 10 + Math.floor(Math.random() * 90);
    const r: DemoRequest = { id: uid(), kind, deviceId: dev?.id, name: dev?.name ?? o.name!, pk: dev?.pk ?? o.pk!, code, choices: numberChoices(code), status: "pending", createdAt: Date.now(), expiresAt: Date.now() + (kind === "open" ? 3 : 5) * 60_000 };
    saveDemoDevices({ ...d, requests: [...d.requests.filter((x) => x.createdAt > Date.now() - 86_400_000), r] });
    return { id: r.id, code, expiresAt: r.expiresAt };
  },
  async get(id: string): Promise<DeviceRequest | null> {
    if (PROD) {
      const r = await q<Record<string, unknown> | null>(sb().rpc("device_request", { req: id }) as never);
      return r ? toDeviceRequest(r) : null;
    }
    const r = demoDevices().requests.find((x) => x.id === id);
    return r ? publicPart(r) : null;
  },
  async pending(): Promise<DeviceRequest[]> {
    if (PROD) return (await q<Record<string, unknown>[]>(sb().rpc("pending_device_requests") as never)).map(toDeviceRequest);
    return demoDevices()
      .requests.filter((r) => r.status === "pending" && r.expiresAt > Date.now())
      .map(publicPart)
      .reverse();
  },
  // The phone's answer: the sealed keys, or null when the number was wrong (the request is then refused for good).
  async approve(id: string, choice: number, sealed: string): Promise<string | null> {
    if (PROD) return q<string | null>(sb().rpc("approve_device_request", { req: id, choice, payload: sealed }) as never);
    const d = demoDevices();
    const r = d.requests.find((x) => x.id === id);
    if (!r || r.status !== "pending" || r.expiresAt < Date.now()) throw new Error("Demande expirée.");
    if (choice !== r.code) {
      r.status = "refused";
      saveDemoDevices(d);
      return null;
    }
    if (r.kind === "pairing") {
      const dev: DemoDevice = { id: uid(), name: r.name, pk: r.pk, createdAt: Date.now(), expiresAt: Date.now() + 90 * 86_400_000 };
      d.devices = [...d.devices.filter((x) => x.pk !== r.pk), dev];
      r.deviceId = dev.id;
      st().email(st().account?.email ?? st().me?.email ?? "", "nouvel-appareil", { name: r.name, date: new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) });
    } else if (!d.devices.some((x) => x.id === r.deviceId && x.expiresAt > Date.now())) throw new Error("Appareil à revalider.");
    Object.assign(r, { status: "approved", sealed });
    saveDemoDevices(d);
    return r.deviceId!;
  },
  async refuse(id: string) {
    if (PROD) return void (await q(sb().rpc("refuse_device_request", { req: id })));
    const d = demoDevices();
    d.requests = d.requests.map((r) => (r.id === id && r.status === "pending" ? { ...r, status: "refused" } : r));
    saveDemoDevices(d);
  },
  // The computer takes the sealed keys back, once: they are erased right away.
  async take(id: string): Promise<Taken> {
    if (PROD) {
      const r = await q<{ status: Taken["status"]; sealed: string | null; device_id: string | null }>(sb().rpc("take_device_request", { req: id }) as never);
      return { status: r.status, sealed: r.sealed ?? undefined, deviceId: r.device_id ?? undefined };
    }
    const d = demoDevices();
    const r = d.requests.find((x) => x.id === id);
    if (!r) throw new Error("Demande inconnue.");
    const taken: Taken = { status: r.status === "pending" && r.expiresAt < Date.now() ? "expired" : r.status, sealed: r.sealed, deviceId: r.deviceId };
    if (r.status === "approved") {
      Object.assign(r, { status: "used", sealed: undefined });
      d.devices = d.devices.map((x) => (x.id === r.deviceId ? { ...x, lastUsedAt: Date.now() } : x));
      saveDemoDevices(d);
    }
    return taken;
  },
  async list(): Promise<TrustedDevice[]> {
    if (PROD) return (await q<Record<string, unknown>[]>(sb().from("trusted_devices").select("id, name, created_at, expires_at, last_used_at").order("created_at") as never)).map(toDevice);
    return demoDevices().devices.map(({ pk: _pk, ...x }) => x);
  },
  async remove(id: string) {
    if (PROD) return void (await q(sb().from("trusted_devices").delete().eq("id", id)));
    const d = demoDevices();
    saveDemoDevices({ devices: d.devices.filter((x) => x.id !== id), requests: d.requests.filter((r) => r.deviceId !== id) });
  },
  // Wakes the phone up (notification). Never blocking: the request also shows when the app is opened.
  async notify(id: string) {
    if (PROD) await invoke("push", { request: id }).catch(console.error);
  },
};

// Phones (production app): the token that lets the server wake them up for a computer's request.
let pushToken: string | undefined;
export async function savePushToken(token: string, platform: "ios" | "android") {
  pushToken = token;
  await q(sb().rpc("register_push", { push_token: token, push_platform: platform }));
}
async function forgetPushToken() {
  if (pushToken) await sb().rpc("unregister_push", { push_token: pushToken });
  pushToken = undefined;
}

/* ---------- Coffre : persistance (utilisée par vault.ts) ---------- */

// The Coffre only ever sends ciphertext. Each function is a no-op in the demo (vault.ts updates the local store itself).
export const remote = {
  // A new vault, or a fresh one after every card was lost (the old one could never be opened again).
  async vaultInit(salt: string, ssk: Record<string, Sealed>) {
    if (!PROD) return;
    const updated = await q<unknown[]>(sb().from("vaults").update({ salt, ssk }).eq("owner_id", me()).select("owner_id") as never);
    if (!updated.length) await q(sb().from("vaults").insert({ owner_id: me(), salt, ssk }));
  },
  async putSsk(ssk: Record<string, Sealed>) {
    if (PROD) await q(sb().from("vaults").update({ ssk }).eq("owner_id", me()));
  },
  async putItem(item: VaultItem) {
    if (PROD) await q(sb().from("vault_items").upsert(itemRow(item, me())));
  },
  async deleteItem(id: string) {
    if (PROD) await q(sb().from("vault_items").delete().eq("id", id).eq("owner_id", me()));
  },
  async setRight(personId: string, subId: string, moment: Moment, removedCards: string[], added: Envelope[]) {
    if (!PROD) return;
    await q(sb().from("rights").upsert({ person_id: personId, owner_id: me(), subsection_id: subId, moment }));
    if (removedCards.length) await q(sb().from("envelopes").delete().eq("subsection_id", subId).in("card_id", removedCards));
    if (added.length) await q(sb().from("envelopes").upsert(added.map((e) => envelopeRow(e, me()))));
  },
  async addEnvelopes(added: Envelope[]) {
    if (PROD && added.length) await q(sb().from("envelopes").upsert(added.map((e) => envelopeRow(e, me()))));
  },
  async rotate(subId: string, wrapped: Sealed, items: VaultItem[], envelopes: Envelope[]) {
    if (!PROD) return;
    await q(
      sb().rpc("rotate_subsection", {
        sub: subId,
        wrapped,
        items: items.filter((i) => i.subsectionId === subId).map((i) => ({ id: i.id, data: i.data })),
        envs: envelopes.filter((e) => e.subsectionId === subId).map((e) => ({ card_id: e.cardId, moment: e.moment, sealed: e.sealed })),
      }),
    );
  },
  async activateOwnerCard(cardId: string, kind: string, chipId: string, wrappedVmk: Sealed) {
    if (PROD) await q(sb().rpc("activate_owner_card", { card: cardId, card_kind: kind, chip: chipId, vmk: wrappedVmk }));
  },
  async activateHolderCard(cardId: string, kind: string, chipId: string, boxPk: string, salt: string) {
    if (PROD) await q(sb().rpc("activate_holder_card", { card: cardId, card_kind: kind, chip: chipId, pk: boxPk, card_salt: salt }));
  },
  async shareConcierge(caseId: string, itemId: string, sealed: string) {
    if (PROD) await q(sb().from("concierge_shares").upsert({ case_id: caseId, item_id: itemId, sealed }, { ignoreDuplicates: true }));
  },
  // Encrypted files: bucket "coffre", <owner>/<sub-section>/<file id>, stored as nonce + ciphertext bytes.
  async putBlob(ownerId: string, subId: string, fileId: string, bytes: Uint8Array) {
    await q(sb().storage.from("coffre").upload(`${ownerId}/${subId}/${fileId}`, new Blob([bytes.slice().buffer]), { upsert: true, contentType: "application/octet-stream" }));
  },
  async getBlob(ownerId: string, subId: string, fileId: string): Promise<Uint8Array> {
    const blob = await q<Blob>(sb().storage.from("coffre").download(`${ownerId}/${subId}/${fileId}`) as never);
    return new Uint8Array(await blob.arrayBuffer());
  },
  async delBlobs(ownerId: string, subId: string, fileIds: string[]) {
    if (fileIds.length) await q(sb().storage.from("coffre").remove(fileIds.map((f) => `${ownerId}/${subId}/${f}`)));
  },
};

// A beneficiary card opened someone else's Coffre: fetch only what the database releases to that card.
export async function loadHolderView(trust: Trust, card: Card) {
  const c = sb();
  const [envelopes, items, procedures] = await Promise.all([
    q<Record<string, unknown>[]>(c.from("envelopes").select("*").eq("card_id", card.id) as never),
    q<Record<string, unknown>[]>(c.from("vault_items").select("*").eq("owner_id", trust.ownerId) as never),
    q<Record<string, unknown>[]>(c.from("procedures").select("*").eq("owner_id", trust.ownerId) as never),
  ]);
  st().set({
    holder: {
      ownerId: trust.ownerId,
      ownerName: trust.ownerName,
      holderName: card.printedName,
      envelopes: envelopes.map(toEnvelope),
      items: items.map(toItem),
      procedures: procedures.map(toProcedure),
    },
  });
}

export const activeTrustCards = () => st().trusts.flatMap((t) => t.cards.filter((c) => c.status === "active"));
export const trustOfCard = (cardId: string) => st().trusts.find((t) => t.cards.some((c) => c.id === cardId));
