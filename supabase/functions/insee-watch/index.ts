// Monthly death watch (cron, e.g. the 5th of each month): latest INSEE file from data.gouv.fr, matched against members.
// Every match opens a "décès" procedure in "vérification": a person always checks before any delay starts.
import { findMatches, type Match, type Member } from "../_shared/insee.ts";
import { admin, internalOnly, json } from "../_shared/server.ts";
import { checkDoubtful } from "../assistant/check.ts";

const DATASET = "https://www.data.gouv.fr/api/1/datasets/fichier-des-personnes-decedees/";

async function latestFile() {
  const ds = await (await fetch(DATASET)).json();
  // Monthly files are named like "deces-2026-m09.txt"; take the most recent one.
  const monthly = (ds.resources as { title: string; url: string }[]).filter((r) => /deces-\d{4}-m\d{2}\.txt$/.test(r.title)).sort((a, b) => b.title.localeCompare(a.title));
  if (!monthly[0]) throw new Error("No monthly INSEE file found");
  return monthly[0];
}

Deno.serve(async (req) => {
  if (!internalOnly(req)) return json({ error: "forbidden" }, 403);
  const db = admin();
  const file = await latestFile();
  const lines = (await (await fetch(file.url)).text()).split(/\r?\n/);

  const { data: profiles } = await db.from("profiles").select("id,last_name,first_name,birth_date,birth_city").eq("kyc", "verifie");
  const members: Member[] = (profiles ?? []).map((p) => ({ id: p.id, lastName: p.last_name, firstNames: p.first_name, birthDate: p.birth_date, birthCity: p.birth_city ?? "" }));
  const matches = findMatches(members, lines);

  const opened: string[] = [];
  for (const m of matches) {
    // Already being handled for this member: do not open a second procedure.
    const { count } = await db.from("procedures").select("id", { count: "exact", head: true }).eq("owner_id", m.memberId).eq("kind", "deces").is("cancelled_at", null).is("rejected_at", null);
    if (count) continue;
    // The AI only looks at doubtful matches (spelling, compound names); it never decides alone.
    const ai: Match["reasons"] = m.doubtful ? await checkDoubtful(members.find((x) => x.id === m.memberId)!, m) : [];
    await db.from("procedures").insert({
      owner_id: m.memberId,
      kind: "deces",
      source: "insee",
      declared_by: "Veille INSEE",
      needs_verification: true,
      note: `Fichier ${file.title}`,
      match: { score: m.score, doubtful: m.doubtful, reasons: [...m.reasons, ...ai], record: m.record },
    });
    opened.push(m.memberId);
  }
  return json({ file: file.title, lines: lines.length, matches: matches.length, opened: opened.length });
});
