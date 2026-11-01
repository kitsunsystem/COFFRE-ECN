"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, FileText, Lock, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge, Button, Card, Notice, PageTitle } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { toggleChecklist } from "@/lib/api";
import { applicable, protectionDone, protectionState, type ProtectionState } from "@/lib/protection";
import { subsection } from "@/lib/sections";
import { useApp } from "@/lib/store";

const BADGE: Record<Exclude<ProtectionState, null>, { text: string; tone: "sage" | "mist" }> = { fait: { text: "C'est fait", tone: "sage" }, na: { text: "Pas concerné", tone: "mist" } };

export default function Protection() {
  const s = useApp(useShallow((x) => ({ checklist: x.checklist, account: x.account! })));
  const [open, setOpen] = useState<string | null>(null);
  const list = applicable(s.account.isBusinessOwner);
  const done = protectionDone(s.checklist, s.account.isBusinessOwner);

  // "C'est fait" and "Pas concerné" exclude each other; a second tap clears the choice.
  async function choose(id: string, to: Exclude<ProtectionState, null>) {
    const now = protectionState(s.checklist, id);
    const other = now && now !== to ? (now === "fait" ? `protection:${id}` : `protection-na:${id}`) : null;
    if (other) await toggleChecklist(other);
    await toggleChecklist(to === "fait" ? `protection:${id}` : `protection-na:${id}`);
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <PageTitle
        eyebrow="Mes démarches de protection"
        title="Ce qui protège vraiment, de votre vivant"
        lead="En cas de coup dur, le vrai blocage, c'est l'accès à l'argent et le droit d'agir. Ces démarches se font dans la vraie vie : chacune dit pourquoi elle compte, où aller et quoi apporter. Un rappel vous est envoyé chaque mois tant qu'il en reste."
      />

      <motion.div variants={rise}>
        <Card>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{`${done} sur ${list.length} réglées`}</span>
            <ShieldCheck className={`h-6 w-6 ${done === list.length ? "text-sage" : "text-gold-deep"}`} />
          </div>
          <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuenow={done} aria-valuemax={list.length}>
            {list.map((d) => (
              <span key={d.id} className={`h-2 flex-1 rounded-full ${protectionState(s.checklist, d.id) ? "bg-sage" : "bg-ink/[0.08]"}`} />
            ))}
          </div>
          <p className="mt-3 text-[0.88rem] text-mist">Les règles varient selon les pays : ces démarches sont écrites pour la France. Alma vous guide pour le vôtre.</p>
        </Card>
      </motion.div>

      <div className="space-y-3">
        {list.map((d) => {
          const state = protectionState(s.checklist, d.id);
          const expanded = open === d.id;
          return (
            <motion.div key={d.id} variants={rise} layout>
              <Card className="!p-0">
                <button onClick={() => setOpen(expanded ? null : d.id)} aria-expanded={expanded} className="flex w-full items-center gap-3 p-4 text-left">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${state ? "bg-sage text-paper" : "bg-ink/[0.07]"}`}>{state ? <Check className="h-4 w-4" strokeWidth={3} /> : <ShieldCheck className="h-4 w-4 text-gold-deep" />}</span>
                  <span className={`flex-1 font-semibold ${state ? "text-mist" : ""}`}>{d.title}</span>
                  {state && <Badge tone={BADGE[state].tone}>{BADGE[state].text}</Badge>}
                  <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                    <ChevronDown className="h-5 w-5 text-mist" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="space-y-3 border-t border-line/70 p-4">
                        <p className="text-ink-soft">{d.why}</p>
                        <p className="flex items-start gap-2 text-[0.95rem]">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" /> {d.where}
                        </p>
                        <div className="flex items-start gap-2 text-[0.95rem]">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />
                          <ul className="space-y-0.5">
                            {d.docs.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                        <p className="flex items-start gap-2 text-[0.88rem] text-mist">
                          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {`Une fois fait, déposez la preuve scannée dans le Coffre, « ${subsection(d.proof).title} ». Ici, seule la case cochée est gardée.`}
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button variant={state === "fait" ? "primary" : "outline"} icon={<Check className="h-4 w-4" />} onClick={() => choose(d.id, "fait")}>
                            C&apos;est fait
                          </Button>
                          <Button variant={state === "na" ? "primary" : "ghost"} onClick={() => choose(d.id, "na")}>
                            Pas concerné
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <motion.div variants={rise}>
        <Notice tone="ink">Le Coffre permet de retrouver vos documents ; ce sont les documents eux-mêmes qui donnent le droit d&apos;agir. Une question ? Alma y répond, et la conciergerie peut vous accompagner sur ticket.</Notice>
      </motion.div>
    </motion.div>
  );
}
