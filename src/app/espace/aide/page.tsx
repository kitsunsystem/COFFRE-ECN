"use client";
import { motion } from "motion/react";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { NamedIcon, TONES } from "@/components/icons";
import { PageTitle } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { checklistFor, RUBRICS } from "@/lib/aide";

export default function Aide() {
  const checklist = useApp((s) => s.checklist);
  return (
    <div>
      <PageTitle eyebrow="Aide" title="Si quelque chose arrive" lead="Des listes claires, des étapes simples et des courriers prêts à imprimer. Sans rien déposer ici : tout ce qui est personnel va dans le Coffre." />
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
        {RUBRICS.map((r) => {
          const items = checklistFor(r, checklist);
          const done = items.filter((c) => checklist[`${r.id}:${c.id}`]).length;
          return (
            <motion.div key={r.id} variants={rise}>
              <Link href={`/espace/aide/${r.id}`}>
                <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} className={`relative overflow-hidden rounded-[1.75rem] p-6 ring-1 ${TONES[r.tone].bg} ${TONES[r.tone].ring}`}>
                  <div className="flex items-start gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-paper/80 shadow-soft">
                      <NamedIcon name={r.icon} className={`h-7 w-7 ${TONES[r.tone].fg}`} />
                    </span>
                    <div className="flex-1">
                      <div className="text-[1.3rem] font-semibold">{r.title}</div>
                      <div className="text-ink-soft">{r.tagline}</div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem] font-semibold text-ink-soft">
                        <span>
                          {done}/{items.length} étapes faites
                        </span>
                        <span className="flex items-center gap-1">
                          <Download className="h-3.5 w-3.5" /> {r.letters.length} courrier{r.letters.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-5 w-5 shrink-0" />
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper/70">
                    <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${(done / items.length) * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
