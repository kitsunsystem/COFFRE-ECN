"use client";
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, BadgeCheck, Bell, CalendarClock, ChevronRight, ConciergeBell, EyeOff, FileText, Flower2, HandHeart, HeartPulse, Home, Landmark, Lock, ShieldCheck, Siren, Sparkles, UserRound, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LangPicker } from "@/components/lang-picker";
import { ThemePicker } from "@/components/theme-picker";
import { Button, Eyebrow } from "@/components/ui";
import { Aurora, Emblem, Logo, NfcCard, Reveal, rise, stagger, TapDemo } from "@/components/visuals";
import { APP_NAME, LAUNCH, OFFER } from "@/lib/config";
import { isNative } from "@/lib/native";
import { longDate } from "@/lib/i18n";
import { moment, type Moment } from "@/lib/rules";
import markLarge from "@/assets/brand/llarys-mark.webp";

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
      <Aurora className="seam-fade-b" />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <LangPicker compact />
          <Link href="/connexion" aria-label="Se connecter" className="grid h-11 min-w-11 place-items-center whitespace-nowrap rounded-full font-semibold text-ink-soft hover:text-ink sm:px-4">
            <UserRound className="h-6 w-6 sm:hidden" />
            <span className="hidden sm:inline">Se connecter</span>
          </Link>
          {/* Phones: the hero's "Protéger ma famille" right below leads to the same place. */}
          <Button href="/inscription" className="!min-h-11 whitespace-nowrap !px-4 max-sm:!hidden sm:!px-5">
            Commencer
          </Button>
        </div>
      </nav>

      <div className="relative mx-auto mt-14 grid max-w-6xl items-center gap-14 lg:mt-24 lg:grid-cols-[1.1fr_1fr]">
        <motion.div variants={stagger} initial="hidden" animate="show" className="min-w-0">
          <motion.div variants={rise}>
            <span className="inline-flex items-center gap-2 rounded-full bg-paper/80 px-4 py-2 text-[0.85rem] font-semibold ring-1 ring-line backdrop-blur">
              <Sparkles className="h-4 w-4 text-gold-deep" /> Coffre de vie et de succession, personnel ou familial
            </span>
          </motion.div>
          {/* Sized so "au même endroit" (kept on one line for its underline) fits a 360 px phone. */}
          <motion.h1 variants={rise} className="mt-6 text-[2.2rem] font-semibold leading-[1.05] min-[400px]:text-[2.6rem] sm:text-[3.6rem] lg:text-[4.4rem]">
            Tout ce dont votre famille aura besoin,{" "}
            <span className="relative whitespace-nowrap italic text-gold-deep">
              au même endroit
              <motion.svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 w-full" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}>
                <motion.path d="M4 14 C 80 4, 200 4, 296 12" fill="none" style={{ stroke: "var(--color-gold)" }} strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 1.1, ease: "easeInOut" }} />
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
          <FloatChip icon={Sparkles} text="Famille préparée à 88 %" className="bottom-0 left-4" delay={1.5} />
        </div>
      </div>
    </section>
  );
}

// The story behind the name, chosen by the client: three old words for the home, its protectors and what is passed on.
const LORE = [
  { word: "LLAR", icon: Home, text: "Le foyer, en catalan, la langue de l'Andorre : la maison qui réunit la famille et la protège." },
  { word: "LAR", icon: Landmark, text: "Les Lares, protecteurs du foyer dans la Rome antique. Comme eux, votre Coffre veille sur ce qui compte et ne s'ouvre que selon vos choix." },
  { word: "LYS", icon: Flower2, text: "La fleur, symbole de pureté, de noblesse et de continuité familiale : ce que vous transmettez à chacun, au bon moment." },
];

function Lore() {
  return (
    <section id="llarys" className="seam-fade relative overflow-hidden bg-night px-5 py-24 text-paper">
      <Aurora dark className="opacity-70" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          {/* brand-medallion: on the light theme the mark (gold light drawn for black) sits on its black disc. */}
          <Image src={markLarge} alt="Logo LLARYS" className="brand-medallion mx-auto w-[min(70vw,24rem)] drop-shadow-[0_0_70px_rgb(212_175_55/0.28)]" />
        </Reveal>
        <div>
          <Reveal>
            <Eyebrow className="!text-gold-soft">Pourquoi LLARYS</Eyebrow>
            <h2 className="mt-3 text-[2.3rem] font-semibold leading-tight sm:text-[3rem]">Trois mots autour du foyer.</h2>
            <p className="mt-5 text-[1.1rem] text-paper/75">LLARYS assemble trois mots aux racines anciennes, qui parlent tous de la famille.</p>
          </Reveal>
          <div className="mt-10 space-y-4">
            {LORE.map((x, i) => (
              <Reveal key={x.word} delay={i * 0.1}>
                <div className="flex gap-4 rounded-3xl bg-paper/5 p-5 ring-1 ring-paper/10">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold/15 ring-1 ring-gold/40">
                    <x.icon className="h-6 w-6 text-gold-soft" />
                  </span>
                  <div className="min-w-0">
                    <div className="notranslate font-display text-[1.35rem] font-semibold tracking-[0.16em] text-gold-soft">{x.word}</div>
                    <p className="mt-1 text-paper/75">{x.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-8 font-display text-[1.25rem] italic text-paper/85">Le foyer, ses gardiens, et ce qui se transmet.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// The three access levels, in the same colours as everywhere in the app (lib/rules.ts MOMENTS).
const LEVELS = [
  { icon: HeartPulse, tone: "bg-sage-soft text-sage", title: "Maintenant", text: "Santé, volontés médicales, contacts clés : vos proches autorisés y accèdent tout de suite, depuis leur compte, avec leur visage et leur code. Et votre fiche médicale se copie dans votre téléphone." },
  { icon: Siren, tone: "bg-coral-soft text-coral", title: "Coup dur", text: "Hospitalisation, coma, incapacité : le proche fait sa demande avec un justificatif. Notre équipe vérifie le document et son identité, puis sa part s'ouvre pour lui seul, un temps limité. Vous êtes prévenu et pouvez tout fermer." },
  { icon: HandHeart, tone: "bg-gold-soft/70 text-gold-deep", title: "Décès", text: "Acte de décès, vérification par notre équipe, registres officiels là où c'est possible, délai d'annulation : chaque bénéficiaire reçoit uniquement sa part." },
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
    <section id="comment" className="seam-fade relative overflow-hidden bg-night px-5 py-24 text-paper">
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
              ["3", "Chaque bénéficiaire a 2 cartes à son nom", "Prépayées et gardées en solde, envoyées à votre décès. D'ici là, vos proches accèdent à leur part depuis leur compte, avec votre accord."],
            ].map(([n, t, d], i) => (
              <Reveal key={n} delay={i * 0.1}>
                <div className="flex gap-4 rounded-3xl bg-paper/5 p-5 ring-1 ring-paper/10">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold font-display text-[1.1rem] font-semibold text-night">{n}</span>
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
          <p className="mt-5 text-[1.1rem] text-ink-soft">Pour chaque proche et chaque sous-rubrique, vous choisissez le niveau : maintenant, coup dur, décès, ou jamais. L&apos;accès conseillé vous est proposé, et vous pouvez changer d&apos;avis quand vous voulez.</p>
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
    <section className="seam-fade bg-sand/60 px-5 py-24">
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
    <section className="seam-fade relative overflow-hidden bg-night-2 px-5 py-24 text-paper">
      <Aurora dark className="opacity-60" />
      <div className="relative mx-auto max-w-4xl text-center">
        <Reveal>
          <motion.div initial={{ rotate: -40 }} whileInView={{ rotate: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 60, damping: 12 }} className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gold/15 ring-1 ring-gold/40">
            <ShieldCheck className="h-11 w-11 text-gold-soft" />
          </motion.div>
          <h2 className="mt-8 text-[2.3rem] font-semibold leading-tight sm:text-[3rem]">Personne ne peut lire votre Coffre.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[1.1rem] text-paper/75">Tout est chiffré sur votre téléphone avant de partir. Ni nous, ni notre assistante, ni la conciergerie ne pouvons en lire le contenu. Seuls vous et les proches que vous avez choisis, au moment que vous avez choisi.</p>
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
            {[`Votre Coffre et vos ${OFFER.ownerCards} cartes`, `Un pack de ${OFFER.packCards} cartes pour chaque bénéficiaire`, "Vos démarches de protection, pas à pas", "Les listes, démarches et courriers pour vos proches", "L'assistante, les relances et la fiche d'urgence"].map((x) => (
              <li key={x} className="flex items-start gap-3 text-[1.02rem]">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage" /> {x}
              </li>
            ))}
          </ul>
          {/* Pre-sale terms: to be validated by the lawyer before going live. */}
          <div className="mt-7 rounded-2xl bg-gold-soft/40 p-4 ring-1 ring-gold/30">
            <div className="font-semibold">Pré-lancement{LAUNCH.discoveryPrice ? ` · ${LAUNCH.discoveryPrice} €` : ""}</div>
            <ul className="mt-2 space-y-1.5 text-[0.92rem] text-ink-soft">
              <li>Ouvert dès maintenant : votre Espace, la vérification d&apos;identité, vos proches, vos garants, « qui voit quoi » et vos démarches de protection.</li>
              <li>{`Au lancement${LAUNCH.plannedDate ? `, prévu le ${longDate(LAUNCH.plannedDate)}` : ", dont la date est annoncée par e-mail"} : vos cartes arrivent et le Coffre s'active. Rien n'est stocké avant.`}</li>
              <li>Si la date est repoussée, vous choisissez : reporter, ou être remboursé.</li>
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
  ["Dois-je retenir un mot de passe ou une phrase secrète ?", "Pas pour le Coffre : il s'ouvre avec votre carte et Face ID, la carte est toujours nécessaire. Un mot de passe protège seulement l'Espace (vos rappels, votre famille)."],
  ["Puis-je ouvrir mon Coffre sur un ordinateur ?", "Oui. La première fois, votre téléphone scanne le code QR affiché sur l'ordinateur ; ensuite, une notification suffit. Chaque ouverture se confirme sur le téléphone, carte posée et Face ID."],
  ["Que se passe-t-il si je perds une carte ?", "Vos deux autres cartes ouvrent toujours votre Coffre. La carte perdue est désactivée en un geste, et une nouvelle peut être appairée."],
  ["Et mes proches ?", "Chacun a obligatoirement son propre compte : vous lui envoyez vous-même l'invitation, un message prêt à partir. Depuis l'application, il demande son accès, avec son visage et un code à 6 chiffres, et vous l'acceptez. Il ouvre alors ce que vous lui confiez, au moment prévu (maintenant, coup dur ou décès). Les 2 cartes d'un bénéficiaire, prépayées, ne lui sont envoyées qu'à votre décès."],
  ["Est-ce un testament ?", "Non. Le Coffre n'est pas un testament : il indique où se trouve l'original et aide vos proches à tout retrouver. Vos démarches de protection vous guident pour le faire."],
  ["Qui décide qu'il y a un coup dur ou un décès ?", "Pour un coup dur, le proche concerné fait une demande avec un justificatif : l'IA donne un premier avis, puis notre équipe vérifie le document et son identité (pièce et visage). Pour un décès : acte de décès fourni par un bénéficiaire, vérification par notre équipe, registres officiels là où c'est possible, puis un délai pendant lequel tout peut être annulé."],
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
  const router = useRouter();
  // The app opens on the sign-in, not on the website's sales page (store rules: no price, no outside payment).
  useEffect(() => {
    if (isNative()) router.replace("/connexion");
  }, [router]);
  return (
    <>
      <Hero />
      <Lore />
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
          <p className="text-center text-[0.85rem] text-mist">Coffre de vie et de succession, personnel ou familial. © {new Date().getFullYear()} {APP_NAME}</p>
          <Link href="/beneficiaire" className="text-[0.85rem] font-semibold text-ink-soft hover:text-ink">
            Un proche est décédé ? Espace bénéficiaire
          </Link>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center gap-2">
          <span className="text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-mist">Couleurs</span>
          <ThemePicker compact />
        </div>
      </footer>
    </>
  );
}
