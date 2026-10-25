"use client";
// Guided tour of the demo, shown at the first entry in the Espace (and again from the dashboard).
import { animate, AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { ArrowLeft, ArrowRight, CreditCard, KeyRound, LifeBuoy, Lock, ShieldCheck, Users, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { DELAYS, POST_DEATH_ACCESS_DAYS } from "@/lib/config";
import { DEMO_PIN } from "@/lib/demo";
import { moment, type Moment } from "@/lib/rules";
import { SECTIONS } from "@/lib/sections";
import { useApp } from "@/lib/store";
import { NamedIcon } from "./icons";
import { Button } from "./ui";
import { Aurora, NfcCard, TapDemo } from "./visuals";

/* ---------- Step visuals ---------- */

const FAMILY = [
  { ini: "MD", n: "Marc" },
  { ini: "LD", n: "Léa" },
  { ini: "PD", n: "Paul" },
  { ini: "SM", n: "Sophie" },
];

// A slow circular orbit, wide enough that no circle ever covers another (or a name).
function Orbiter({ t, i, ini, n }: { t: MotionValue<number>; i: number; ini: string; n: string }) {
  const a = useTransform(t, (v) => (v + i / FAMILY.length) * Math.PI * 2 - Math.PI / 2);
  const x = useTransform(a, (v) => Math.cos(v) * 112);
  const y = useTransform(a, (v) => Math.sin(v) * 100);
  return (
    <motion.div style={{ x, y }} className="absolute inset-0 m-auto flex h-fit w-fit flex-col items-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-paper font-display text-[1rem] font-semibold text-ink shadow-lift">{ini}</span>
      <span className="mt-1 rounded-full bg-night/60 px-1.5 text-[0.78rem] font-semibold text-paper/90">{n}</span>
    </motion.div>
  );
}

function FamilyOrbit() {
  const t = useMotionValue(0);
  useEffect(() => {
    const c = animate(t, 1, { duration: 40, repeat: Infinity, ease: "linear" });
    return () => c.stop();
  }, [t]);
  return (
    <div className="relative mx-auto h-[19rem] w-72">
      <div className="absolute left-1/2 top-1/2 h-[200px] w-[224px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-gold/30" />
      <div className="absolute inset-0 m-auto flex h-fit w-fit flex-col items-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-gold-soft to-gold font-display text-[1.5rem] font-semibold text-night shadow-glow">CD</span>
        <span className="mt-1 text-[0.8rem] font-bold">Claire</span>
      </div>
      {FAMILY.map((p, i) => (
        <Orbiter key={p.n} t={t} i={i} {...p} />
      ))}
    </div>
  );
}

function TwoWorlds() {
  const spring = { type: "spring" as const, stiffness: 90, damping: 15 };
  const row = (I: typeof Users, label: string, locked?: boolean) => (
    <div key={label} className="flex items-center gap-2 text-[0.85rem] font-semibold">
      <I className={`h-4 w-4 ${locked ? "text-gold-soft" : "text-gold-deep"}`} />
      <span className="flex-1">{label}</span>
      {locked && <Lock className="h-3.5 w-3.5 text-sage-soft" />}
    </div>
  );
  return (
    <div className="mx-auto flex h-60 max-w-sm items-center justify-center gap-3 [perspective:900px]">
      <motion.div initial={{ rotateY: 0, opacity: 0, x: 40 }} animate={{ rotateY: 20, opacity: 1, x: 0 }} transition={spring} className="w-1/2 origin-right space-y-2.5 rounded-[1.4rem] bg-paper p-4 text-ink shadow-lift">
        <div className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold-deep">Espace</div>
        {row(Users, "Famille")}
        {row(ShieldCheck, "Garants")}
        {row(CreditCard, "Cartes")}
        {row(LifeBuoy, "Aide")}
        <div className="pt-1 text-[0.72rem] text-mist">Rien de personnel</div>
      </motion.div>
      <motion.div initial={{ rotateY: 0, opacity: 0, x: -40 }} animate={{ rotateY: -20, opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.1 }} className="w-1/2 origin-left space-y-2 rounded-[1.4rem] bg-night-2 p-4 shadow-glow ring-1 ring-gold/30">
        <div className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold-soft">Coffre</div>
        {/* The real section names (lib/sections.ts). */}
        {SECTIONS.filter((s) => !s.optional && s.id !== "effacer").map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-[0.78rem] font-semibold leading-tight">
            <NamedIcon name={s.icon} className="h-3.5 w-3.5 shrink-0 text-gold-soft" />
            <span className="flex-1">{s.title}</span>
          </div>
        ))}
        <div className="pt-1 text-[0.72rem] text-paper/55">Chiffré, illisible pour nous</div>
      </motion.div>
    </div>
  );
}

// Same rights as the demo family (lib/demo.ts), same colours as everywhere (lib/rules.ts).
const MATRIX: [string, Moment, Moment, Moment][] = [
  ["Groupe sanguin, allergies", "now", "now", "now"],
  ["Personnes à prévenir", "now", "now", "now"],
  ["Banques", "coup_dur", "jamais", "jamais"],
  ["Assurance-vie", "deces", "jamais", "jamais"],
  ["Lettres", "jamais", "deces", "deces"],
];

function RightsMatrix() {
  return (
    <div className="mx-auto max-w-sm rounded-[1.6rem] bg-paper/[0.06] p-3.5 ring-1 ring-paper/10 [perspective:800px]">
      <div className="grid grid-cols-[1fr_4.3rem_4.3rem_4.3rem] items-center gap-x-1.5 gap-y-2.5 text-[0.82rem]">
        <span />
        {["Marc", "Léa", "Paul"].map((n) => (
          <span key={n} className="text-center font-bold">
            {n}
          </span>
        ))}
        {MATRIX.map(([label, ...cells], r) => (
          <Fragment key={label}>
            <span className="text-left leading-tight text-paper/80">{label}</span>
            {cells.map((v, c) => (
              <motion.span key={c} initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ delay: 0.25 + r * 0.12 + c * 0.06, type: "spring", stiffness: 200, damping: 16 }} className={`rounded-full py-1 text-center text-[0.68rem] font-bold ${moment(v).pill}`}>
                {moment(v).short}
              </motion.span>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function Track({ level, items, delay }: { level: Moment; items: string[]; delay: number }) {
  const m = moment(level);
  return (
    <div className="rounded-[1.4rem] bg-paper/[0.06] p-4 text-left ring-1 ring-paper/10">
      <div className="flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.18em]">
        <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} /> {m.short}
      </div>
      <ol className="relative mt-3 space-y-2.5">
        <motion.span aria-hidden className={`absolute bottom-2 left-[7px] top-2 w-0.5 origin-top opacity-60 ${m.dot}`} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay, duration: items.length * 0.35, ease: "easeInOut" }} />
        {items.map((t, k) => (
          <motion.li key={t} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + k * 0.35 }} className="relative flex gap-2.5 text-[0.86rem] leading-snug">
            <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-[3px] border-night ${m.dot}`} />
            {t}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

const hours = Math.round(DELAYS.coupDur / 3_600_000);
const days = Math.round(DELAYS.deces / 86_400_000);
const months = Math.round(POST_DEATH_ACCESS_DAYS / 30);

// Claire's card, and one 2-card pack per beneficiary.
function Packs() {
  return (
    <div className="mx-auto max-w-sm">
      <div className="mx-auto w-52">
        <NfcCard name="Claire Durand" spin />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {["Marc", "Léa", "Paul"].map((n, i) => (
          <motion.div key={n} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.12 }}>
            <div className="relative h-16">
              <div className="absolute inset-x-0 top-0 -rotate-6">
                <NfcCard name={`${n} Durand`} flipped interactive={false} />
              </div>
              <div className="absolute inset-x-0 top-3 rotate-3">
                <NfcCard name={`${n} Durand`} flipped interactive={false} />
              </div>
            </div>
            <div className="mt-3 text-[0.8rem] font-semibold">
              {n} · 2 cartes
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Steps ---------- */

const SCENARIO = [
  ["Ouvrez le Coffre avec une carte de Claire", `code ${DEMO_PIN} · essayez « Copier dans la fiche médicale »`],
  ["Rouvrez-le avec une carte de Marc", "il ne voit que l'urgence"],
  ["Compte → Coup dur et décès → Signaler comme garant", "puis Mode démonstration → Aller à la fin du délai, et rouvrez avec Marc"],
  ["Mode démonstration → simulez un décès (INSEE)", "puis Espace bénéficiaire : Léa dépose l'acte de décès"],
  ["Administration → vérifiez l'identité et confirmez", "fin du délai, puis Léa ouvre avec sa carte et exporte en PDF"],
];

const STEPS: { eyebrow: string; title: string; text: string; visual: ReactNode; extra?: ReactNode }[] = [
  {
    eyebrow: "Bienvenue",
    title: "Voici la famille Durand",
    text: "Claire a préparé son Coffre pour ses bénéficiaires : Marc, son mari, et leurs enfants Léa et Paul. Sophie, une amie, est garante. Suivez la visite, tout est expliqué pas à pas.",
    visual: <FamilyOrbit />,
  },
  {
    eyebrow: "Deux espaces",
    title: "L'Espace au quotidien, le Coffre pour l'essentiel",
    text: "Dans l'Espace : la famille, les garants, les cartes et l'aide. On n'y dépose rien de personnel. Tout ce qui est personnel va dans le Coffre, chiffré sur le téléphone : personne d'autre ne peut le lire, pas même nous.",
    visual: <TwoWorlds />,
  },
  {
    eyebrow: "Les cartes",
    title: "Votre carte, c'est votre clé",
    text: "Claire a trois cartes : chacune ouvre tout son Coffre. Chaque bénéficiaire reçoit un pack de 2 cartes à son nom, à ranger dans deux endroits différents. Elles n'ouvrent que ce que Claire lui a confié.",
    visual: <Packs />,
  },
  {
    eyebrow: "Ouvrir le Coffre",
    title: "Posez la carte, tapez le code",
    text: "On pose la carte au dos du téléphone, puis on tape son code ou on utilise Face ID. La carte est toujours nécessaire : le code ne la remplace jamais.",
    visual: <TapDemo light />,
    extra: (
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-2 font-semibold text-gold-soft ring-1 ring-gold/40">
        <KeyRound className="h-4 w-4" /> Code de la démo : {DEMO_PIN}
      </div>
    ),
  },
  {
    eyebrow: "Qui voit quoi",
    title: "Chacun voit ce que Claire a choisi",
    text: "Pour chaque bénéficiaire et chaque rubrique, Claire choisit le niveau : urgence, coup dur, décès, ou jamais. Elle peut changer d'avis quand elle veut.",
    visual: <RightsMatrix />,
  },
  {
    eyebrow: "Trois niveaux d'accès",
    title: "Chaque niveau a ses règles",
    text: "L'urgence est toujours ouverte aux bénéficiaires autorisés. Le reste ne s'ouvre jamais sans délai, et Claire peut tout annuler.",
    visual: (
      <div className="mx-auto grid max-w-sm gap-3 sm:max-w-3xl sm:grid-cols-3">
        <Track level="now" delay={0.15} items={["Ouvert tout de suite, à tout moment", "Sans délai ni contrôle", "Fiche médicale copiée dans le téléphone"]} />
        <Track level="coup_dur" delay={0.4} items={["Un garant signale", `${hours} h pour annuler`, "Seul le « coup dur » s'ouvre"]} />
        <Track level="deces" delay={0.65} items={["Registre INSEE ou garant", "Acte de décès déposé par un bénéficiaire", "Vérification par notre équipe", `${days} jours pour annuler`, `Accès ${months} mois, puis effacement définitif`]} />
      </div>
    ),
  },
  {
    eyebrow: "À vous",
    title: "Essayez la démo",
    text: "Le parcours qui montre tout, dans l'ordre :",
    visual: null,
    extra: (
      <ol className="mt-4 space-y-2.5 text-left">
        {SCENARIO.map(([t, d], k) => (
          <motion.li key={t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + k * 0.08 }} className="flex gap-3 rounded-2xl bg-paper/[0.06] p-3.5 ring-1 ring-paper/10">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold font-display font-semibold text-night">{k + 1}</span>
            <span>
              <span className="block font-semibold leading-snug">{t}</span>
              <span className="text-[0.85rem] text-paper/60">{d}</span>
            </span>
          </motion.li>
        ))}
      </ol>
    ),
  },
];

const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 70, rotateY: d * -24 }),
  center: { opacity: 1, x: 0, rotateY: 0, transition: { type: "spring" as const, stiffness: 170, damping: 22 } },
  exit: (d: number) => ({ opacity: 0, x: d * -70, rotateY: d * 24, transition: { duration: 0.18 } }),
};

export function Tour() {
  const set = useApp((s) => s.set);
  const [[i, dir], setStep] = useState<[number, number]>([0, 1]);
  const last = i === STEPS.length - 1;
  const close = () => set({ tourPending: false });
  const go = (n: number) => n >= 0 && n < STEPS.length && setStep([n, n > i ? 1 : -1]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", k);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.documentElement.style.overflow = overflow;
    };
  });

  const s = STEPS[i];
  return (
    <motion.div role="dialog" aria-modal aria-label="Visite guidée de la démonstration" className="grain fixed inset-0 z-[70] overflow-y-auto bg-night text-paper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Aurora dark className="fixed opacity-80" />
      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {STEPS.map((_, k) => (
              <button key={k} onClick={() => go(k)} className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper/15" tabIndex={-1}>
                <motion.span className="block h-full bg-gold" initial={false} animate={{ width: k <= i ? "100%" : "0%" }} transition={{ type: "spring", stiffness: 140, damping: 20 }} />
              </button>
            ))}
          </div>
          <button onClick={close} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.9rem] font-semibold text-paper/75 ring-1 ring-paper/15 hover:bg-paper/10">
            Passer <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 place-items-center py-6 [perspective:1200px]">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={i}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_, info) => (info.offset.x < -70 ? go(i + 1) : info.offset.x > 70 && go(i - 1))}
              className="w-full text-center"
            >
              {s.visual && <div className="mb-7">{s.visual}</div>}
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold-soft">
                {i + 1} / {STEPS.length} · {s.eyebrow}
              </div>
              <h2 className="mt-2 text-[1.9rem] font-semibold leading-tight">{s.title}</h2>
              <p className="mx-auto mt-3 max-w-md text-[1.05rem] text-paper/75">{s.text}</p>
              {s.extra}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-3">
          {i > 0 && (
            <Button variant="light" className="!px-4" aria-label="Étape précédente" onClick={() => go(i - 1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {last ? (
            <div className="flex flex-1 gap-3">
              <Link href="/coffre" onClick={close} className="flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-soft to-gold px-5 font-semibold text-night shadow-glow">
                <Lock className="h-5 w-5" /> Ouvrir le Coffre
              </Link>
              <Button variant="light" onClick={close}>
                L'Espace
              </Button>
            </div>
          ) : (
            <Button full variant="gold" icon={<ArrowRight className="h-5 w-5" />} onClick={() => go(i + 1)}>
              {i === 0 ? "Commencer la visite" : "Suivant"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
