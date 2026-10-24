// Shared by the Edge Functions (Deno). Secrets are set with `supabase secrets set` (see .env.example).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { render, toHtml, type TemplateId } from "./templates.ts";

export const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing secret ${k}`);
  return v;
};

// Service role: bypasses RLS. Only ever used server-side, never for Coffre content (it is ciphertext anyway).
export const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

// Internal endpoints (cron, database webhooks) must carry the service role key.
export const internalOnly = (req: Request) => req.headers.get("authorization") === `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`;

export async function sendEmail(to: { email: string; name?: string }, template: TemplateId, data: Record<string, string> = {}) {
  const e = render(template, data);
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env("BREVO_API_KEY"), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: env("MAIL_FROM_NAME"), email: env("MAIL_FROM") },
      to: [to],
      subject: e.subject,
      htmlContent: toHtml(e, env("APP_URL")),
      textContent: [e.title, ...e.body].join("\n\n"),
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
  const { messageId } = await r.json();
  await admin().from("email_log").insert({ to_address: to.email, template, provider_id: messageId });
  return messageId as string;
}

// The end of a Coffre (after the post-death access period, or an unpaid subscription): ciphertext, files, keys, envelopes.
export async function eraseCoffre(db: ReturnType<typeof admin>, ownerId: string) {
  const bucket = db.storage.from("coffre");
  const { data: folders } = await bucket.list(ownerId, { limit: 1000 });
  for (const f of folders ?? []) {
    const { data: files } = await bucket.list(`${ownerId}/${f.name}`, { limit: 1000 });
    const paths = (files ?? []).map((x) => `${ownerId}/${f.name}/${x.name}`);
    if (paths.length) await bucket.remove(paths);
  }
  await db.from("vault_items").delete().eq("owner_id", ownerId);
  await db.from("envelopes").delete().eq("owner_id", ownerId);
  await db.from("rights").delete().in("person_id", ((await db.from("people").select("id").eq("owner_id", ownerId)).data ?? []).map((p) => p.id));
  await db.from("vaults").delete().eq("owner_id", ownerId);
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
