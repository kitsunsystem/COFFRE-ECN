// End-to-end check against a real Supabase stack (local `supabase start`, or a staging project):
// accounts with one-time codes, the access rules through the HTTP API, encrypted files in storage, the e-mail queue
// and the server functions. Run by the CI; locally: `supabase start`, then
//   API_URL=... ANON_KEY=... SERVICE_ROLE_KEY=... npm run test:e2e
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.API_URL ?? process.env.SUPABASE_URL;
const ANON = process.env.ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) throw new Error("API_URL, ANON_KEY et SERVICE_ROLE_KEY sont requis.");

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const sealed = { n: "bm9uY2U=", c: "Y2lwaGVy" };
let step = 0;
const ok = (label) => console.log(`  ✓ ${++step}. ${label}`);
const must = async (p, label) => {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};
const refused = async (p, label) => {
  const { error, data } = await p;
  assert.ok(error || (Array.isArray(data) && data.length === 0), `${label} aurait dû être refusé`);
};

// A person signs in with the 6-digit code (taken from the admin API instead of the mailbox).
async function signIn(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  // Same as signInWithOtp({ shouldCreateUser: true }) followed by the code from the e-mail.
  await admin.auth.admin.createUser({ email, email_confirm: true });
  const link = await must(admin.auth.admin.generateLink({ type: "magiclink", email }), "generateLink");
  const session = await must(c.auth.verifyOtp({ email, token: link.properties.email_otp, type: "email" }), "verifyOtp");
  assert.ok(session.session, "session");
  return { c, id: session.user.id };
}

const tag = Date.now();
const mail = (who) => `${who}.${tag}@exemple.fr`;

console.log("Parcours de production (API Supabase réelle)");
await admin.from("app_settings").update({ launched: false }).eq("id", true);

const claire = await signIn(mail("claire"));
const marc = await signIn(mail("marc"));
const eve = await signIn(mail("eve"));
ok("connexion par code à usage unique (3 comptes)");

await must(claire.c.from("profiles").insert({ id: claire.id, first_name: "Claire", last_name: "Durand", birth_date: "1972-03-14", birth_city: "Lyon" }), "profil");
const [profile] = await must(claire.c.from("profiles").select("kyc, email"), "lecture profil");
assert.equal(profile.kyc, "a_faire");
assert.equal(profile.email, mail("claire"));
await refused(claire.c.from("profiles").update({ kyc: "verifie" }).eq("id", claire.id).select(), "KYC par l'app");
ok("profil créé ; KYC et facturation hors de portée de l'application");

const pMarc = randomUUID();
await must(claire.c.from("people").insert({ id: pMarc, owner_id: claire.id, first_name: "Marc", last_name: "Durand", relation: "Conjoint", email: mail("marc") }), "proche");
await must(claire.c.from("guarantors").insert({ owner_id: claire.id, person_id: pMarc, role: "Prévenir les enfants" }), "garant");
assert.equal((await must(eve.c.from("people").select("*"), "eve")).length, 0);
ok("famille et garant ; invisibles pour un inconnu");

const cards = await must(claire.c.rpc("order_owner_cards"), "cartes");
assert.equal(cards.length, 3);
const pack = await must(claire.c.rpc("order_pack", { person: pMarc }), "pack");
assert.equal(pack.length, 2);
await must(claire.c.rpc("activate_owner_card", { card: cards[0].id, card_kind: "demo", chip: `chip-${tag}`, vmk: sealed }), "activation");
ok("3 cartes + un pack de 2 ; activation d'une carte");

await must(claire.c.from("vaults").insert({ owner_id: claire.id, salt: "c2FsdA==", ssk: {} }), "coffre");
const item = randomUUID();
await refused(claire.c.from("vault_items").insert({ id: item, owner_id: claire.id, subsection_id: "a-prevenir", data: sealed }).select(), "dépôt en phase découverte");
const up0 = await claire.c.storage.from("coffre").upload(`${claire.id}/a-prevenir/f-${tag}`, new Blob([new Uint8Array([1, 2, 3])]));
assert.ok(up0.error, "fichier en phase découverte");
await admin.from("app_settings").update({ launched: true }).eq("id", true);
await must(claire.c.from("vault_items").insert({ id: item, owner_id: claire.id, subsection_id: "a-prevenir", data: sealed, file_ids: [`f-${tag}`] }), "élément");
await must(claire.c.storage.from("coffre").upload(`${claire.id}/a-prevenir/f-${tag}`, new Blob([new Uint8Array([1, 2, 3])]), { contentType: "application/octet-stream" }), "fichier chiffré");
const evil = await eve.c.storage.from("coffre").upload(`${claire.id}/a-prevenir/evil-${tag}`, new Blob([new Uint8Array([9])]));
assert.ok(evil.error, "dépôt dans le Coffre d'un autre");
ok("phase découverte respectée, puis dépôt chiffré ; rien dans le Coffre d'un autre");

assert.equal(await must(marc.c.rpc("claim_invitations"), "rattachement"), 1);
const [trust] = await must(marc.c.rpc("my_trusts"), "my_trusts");
assert.equal(trust.owner_name, "Claire Durand");
const mine = trust.cards;
await must(marc.c.rpc("activate_holder_card", { card: mine[0].id, card_kind: "demo", chip: `chip-m-${tag}`, pk: "cGs=", card_salt: "c2FsdA==" }), "pack activé par Marc");
ok("Marc rattaché par son adresse vérifiée ; il active lui-même son pack");

assert.equal((await must(marc.c.from("vault_items").select("id"), "avant droits")).length, 0);
await must(claire.c.from("rights").insert({ person_id: pMarc, owner_id: claire.id, subsection_id: "a-prevenir", moment: "now" }), "droit");
await must(claire.c.from("envelopes").insert({ card_id: mine[0].id, owner_id: claire.id, subsection_id: "a-prevenir", moment: "now", sealed: "a2V5" }), "enveloppe");
assert.deepEqual((await must(marc.c.from("vault_items").select("id"), "après droits")).map((x) => x.id), [item]);
const dl = await marc.c.storage.from("coffre").download(`${claire.id}/a-prevenir/f-${tag}`);
assert.ok(!dl.error && dl.data.size === 3, "téléchargement par le bénéficiaire");
const dlEve = await eve.c.storage.from("coffre").download(`${claire.id}/a-prevenir/f-${tag}`);
assert.ok(dlEve.error, "téléchargement par un inconnu");
ok("Urgence : Marc lit l'élément et télécharge le fichier chiffré ; un inconnu ne peut pas");

const procId = await must(marc.c.rpc("declare_procedure", { owner: claire.id, proc_kind: "coup_dur", proc_note: "Hospitalisée" }), "coup dur");
assert.ok(procId);
await refused(eve.c.rpc("declare_procedure", { owner: claire.id, proc_kind: "coup_dur" }), "déclaration par un inconnu");
await must(claire.c.rpc("cancel_procedure", { proc: procId }), "annulation");
ok("coup dur déclaré par le garant, refusé à un inconnu, annulé par la titulaire");

const queued = await must(admin.from("outbox").select("template, to_email").in("to_email", [mail("claire"), mail("marc")]), "outbox");
for (const t of ["bienvenue", "invitation-garant", "cartes-commandees", "invitation-porteur", "coup-dur-declare"]) assert.ok(queued.some((m) => m.template === t), `e-mail ${t} en file`);
await refused(claire.c.from("outbox").select("*"), "lecture de la file d'e-mails");
const fn = (name, key, body = {}) => fetch(`${URL_}/functions/v1/${name}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
const r = await fn("mailer", SERVICE);
assert.equal(r.status, 200, `mailer: ${await r.clone().text()}`);
assert.ok((await r.json()).sent >= 5);
assert.equal((await fn("mailer", ANON)).status, 403);
ok("e-mails mis en file par la base, envoyés par « mailer » (refusé sans la clé de service)");

const del = await fn("account-delete", (await claire.c.auth.getSession()).data.session.access_token);
assert.equal(del.status, 200, `account-delete: ${await del.clone().text()}`);
assert.equal((await must(admin.from("profiles").select("id").eq("id", claire.id), "après suppression")).length, 0);
const gone = await admin.storage.from("coffre").list(`${claire.id}/a-prevenir`);
assert.equal(gone.data?.length ?? 0, 0);
ok("suppression du compte (RGPD) : profil, Coffre et fichiers effacés");

await admin.from("app_settings").update({ launched: false }).eq("id", true);
for (const u of [marc, eve]) await admin.auth.admin.deleteUser(u.id);
console.log(`\n${step} étapes réussies.`);
