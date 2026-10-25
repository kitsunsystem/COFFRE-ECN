"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, ChevronDown, ConciergeBell, Download, Lock, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NamedIcon, TONES } from "@/components/icons";
import { Button, Card, Notice } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { checklistFor, downloadLetter, rubric } from "@/lib/aide";
import { toggleChecklist } from "@/lib/api";
import { useApp } from "@/lib/store";

export function RubriqueView({ id }: { id: string }) {
  const r = rubric(id)!;
  const checklist = useApp((s) => s.checklist);
  const [open, setOpen] = useState<number | null>(0);
  const key = (c: string) => `${r.id}:${c}`;
  const items = checklistFor(r, checklist);
  const done = items.filter((c) => checklist[key(c.id)]).length;
  const toggle = (c: string) => toggleChecklist(key(c));
  // Group the check-list by "when", keeping the order of the content file.
  const groups = [...new Set(items.map((c) => c.when))].map((when) => ({ when, items: items.filter((c) => c.when === when) }));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={rise}>
        <Link href="/espace/aide" className="inline-flex items-center gap-2 text-[0.95rem] font-semibold text-ink-soft">
          <ArrowLeft className="h-4 w-4" /> Toutes les rubriques
        </Link>
      </motion.div>

      <motion.div variants={rise} className={`relative overflow-hidden rounded-[2rem] p-6 ring-1 ${TONES[r.tone].bg} ${TONES[r.tone].ring}`}>
        <motion.div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-paper/40 blur-2xl" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 6, repeat: Infinity }} />
        <NamedIcon name={r.icon} className={`relative h-10 w-10 ${TONES[r.tone].fg}`} />
        <h1 className="relative mt-4 text-[2.1rem] font-semibold leading-tight">{r.title}</h1>
        <p className="relative mt-2 text-[1.05rem] text-ink-soft">{r.intro}</p>
      </motion.div>

      {r.profile && (
        <motion.section variants={rise}>
          <h2 className="text-[1.2rem] font-semibold">Pour adapter la liste</h2>
          <p className="mb-3 text-[0.92rem] text-mist">Cochez ce qui correspond à la situation de votre proche.</p>
          <div className="flex flex-wrap gap-2">
            {r.profile.map((p) => {
              const on = !!checklist[key(`profil:${p.id}`)];
              return (
                <motion.button key={p.id} type="button" whileTap={{ scale: 0.95 }} aria-pressed={on} onClick={() => toggle(`profil:${p.id}`)} className={`rounded-full px-4 py-2 text-[0.92rem] font-semibold ring-1 ${on ? "bg-ink text-paper ring-ink" : "bg-paper ring-line"}`}>
                  {p.label}
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      )}

      <motion.section variants={rise}>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-[1.4rem] font-semibold">La liste à cocher</h2>
          <span className="font-display text-[1.2rem] font-semibold tabular-nums">
            {done}
            <span className="text-mist">/{items.length}</span>
          </span>
        </div>
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.when}>
              <div className="mb-2 text-[0.78rem] font-bold uppercase tracking-[0.18em] text-gold-deep">{g.when}</div>
              <div className="space-y-2">
                {g.items.map((c) => {
                  const on = !!checklist[key(c.id)];
                  return (
                    <motion.button key={c.id} type="button" whileTap={{ scale: 0.98 }} onClick={() => toggle(c.id)} aria-pressed={on} className="flex w-full items-center gap-4 rounded-2xl bg-paper p-4 text-left ring-1 ring-line">
                      <motion.span animate={{ scale: on ? [1, 1.2, 1] : 1 }} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${on ? "bg-sage" : "bg-ink/[0.06]"}`}>
                        <AnimatePresence>{on && <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><Check className="h-4 w-4 text-paper" strokeWidth={3} /></motion.span>}</AnimatePresence>
                      </motion.span>
                      <span className={`flex-1 transition-colors ${on ? "text-mist line-through decoration-mist/40" : "font-semibold"}`}>{c.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section variants={rise}>
        <h2 className="mb-3 text-[1.4rem] font-semibold">Pas à pas</h2>
        <div className="space-y-2">
          {r.steps.map((st, i) => (
            <div key={st.title} className="overflow-hidden rounded-2xl bg-paper ring-1 ring-line">
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center gap-4 p-4 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display font-semibold text-paper">{i + 1}</span>
                <span className="flex-1 font-semibold">{st.title}</span>
                <motion.span animate={{ rotate: open === i ? 180 : 0 }}>
                  <ChevronDown className="h-5 w-5 text-mist" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 200, damping: 26 }}>
                    <p className="px-4 pb-5 pl-[4.25rem] text-ink-soft">{st.body}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section variants={rise}>
        <h2 className="text-[1.4rem] font-semibold">Courriers à imprimer</h2>
        <p className="mb-3 mt-1 text-ink-soft">Des modèles vierges : complétez les passages entre crochets, imprimez, signez.</p>
        <div className="space-y-2.5">
          {r.letters.map((l) => (
            <Card key={l.id} className="!p-4">
              <div className="flex items-center gap-4">
                <Printer className="h-6 w-6 shrink-0 text-gold-deep" />
                <div className="flex-1">
                  <div className="font-semibold">{l.title}</div>
                  <div className="text-[0.88rem] text-mist">Destinataire : {l.to}</div>
                </div>
                <button type="button" onClick={() => downloadLetter(l)} className="grid h-11 w-11 place-items-center rounded-full bg-ink text-paper" aria-label={`Télécharger ${l.title}`}>
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </motion.section>

      <motion.div variants={rise} className="space-y-3">
        <Notice tone="ink">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0" />
            <span>Vous ne déposez rien ici. Les papiers et informations personnelles vont dans le Coffre, où seuls ceux que vous avez choisis pourront les ouvrir.</span>
          </div>
        </Notice>
        <Button full variant="outline" href="/espace/services" icon={<ConciergeBell className="h-5 w-5" />}>
          Se faire aider par la conciergerie
        </Button>
        <p className="text-center text-[0.82rem] text-mist">Informations générales, qui ne remplacent pas un professionnel du droit.</p>
      </motion.div>
    </motion.div>
  );
}
