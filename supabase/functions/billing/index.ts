// Subscription (Paddle Billing). Called from the app with the user's token: { action: "checkout" | "portal" }.
// checkout → { transactionId }: the app opens Paddle's checkout over the page (Paddle.js), card details never reach us.
// portal → { url }: Paddle's customer portal (invoices, card, cancellation), a short-lived link.
// Secrets: PADDLE_API_KEY, PADDLE_PRICE_ID (the yearly price), PADDLE_ENV ("sandbox" while testing).
import { admin, caller, cors, env, json } from "../_shared/server.ts";

const API = Deno.env.get("PADDLE_ENV") === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

async function paddle(path: string, body?: unknown) {
  const r = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${env("PADDLE_API_KEY")}`, "content-type": "application/json", "paddle-version": "1" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await r.json();
  if (!r.ok) throw Object.assign(new Error(res?.error?.detail ?? `Paddle ${r.status}`), { code: res?.error?.code });
  return res.data;
}

// The address may already be known to Paddle (e.g. an account deleted then created again): reuse that customer.
async function customerFor(p: { id: string; email: string; first_name: string; last_name: string }) {
  try {
    return (await paddle("/customers", { email: p.email, name: `${p.first_name} ${p.last_name}`, custom_data: { user_id: p.id } })).id as string;
  } catch (e) {
    if ((e as { code?: string }).code !== "customer_already_exists") throw e;
    const [c] = await paddle(`/customers?email=${encodeURIComponent(p.email)}&status=active,archived`);
    return c.id as string;
  }
}

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  const user = await caller(req);
  if (!user) return json({ error: "non connecté" }, 401, h);
  const { action } = await req.json().catch(() => ({}));
  const db = admin();
  const { data: p } = await db.from("profiles").select("id, email, first_name, last_name, billing_customer_id").eq("id", user.id).single();
  if (!p) return json({ error: "profil manquant" }, 404, h);
  try {
    let customer = p.billing_customer_id as string | null;
    if (!customer) {
      customer = await customerFor(p);
      await db.from("profiles").update({ billing_customer_id: customer }).eq("id", p.id);
    }
    if (action === "portal") return json({ url: (await paddle(`/customers/${customer}/portal-sessions`, {})).urls.general.overview }, 200, h);
    const t = await paddle("/transactions", { items: [{ price_id: env("PADDLE_PRICE_ID"), quantity: 1 }], customer_id: customer, custom_data: { user_id: p.id } });
    return json({ transactionId: t.id }, 200, h);
  } catch (e) {
    console.error("billing", e);
    return json({ error: "Paiement indisponible pour le moment." }, 502, h);
  }
});
