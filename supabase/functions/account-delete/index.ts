// RGPD (right to erasure): the signed-in owner deletes their account. Files first (storage has no cascade),
// then the user: the database cascade removes the profile, the Espace and the Coffre.
// Refused while a death procedure is under way, so a mistaken deletion cannot cut the beneficiaries' access.
import { admin, caller, cors, eraseCoffre, json, removeFolder } from "../_shared/server.ts";

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  const user = await caller(req);
  if (!user) return json({ error: "non connecté" }, 401, h);
  const db = admin();
  const { data: deaths } = await db.from("procedures").select("id").eq("owner_id", user.id).eq("kind", "deces").is("cancelled_at", null).is("rejected_at", null).is("erased_at", null);
  if (deaths?.length) return json({ error: "Une procédure est en cours : contactez-nous." }, 409, h);
  await eraseCoffre(db, user.id);
  await removeFolder(db, "kyc", user.id);
  await removeFolder(db, "verification", user.id);
  await db.from("audit_log").insert({ owner_id: user.id, actor: user.id, action: "compte.suppression" });
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500, h);
  return json({ ok: true }, 200, h);
});
