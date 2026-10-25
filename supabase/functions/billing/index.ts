// Subscription (Stripe). Called from the app with the user's token: { action: "checkout" | "portal", returnUrl }.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID (the yearly price of the simple plan), APP_URL / APP_ORIGINS.
import { admin, caller, cors, env, json } from "../_shared/server.ts";

async function stripe(path: string, params: Record<string, string>) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body?.error?.message ?? `Stripe ${r.status}`);
  return body;
}

// Only back to our own pages: no open redirect.
function safeReturn(url: unknown) {
  const origins = (Deno.env.get("APP_ORIGINS") ?? env("APP_URL")).split(",").map((s) => s.trim());
  return typeof url === "string" && origins.some((o) => url.startsWith(o + "/")) ? url : `${env("APP_URL")}/espace/compte/`;
}

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  const user = await caller(req);
  if (!user) return json({ error: "non connecté" }, 401, h);
  const { action, returnUrl } = await req.json().catch(() => ({}));
  const back = safeReturn(returnUrl);
  const db = admin();
  const { data: p } = await db.from("profiles").select("id, email, first_name, last_name, stripe_customer_id").eq("id", user.id).single();
  if (!p) return json({ error: "profil manquant" }, 404, h);
  try {
    let customer = p.stripe_customer_id as string | null;
    if (!customer) {
      customer = (await stripe("customers", { email: p.email, name: `${p.first_name} ${p.last_name}`, "metadata[user_id]": p.id })).id as string;
      await db.from("profiles").update({ stripe_customer_id: customer }).eq("id", p.id);
    }
    if (action === "portal") return json({ url: (await stripe("billing_portal/sessions", { customer, return_url: back })).url }, 200, h);
    const s = await stripe("checkout/sessions", {
      mode: "subscription",
      customer,
      client_reference_id: p.id,
      "line_items[0][price]": env("STRIPE_PRICE_ID"),
      "line_items[0][quantity]": "1",
      "subscription_data[metadata][user_id]": p.id,
      locale: "fr",
      success_url: `${back}?paiement=ok`,
      cancel_url: back,
    });
    return json({ url: s.url }, 200, h);
  } catch (e) {
    console.error("billing", e);
    return json({ error: "Paiement indisponible pour le moment." }, 502, h);
  }
});
