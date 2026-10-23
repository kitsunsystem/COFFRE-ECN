"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NamedIcon } from "@/components/icons";
import { Button, Segmented } from "@/components/ui";
import { MOMENTS, type Moment } from "@/lib/rules";
import { SECTIONS } from "@/lib/sections";
import { holderCards, personName, useApp, useSession } from "@/lib/store";
import { setRight, setSectionRight } from "@/lib/vault";

const DOT: Record<Moment, string> = { now: "bg-sage", coup_dur: "bg-gold", deces: "bg-coral", jamais: "bg-paper/20" };
const OPTIONS = MOMENTS.map((m) => ({ id: m.id, label: m.short }));

export default function Droits() {
  const cards = useApp((s) => s.cards);
  const people = useApp((s) => s.people);
  const rights = useApp((s) => s.rights);
  const account = useApp((s) => s.account);
  const mode = useSession((s) => s.session.mode);
  const router = useRouter();
  const holders = holderCards({ cards }).filter((c) => c.status === "active");
  const [cardId, setCardId] = useState<string | undefined>(holders[0]?.id);
  const [open, setOpen] = useState<string | null>("urgence");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const r = (cardId && rights[cardId]) || {};

  useEffect(() => {
    if (mode === "holder") router.replace("/coffre/rubriques");
  }, [mode, router]);

  async function change(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  const sections = SECTIONS.filter((s) => s.id !== "effacer" && (!s.optional || account?.isBusinessOwner));
  const pending = holderCards({ cards }).filter((c) => c.status !== "active" && c.status !== "perdue");

  return (
    <div>
      <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold-soft">Qui voit quoi</div>
      <h1 className="mt-2 text-[2rem] font-semibold leading-tight">Pour chacun, au bon moment</h1>
      <p className="mt-2 text-paper/65">Une carte par proche. Pour chaque rubrique, choisissez quand il pourra l'ouvrir. Par défaut : jamais.</p>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8rem] text-paper/65">
        {MOMENTS.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[m.id]}`} /> {m.label}
          </span>
        ))}
      </div>

      {holders.length === 0 ? (
        <div className="mt-8 rounded-[1.6rem] bg-paper/5 p-6 text-center ring-1 ring-paper/10">
          <CreditCard className="mx-auto h-8 w-8 text-gold-soft" />
          <p className="mt-3 text-paper/75">{pending.length > 0 ? "Les cartes de vos proches doivent d'abord être activées par eux." : "Attribuez d'abord une carte à un proche."}</p>
          <Button className="mt-4" variant="light" href="/espace/cartes">
            Gérer les cartes
          </Button>
        </div>
      ) : (
        <>
          <div className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1">
            {holders.map((c) => (
              <button key={c.id} onClick={() => setCardId(c.id)} className={`relative shrink-0 rounded-full px-4 py-2.5 text-[0.95rem] font-semibold ${cardId === c.id ? "text-ink" : "text-paper/75 ring-1 ring-paper/15"}`}>
                {cardId === c.id && <motion.span layoutId="holder" className="absolute inset-0 rounded-full bg-gold-soft" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <span className="relative">{personName(people, c.holderId)}</span>
              </button>
            ))}
          </div>

          {error && <p className="mt-3 font-semibold text-coral-soft">{error}</p>}

          <div className="mt-5 space-y-3">
            {sections.map((s) => {
              const values = s.subsections.map((x) => r[x.id] ?? "jamais");
              const same = values.every((v) => v === values[0]) ? values[0] : null;
              const expanded = open === s.id;
              return (
                <div key={s.id} className="overflow-hidden rounded-[1.5rem] bg-night-2 ring-1 ring-paper/10">
                  <button onClick={() => setOpen(expanded ? null : s.id)} aria-expanded={expanded} className="flex w-full items-center gap-3 p-4 text-left">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-paper/10">
                      <NamedIcon name={s.icon} className="h-5 w-5 text-gold-soft" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{s.title}</span>
                      <span className="mt-1 flex gap-1">
                        {values.map((v, i) => (
                          <span key={i} className={`h-1.5 w-5 rounded-full ${DOT[v]}`} />
                        ))}
                      </span>
                    </span>
                    {busy?.startsWith(s.id) ? <Loader2 className="h-5 w-5 animate-spin text-gold-soft" /> : (
                      <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                        <ChevronDown className="h-5 w-5 text-paper/50" />
                      </motion.span>
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && cardId && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ type: "spring", stiffness: 220, damping: 28 }}>
                        <div className="space-y-4 border-t border-paper/10 p-4">
                          <div className="rounded-2xl bg-paper/[0.06] p-3">
                            <div className="mb-2 text-[0.82rem] font-bold text-paper/70">Toute la rubrique</div>
                            <div className="rounded-full bg-paper">
                              <Segmented layoutKey={`all-${s.id}`} options={OPTIONS} value={same ?? ("" as Moment)} onChange={(m) => change(s.id, () => setSectionRight(cardId, s.id, m))} />
                            </div>
                          </div>
                          {s.subsections.map((x) => (
                            <div key={x.id}>
                              <div className="mb-1.5 flex items-center gap-2 text-[0.92rem] font-semibold">
                                <span className={`h-2 w-2 rounded-full ${DOT[r[x.id] ?? "jamais"]}`} />
                                {x.title}
                              </div>
                              <div className="rounded-full bg-paper">
                                <Segmented layoutKey={`${cardId}-${x.id}`} options={OPTIONS} value={r[x.id] ?? "jamais"} onChange={(m) => change(`${s.id}:${x.id}`, () => setRight(cardId, x.id, m))} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-center text-[0.85rem] text-paper/50">« À effacer » n'est jamais attribué : cette rubrique est détruite au décès sans être lue.</p>
        </>
      )}
    </div>
  );
}
