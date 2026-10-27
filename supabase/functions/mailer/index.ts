// Cron every minute: sends the queued e-mails (table outbox) through Brevo. Failures are retried up to 5 times.
// Without BREVO_API_KEY (local tests), e-mails are only marked as sent and logged.
import { admin, internalOnly, json, sendBrevo } from "../_shared/server.ts";
import type { TemplateId } from "../_shared/templates.ts";

Deno.serve(async (req) => {
  if (!internalOnly(req)) return json({ error: "forbidden" }, 403);
  const db = admin();
  const { data: batch, error } = await db.rpc("claim_outbox", { n: 50 });
  if (error) return json({ error: error.message }, 500);
  const dry = !Deno.env.get("BREVO_API_KEY");
  let sent = 0, failed = 0;
  for (const m of batch ?? []) {
    try {
      const id = dry ? `dry-${m.id}` : await sendBrevo({ email: m.to_email, name: m.to_name ?? undefined }, m.template as TemplateId, m.data ?? {}, m.lang);
      if (dry) console.log("mailer (dry run)", m.template, m.to_email);
      await db.from("outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_id: id, last_error: null }).eq("id", m.id);
      sent++;
    } catch (e) {
      await db.from("outbox").update({ status: "error", last_error: String(e).slice(0, 500) }).eq("id", m.id);
      failed++;
    }
  }
  return json({ sent, failed });
});
