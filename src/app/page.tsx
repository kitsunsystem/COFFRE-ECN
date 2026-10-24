"use client";
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, BadgeCheck, Bell, CalendarClock, ChevronRight, ConciergeBell, EyeOff, FileText, HandHeart, HeartPulse, Lock, ShieldCheck, Siren, Sparkles, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Eyebrow } from "@/components/ui";
import { Aurora, Emblem, Logo, NfcCard, Reveal, rise, stagger, TapDemo } from "@/components/visuals";
import { APP_NAME, LAUNCH, OFFER } from "@/lib/config";
import { moment, type Moment } from "@/lib/rules";

function FloatChip({ icon: I, text, className, delay }: { icon: typeof Bell; text: string; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 160, damping: 16 }}
      className={`absolute z-20 flex items-center gap-2 rounded-2xl bg-paper/90 px-3.5 py-2.5 text-[0.82rem] font-semibold shadow-lift ring-1 ring-line backdrop-blur animate-float ${className}`}
    >
      <I className="h-4 w-4 text-gold-deep" />
      {text}
    </motion.div>
  );
}

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  // The card stack is one 3D scene: scrolling and the pointer turn it.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sceneY = useSpring(useTransform(() => -22 + scrollYProgress.get() * 40 + px.get() * 14), { stiffness: 80, damping: 18 });
  const sceneX = useSpring(useTransform(() => 14 - scrollYProgress.get() * 18 - py.get() * 10), { stiffness: 80, damping: 18 });
  return (
    <section ref={ref} className="relative overflow-hidden px-5 pb-20 pt-6">
      <Aurora />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/connexion" aria-label="Se connecter" className="grid h-11 min-w-11 place-items-center whitespace-nowrap rounded-full font-semibold text-ink-soft hover:text-ink sm:px-4">
            <UserRound className="h-6 w-6 sm:hidden" />
            <span className="hidden sm:inline">Se connecter</span>
          </Link>
          <Button href="/inscription" className="!min-h-11 !px-4 sm:!px-5">
            Commencer
          </Button>
        </div>
      </nav>

      <div className="relative mx-auto mt-14 grid max-w-6xl items-center gap-14 lg:mt-24 lg:grid-cols-[1.1fr_1fr]">
        <motion.div variants={stagger} initial="hidden" animate="show" className="min-w-0">
          <motion.div variants={rise}>
            <span className="inline-flex items-center gap-2 rounded-full bg-paper/80 px-4 py-2 text-[0.85rem] font-semibold ring-1 ring-line backdrop-blur">
              <Sparkles className="h-4 w-4 text-gold-deep" /> De son vivant comme après
            </span>
          </motion.div>
          {/* Sized so "au même endroit" (kept on one line for its underline) fits a 360 px phone. */}
          <motion.h1 variants={rise} className="mt-6 text-[2.2rem] font-semibold leading-[1.05] min-[400px]:text-[2.6rem] sm:text-[3.6rem] lg:text-[4.4rem]">
            Tout ce dont votre famille aura besoin,{" "}
            <span className="relative whitespace-nowrap italic text-gold-deep">
              au même endroit
              <motion.svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 w-full" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}>
                <motion.path d="M4 14 C 80 4, 200 4, 296 12" fill="none" stroke="#c9a55c" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 1.1, ease: "easeInOut" }} />
              </motion.svg>
            </span>
            .
          </motion.h1>
          <motion.p variants={rise} className="mt-7 max-w-xl text-[1.2rem] leading-relaxed text-ink-soft">
            Vos papiers, vos contrats, vos codes et vos mots pour vos proches, rangés au même endroit, à votre rythme. Utile tous les jours, et prêt le jour où quelque chose arrive.
          </motion.p>
          <motion.div variants={rise} className="mt-9 flex flex-wrap gap-3">
            <Button href="/inscription" variant="gold" icon={<ArrowRight className="h-5 w-5" />}>
              Protéger ma famille
            </Button>
            <Button href="#comment" variant="outline">
              Comment ça marche
            </Button>
          </motion.div>
          <motion.div variants={rise} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.92rem] text-ink-soft">
            <span className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-sage" /> Rien à retenir</span>
            <span className="flex items-center gap-2"><Lock className="h-5 w-5 text-sage" /> Chiffré sur votre téléphone</span>
            <span className="flex items-center gap-2"><Users className="h-5 w-5 text-sage" /> Toute la famille</span>
          </motion.div>
        </motion.div>

        <div
          className="relative mx-auto h-[26rem] w-[86%] max-w-[26rem] [perspective:1200px] sm:h-[30rem] sm:w-full"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            px.set((e.clientX - r.left) / r.width - 0.5);
            py.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerLeave={() => {
            px.set(0);
            py.set(0);
          }}
        >
          <motion.div style={{ rotateX: sceneX, rotateY: sceneY }} className="absolute inset-0 [transform-style:preserve-3d]">
            <motion.div style={{ y: y2, z: -120 }} className="absolute left-[2%] top-[4%] w-[78%]" initial={{ opacity: 0, rotateZ: -24, x: -40 }} animate={{ opacity: 1, rotateZ: -12, x: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 60, damping: 14 }}>
              <NfcCard name="Marc Durand" flipped />
            </motion.div>
            <motion.div style={{ y: y1, z: -50 }} className="absolute right-[0%] top-[20%] w-[78%]" initial={{ opacity: 0, rotateZ: 20, x: 40 }} animate={{ opacity: 1, rotateZ: 8, x: 0 }} transition={{ delay: 0.45, type: "spring", stiffness: 60, damping: 14 }}>
              <NfcCard name="Léa Durand" />
            </motion.div>
            <motion.div style={{ z: 40 }} className="absolute left-[8%] top-[40%] w-[84%]" initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, type: "spring", stiffness: 60, damping: 14 }}>
              <NfcCard name="Claire Durand" />
            </motion.div>
          </motion.div>
          <FloatChip icon={CalendarClock} text="Passeport : expire dans 30 jours" className="-left-2 top-0 sm:-left-10" delay={1.1} />
          <FloatChip icon={HeartPulse} text="Marc voit : Urgence et santé" className="-right-2 bottom-16 sm:-right-8" delay={1.3} />
          <FloatChip icon={Sparkles} text="Famille préparée à 89 %" className="bottom-0 left-4" delay={1.5} />
        </div>
      </div>
    </section>
  );
}

// The three access levels, in the same colours as everywhere in the app (lib/rules.ts MOMENTS).
const LEVELS = [
  { icon: HeartPulse, tone: "bg-sage-soft text-sage", title: "Urgence", text: "Santé, personnes à prévenir : vos proches autorisés y accèdent tout de suite, à tout moment, avec leur carte. Et votre fiche médicale se copie dans votre téléphone." },
  { icon: Siren, tone: "bg-coral-soft text-coral", title: "Coup dur", text: "Banques, codes, contrats : un garant signale la situation, un court délai s'écoule, puis seuls les éléments prévus pour ce cas s'ouvrent." },
  { icon: HandHeart, tone: "bg-gold-soft/70 text-gold-deep", title: "Décès", text: "Veille du registre des décès, acte de décès, vérification par notre équipe : chaque bénéficiaire reçoit uniquement sa part." },
];

function Moments() {
  return (
    <section className="px-5 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Eyebrow>Trois niveaux d&apos;accès</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-[2.3rem] font-semibold leading-tight sm:text-[3rem]">Pas seulement pour « après ». Pour toute la vie.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {LEVELS.map((m, i) => (
            <Reveal key={m.title} delay={i * 0.1}>
              <motion.div whileHover={{ y: -6 }} className="h-full rounded-[2rem] bg-paper p-7 shadow-soft ring-1 ring-line">
                <span className={`grid h-14 w-14 place-items-center rounded-2xl ${m.tone}`}>
                  <m.icon className="h-7 w-7" />
                </span>
                <h3 className="mt-6 text-[1.6rem] font-semibold">{m.title}</h3>
                <p className="mt-3 text-[1.02rem] text-ink-soft">{m.text}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CardSection() {
  return (
    <section id="comment" className="relative overflow-hidden bg-night px-5 py-24 text-paper">
      <Aurora dark />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <TapDemo light />
        </Reveal>
        <div>
          <Reveal>
            <Eyebrow className="!text-gold-soft">Zéro phrase à retenir</Eyebrow>
            <h2 className="mt-3 text-[2.3rem] font-semibold leading-tight sm:text-[3rem]">Une carte, votre code. C'est tout.</h2>
            <p className="mt-5 text-[1.1rem] text-paper/75">Vous recevez trois cartes. Posez l&apos;une d&apos;elles au dos de votre téléphone, tapez votre code ou utilisez Face ID : votre Coffre s&apos;ouvre. La carte est toujours nécessaire, le code ne la remplace jamais.</p>
          </Reveal>
          <div className="mt-10 space-y-4">
            {[
              ["1", "Recevez vos trois cartes", "Elles sont fabriquées pour vous et livrées chez vous."],
              ["2", "Activez-les avec votre téléphone", "La carte crée son secret dans sa puce : il n'en sort jamais."],
              ["3", "Chaque bénéficiaire reçoit 2 cartes", "À ranger dans deux endroits. Elles n'ouvrent que ce que vous lui avez attribué."],
            ].map(([n, t, d], i) => (
              <Reveal key={n} delay={i * 0.1}>
                <div className="flex gap-4 rounded-3xl bg-paper/5 p-5 ring-1 ring-paper/10">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold font-display text-[1.1rem] font-semibold text-ink">{n}</span>
                  <div>
                    <div className="text-[1.1rem] font-semibold">{t}</div>
                    <div className="text-paper/65">{d}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const PEOPLE: { name: string; role: string; rows: Moment[] }[] = [
  { name: "Marc", role: "Conjoint", rows: ["now", "now", "coup_dur", "deces"] },
  { name: "Léa", role: "Fille", rows: ["now", "deces", "jamais", "deces"] },
  { name: "Paul", role: "Fils", rows: ["now", "jamais", "jamais", "deces"] },
];
const ROWS = ["Urgence et santé", "Documents", "Argent et contrats", "Volontés"];

function Rights() {
  const [who, setWho] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setWho((w) => (w + 1) % PEOPLE.length), 2600);
    return () => clearInterval(t);
  }, []);
  const p = PEOPLE[who];
  return (
    <section className="px-5 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>Qui voit quoi, et quand</Eyebrow>
          <h2 className="mt-3 text-[2.3rem] font-semibold leading-tight sm:text-[3rem]">Chacun voit ce que vous avez choisi. Rien de plus.</h2>
          <p className="mt-5 text-[1.1rem] text-ink-soft">Pour chaque bénéficiaire et chaque rubrique, vous choisissez le niveau : urgence, coup dur, décès, ou jamais. Vous pouvez changer d&apos;avis quand vous voulez.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-[2rem] bg-paper p-6 shadow-lift ring-1 ring-line">
            <div className="flex gap-2">
              {PEOPLE.map((x, i) => (
                <button key={x.name} onClick={() => setWho(i)} className="relative flex-1 rounded-2xl px-3 py-3 text-left">
                  {who === i && <motion.span layoutId="landingWho" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
                  <span className={`relative block font-semibold ${who === i ? "text-paper" : "text-ink"}`}>{x.name}</span>
                  <span className={`relative block text-[0.8rem] ${who === i ? "text-paper/60" : "text-mist"}`}>{x.role}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {ROWS.map((r, i) => (
                <div key={r} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3.5">
                  <span className="font-semibold">{r}</span>
                  <AnimatePresence mode="popLayout">
                    <motion.span key={p.name + i} initial={{ opacity: 0, scale: 0.7, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 20 }} className={`rounded-full px-3 py-1 text-[0.8rem] font-bold ${moment(p.rows[i]).pill}`}>
                      {moment(p.rows[i]).short}
                    </motion.span>
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Family() {
  const items = [
    { icon: FileText, t: "La liste des démarches", d: "Personnalisée, dans l'ordre : les premiers jours, les premières semaines, les premiers mois." },
    { icon: Sparkles, t: "Des courriers prêts", d: "Banques, assureurs, abonnements : des modèles à compléter, imprimer et envoyer." },
    { icon: ConciergeBell, t: "Une conciergerie", d: "Si la famille le souhaite, quelqu'un s'occupe de tout, sur mandat." },
  ];
  return (
    <section className="bg-sand/60 px-5 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Eyebrow>Vos proches ne sont jamais seuls</Eyebrow>
          <h2 className="mt-3 max-w-3xl text-[2.3rem] font-semibold leading-tight sm:text-[3rem]">Le moment le plus difficile vient après. C'est là que nous sommes le plus présents.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {items.map((x, i) => (
            <Reveal key={x.t} delay={i * 0.1}>
              <div className="h-full rounded-[2rem] bg-paper p-7 ring-1 ring-line">
                <x.icon className="h-8 w-8 text-gold-deep" />
                <h3 className="mt-5 text-[1.4rem] font-semibold">{x.t}</h3>
                <p className="mt-2 text-ink-soft">{x.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="relative overflow-hidden bg-ink px-5 py-24 text-paper">
      <Aurora dark className="opacity-60" />
      <div className="relative mx-auto max-w-4xl text-center">
        <Reveal>
          <motion.div initial={{ rotate: -40 }} whileInView={{ rotate: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 60, damping: 12 }} className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gold/15 ring-1 ring-gold/40">
            <ShieldCheck className="h-11 w-11 text-gold-soft" />
          </motion.div>
          <h2 className="mt-8 text-[2.3rem] font-semibold leading-tight sm:text-[3rem]">Personne ne peut lire votre Coffre.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[1.1rem] text-paper/75">Tout est chiffré sur votre téléphone avant de partir. Ni nous, ni notre assistant, ni la conciergerie ne pouvons en lire le contenu. Seuls vous et les porteurs de cartes que vous avez choisis, au moment que vous avez choisi.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { i: Lock, t: "Chiffré sur l'appareil" },
            { i: EyeOff, t: "« À effacer » détruit sans lecture" },
            { i: Users, t: "Garants et délai d'annulation" },
          ].map((x, k) => (
            <Reveal key={x.t} delay={k * 0.1}>
              <div className="rounded-3xl bg-paper/5 p-5 ring-1 ring-paper/10">
                <x.i className="mx-auto h-7 w-7 text-gold-soft" />
                <div className="mt-3 font-semibold">{x.t}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Offer() {
  return (
    <section className="px-5 py-24">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-paper shadow-lift ring-1 ring-line md:grid md:grid-cols-2">
        <div className="p-9 sm:p-12">
          <Eyebrow>Formule simple</Eyebrow>
          <h2 className="mt-3 text-[2.2rem] font-semibold leading-tight">Tout compris, sans surprise.</h2>
          <ul className="mt-7 space-y-3.5">
            {[`Votre Coffre et vos ${OFFER.ownerCards} cartes`, `Un pack de ${OFFER.packCards} cartes pour chaque bénéficiaire`, "Les listes, démarches et courriers pour vos proches", "L'assistante, les relances et la fiche d'urgence"].map((x) => (
              <li key={x} className="flex items-start gap-3 text-[1.02rem]">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage" /> {x}
              </li>
            ))}
          </ul>
          {/* Pre-sale terms: to be validated by the lawyer before going live. */}
          <div className="mt-7 rounded-2xl bg-gold-soft/40 p-4 ring-1 ring-gold/30">
            <div className="font-semibold">Phase découverte{LAUNCH.discoveryPrice ? ` · ${LAUNCH.discoveryPrice} €` : ""}</div>
            <ul className="mt-2 space-y-1.5 text-[0.92rem] text-ink-soft">
              <li>Inclus dès maintenant : inscription, vérification d&apos;identité, famille, garants, réglages « qui voit quoi », fabrication et livraison des cartes.</li>
              <li>Au lancement officiel{LAUNCH.plannedDate ? `, prévu le ${LAUNCH.plannedDate}` : " (date annoncée prochainement)"} : ouverture de l&apos;ajout de documents. Rien n&apos;est stocké avant.</li>
              <li>Remboursé si le lancement n&apos;a pas lieu à la date annoncée.</li>
            </ul>
          </div>
          <div className="mt-7">
            <Button href="/inscription" variant="gold" icon={<ArrowRight className="h-5 w-5" />}>
              Réserver ma place
            </Button>
            <p className="mt-3 text-[0.88rem] text-mist">Accès sur invitation de votre conseiller.</p>
          </div>
        </div>
        <div className="relative grid place-items-center overflow-hidden bg-night p-10">
          <Aurora dark />
          <div className="relative w-full max-w-xs space-y-[-38%] [perspective:1000px]">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} initial={{ y: 60, opacity: 0, rotateX: 50 }} whileInView={{ y: 0, opacity: 1, rotateX: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15, type: "spring", stiffness: 70, damping: 14 }} style={{ rotate: (i - 1) * 6 }}>
                <NfcCard flipped={i === 1} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["Dois-je retenir un mot de passe ou une phrase secrète ?", "Non. Vous ouvrez votre Coffre avec votre carte, plus votre code ou Face ID. La carte est toujours nécessaire."],
  ["Que se passe-t-il si je perds une carte ?", "Vos deux autres cartes ouvrent toujours votre Coffre. La carte perdue est désactivée en un geste, et une nouvelle peut être appairée."],
  ["Et mes bénéficiaires ?", "Chacun reçoit un pack de 2 cartes à son nom, à ranger dans deux endroits différents. Après votre décès, un bénéficiaire qui aurait perdu ses deux cartes perdrait son accès : nous le lui expliquons à la réception, et nous lui demandons régulièrement si ses cartes sont toujours là."],
  ["Est-ce un testament ?", "Non. Le Coffre ne remplace ni un notaire ni un testament : il indique où se trouve l'original et aide vos proches à tout retrouver."],
  ["Qui décide qu'il y a un coup dur ou un décès ?", "Pour un coup dur, vos garants, que vous choisissez. Pour un décès : veille du registre des décès, acte de décès fourni par un bénéficiaire et vérification par notre équipe, puis un délai pendant lequel tout peut être annulé."],
  ["Combien de temps mes proches ont-ils accès ?", "Après la confirmation du décès et le délai, vos bénéficiaires ont un temps limité pour tout récupérer. Ensuite, le Coffre est effacé définitivement."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="px-5 pb-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-center text-[2.2rem] font-semibold">Vos questions</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="overflow-hidden rounded-3xl bg-paper ring-1 ring-line">
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 p-5 text-left text-[1.08rem] font-semibold" aria-expanded={open === i}>
                {q}
                <motion.span animate={{ rotate: open === i ? 90 : 0 }}>
                  <ChevronRight className="h-5 w-5" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <p className="px-5 pb-5 text-ink-soft">{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <>
      <Hero />
      <Moments />
      <CardSection />
      <Rights />
      <Family />
      <Privacy />
      <Offer />
      <Faq />
      <footer className="border-t border-line px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="flex items-center gap-2">
            <Emblem /> <span className="font-display text-[1.2rem] font-semibold">{APP_NAME}</span>
          </span>
          <p className="text-center text-[0.85rem] text-mist">Ce service ne remplace ni un notaire ni un avocat. © {new Date().getFullYear()} {APP_NAME}</p>
          <Link href="/beneficiaire" className="text-[0.85rem] font-semibold text-ink-soft hover:text-ink">
            Un proche est décédé ? Espace bénéficiaire
          </Link>
        </div>
      </footer>
    </>
  );
}
