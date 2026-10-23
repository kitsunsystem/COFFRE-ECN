// Cron every 15 minutes: alerts during the cancellation window, then release at its end.
// Release itself is enforced by RLS (is_released); this function only notifies and destroys "À effacer".
import { admin, internalOnly, json, sendEmail } from "../_shared/server.ts";

const fmt = (t: string) => new Date(t).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

Deno.serve(async (req) => {
  if (!internalOnly(req)) return json({ error: "forbidden" }, 403);
  const db = admin();
  const now = Date.now();
  const { data: procs } = await db
    .from("procedures")
    .select("*, profiles!inner(first_name,last_name,email)")
    .is("finalized_at", null)
    .is("cancelled_at", null)
    .is("rejected_at", null)
    .is("closed_at", null)
    .not("ends_at", "is", null);
  let alerts = 0, released = 0;

  for (const p of procs ?? []) {
    const o = p.profiles;
    const ends = new Date(p.ends_at).getTime();
    const template = p.kind === "coup_dur" ? "coup-dur-declare" : "deces-delai";
    const data = { declaredBy: p.declared_by, endsAt: fmt(p.ends_at) };
    if (now < ends) {
      // shortcut: e-mail only; add Brevo SMS and a push notification here once the sender and app ids exist.
      if (!p.alerted_at) {
        await sendEmail({ email: o.email, name: o.first_name }, template, data);
        await db.from("procedures").update({ alerted_at: new Date().toISOString() }).eq("id", p.id);
        alerts++;
      } else if (!p.last_call_at && ends - now < 24 * 3_600_000) {
        await sendEmail({ email: o.email, name: o.first_name }, template, data);
        await db.from("procedures").update({ last_call_at: new Date().toISOString() }).eq("id", p.id);
        alerts++;
      }
      continue;
    }

    // Window over: tell each holder who now has something to open.
    const moments = p.kind === "deces" ? ["coup_dur", "deces"] : ["coup_dur"];
    const { data: envs } = await db.from("envelopes").select("card_id, cards!inner(holder_person_id, people(first_name, email))").eq("owner_id", p.owner_id).in("moment", moments);
    const notified = new Set<string>();
    for (const e of envs ?? []) {
      // deno-lint-ignore no-explicit-any
      const person = (e.cards as any)?.people;
      if (!person?.email || notified.has(person.email)) continue;
      notified.add(person.email);
      await sendEmail({ email: person.email, name: person.first_name }, "acces-ouvert", { ownerName: `${o.first_name} ${o.last_name}` });
    }

    if (p.kind === "deces") {
      // "À effacer": ciphertext and files destroyed without ever being read (nobody holds its key).
      const { data: doomed } = await db.from("vault_items").select("id, file_ids").eq("owner_id", p.owner_id).eq("subsection_id", "prive");
      const paths = (doomed ?? []).flatMap((i) => i.file_ids.map((f: string) => `${p.owner_id}/prive/${f}`));
      if (paths.length) await db.storage.from("coffre").remove(paths);
      await db.from("vault_items").delete().eq("owner_id", p.owner_id).eq("subsection_id", "prive");
    }
    await db.from("procedures").update({ finalized_at: new Date().toISOString() }).eq("id", p.id);
    released++;
  }
  return json({ alerts, released });
});
