"use client";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, House, LifeBuoy, Lock, LockOpen, ShieldCheck, Sparkles, UserRound, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { PROD } from "@/lib/env";
import { activeProcedure, graceEnd, procedureStatus } from "@/lib/rules";
import { useApp, useSession } from "@/lib/store";
import { lock } from "@/lib/vault";
import { Alma } from "./alma";
import { Tour } from "./tour";
import { useHydrated, useNow } from "./providers";
import { Aurora, Logo } from "./visuals";

// trailingSlash is on (static hosting): compare paths without it.
const usePath = () => usePathname().replace(/(.)\/$/, "$1");

type NavItem ={ href: string; label: string; icon: LucideIcon; center?: boolean };

function BottomNav({ items, dark }: { items: NavItem[]; dark?: boolean }) {
  const path = usePath();
  const active = (h: string) => (h === "/espace" || h === "/coffre/rubriques" ? path === h : path.startsWith(h));
  return (
    <nav className={`fixed inset-x-0 bottom-0 z-40 safe-bottom ${dark ? "bg-night/80" : "bg-cream/85"} backdrop-blur-xl`}>
      {/* Equal flexible columns: fixed minimum widths overflowed 360 px phones. */}
      <div className={`mx-auto flex max-w-lg items-end border-t px-1.5 pt-2 ${dark ? "border-paper/10" : "border-line"}`}>
        {items.map((it) => {
          const on = active(it.href);
          if (it.center)
            return (
              <Link key={it.href} href={it.href} className="-mt-7 flex min-w-0 flex-1 flex-col items-center gap-1" aria-label={it.label}>
                <motion.span whileTap={{ scale: 0.92 }} whileHover={{ y: -2 }} className="grid h-16 w-16 place-items-center rounded-[1.4rem] bg-gradient-to-b from-gold-soft to-gold text-night shadow-glow">
                  <it.icon className="h-7 w-7" />
                </motion.span>
                <span className={`text-[0.7rem] font-bold ${dark ? "text-paper" : "text-ink"}`}>{it.label}</span>
              </Link>
            );
          return (
            <Link key={it.href} href={it.href} className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1.5">
              {on && <motion.span layoutId={dark ? "navDark" : "nav"} className={`absolute inset-0 rounded-2xl ${dark ? "bg-paper/10" : "bg-ink/[0.06]"}`} transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <it.icon className={`relative h-6 w-6 ${on ? (dark ? "text-gold-soft" : "text-ink") : "text-mist"}`} />
              <span className={`relative max-w-full truncate text-[0.7rem] font-bold ${on ? (dark ? "text-paper" : "text-ink") : "text-mist"}`}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Enter-only: waiting for an exit animation made every tap feel slow.
function Transition({ children }: { children: ReactNode }) {
  const path = usePath();
  return (
    <motion.div key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

export function Loader({ dark }: { dark?: boolean }) {
  return (
    <div className={`grid min-h-dvh place-items-center ${dark ? "bg-night" : "bg-cream"}`}>
      <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }}>
        <Logo light={dark} />
      </motion.div>
    </div>
  );
}

export function EspaceShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const account = useApp((s) => s.account);
  const procedures = useApp((s) => s.procedures);
  const tourPending = useApp((s) => s.tourPending);
  const phase = useApp((s) => s.phase);
  const billing = useApp((s) => s.billing);
  const me = useApp((s) => s.me);
  const hasTrusts = useApp((s) => s.trusts.length > 0);
  const router = useRouter();
  const path = usePath();
  const t = useNow(5000);
  useEffect(() => {
    // Production: signed in without an Espace of one's own = a relative (guarantor, beneficiary) or a sign-up to finish.
    if (hydrated && !account) router.replace(PROD && me ? (hasTrusts ? "/proche" : "/inscription") : "/connexion");
  }, [hydrated, account, me, hasTrusts, router]);
  // The Coffre and the Espace are two separate places: reaching the Espace (back button, link) always closes the Coffre.
  useEffect(() => {
    if (useSession.getState().session.mode !== "locked") lock();
  }, []);
  if (!hydrated || !account) return <Loader />;
  const alert = activeProcedure(procedures, t);
  const status = alert && procedureStatus(alert, t);
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Aurora className="fixed opacity-60" />
      <header className="sticky top-0 z-30 bg-cream/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <Link href="/espace" aria-label="Accueil">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Alma />
            <Link href="/espace/compte" className="grid h-11 w-11 place-items-center rounded-full bg-ink font-display text-[1.05rem] font-semibold text-paper" aria-label="Mon compte">
              {account.firstName[0]}
              {account.lastName[0]}
            </Link>
          </div>
        </div>
        {billing.status === "impaye" && billing.since && (
          <Link href="/espace/compte" className="block bg-coral px-5 py-3 text-paper">
            <div className="mx-auto flex max-w-lg items-center gap-3 text-[0.92rem] font-semibold">
              <CircleAlert className="h-5 w-5 shrink-0" />
              Paiement en retard : sans régularisation, votre Coffre sera effacé le {new Date(graceEnd(billing.since)).toLocaleDateString("fr-FR")}.
              <span className="ml-auto shrink-0 underline">Régler</span>
            </div>
          </Link>
        )}
        {phase === "decouverte" && (
          <div className="bg-gold-soft px-5 py-2.5 text-ink">
            <div className="mx-auto max-w-lg text-[0.85rem] font-semibold">Phase découverte : tout est ouvert, sauf l&apos;ajout de documents dans le Coffre, qui ouvrira au lancement officiel.</div>
          </div>
        )}
        {alert && status !== "active" && path !== "/espace/procedures" && (
          <Link href="/espace/procedures" className="block bg-coral px-5 py-3 text-paper">
            <div className="mx-auto flex max-w-lg items-center gap-3 text-[0.95rem] font-semibold">
              <CircleAlert className="h-5 w-5 shrink-0" />
              {alert.kind === "coup_dur" ? "Un coup dur a été signalé. Tout va bien ?" : "Une procédure de transmission est ouverte à votre nom."}
              <span className="ml-auto underline">Voir</span>
            </div>
          </Link>
        )}
      </header>
      <main className="relative mx-auto max-w-lg px-5 pb-40 pt-4">
        <Transition>{children}</Transition>
      </main>
      {/* The guided tour shows the fictitious Durand family: demo only. */}
      <AnimatePresence>{!PROD && tourPending && <Tour key="tour" />}</AnimatePresence>
      <BottomNav
        items={[
          { href: "/espace", label: "Accueil", icon: House },
          { href: "/espace/famille", label: "Famille", icon: Users },
          { href: "/coffre", label: "Coffre", icon: Lock, center: true },
          { href: "/espace/aide", label: "Aide", icon: LifeBuoy },
          { href: "/espace/compte", label: "Compte", icon: UserRound },
        ]}
      />
    </div>
  );
}

export function CoffreShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const session = useSession((s) => s.session);
  const account = useApp((s) => s.account);
  const me = useApp((s) => s.me);
  const router = useRouter();
  // Set when the person closes the Coffre: their destination wins over the "locked → lock screen" redirect.
  const closing = useRef(false);
  useEffect(() => {
    if (hydrated && session.mode === "locked" && !closing.current) router.replace("/coffre");
  }, [hydrated, session.mode, router]);
  // Auto-lock after 5 minutes without activity: keys must not stay in memory.
  useEffect(() => {
    let timer = setTimeout(lock, 5 * 60_000);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, 5 * 60_000);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, []);
  if (!hydrated || session.mode === "locked") return <Loader dark />;
  // No way back to the Espace from here: the Coffre has to be closed first.
  const items: NavItem[] = [
    { href: "/coffre/rubriques", label: "Rubriques", icon: LockOpen },
    ...(session.mode === "owner"
      ? [
          { href: "/coffre/essentiels", label: "L'essentiel", icon: Sparkles },
          { href: "/coffre/droits", label: "Qui voit quoi", icon: ShieldCheck },
        ]
      : []),
  ];
  return (
    <div className="grain relative min-h-dvh overflow-x-clip bg-night text-paper">
      <Aurora dark className="fixed opacity-70" />
      <header className="sticky top-0 z-30 bg-night/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <Logo light />
          <div className="flex items-center gap-2">
            <Alma dark />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                closing.current = true;
                lock();
                router.replace(account ? "/espace" : PROD && me ? "/proche" : "/coffre");
              }}
              className="flex items-center gap-2 whitespace-nowrap rounded-full bg-gold px-4 py-2.5 text-[0.9rem] font-semibold text-night"
            >
              <Lock className="h-4 w-4" />
              {/* One flex item: the gap must not split "Fermer le Coffre" into a double space. */}
              <span>
                Fermer<span className="hidden min-[420px]:inline"> le Coffre</span>
              </span>
            </motion.button>
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-lg px-5 pb-40 pt-4">
        <Transition>{children}</Transition>
      </main>
      <BottomNav dark items={items} />
    </div>
  );
}
