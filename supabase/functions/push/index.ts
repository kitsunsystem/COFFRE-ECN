// Wakes the person's phones up when one of their trusted computers asks for the Coffre (called by the app right after
// the request). Android: Firebase Cloud Messaging (HTTP v1, service account). iOS: APNs (token key .p8).
// Without those secrets nothing is sent: the request still waits in the app. The notification never carries a key.
import { admin, caller, cors, json } from "../_shared/server.ts";
import { pushMessage } from "../_shared/templates.ts";

type Message = { title: string; body: string; request: string };

const b64url = (b: ArrayBuffer | string) =>
  btoa(typeof b === "string" ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// JWT signed with WebCrypto (ECDSA signatures come out raw r||s, as JWS ES256 expects).
async function jwt(alg: "RS256" | "ES256", pem: string, claims: Record<string, unknown>, kid?: string) {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const rsa = alg === "RS256";
  const key = await crypto.subtle.importKey("pkcs8", der, rsa ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } : { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const input = `${b64url(JSON.stringify({ alg, typ: "JWT", ...(kid ? { kid } : {}) }))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign(rsa ? "RSASSA-PKCS1-v1_5" : { name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input));
  return `${input}.${b64url(sig)}`;
}

async function fcm(token: string, m: Message): Promise<boolean | "gone"> {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return false;
  const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const assertion = await jwt("RS256", sa.private_key, { iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const auth = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const { access_token } = await auth.json();
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title: m.title, body: m.body }, data: { request: m.request }, android: { priority: "high", ttl: "180s" } } }),
  });
  if (r.status === 404) return "gone"; // the app was uninstalled
  return r.ok;
}

async function apns(token: string, m: Message): Promise<boolean | "gone"> {
  const [key, kid, team, topic] = ["APNS_KEY", "APNS_KEY_ID", "APNS_TEAM_ID", "APNS_TOPIC"].map((k) => Deno.env.get(k));
  if (!key || !kid || !team || !topic) return false;
  const host = Deno.env.get("APNS_SANDBOX") === "1" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const r = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await jwt("ES256", key, { iss: team, iat: Math.floor(Date.now() / 1000) }, kid)}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 180),
    },
    body: JSON.stringify({ aps: { alert: { title: m.title, body: m.body }, sound: "default" }, request: m.request }),
  });
  if (r.status === 410) return "gone";
  return r.ok;
}

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  const user = await caller(req);
  if (!user) return json({ error: "non connecté" }, 401, h);
  const { request } = await req.json().catch(() => ({ request: null }));
  const db = admin();
  // Only a fresh opening request of the caller's own: nobody can make someone else's phone ring.
  const { data: r } = await db.from("device_requests").select("id, name, kind, status, created_at").eq("id", request).eq("user_id", user.id).maybeSingle();
  if (!r || r.kind !== "open" || r.status !== "pending" || Date.now() - Date.parse(r.created_at) > 60_000) return json({ sent: 0 }, 200, h);
  const { data: tokens } = await db.from("push_tokens").select("token, platform").eq("user_id", user.id);
  const { data: profile } = await db.from("profiles").select("lang").eq("id", user.id).maybeSingle();
  const m: Message = { ...pushMessage(r.name, profile?.lang ?? user.user_metadata?.lang ?? "fr"), request: r.id };
  let sent = 0;
  for (const t of tokens ?? []) {
    const res = await (t.platform === "android" ? fcm(t.token, m) : apns(t.token, m)).catch((e) => (console.error(e), false));
    if (res === "gone") await db.from("push_tokens").delete().eq("token", t.token);
    if (res === true) sent++;
  }
  return json({ sent }, 200, h);
});
