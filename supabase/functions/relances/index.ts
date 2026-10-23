// Daily cron: expiry reminders (30 and 7 days before) and a gentle nudge when the essentials are not done.
// Uses only Espace metadata: the date of a reminder, the number of items per sub-section. Never Coffre content.
import { admin, internalOnly, json, sendEmail } from "../_shared/server.ts";

const ESSENTIALS = ["a-prevenir", "groupe-allergies", "identite-famille", "banques", "assurances", "telephone", "messageries", "juridique", "obseques", "lettres"];
const DAY = 86_400_000;

Deno.serve(async (req) => {
  if (!internalOnly(req)) return json({ error: "forbidden" }, 403);
  const db = admin();
  const today = Date.now();
  let echeances = 0, relances = 0;

  const { data: reminders } = await db.from("reminders").select("*, profiles!inner(first_name,email)");
  for (const r of reminders ?? []) {
    const left = new Date(r.date).getTime() - today;
    const field = left < 7 * DAY && !r.sent_7 ? "sent_7" : left < 30 * DAY && !r.sent_30 ? "sent_30" : null;
    if (!field || left < 0) continue;
    await sendEmail({ email: r.profiles.email, name: r.profiles.first_name }, "echeance", { date: new Date(r.date).toLocaleDateString("fr-FR", { dateStyle: "long" }) });
    await db.from("reminders").update({ [field]: true, ...(field === "sent_7" ? { sent_30: true } : {}) }).eq("item_id", r.item_id);
    echeances++;
  }

  // Nudge on Mondays only, so nobody gets more than one e-mail a week.
  if (new Date().getDay() === 1) {
    const { data: profiles } = await db.from("profiles").select("id, first_name, email");
    for (const p of profiles ?? []) {
      const { data: items } = await db.from("vault_items").select("subsection_id").eq("owner_id", p.id).in("subsection_id", ESSENTIALS);
      const done = new Set((items ?? []).map((i) => i.subsection_id)).size;
      if (done >= ESSENTIALS.length) continue;
      await sendEmail({ email: p.email, name: p.first_name }, "relance", { score: String(Math.round((done / ESSENTIALS.length) * 100)), next: "ajouter un élément essentiel à votre Coffre" });
      relances++;
    }
  }
  return json({ echeances, relances });
});
