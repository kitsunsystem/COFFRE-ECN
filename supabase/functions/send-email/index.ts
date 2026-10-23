// Database webhook (INSERT on profiles, guarantors, cards) → transactional e-mail through Brevo.
// Configure in Supabase: Database → Webhooks → "send-email", with the service role key in the Authorization header.
import { admin, internalOnly, json, sendEmail } from "../_shared/server.ts";

type Payload = { type: "INSERT" | "UPDATE" | "DELETE"; table: string; record: Record<string, unknown> };

Deno.serve(async (req) => {
  if (!internalOnly(req)) return json({ error: "forbidden" }, 403);
  const { type, table, record } = (await req.json()) as Payload;
  if (type !== "INSERT") return json({ skipped: true });
  const db = admin();
  const owner = async (id: unknown) => (await db.from("profiles").select("first_name,last_name,email").eq("id", id).single()).data!;
  const person = async (id: unknown) => (await db.from("people").select("first_name,last_name,email").eq("id", id).single()).data!;

  if (table === "profiles") {
    await sendEmail({ email: record.email as string, name: record.first_name as string }, "bienvenue", { firstName: record.first_name as string });
  } else if (table === "guarantors") {
    const [o, p] = await Promise.all([owner(record.owner_id), person(record.person_id)]);
    if (p.email) await sendEmail({ email: p.email, name: p.first_name }, "invitation-garant", { ownerName: `${o.first_name} ${o.last_name}`, role: record.role as string });
  } else if (table === "cards" && record.holder_person_id) {
    const [o, p] = await Promise.all([owner(record.owner_id), person(record.holder_person_id)]);
    if (p.email) await sendEmail({ email: p.email, name: p.first_name }, "invitation-porteur", { ownerName: `${o.first_name} ${o.last_name}` });
  } else if (table === "cards") {
    // One e-mail for the batch of included cards: only on the first one.
    const { count } = await db.from("cards").select("id", { count: "exact", head: true }).eq("owner_id", record.owner_id).is("holder_person_id", null);
    if (count === 1) {
      const o = await owner(record.owner_id);
      await sendEmail({ email: o.email, name: o.first_name }, "cartes-commandees", { count: "3" });
    }
  }
  return json({ ok: true });
});
