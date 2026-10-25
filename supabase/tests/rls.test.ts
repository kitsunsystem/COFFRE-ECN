// Access rules of the production database, exercised as each kind of person would through the API:
// owner, guarantor, beneficiaries, a stranger, the team. Every "refused" is a door an attacker would try.
import { beforeAll, describe, expect, it } from "vitest";
import { as, freshDb, refused, user, type Db } from "./db";

let db: Db;
const ids: Record<string, string> = {};
const sealed = JSON.stringify({ n: "bm9uY2U=", c: "Y2lwaGVy" });

beforeAll(async () => {
  db = await freshDb();
  for (const who of ["claire", "marc", "lea", "eve", "verif", "logistique", "concierge", "admin"]) ids[who] = await user(db, `${who}@exemple.fr`);
  await db.exec(`insert into public.staff values ('${ids.verif}', 'verification'), ('${ids.logistique}', 'logistique'), ('${ids.concierge}', 'conciergerie'), ('${ids.admin}', 'admin');`);
}, 60_000);

const claire = (q: string, p: unknown[] = []) => as(db, ids.claire, q, p);
const outbox = async (template: string) => (await db.query<{ to_email: string }>("select to_email from outbox where template = $1", [template])).rows.map((r) => r.to_email);

describe("profil", () => {
  it("creates one's own profile, with KYC and billing forced by the server", async () => {
    await claire(`insert into profiles (id, first_name, last_name, birth_date, birth_city) values ($1, 'Claire', 'Durand', '1972-03-14', 'Lyon')`, [ids.claire]);
    const [p] = await claire("select email, kyc, billing_status from profiles where id = $1", [ids.claire]);
    expect(p).toEqual({ email: "claire@exemple.fr", kyc: "a_faire", billing_status: "a_jour" });
    expect(await outbox("bienvenue")).toContain("claire@exemple.fr");
  });

  it("refuses a profile for someone else", async () => {
    await refused(as(db, ids.eve, `insert into profiles (id, first_name, last_name, birth_date) values ($1, 'X', 'Y', '1980-01-01')`, [ids.claire]));
  });

  it("refuses to set KYC, billing, name or birth from the app", async () => {
    await refused(claire(`update profiles set kyc = 'verifie' where id = $1`, [ids.claire]), /permission denied/);
    await refused(claire(`update profiles set billing_status = 'a_jour', billing_since = null where id = $1`, [ids.claire]), /permission denied/);
    await refused(claire(`update profiles set last_name = 'Autre' where id = $1`, [ids.claire]), /permission denied/);
    await refused(claire(`update profiles set birth_date = '1990-01-01' where id = $1`, [ids.claire]), /permission denied/);
    await claire(`update profiles set phone = '0600000000' where id = $1`, [ids.claire]);
  });

  it("a stranger sees nothing of the profile, and nobody can delete it from the app", async () => {
    expect(await as(db, ids.eve, "select * from profiles")).toHaveLength(0);
    await refused(claire("delete from profiles where id = $1", [ids.claire]), /permission denied/);
  });

  it("KYC by hand: the document path must be in one's own folder", async () => {
    await refused(claire("select submit_kyc($1)", [`${ids.eve}/x.pdf`]), /chemin invalide/);
    await claire("select submit_kyc($1)", [`${ids.claire}/id.pdf`]);
    await refused(as(db, ids.eve, "select staff_set_kyc($1, 'verifie')", [ids.claire]), /interdit/);
    await as(db, ids.verif, "select staff_set_kyc($1, 'verifie')", [ids.claire]);
    expect((await claire("select kyc from profiles"))[0].kyc).toBe("verifie");
  });
});

describe("famille et garants", () => {
  it("adds relatives; the account link can never be set by the owner", async () => {
    await claire(`insert into people (id, owner_id, first_name, last_name, relation, email) values ($1, $2, 'Marc', 'Durand', 'Conjoint', 'marc@exemple.fr')`, [(ids.pMarc = crypto.randomUUID()), ids.claire]);
    await claire(`insert into people (id, owner_id, first_name, last_name, relation, email) values ($1, $2, 'Léa', 'Durand', 'Enfant', 'LEA@exemple.fr')`, [(ids.pLea = crypto.randomUUID()), ids.claire]);
    await refused(claire("update people set user_id = $1 where id = $2", [ids.eve, ids.pMarc]), /permission denied/);
    await refused(claire(`insert into people (owner_id, user_id, first_name, last_name, relation) values ($1, $2, 'X', 'Y', 'Ami')`, [ids.claire, ids.eve]), /permission denied/);
  });

  it("refuses relatives in someone else's family", async () => {
    await refused(as(db, ids.eve, `insert into people (owner_id, first_name, last_name, relation) values ($1, 'X', 'Y', 'Ami')`, [ids.claire]), /row-level security/);
    expect(await as(db, ids.eve, "select * from people")).toHaveLength(0);
  });

  it("a guarantor must be one of the owner's relatives, and is invited by e-mail", async () => {
    await claire("insert into guarantors (owner_id, person_id, role) values ($1, $2, 'Prévenir les enfants')", [ids.claire, ids.pMarc]);
    expect(await outbox("invitation-garant")).toContain("marc@exemple.fr");
    const evePerson = crypto.randomUUID();
    await db.query(`insert into profiles (id, first_name, last_name, email, birth_date) values ($1, 'Eve', 'X', 'eve@exemple.fr', '1980-01-01')`, [ids.eve]);
    await db.query(`insert into people (id, owner_id, first_name, last_name, relation) values ($1, $2, 'Z', 'Z', 'Ami')`, [evePerson, ids.eve]);
    await refused(claire("insert into guarantors (owner_id, person_id, role) values ($1, $2, 'x')", [ids.claire, evePerson]));
  });

  it("the relative is linked to their account only with a confirmed address", async () => {
    await db.query("update auth.users set email_confirmed_at = null where id = $1", [ids.lea]);
    expect((await as(db, ids.lea, "select claim_invitations() as n"))[0].n).toBe(0);
    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [ids.lea]);
    expect((await as(db, ids.lea, "select claim_invitations() as n"))[0].n).toBe(1); // case-insensitive e-mail
    expect((await as(db, ids.marc, "select claim_invitations() as n"))[0].n).toBe(1);
    const [t] = await as<{ owner_name: string; guarantor_role: string }>(db, ids.marc, "select * from my_trusts()");
    expect(t).toMatchObject({ owner_name: "Claire Durand", guarantor_role: "Prévenir les enfants" });
  });
});

describe("cartes", () => {
  it("orders the 3 included cards once, and a pack of 2 per beneficiary", async () => {
    expect(await claire("select * from order_owner_cards()")).toHaveLength(3);
    await refused(claire("select * from order_owner_cards()"), /déjà commandées/);
    const pack = await claire<{ id: string; extra: boolean }>("select * from order_pack($1)", [ids.pMarc]);
    expect(pack).toHaveLength(2);
    expect(pack.every((c) => c.extra)).toBe(true);
    await claire("select * from order_pack($1)", [ids.pLea]);
    await refused(as(db, ids.eve, "select * from order_pack($1)", [ids.pMarc]), /proche inconnu/);
    expect(await outbox("invitation-porteur")).toEqual(expect.arrayContaining(["marc@exemple.fr", "LEA@exemple.fr"]));
  });

  it("cards cannot be written directly", async () => {
    await refused(claire("update cards set status = 'active'"), /permission denied/);
    await refused(claire("insert into cards (owner_id, printed_name) values ($1, 'x')", [ids.claire]), /permission denied/);
  });

  it("activates an owner card; a physical chip can be registered only once", async () => {
    const owner = await claire<{ id: string }>("select id from cards where holder_person_id is null order by ordered_at, id");
    ids.c1 = owner[0].id;
    ids.c2 = owner[1].id;
    await claire("select activate_owner_card($1, 'demo', 'chip-1', $2::jsonb)", [ids.c1, sealed]);
    await refused(claire("select activate_owner_card($1, 'demo', 'chip-1', $2::jsonb)", [ids.c2, sealed]), /duplicate|unique/);
    await refused(as(db, ids.eve, "select activate_owner_card($1, 'demo', 'chip-x', $2::jsonb)", [ids.c2, sealed]), /non activable/);
  });

  it("a beneficiary activates their own pack, nobody else can", async () => {
    const mine = await as<{ id: string; status: string }>(db, ids.marc, "select id, status from cards");
    expect(mine).toHaveLength(2); // only their own cards
    ids.m1 = mine[0].id;
    ids.m2 = mine[1].id;
    await refused(as(db, ids.lea, "select activate_holder_card($1, 'demo', 'chip-m', 'pk', 'salt')", [ids.m1]), /non activable/);
    await as(db, ids.marc, "select activate_holder_card($1, 'demo', 'chip-m1', 'pk-m1', 'salt')", [ids.m1]);
    await as(db, ids.marc, "select activate_holder_card($1, 'demo', 'chip-m2', 'pk-m2', 'salt')", [ids.m2]);
    const lea = await as<{ id: string }>(db, ids.lea, "select id from cards");
    ids.l1 = lea[0].id;
    await claire("select activate_holder_card($1, 'demo', 'chip-l1', 'pk-l1', 'salt')", [ids.l1]); // from the owner's phone
  });

  it("only the logistics team moves cards along the delivery", async () => {
    await refused(claire("select staff_card_status($1, 'en_route')", [ids.c2]), /interdit/);
    await as(db, ids.logistique, "select staff_card_status($1, 'en_route')", [ids.c2]);
    expect((await claire("select status from cards where id = $1", [ids.c2]))[0].status).toBe("en_route");
  });
});

describe("Coffre", () => {
  it("phase découverte: no document can be stored before the launch", async () => {
    await claire(`insert into vaults (owner_id, salt, ssk) values ($1, 'salt', '{}')`, [ids.claire]);
    await refused(claire(`insert into vault_items (id, owner_id, subsection_id, data) values ($1, $2, 'banques', $3::jsonb)`, [crypto.randomUUID(), ids.claire, sealed]), /row-level security/);
    await refused(claire(`insert into storage.objects (bucket_id, name) values ('coffre', $1)`, [`${ids.claire}/banques/f1`]), /row-level security/);
    await refused(claire("select staff_set_launched(true)"), /interdit/);
    await as(db, ids.admin, "select staff_set_launched(true)");
  });

  it("stores ciphertext only in one's own Coffre", async () => {
    for (const [sub, id] of [["banques", "iBanque"], ["a-prevenir", "iPrevenir"], ["lettres", "iLettre"], ["prive", "iPrive"]]) {
      ids[id] = crypto.randomUUID();
      await claire(`insert into vault_items (id, owner_id, subsection_id, data) values ($1, $2, $3, $4::jsonb)`, [ids[id], ids.claire, sub, sealed]);
      await claire(`insert into storage.objects (bucket_id, name) values ('coffre', $1)`, [`${ids.claire}/${sub}/file-${id}`]);
    }
    await refused(claire(`insert into vault_items (id, owner_id, subsection_id, data) values ($1, $2, 'banques', '{"x":1}'::jsonb)`, [crypto.randomUUID(), ids.claire]), /check/);
    await refused(as(db, ids.eve, `insert into vault_items (id, owner_id, subsection_id, data) values ($1, $2, 'banques', $3::jsonb)`, [crypto.randomUUID(), ids.claire, sealed]), /row-level security/);
    await refused(as(db, ids.eve, `insert into storage.objects (bucket_id, name) values ('coffre', $1)`, [`${ids.claire}/banques/evil`]), /row-level security/);
    expect(await as(db, ids.eve, "select * from vault_items")).toHaveLength(0);
    expect(await as(db, ids.verif, "select * from vault_items")).toHaveLength(0); // the team never reads the Coffre
    expect(await as(db, ids.verif, "select * from storage.objects where bucket_id = 'coffre'")).toHaveLength(0);
  });

  it("envelopes only target active beneficiary cards of the owner, never « À effacer »", async () => {
    await refused(claire(`insert into envelopes (card_id, owner_id, subsection_id, moment, sealed) values ($1, $2, 'banques', 'now', 'x')`, [ids.c1, ids.claire]), /carte invalide/);
    await refused(claire(`insert into envelopes (card_id, owner_id, subsection_id, moment, sealed) values ($1, $2, 'prive', 'now', 'x')`, [ids.m1, ids.claire]), /check/);
    await refused(claire(`insert into rights (person_id, owner_id, subsection_id, moment) values ($1, $2, 'prive', 'deces')`, [ids.pMarc, ids.claire]), /check/);
    await claire(`insert into rights (person_id, owner_id, subsection_id, moment) values ($1, $2, 'a-prevenir', 'now'), ($1, $2, 'banques', 'coup_dur')`, [ids.pMarc, ids.claire]);
    await claire(`insert into rights (person_id, owner_id, subsection_id, moment) values ($1, $2, 'lettres', 'deces')`, [ids.pLea, ids.claire]);
    await claire(
      `insert into envelopes (card_id, owner_id, subsection_id, moment, sealed) values ($1, $3, 'a-prevenir', 'now', 'k1'), ($1, $3, 'banques', 'coup_dur', 'k2'), ($2, $3, 'lettres', 'deces', 'k3')`,
      [ids.m1, ids.l1, ids.claire],
    );
  });

  it("a beneficiary sees « Urgence » at once, nothing else before its moment", async () => {
    const envs = await as<{ subsection_id: string }>(db, ids.marc, "select subsection_id from envelopes");
    expect(envs.map((e) => e.subsection_id)).toEqual(["a-prevenir"]);
    const items = await as<{ id: string }>(db, ids.marc, "select id from vault_items");
    expect(items.map((i) => i.id)).toEqual([ids.iPrevenir]);
    expect(await as(db, ids.marc, "select name from storage.objects where bucket_id = 'coffre'")).toEqual([{ name: `${ids.claire}/a-prevenir/file-iPrevenir` }]);
    expect(await as(db, ids.lea, "select * from vault_items")).toHaveLength(0);
  });
});

describe("coup dur", () => {
  it("only a guarantor declares; the owner is alerted; the delay applies", async () => {
    await refused(as(db, ids.eve, "select declare_procedure($1, 'coup_dur', 'x')", [ids.claire]), /pas garant/);
    await refused(as(db, ids.lea, "select declare_procedure($1, 'coup_dur', 'x')", [ids.claire]), /pas garant/);
    const [{ declare_procedure: id }] = await as<{ declare_procedure: string }>(db, ids.marc, "select declare_procedure($1, 'coup_dur', 'Hospitalisée')", [ids.claire]);
    ids.proc = id;
    expect(await outbox("coup-dur-declare")).toContain("claire@exemple.fr");
    await refused(as(db, ids.marc, "select declare_procedure($1, 'coup_dur', 'encore')", [ids.claire]), /déjà signalé/);
    expect((await as(db, ids.marc, "select subsection_id from envelopes")).map((e) => e.subsection_id)).toEqual(["a-prevenir"]);
    await refused(as(db, ids.marc, "update procedures set ends_at = now()"), /permission denied/);
  });

  it("at the end of the delay, the coup dur elements open — only those", async () => {
    await db.query("update procedures set ends_at = now() - interval '1 second' where id = $1", [ids.proc]);
    expect((await as<{ subsection_id: string }>(db, ids.marc, "select subsection_id from envelopes order by 1")).map((e) => e.subsection_id)).toEqual(["a-prevenir", "banques"]);
    expect((await as<{ id: string }>(db, ids.marc, "select id from vault_items")).map((i) => i.id).sort()).toEqual([ids.iBanque, ids.iPrevenir].sort());
    expect(await as(db, ids.lea, "select * from vault_items")).toHaveLength(0);
  });

  it("the owner takes the keys back: access closes at once", async () => {
    await refused(as(db, ids.eve, "select close_procedure($1)", [ids.proc]), /non clôturable/);
    await claire("select close_procedure($1)", [ids.proc]);
    expect((await as<{ subsection_id: string }>(db, ids.marc, "select subsection_id from envelopes")).map((e) => e.subsection_id)).toEqual(["a-prevenir"]);
  });
});

describe("décès", () => {
  it("a beneficiary hands in the certificate, from their own folder only", async () => {
    await refused(as(db, ids.eve, "select declare_death_with_certificate($1, $2, $3)", [ids.claire, `${ids.eve}/a.pdf`, `${ids.eve}/i.pdf`]), /pas bénéficiaire/);
    await refused(as(db, ids.lea, "select declare_death_with_certificate($1, $2, $3)", [ids.claire, `${ids.marc}/a.pdf`, `${ids.lea}/i.pdf`]), /chemin invalide/);
    await refused(as(db, ids.lea, `insert into storage.objects (bucket_id, name) values ('verification', $1)`, [`${ids.marc}/acte.pdf`]), /row-level security/);
    await as(db, ids.lea, `insert into storage.objects (bucket_id, name) values ('verification', $1), ('verification', $2)`, [`${ids.lea}/acte.pdf`, `${ids.lea}/id.pdf`]);
    const [{ declare_death_with_certificate: id }] = await as<{ declare_death_with_certificate: string }>(db, ids.lea, "select declare_death_with_certificate($1, $2, $3)", [ids.claire, `${ids.lea}/acte.pdf`, `${ids.lea}/id.pdf`]);
    ids.death = id;
    expect(await as(db, ids.lea, "select * from storage.objects where bucket_id = 'verification'")).toHaveLength(0); // cannot read it back
    expect(await as(db, ids.verif, "select * from storage.objects where bucket_id = 'verification'")).toHaveLength(2);
    expect(await claire("select * from storage.objects where bucket_id = 'verification'")).toHaveLength(0);
  });

  it("only the verification team confirms, and only with the beneficiary's identity checked", async () => {
    await refused(claire("select staff_confirm_death($1)", [ids.death]), /interdit/);
    await refused(as(db, ids.concierge, "select staff_confirm_death($1)", [ids.death]), /interdit/);
    await refused(as(db, ids.verif, "select staff_confirm_death($1)", [ids.death]), /concordance incomplète/);
    await as(db, ids.verif, "select staff_check_identity($1, true)", [ids.death]);
    await as(db, ids.verif, "select staff_confirm_death($1)", [ids.death]);
    expect((await db.query<{ days: number }>("select extract(day from ends_at - verified_at)::int as days from procedures where id = $1", [ids.death])).rows[0].days).toBe(15);
    expect(await outbox("deces-delai")).toContain("claire@exemple.fr");
  });

  it("during the cancellation delay nothing opens; after it, each one gets their part, never « À effacer »", async () => {
    expect((await as<{ subsection_id: string }>(db, ids.lea, "select subsection_id from envelopes")).map((e) => e.subsection_id)).toEqual([]);
    await db.query("update procedures set ends_at = now() - interval '1 second' where id = $1", [ids.death]);
    expect((await as<{ id: string }>(db, ids.lea, "select id from vault_items")).map((i) => i.id)).toEqual([ids.iLettre]);
    const marc = (await as<{ id: string }>(db, ids.marc, "select id from vault_items")).map((i) => i.id);
    expect(marc.sort()).toEqual([ids.iBanque, ids.iPrevenir].sort()); // trusted for a coup dur = trusted after a death
    expect(marc).not.toContain(ids.iPrive);
  });

  it("the owner can still cancel a mistaken procedure while it is pending", async () => {
    const [{ id }] = (await db.query<{ id: string }>(`insert into procedures (owner_id, kind, source, declared_by, needs_verification) values ($1, 'deces', 'insee', 'Veille INSEE', true) returning id`, [ids.eve])).rows;
    await refused(claire("select cancel_procedure($1)", [id]), /non annulable/);
    await as(db, ids.eve, "select cancel_procedure($1)", [id]);
  });
});

describe("conciergerie, échéances, journal", () => {
  it("the concierge only receives what was confided under a signed mandate", async () => {
    ids.case = crypto.randomUUID();
    await claire(`insert into concierge_cases (id, owner_id, kind, partner) values ($1, $2, 'Démarches après un décès', 'Partenaire')`, [ids.case, ids.claire]);
    await refused(claire(`insert into concierge_cases (owner_id, kind, partner, status) values ($1, 'x', 'p', 'termine')`, [ids.claire]), /permission denied/);
    await refused(claire(`insert into concierge_shares (case_id, item_id, sealed) values ($1, $2, 'x')`, [ids.case, ids.iBanque]), /row-level security/);
    await refused(claire("select sign_mandate($1, 'Quelqu''un d''autre')", [ids.case]), /signature invalide/);
    await claire("select sign_mandate($1, 'claire durand')", [ids.case]);
    await claire(`insert into concierge_shares (case_id, item_id, sealed) values ($1, $2, 'x')`, [ids.case, ids.iBanque]);
    expect(await as(db, ids.concierge, "select * from concierge_shares")).toHaveLength(1);
    expect(await as(db, ids.eve, "select * from concierge_shares")).toHaveLength(0);
    await refused(claire("select staff_concierge_status($1, 'termine')", [ids.case]), /interdit/);
    await as(db, ids.concierge, "select staff_concierge_status($1, 'en_cours')", [ids.case]);
  });

  it("reminders need the person's consent", async () => {
    await refused(claire(`insert into reminders (owner_id, label, date) values ($1, 'Passeport', '2030-01-01')`, [ids.claire]), /accord requis/);
    await claire("update profiles set reminder_consent = true where id = $1", [ids.claire]);
    await claire(`insert into reminders (owner_id, label, date) values ($1, 'Passeport', '2030-01-01')`, [ids.claire]);
  });

  it("the outbox and internal functions are out of reach of the app", async () => {
    await refused(claire("select * from outbox"), /permission denied/);
    await refused(claire("select enqueue_email('x@y.z', 'x', 'bienvenue')"), /permission denied/);
    await refused(claire("select * from claim_outbox(10)"), /permission denied/);
    await refused(as(db, null, "select * from profiles"), /permission denied/);
  });

  it("the audit log keeps sensitive actions, readable by the owner and the team only", async () => {
    const mine = await claire<{ action: string }>("select action from audit_log");
    expect(mine.map((a) => a.action)).toEqual(expect.arrayContaining(["cartes.commande", "carte.activation", "procedure.declaration", "verification.deces_confirme"]));
    expect(await as(db, ids.lea, "select * from audit_log where owner_id = $1", [ids.claire])).toHaveLength(0);
    await refused(claire("delete from audit_log"), /permission denied/);
  });
});

describe("clés et départs", () => {
  it("rotates a sub-section key in one transaction", async () => {
    await claire("select rotate_subsection('banques', '\"new\"'::jsonb, $1::jsonb, $2::jsonb)", [
      JSON.stringify([{ id: ids.iBanque, data: { n: "bg==", c: "bmV3" } }]),
      JSON.stringify([{ card_id: ids.m1, moment: "coup_dur", sealed: "k2-new" }]),
    ]);
    expect((await claire<{ sealed: string }>("select sealed from envelopes where subsection_id = 'banques'"))[0].sealed).toBe("k2-new");
    await refused(
      claire("select rotate_subsection('banques', '\"x\"'::jsonb, '[]'::jsonb, $1::jsonb)", [JSON.stringify([{ card_id: ids.c1, moment: "now", sealed: "x" }])]),
      /carte invalide/,
    );
    expect((await claire<{ sealed: string }>("select sealed from envelopes where subsection_id = 'banques'"))[0].sealed).toBe("k2-new"); // all or nothing
  });

  it("a lost card stops opening anything at once", async () => {
    await as(db, ids.marc, "select declare_card_lost($1)", [ids.m1]);
    expect(await as(db, ids.marc, "select * from envelopes")).toHaveLength(0);
    await refused(as(db, ids.eve, "select declare_card_lost($1)", [ids.m2]), /carte inconnue/);
  });

  it("removing a relative removes their cards and envelopes", async () => {
    await claire("delete from people where id = $1", [ids.pLea]);
    expect(await as(db, ids.lea, "select * from cards")).toHaveLength(0);
    expect(await as(db, ids.lea, "select * from vault_items")).toHaveLength(0);
  });
});
