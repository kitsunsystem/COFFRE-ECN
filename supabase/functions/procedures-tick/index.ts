// Cron every 15 minutes: alerts during the cancellation window, release at its end, and after a death the end of
// the beneficiaries' access (warning 30 days before, then the whole Coffre is erased for good).
// Release itself is enforced by RLS (is_released); this function only notifies and erases.
import { admin, eraseCoffre, internalOnly, json, sendEmail } from "../_shared/server.ts";

const fmt = (t: string) => new Date(t).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
const day = (t: string) => new Date(t).toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

// deno-lint-ignore no-explicit-any
async function beneficiaries(db: any, ownerId: string, moments: string[]) {
  const { data: envs } = await db.from("envelopes").select("card_id, cards!inner(holder_person_id, people(first_name, email))").eq("owner_id", ownerId).in("moment", moments);
  const byEmail = new Map<string, string>();
  // deno-lint-ignore no-explicit-any
  for (const e of envs ?? []) { const p = (e.cards as any)?.people; if (p?.email) byEmail.set(p.email, p.first_name); }
  return [...byEmail].map(([email, name]) => ({ email, name })); // one e-mail per person, not per card of their pack
}

async function endOfAccess(db: ReturnType<typeof admin>) {
  const { data: deaths } = await db.from("procedures").select("*, profiles!inner(first_name,last_name), end:access_end").eq("kind", "deces").not("finalized_at", "is", null).is("erased_at", null);
  let warned = 0, erased = 0;
  for (const p of deaths ?? []) {
    const left = new Date(p.end).getTime() - Date.now();
    const ownerName = `${p.profiles.first_name} ${p.profiles.last_name}`;
    if (left <= 0) {
      await eraseCoffre(db, p.owner_id);
      await db.from("procedures").update({ erased_at: new Date().toISOString() }).eq("id", p.id);
      erased++;
    } else if (!p.end_warned_at && left < 30 * 86_400_000) {
      for (const b of await beneficiaries(db, p.owner_id, ["now", "coup_dur", "deces"])) await sendEmail(b, "acces-fin", { ownerName, until: day(p.end) });
      await db.from("procedures").update({ end_warned_at: new Date().toISOString() }).eq("id", p.id);
      warned++;
    }
  }
  return { warned, erased };
}

Deno.serve(async (req) => {
  if (!internalOnly(req)) return json({ error: "forbidden" }, 403);
  const db = admin();
  const now = Date.now();
  const { data: procs } = await db
    .from("procedures")
    .select("*, profiles!inner(first_name,last_name,email), end:access_end")
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

    // Window over: tell each beneficiary who now has something to open.
    const moments = p.kind === "deces" ? ["coup_dur", "deces"] : ["coup_dur"];
    for (const b of await beneficiaries(db, p.owner_id, moments))
      await sendEmail(b, "acces-ouvert", { ownerName: `${o.first_name} ${o.last_name}`, ...(p.end ? { until: day(p.end) } : {}) });

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
  return json({ alerts, released, ...(await endOfAccess(db)) });
});
