// Stripe webhook: keeps profiles.billing_status in line with the subscription.
// Unpaid or cancelled = "impaye" from that day: reminders during the grace period, then the Coffre is erased ("relances").
// Secret: STRIPE_WEBHOOK_SECRET. Configure the endpoint in Stripe for the events handled below.
import { admin, enqueue, env, json } from "../_shared/server.ts";

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

// https://docs.stripe.com/webhooks#verify-manually : HMAC-SHA256 of "<t>.<payload>", 5-minute tolerance.
async function verified(req: Request, payload: string) {
  const header = req.headers.get("stripe-signature") ?? "";
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(env("STRIPE_WEBHOOK_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
  const given = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  // Constant-time comparison.
  return given.some((g) => g.length === expected.length && [...g].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  const payload = await req.text();
  if (!(await verified(req, payload))) return json({ error: "signature" }, 400);
  const event = JSON.parse(payload);
  const o = event.data?.object ?? {};
  const db = admin();
  const byCustomer = async (customer: string) => (await db.from("profiles").select("id, email, first_name, billing_status").eq("stripe_customer_id", customer).maybeSingle()).data;

  if (event.type === "checkout.session.completed" && o.client_reference_id && o.customer) {
    await db.from("profiles").update({ stripe_customer_id: o.customer }).eq("id", o.client_reference_id).is("stripe_customer_id", null);
    return json({ ok: true });
  }

  const customer = typeof o.customer === "string" ? o.customer : null;
  if (!customer) return json({ skipped: true });
  const p = await byCustomer(customer);
  if (!p) return json({ skipped: "unknown customer" });

  let status: "a_jour" | "impaye" | null = null;
  if (event.type.startsWith("customer.subscription.")) {
    const s = event.type === "customer.subscription.deleted" ? "canceled" : o.status;
    await db.from("profiles").update({ subscription_status: s }).eq("id", p.id);
    status = ["active", "trialing"].includes(s) ? "a_jour" : ["past_due", "unpaid", "canceled", "incomplete_expired"].includes(s) ? "impaye" : null;
  } else if (event.type === "invoice.paid") status = "a_jour";
  else if (event.type === "invoice.payment_failed") status = "impaye";

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
