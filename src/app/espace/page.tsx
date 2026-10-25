"use client";
import { motion } from "motion/react";
import { ArrowRight, Bell, CalendarClock, Check, ChevronRight, Compass, ConciergeBell, CreditCard, HeartPulse, LifeBuoy, Lock, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { NamedIcon, TONES } from "@/components/icons";
import { useNow } from "@/components/providers";
import { Card, Eyebrow, Notice } from "@/components/ui";
import { rise, ScoreRing, stagger, Tilt } from "@/components/visuals";
import { RUBRICS } from "@/lib/aide";
import { PROD } from "@/lib/env";
import { progress } from "@/lib/score";
import { useApp } from "@/lib/store";

export default function Accueil() {
  const s = useApp(useShallow((x) => ({ account: x.account!, cards: x.cards, guarantors: x.guarantors, vault: x.vault, people: x.people, reminders: x.reminders, set: x.set })));
  const t = useNow(60_000);
  const { score, steps, next } = progress(s);
  const activeCards = s.cards.filter((c) => c.holderId === "owner" && c.status === "active").length;
  const soon = s.reminders.filter((r) => {
    const d = new Date(r.date).getTime();
    return d > t && d - t < 90 * 86_400_000;
  });
  const hour = new Date(t).getHours();

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={rise} className="flex items-end justify-between gap-3">
        <div>
          <Eyebrow>{new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</Eyebrow>
          <h1 className="mt-2 text-[2.2rem] font-semibold leading-tight">
            {hour < 18 ? "Bonjour" : "Bonsoir"}, {s.account.firstName}
          </h1>
        </div>
        {!PROD && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => s.set({ tourPending: true })} className="mb-1 flex shrink-0 items-center gap-1.5 rounded-full bg-paper px-3.5 py-2 text-[0.85rem] font-semibold shadow-soft ring-1 ring-line">
            <Compass className="h-4 w-4 text-gold-deep" /> Visite guidée
          </motion.button>
        )}
      </motion.div>

      <motion.div variants={rise}>
        <Card className="relative overflow-hidden !p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-soft/40 blur-2xl" />
          <div className="relative flex items-center gap-5">
            <ScoreRing value={score} size={132} />
            <div className="flex-1">
              <div className="text-[1.15rem] font-semibold leading-snug">Votre famille est préparée à {score} %</div>
              {next ? <p className="mt-1 text-[0.95rem] text-ink-soft">Prochaine étape : {next.label.toLowerCase()}.</p> : <p className="mt-1 text-[0.95rem] text-sage">Tout l'essentiel est en place. Bravo.</p>}
            </div>
          </div>
          {next && (
            <Link href={next.href} className="relative mt-5 flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-paper">
              <span>
                <span className="block font-semibold">{next.label}</span>
                <span className="text-[0.85rem] text-paper/65">{next.hint}</span>
              </span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
        </Card>
      </motion.div>

      <motion.div variants={rise}>
        <Card>
          <div className="mb-3 font-semibold">Votre parcours</div>
          <ol className="space-y-1">
            {steps.map((st, i) => (
              <li key={st.id}>
                <Link href={st.href} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-ink/[0.04]">
                  <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ delay: 0.2 + i * 0.06 }} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.85rem] font-bold ${st.done ? "bg-sage text-paper" : "bg-ink/[0.07] text-ink"}`}>
                    {st.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </motion.span>
                  <span className={`flex-1 ${st.done ? "text-mist line-through decoration-mist/40" : "font-semibold"}`}>{st.label}</span>
                  <ChevronRight className="h-4 w-4 text-mist" />
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </motion.div>

      {next && (
        <motion.div variants={rise}>
          <Link href="/espace/services" className="flex items-center gap-4 rounded-[1.5rem] bg-paper p-4 shadow-soft ring-1 ring-line/70">
            <ConciergeBell className="h-7 w-7 shrink-0 text-gold-deep" />
            <span className="flex-1">
              <span className="block font-semibold">Besoin d&apos;aide pour tout mettre en place ?</span>
              <span className="text-[0.88rem] text-mist">La conciergerie le fait avec vous.</span>
            </span>
            <ChevronRight className="h-5 w-5 text-mist" />
          </Link>
        </motion.div>
      )}

      {soon.length > 0 && (
        <motion.div variants={rise}>
          <Notice tone="coral">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
              <div>
                <div className="font-semibold">
                  {soon[0].label} : échéance le {new Date(soon[0].date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </div>
                <div className="text-ink-soft">{soon.length > 1 ? `Et ${soon.length - 1} autre${soon.length > 2 ? "s" : ""} dans les 3 mois. ` : ""}Pensez à le renouveler, puis à mettre le Coffre à jour.</div>
                <Link href="/espace/echeances" className="mt-1 inline-block font-semibold text-coral underline">
                  Mes échéances
                </Link>
              </div>
            </div>
          </Notice>
        </motion.div>
      )}

      <motion.div variants={rise} className="grid grid-cols-2 gap-3">
        {[
          { href: "/espace/cartes", icon: CreditCard, title: "Mes cartes", sub: `${activeCards} active${activeCards > 1 ? "s" : ""}` },
          { href: "/espace/famille", icon: Users, title: "Ma famille", sub: `${s.people.length} proche${s.people.length > 1 ? "s" : ""} · ${s.guarantors.length} garant${s.guarantors.length > 1 ? "s" : ""}` },
          { href: "/espace/echeances", icon: CalendarClock, title: "Mes échéances", sub: `${s.reminders.length} suivie${s.reminders.length > 1 ? "s" : ""}` },
          { href: "/coffre/rubriques/urgence", icon: HeartPulse, title: "Fiche d'urgence", sub: "À copier dans le téléphone" },
          { href: "/espace/services", icon: ConciergeBell, title: "Conciergerie", sub: "On s'occupe de tout" },
          { href: "/espace/aide", icon: LifeBuoy, title: "Démarches", sub: "Listes et courriers" },
        ].map((x) => (
          <Link key={x.href + x.title} href={x.href}>
            <Tilt className="rounded-[1.5rem]">
              <div className="h-full rounded-[1.5rem] bg-paper p-4 shadow-soft ring-1 ring-line/70">
                <x.icon className="h-7 w-7 text-gold-deep" />
                <div className="mt-3 font-semibold">{x.title}</div>
                <div className="text-[0.85rem] text-mist">{x.sub}</div>
              </div>
            </Tilt>
          </Link>
        ))}
      </motion.div>

      <motion.div variants={rise}>
        <Link href="/coffre" className="block overflow-hidden rounded-[1.75rem] bg-night p-5 text-paper shadow-lift">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/20 ring-1 ring-gold/40">
              <Lock className="h-7 w-7 text-gold-soft" />
            </span>
            <div className="flex-1">
              <div className="text-[1.1rem] font-semibold">Tout ce qui est personnel va dans le Coffre</div>
              <div className="text-[0.88rem] text-paper/65">Ici, dans l'Espace, on ne dépose jamais rien.</div>
            </div>
            <ShieldCheck className="h-6 w-6 text-sage-soft" />
          </div>
        </Link>
      </motion.div>

      <motion.div variants={rise}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[1.4rem] font-semibold">Si quelque chose arrive</h2>
          <Link href="/espace/aide" className="shrink-0 whitespace-nowrap text-[0.9rem] font-semibold text-gold-deep">
            Tout voir
          </Link>
        </div>
        {/* Swiped with a finger or a trackpad: no scroll bar, the next card peeks out at the faded edge. */}
        <div className="no-scrollbar fade-x -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-3 pt-1">
          {RUBRICS.map((r) => (
            <Link key={r.id} href={`/espace/aide/${r.id}`} className="w-60 shrink-0 snap-start">
              <Tilt className="rounded-[1.5rem]">
                <div className={`tile h-full rounded-[1.5rem] p-5 ring-1 ${TONES[r.tone].bg} ${TONES[r.tone].ring}`}>
                  <NamedIcon name={r.icon} className={`h-7 w-7 ${TONES[r.tone].fg}`} />
                  <div className="mt-4 text-[1.1rem] font-semibold">{r.title}</div>
                  <div className="text-[0.88rem] text-ink-soft">{r.tagline}</div>
                </div>
              </Tilt>
            </Link>
          ))}
          <span aria-hidden className="w-2 shrink-0" />
        </div>
      </motion.div>
    </motion.div>
  );
}
