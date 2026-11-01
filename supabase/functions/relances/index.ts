// Daily cron. Uses only Espace data, never Coffre content:
// - expiry reminders typed in the Espace (30 and 7 days before), with the person's consent;
// - "tout est-il à jour ?" every 3 months;
// - the démarches de protection not done yet, and the relatives still without an account: every month, to the owner;
// - each relative with an account checks their details twice a year;
// - unpaid subscriptions: a reminder each week of the grace period, then the whole Coffre is erased;
// - documents and e-mails kept no longer than needed: ID and face photo once checked, a coup dur proof once decided,
//   the death certificate once the procedure is over, sent e-mails after 30 days.
import { PROTECTION_IDS } from "../_shared/protection.ts";
import { admin, enqueue, eraseCoffre, internalOnly, json } from "../_shared/server.ts";

const DAY = 86_400_000;

Deno.serve(async (req) => {
  if (!internalOnly(req)) return json({ error: "forbidden" }, 403);
  const db = admin();
  const today = new Date();
  const stats = { echeances: 0, aJour: 0, protection: 0, sansCompte: 0, proches: 0, impayes: 0, effaces: 0, pieces: 0 };

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

  if (firstMonday) {
    // Démarches de protection: done or "pas concerné" both count.
    const { data: owners } = await db.from("profiles").select("id, first_name, email, is_business_owner, checklist(key)").eq("billing_status", "a_jour");
    for (const o of owners ?? []) {
      const keys = new Set((o.checklist ?? []).map((c: { key: string }) => c.key));
      const ids = PROTECTION_IDS.filter((d) => !d.business || o.is_business_owner).map((d) => d.id);
      const left = ids.filter((id) => !keys.has(`protection:${id}`) && !keys.has(`protection-na:${id}`)).length;
      if (!left) continue;
      await enqueue(db, { email: o.email, name: o.first_name }, "protection", { count: String(left), total: String(ids.length) });
      stats.protection++;
    }
    // Every relative needs an account: the owner is reminded of those who have not created theirs.
    const { data: waiting } = await db.from("people").select("first_name, last_name, profiles!inner(first_name, email, billing_status)").is("user_id", null).eq("profiles.billing_status", "a_jour");
    const byOwner = new Map<string, { name: string; names: string[] }>();
    for (const w of waiting ?? []) {
      const o = byOwner.get(w.profiles.email) ?? { name: w.profiles.first_name, names: [] };
      o.names.push(`${w.first_name} ${w.last_name}`);
      byOwner.set(w.profiles.email, o);
    }
    for (const [email, o] of byOwner) await enqueue(db, { email, name: o.name }, "proches-sans-compte", { names: o.names.join(", ") });
    stats.sansCompte = byOwner.size;
  }
  // Twice a year (January and July), each relative with an account checks their details.
  if (firstMonday && today.getMonth() % 6 === 0) {
    const { data: linked } = await db.from("people").select("first_name, email, profiles!inner(first_name, last_name)").not("user_id", "is", null).not("email", "is", null);
    for (const r of linked ?? []) {
      await enqueue(db, { email: r.email, name: r.first_name }, "verifier-infos", { ownerName: `${r.profiles.first_name} ${r.profiles.last_name}` });
      stats.proches++;
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
  // The ID and the face photo only serve the identity check; a coup dur proof, the team's decision; the death certificate,
  // the proof while the access lasts.
  const { data: docs } = await db
    .from("procedures")
    .select("id, kind, acte_path, acte_id_path, selfie_path, acte_id_checked, verified_at, rejected_at, cancelled_at, closed_at, erased_at")
    .or("acte_path.not.is.null,acte_id_path.not.is.null,selfie_path.not.is.null");
  for (const p of docs ?? []) {
    const over = !!(p.rejected_at || p.cancelled_at || p.erased_at || (p.kind === "coup_dur" && (p.verified_at || p.closed_at)));
    const checked = over || p.acte_id_checked || p.verified_at;
    const keep = { acte_path: over ? null : p.acte_path, acte_id_path: checked ? null : p.acte_id_path, selfie_path: checked ? null : p.selfie_path };
    const gone = (["acte_path", "acte_id_path", "selfie_path"] as const).filter((k) => p[k] && p[k] !== keep[k]).map((k) => p[k] as string);
    if (!gone.length) continue;
    await db.storage.from("verification").remove(gone);
    await db.from("procedures").update(keep).eq("id", p.id);
    stats.pieces += gone.length;
  }
  await db.from("outbox").delete().eq("status", "sent").lt("sent_at", new Date(today.getTime() - 30 * DAY).toISOString());
  return json(stats);
});
