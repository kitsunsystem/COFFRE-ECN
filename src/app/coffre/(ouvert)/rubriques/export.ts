// PDF file for a notary or a hospital, built on the device only from what the person opening the Coffre may see:
// the owner sees everything, a beneficiary only the sub-sections released to their card. Codes and passwords are left out.
import { colon, tr } from "@/lib/i18n";
import { SECTIONS } from "@/lib/sections";
import { saveFile } from "@/lib/native";
import { readItems, visibleSubsections } from "@/lib/vault";

export interface ExportSection {
  title: string;
  subs: { title: string; items: { title: string; rows: [string, string][] }[] }[];
}

// What goes into the PDF, kept apart from the layout so it can be tested.
export async function exportContent(): Promise<ExportSection[]> {
  const visible = visibleSubsections();
  const out: ExportSection[] = [];
  for (const sec of SECTIONS) {
    const subs: ExportSection["subs"] = [];
    for (const sub of sec.subsections.filter((x) => visible.includes(x.id) && x.id !== "prive")) {
      const list = await readItems(sub.id);
      if (!list.length) continue;
      subs.push({
        title: sub.title,
        items: list.map(({ payload }) => {
          const rows: [string, string][] = sub.fields
            .filter((f) => f.kind !== "secret" && payload.fields[f.key]?.trim())
            .map((f) => [f.label, f.kind === "date" ? new Date(payload.fields[f.key]).toLocaleDateString("fr-FR", { dateStyle: "long" }) : payload.fields[f.key].trim()]);
          if (payload.files.length) rows.push(["Documents", payload.files.map((f) => f.name).join(", ")]);
          return { title: payload.title, rows };
        }),
      });
    }
    if (subs.length) out.push({ title: sec.title, subs });
  }
  return out;
}

export async function exportPdf(owner: string, reader: string) {
  const [{ jsPDF }, content] = await Promise.all([import("jspdf"), exportContent()]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  let y = M;
  const room = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, size: number, opts: { bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(size).setTextColor(...(opts.color ?? [15, 27, 45]));
    const lines = doc.splitTextToSize(tr(s), W - 2 * M - (opts.indent ?? 0)) as string[];
    for (const l of lines) {
      room(size * 1.35);
      doc.text(l, M + (opts.indent ?? 0), y + size);
      y += size * 1.35;
    }
    y += opts.gap ?? 0;
  };

  const date = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });
  text(`Coffre de ${owner}`, 22, { bold: true, gap: 4 });
  text(`Exporté le ${date} par ${reader}. Ce document contient uniquement ce que ${reader} a le droit de voir. Codes et mots de passe exclus.`, 10, { color: [107, 119, 138], gap: 14 });
  if (!content.length) text("Aucun élément à exporter.", 12);
  for (const sec of content) {
    room(60);
    y += 8;
    text(sec.title, 16, { bold: true });
    doc.setDrawColor(201, 165, 92).setLineWidth(1.5).line(M, y, W - M, y);
    y += 10;
    for (const sub of sec.subs) {
      room(40);
      text(sub.title, 12.5, { bold: true, color: [42, 58, 82], gap: 2 });
      for (const it of sub.items) {
        room(30);
        text(it.title, 11.5, { bold: true, indent: 10 });
        for (const [k, v] of it.rows) text(`${tr(k)}${colon()} ${tr(v)}`, 10.5, { indent: 18 });
        y += 6;
      }
    }
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i).setFont("helvetica", "normal").setFontSize(8.5).setTextColor(107, 119, 138);
    doc.text(tr(`Document confidentiel · ${owner} · page ${i} sur ${pages}`), M, H - 28);
  }
  const slug = owner.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-");
  await saveFile(doc.output("blob"), `Coffre-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
