// Daily cron. Uses only Espace data, never Coffre content:
// - expiry reminders typed in the Espace (30 and 7 days before), with the person's consent;
// - "tout est-il à jour ?" every 3 months;
// - "vos cartes sont-elles toujours là ?" to every beneficiary every 6 months;
// - unpaid subscriptions: a reminder each week of the grace period, then the whole Coffre is erased;
// - documents and e-mails kept no longer than needed: ID once checked, death certificate once the procedure is over,
//   sent e-mails after 30 days.
import { admin, enqueue, eraseCoffre, internalOnly, json } from "../_shared/server.ts";

const DAY = 86_400_000;

Deno.serve(async (req) => {
  if (!internalOnly(req)) return json({ error: "forbidden" }, 403);
  const db = admin();
  const today = new Date();
  const stats = { echeances: 0, aJour: 0, cartes: 0, impayes: 0, effaces: 0, pieces: 0 };

  const { data: reminders } = await db.from("reminders").select("*, profiles!inner(first_name,email,reminder_consent)").eq("profiles.reminder_consent", true);
  for (const r of reminders ?? []) {
    const left = new Date(r.date).getTime() - today.getTime();
    const field = left < 7 * DAY && !r.sent_7 ? "sent_7" : left < 30 * DAY && !r.sent_30 ? "sent_30" : null;
    if (!field || left < 0) continue;
    await enqueue(db, { email: r.profiles.email, name: r.profiles.first_name }, "echeance", { label: r.label, date: r.date });
    await db.from("reminders").update({ [field]: true, ...(field === "sent_7" ? { sent_30: true } : {}) }).eq("id", r.id);
    stats.echeances++;
  }

  const firstMonday = today.getDay() === 1 && today.getDate() <= 7;
  // Quarterly check-in: first Monday of January, April, July and October.
  if (firstMonday && today.getMonth() % 3 === 0) {
    const { data: profiles } = await db.from("profiles").select("first_name, email").eq("billing_status", "a_jour");
    for (const p of profiles ?? []) await enqueue(db, { email: p.email, name: p.first_name }, "a-jour");
    stats.aJour = profiles?.length ?? 0;
  }

  // Twice a year (first Monday of March and September): beneficiaries confirm their 2 cards are still there.
  if (firstMonday && (today.getMonth() === 2 || today.getMonth() === 8)) {
    const { data: holders } = await db.from("cards").select("people!inner(id, first_name, email), profiles!inner(first_name, last_name)").eq("status", "active").not("holder_person_id", "is", null);
    const seen = new Set<string>();
    for (const h of holders ?? []) {
      // deno-lint-ignore no-explicit-any
      const p = h.people as any, o = h.profiles as any;
      if (!p.email || seen.has(p.id)) continue;
      seen.add(p.id);
      await enqueue(db, { email: p.email, name: p.first_name }, "controle-cartes", { ownerName: `${o.first_name} ${o.last_name}` });
      stats.cartes++;
    }
  }

  const { data: unpaid } = await db.from("profiles").select("id, first_name, email, billing_since, until:grace_end").eq("billing_status", "impaye");
  for (const u of unpaid ?? []) {
    if (new Date(u.until).getTime() <= today.getTime()) {
      await eraseCoffre(db, u.id);
      await db.from("profiles").update({ billing_status: "efface" }).eq("id", u.id);
      stats.effaces++;
    } else if (Math.floor((today.getTime() - new Date(u.billing_since).getTime()) / DAY) % 7 === 0) {
      await enqueue(db, { email: u.email, name: u.first_name }, "impaye", { until: u.until });
      stats.impayes++;
    }
  }
  const { data: kyc } = await db.from("profiles").select("id, kyc_doc_path").in("kyc", ["verifie", "refuse"]).not("kyc_doc_path", "is", null);
  for (const k of kyc ?? []) {
    await db.storage.from("kyc").remove([k.kyc_doc_path]);
    await db.from("profiles").update({ kyc_doc_path: null }).eq("id", k.id);
    stats.pieces++;
  }
  // The beneficiary's ID only serves the identity check; the certificate, the proof while the access lasts.
  const { data: docs } = await db.from("procedures").select("id, acte_path, acte_id_path, acte_id_checked, verified_at, rejected_at, cancelled_at, erased_at").or("acte_path.not.is.null,acte_id_path.not.is.null");
  for (const p of docs ?? []) {
    const over = !!(p.rejected_at || p.cancelled_at || p.erased_at);
    const keep = { acte_path: over ? null : p.acte_path, acte_id_path: over || p.acte_id_checked || p.verified_at ? null : p.acte_id_path };
    const gone = [p.acte_path !== keep.acte_path && p.acte_path, p.acte_id_path !== keep.acte_id_path && p.acte_id_path].filter(Boolean) as string[];
    if (!gone.length) continue;
    await db.storage.from("verification").remove(gone);
    await db.from("procedures").update(keep).eq("id", p.id);
    stats.pieces += gone.length;
  }
  await db.from("outbox").delete().eq("status", "sent").lt("sent_at", new Date(today.getTime() - 30 * DAY).toISOString());
  return json(stats);
});
