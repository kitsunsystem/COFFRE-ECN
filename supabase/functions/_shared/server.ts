// Shared by the Edge Functions (Deno). Secrets are set with `supabase secrets set` (see .env.example).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { render, toHtml, type TemplateId } from "./templates.ts";

export const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing secret ${k}`);
  return v;
};

// Service role: bypasses RLS. Only ever used server-side, never for Coffre content (it is ciphertext anyway).
export const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

// The signed-in user behind a request (functions called from the app with the user's token).
export async function caller(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user ?? null;
}

// Internal endpoints (cron) must carry the service role key.
export const internalOnly = (req: Request) => req.headers.get("authorization") === `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`;

// Every e-mail goes through the outbox: the "mailer" function sends it (Brevo) and retries on failure.
export async function enqueue(db: SupabaseClient, to: { email?: string | null; name?: string | null }, template: TemplateId, data: Record<string, string> = {}) {
  if (!to.email) return;
  const { error } = await db.from("outbox").insert({ to_email: to.email, to_name: to.name ?? null, template, data });
  if (error) throw new Error(`outbox: ${error.message}`);
}

export async function sendBrevo(to: { email: string; name?: string }, template: TemplateId, data: Record<string, string> = {}, lang = "fr") {
  const e = render(template, data, lang);
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env("BREVO_API_KEY"), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: env("MAIL_FROM_NAME"), email: env("MAIL_FROM") },
      to: [to],
      subject: e.subject,
      htmlContent: toHtml(e, env("APP_URL")),
      textContent: [e.title, ...e.body, ...(e.cta ? [`${e.cta.label} : ${env("APP_URL")}${e.cta.path}`] : [])].join("\n\n"),
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
  const { messageId } = await r.json();
  return messageId as string;
}

// The end of a Coffre (after the post-death access period, or an unpaid subscription): ciphertext, files, keys, envelopes.
export async function eraseCoffre(db: SupabaseClient, ownerId: string) {
  await removeFolder(db, "coffre", ownerId);
  await db.from("vault_items").delete().eq("owner_id", ownerId);
  await db.from("envelopes").delete().eq("owner_id", ownerId);
  await db.from("rights").delete().eq("owner_id", ownerId);
  await db.from("vaults").delete().eq("owner_id", ownerId);
}

// Storage has no recursive delete: list each sub-folder (one level deep, as our paths are) and remove by batches.
export async function removeFolder(db: SupabaseClient, bucket: string, prefix: string) {
  const b = db.storage.from(bucket);
  const { data: entries } = await b.list(prefix, { limit: 1000 });
  for (const f of entries ?? []) {
    if (f.id) {
      await b.remove([`${prefix}/${f.name}`]);
      continue;
    }
    for (;;) {
      const { data: files } = await b.list(`${prefix}/${f.name}`, { limit: 1000 });
      const paths = (files ?? []).map((x) => `${prefix}/${f.name}/${x.name}`);
      if (!paths.length) break;
      await b.remove(paths);
    }
  }
}

const ALLOWED = (Deno.env.get("APP_ORIGINS") ?? Deno.env.get("APP_URL") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
// Browser calls (app → function): only from our own origins (website and the native app's local origins).
export function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const ok = ALLOWED.includes(origin) || ["capacitor://localhost", "https://localhost"].includes(origin);
  return {
    "access-control-allow-origin": ok ? origin : ALLOWED[0] ?? "null",
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "origin",
  };
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } });
