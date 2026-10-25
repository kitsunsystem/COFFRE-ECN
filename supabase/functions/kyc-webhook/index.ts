// Result of the identity check from the group's KYC system (to connect: its name and format are still "à décider").
// Expected: POST { "user_id": "<uuid>", "status": "verifie" | "refuse", "ref": "<file reference>" }
// with header x-signature = hex(HMAC-SHA256(body, KYC_WEBHOOK_SECRET)). Until then, the team checks by hand (admin › Identités).
import { admin, env, json } from "../_shared/server.ts";

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  const body = await req.text();
  const key = await crypto.subtle.importKey("raw", enc.encode(env("KYC_WEBHOOK_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  const given = req.headers.get("x-signature") ?? "";
  if (given.length !== expected.length || [...given].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) !== 0) return json({ error: "signature" }, 401);
  const { user_id, status, ref } = JSON.parse(body);
  if (!/^[0-9a-f-]{36}$/.test(user_id) || !["verifie", "refuse"].includes(status)) return json({ error: "invalid" }, 400);
  const db = admin();
  await db.from("profiles").update({ kyc: status, kyc_ref: typeof ref === "string" ? ref.slice(0, 120) : null }).eq("id", user_id);
  await db.from("audit_log").insert({ owner_id: user_id, action: "verification.kyc", detail: { status, source: "webhook" } });
  return json({ ok: true });
});
