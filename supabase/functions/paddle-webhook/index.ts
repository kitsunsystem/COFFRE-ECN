// Paddle webhook: keeps profiles.billing_status in line with the subscription.
// Unpaid or cancelled = "impaye" from that day: reminders during the grace period, then the Coffre is erased ("relances").
// Secret: PADDLE_WEBHOOK_SECRET (the key of the notification destination). Events: subscription.created, subscription.updated,
// subscription.canceled, subscription.past_due, transaction.completed. A card refused at checkout changes nothing.
import { admin, enqueue, env, json } from "../_shared/server.ts";

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

// https://developer.paddle.com/webhooks/signature-verification : "ts=…;h1=…" (several h1 while the key is rotated),
// HMAC-SHA256 of "<ts>:<raw body>", 5-minute tolerance.
async function verified(req: Request, payload: string) {
  const parts = (req.headers.get("paddle-signature") ?? "").split(";").map((kv) => kv.split("=") as [string, string | undefined]);
  const ts = Number(parts.find(([k]) => k === "ts")?.[1]);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(env("PADDLE_WEBHOOK_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}:${payload}`)));
  // Constant-time comparison.
  return parts.some(([k, g]) => k === "h1" && g?.length === expected.length && [...g].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  const payload = await req.text();
  if (!(await verified(req, payload))) return json({ error: "signature" }, 400);
  const event = JSON.parse(payload);
  const type = String(event.event_type ?? "");
  const o = event.data ?? {};
  const db = admin();
  const cols = "id, email, first_name, billing_status";
  const p =
    (o.customer_id && (await db.from("profiles").select(cols).eq("billing_customer_id", o.customer_id).maybeSingle()).data) ||
    (o.custom_data?.user_id && (await db.from("profiles").select(cols).eq("id", o.custom_data.user_id).maybeSingle()).data);
  if (!p) return json({ skipped: "unknown customer" });

  let status: "a_jour" | "impaye" | null = null;
  if (type.startsWith("subscription.")) {
    await db.from("profiles").update({ subscription_status: o.status }).eq("id", p.id);
    status = ["active", "trialing"].includes(o.status) ? "a_jour" : ["past_due", "paused", "canceled"].includes(o.status) ? "impaye" : null;
  } else if (type === "transaction.completed") status = "a_jour";

  if (status === "a_jour" && p.billing_status !== "efface") await db.from("profiles").update({ billing_status: "a_jour", billing_since: null }).eq("id", p.id);
  if (status === "impaye" && p.billing_status === "a_jour") {
    const since = new Date();
    await db.from("profiles").update({ billing_status: "impaye", billing_since: since.toISOString() }).eq("id", p.id);
    const { data: s } = await db.from("app_settings").select("grace_period").single();
    const days = Number(String(s?.grace_period ?? "30 days").match(/\d+/)?.[0] ?? 30);
    const until = new Date(since.getTime() + days * 86_400_000).toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
    await enqueue(db, { email: p.email, name: p.first_name }, "impaye", { until });
  }
  return json({ ok: true });
});
