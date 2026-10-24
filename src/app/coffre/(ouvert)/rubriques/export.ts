// Printable export (save as PDF) for a notary or a hospital, built only from what the person opening the Coffre may see.
// Codes and passwords are left out: never needed by a notary or a hospital.
import { SECTIONS } from "@/lib/sections";
import { readItems, visibleSubsections } from "@/lib/vault";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function exportPdf(owner: string, reader: string) {
  // Opened first, synchronously in the click, so the browser does not block it as a pop-up.
  const w = window.open("", "_blank");
  if (!w) return;
  const visible = visibleSubsections();
  const parts: string[] = [];
  for (const sec of SECTIONS) {
    const blocks: string[] = [];
    for (const sub of sec.subsections.filter((x) => visible.includes(x.id) && x.id !== "prive")) {
      const list = await readItems(sub.id);
      if (!list.length) continue;
      const items = list.map(({ payload }) => {
        const rows = sub.fields
          .filter((f) => f.kind !== "secret" && payload.fields[f.key]?.trim())
          .map((f) => `<tr><th>${esc(f.label)}</th><td>${esc(payload.fields[f.key]).replace(/\n/g, "<br>")}</td></tr>`);
        if (payload.files.length) rows.push(`<tr><th>Documents</th><td>${payload.files.map((f) => esc(f.name)).join(", ")}</td></tr>`);
        return `<div class="item"><h4>${esc(payload.title)}</h4><table>${rows.join("")}</table></div>`;
      });
      blocks.push(`<h3>${esc(sub.title)}</h3>${items.join("")}`);
    }
    if (blocks.length) parts.push(`<h2>${esc(sec.title)}</h2>${blocks.join("")}`);
  }
  const date = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Coffre de ${esc(owner)}</title>
<style>body{font:15px/1.5 Georgia,serif;color:#0f1b2d;max-width:720px;margin:32px auto;padding:0 20px}h1{font-size:26px;margin:0}
.meta{color:#6b778a;margin:4px 0 24px}h2{font-size:20px;border-bottom:2px solid #c9a55c;padding-bottom:4px;margin-top:28px}
h3{font-size:16px;margin:18px 0 6px}.item{border:1px solid #e3d9c6;border-radius:10px;padding:10px 14px;margin:8px 0;break-inside:avoid}
h4{margin:0 0 6px}table{border-collapse:collapse;width:100%}th{text-align:left;color:#6b778a;font-weight:normal;width:38%;vertical-align:top;padding:2px 8px 2px 0}
td{padding:2px 0}.foot{margin-top:28px;color:#6b778a;font-size:12px}</style></head><body>
<h1>Coffre de ${esc(owner)}</h1><p class="meta">Exporté le ${date} par ${esc(reader)}. Ne contient que ce que cette personne a le droit de voir. Codes et mots de passe exclus.</p>
${parts.join("") || "<p>Aucun élément à exporter.</p>"}
<p class="foot">Document confidentiel. Pour l'enregistrer en PDF : Imprimer › Enregistrer au format PDF.</p>
<script>window.onload=()=>print()</script></body></html>`);
  w.document.close();
}
