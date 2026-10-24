"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ShieldCheck, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ItemEditor } from "@/components/item-editor";
import { Button } from "@/components/ui";
import { ESSENTIALS, subsection } from "@/lib/sections";
import { useApp, useSession } from "@/lib/store";

export default function Essentiels() {
  const items = useApp((s) => s.vault.items);
  const launched = useApp((s) => s.phase) === "lancement";
  const mode = useSession((s) => s.session.mode);
  const router = useRouter();
  const filled = (subId: string) => items.some((i) => i.subsectionId === subId);
  const [i, setI] = useState(() => {
    const first = ESSENTIALS.findIndex((e) => !filled(e.subsectionId));
    return first === -1 ? ESSENTIALS.length : first;
  });
  const [adding, setAdding] = useState(false);
  const done = ESSENTIALS.filter((e) => filled(e.subsectionId)).length;

  useEffect(() => {
    if (mode === "holder") router.replace("/coffre/rubriques");
  }, [mode, router]);

  const next = () => {
    setAdding(false);
    const after = ESSENTIALS.findIndex((e, j) => j > i && !filled(e.subsectionId));
    setI(after === -1 ? ESSENTIALS.length : after);
  };
  const step = ESSENTIALS[i];

  return (
    <div>
      <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold-soft">L'essentiel</div>
      <h1 className="mt-2 text-[2rem] font-semibold leading-tight">Dix choses qui changent tout</h1>
      <div className="mt-4 flex gap-1.5" role="progressbar" aria-valuenow={done} aria-valuemax={ESSENTIALS.length}>
        {ESSENTIALS.map((e, j) => (
          <button key={e.subsectionId} onClick={() => { setI(j); setAdding(false); }} className="h-2 flex-1 overflow-hidden rounded-full bg-paper/10" aria-label={e.title}>
            <motion.span className={`block h-full ${j === i ? "bg-paper" : "bg-gold"}`} initial={false} animate={{ width: filled(e.subsectionId) || j === i ? "100%" : "0%" }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </button>
        ))}
      </div>
      <div className="mt-2 text-[0.85rem] text-paper/55">
        {done} sur {ESSENTIALS.length}
      </div>

      <AnimatePresence mode="wait">
        {step ? (
          <motion.div key={step.subsectionId + adding} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "spring", stiffness: 160, damping: 22 }} className="mt-6">
            <div className="rounded-[1.75rem] bg-night-2 p-5 ring-1 ring-paper/10">
              <div className="text-[0.8rem] font-bold text-gold-soft">
                Étape {i + 1} · {subsection(step.subsectionId).title}
              </div>
              <h2 className="mt-1 text-[1.5rem] font-semibold leading-snug">{step.title}</h2>
              <p className="mt-1 text-paper/65">{step.why}</p>
            </div>
            {filled(step.subsectionId) && !adding ? (
              <div className="mt-5 space-y-3 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage text-paper">
                  <Check className="h-8 w-8" strokeWidth={3} />
                </div>
                <p className="text-paper/75">C'est déjà fait.</p>
                <Button full variant="gold" icon={<ArrowRight className="h-5 w-5" />} onClick={next}>
                  Étape suivante
                </Button>
                <Button full variant="light" onClick={() => setAdding(true)}>
                  En ajouter un autre
                </Button>
              </div>
            ) : !launched ? (
              <div className="mt-5 rounded-[1.75rem] bg-gold/15 p-5 ring-1 ring-gold/30">
                <p className="text-paper/85">Phase découverte : vous pourrez remplir cette étape au lancement officiel. Rien n&apos;est stocké avant.</p>
                <Button className="mt-4" full variant="light" onClick={next}>
                  Étape suivante
                </Button>
              </div>
            ) : (
              <div className="mt-5 rounded-[1.75rem] bg-cream p-5 text-ink">
                <ItemEditor key={step.subsectionId + adding} subId={step.subsectionId} onDone={next} />
                <button onClick={next} className="mx-auto mt-4 flex items-center gap-2 text-[0.92rem] font-semibold text-mist">
                  <SkipForward className="h-4 w-4" /> Plus tard
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="end" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 text-center">
            <motion.div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b from-gold-soft to-gold text-ink shadow-glow" animate={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 0.8, delay: 0.2 }}>
              <ShieldCheck className="h-12 w-12" />
            </motion.div>
            <h2 className="mt-6 text-[1.7rem] font-semibold">{done === ESSENTIALS.length ? "L'essentiel est en place" : "Bien avancé"}</h2>
            <p className="mx-auto mt-2 max-w-xs text-paper/65">{done === ESSENTIALS.length ? "Choisissez maintenant qui pourra voir quoi, et à quel moment." : `${ESSENTIALS.length - done} étape${ESSENTIALS.length - done > 1 ? "s restent" : " reste"} : revenez quand vous voulez.`}</p>
            <Button className="mt-6" full variant="gold" href="/coffre/droits">
              Qui voit quoi
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
