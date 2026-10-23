"use client";
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useSpring, useTransform, type Variants } from "motion/react";
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { APP_NAME } from "@/lib/config";

/* ---------- Brand ---------- */

export function Emblem({ className = "h-8 w-8", light }: { className?: string; light?: boolean }) {
  // Three widening arcs: the wake ("sillage") a life leaves behind, and the contactless gesture of the card.
  const c = light ? "#ead7a8" : "#c9a55c";
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="12" cy="20" r="4.2" fill={c} />
      {[9, 15, 21].map((r, i) => (
        <path key={r} d={`M ${12 + r * Math.cos(-0.9)} ${20 + r * Math.sin(-0.9)} A ${r} ${r} 0 0 1 ${12 + r * Math.cos(0.9)} ${20 + r * Math.sin(0.9)}`} fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" opacity={1 - i * 0.25} />
      ))}
    </svg>
  );
}

export function Logo({ light, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Emblem light={light} />
      <span className={`font-display text-[1.45rem] font-semibold tracking-tight ${light ? "text-paper" : "text-ink"}`}>{APP_NAME}</span>
    </span>
  );
}

/* ---------- Ambient motion ---------- */

export function Aurora({ dark, className = "" }: { dark?: boolean; className?: string }) {
  const blobs = dark
    ? ["bg-gold/25", "bg-[#2c4c7a]/50", "bg-sage/25"]
    : ["bg-gold-soft/70", "bg-sage-soft/80", "bg-coral-soft/60"];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className={`absolute -left-[20%] -top-[25%] h-[70%] w-[70%] rounded-full blur-3xl will-change-transform animate-aurora ${blobs[0]}`} />
      <div className={`absolute -right-[25%] top-[10%] h-[65%] w-[65%] rounded-full blur-3xl will-change-transform animate-aurora [animation-delay:-6s] ${blobs[1]}`} />
      <div className={`absolute -bottom-[30%] left-[15%] h-[60%] w-[60%] rounded-full blur-3xl will-change-transform animate-aurora [animation-delay:-12s] ${blobs[2]}`} />
    </div>
  );
}

export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
// Opacity + transform only: blur filters stutter on mid-range phones.
export const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 140, damping: 20 } },
};

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ type: "spring", stiffness: 90, damping: 18, delay }}>
      {children}
    </motion.div>
  );
}

export function CountUp({ to, className }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    const c = animate(0, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = String(Math.round(v))) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref} className={className}>0</span>;
}

/* ---------- ECN card (Tangem) ---------- */

// The client's card: matte black Tangem card, "ECN GROUP" on the front, "MEMBER" and the shield on the back.
export function EcnLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 132" className={className} role="img" aria-label="ECN Group">
      <path d="M 40 58 A 62 62 0 0 1 160 58" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="40" cy="58" r="5.5" fill="currentColor" />
      <circle cx="160" cy="58" r="5.5" fill="currentColor" />
      <path d="M100 2 L80 60 L100 49 Z" fill="currentColor" />
      <path d="M100 2 L120 60 L100 49 Z" fill="currentColor" opacity="0.55" />
      <text x="100" y="104" textAnchor="middle" className="font-display" fontSize="46" fontWeight="500" letterSpacing="3" fill="currentColor">
        ECN
      </text>
      <line x1="44" y1="122" x2="64" y2="122" stroke="currentColor" strokeWidth="1.5" />
      <text x="102" y="127" textAnchor="middle" fontSize="13" fontWeight="600" letterSpacing="5" fill="currentColor">
        GROUP
      </text>
      <line x1="138" y1="122" x2="158" y2="122" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ShieldLock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M32 3 L59 12 V34 C59 52 47 63 32 69 C17 63 5 52 5 34 V12 Z" />
      <rect x="20" y="33" width="24" height="18" rx="2.5" />
      <path d="M25 33 V27 a7 7 0 0 1 14 0 V33" />
      <path d="M32 39.5 v5" />
    </svg>
  );
}

const FACE = "absolute inset-0 overflow-hidden rounded-[4.6cqw] ring-1 ring-white/15 [backface-visibility:hidden]";
const MATTE = "radial-gradient(130% 100% at 22% 12%, #2c2c30 0%, #161618 46%, #0a0a0b 100%)";

export function NfcCard({
  name,
  flipped = false,
  spin,
  dim,
  className = "",
  interactive = true,
}: {
  name?: string;
  flipped?: boolean; // show the "MEMBER" side
  spin?: boolean; // keeps turning, for showcases
  dim?: boolean;
  className?: string;
  interactive?: boolean;
}) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [12, -12]), { stiffness: 150, damping: 15 });
  const ry = useSpring(useTransform(mx, [0, 1], [-16, 16]), { stiffness: 150, damping: 15 });
  const flip = useMotionValue(0);
  const rotateY = useTransform(() => ry.get() + flip.get());
  const gx = useTransform(mx, (v) => `${v * 100}%`);
  const gy = useTransform(my, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.22), transparent 55%)`;
  const glow = useSpring(0, { stiffness: 120, damping: 20 }); // glare only while the card is touched
  const [toggled, setToggled] = useState(false);
  const back = flipped !== toggled;

  useEffect(() => {
    const c = spin
      ? animate(flip, [flip.get(), flip.get() + 360], { duration: 9, ease: "linear", repeat: Infinity })
      : animate(flip, back ? 180 : 0, { type: "spring", stiffness: 70, damping: 14 });
    return () => c.stop();
  }, [back, spin, flip]);

  const sheen = <motion.div className="pointer-events-none absolute inset-0" style={{ background: glare, opacity: glow }} />;
  return (
    <div
      role="img"
      aria-label={name ? `Carte ECN de ${name}` : "Carte ECN"}
      className={`relative aspect-[1.586] w-full select-none [container-type:inline-size] [perspective:1100px] ${dim ? "opacity-50 grayscale" : ""} ${interactive ? "cursor-pointer" : ""} ${className}`}
      onClick={() => interactive && setToggled((t) => !t)}
      onPointerMove={(e) => {
        if (!interactive) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
        glow.set(1);
      }}
      onPointerLeave={() => {
        mx.set(0.5);
        my.set(0.5);
        glow.set(0);
      }}
    >
      <motion.div style={{ rotateX: rx, rotateY }} className="relative h-full w-full rounded-[4.6cqw] shadow-lift [transform-style:preserve-3d]">
        <div className={FACE} style={{ background: MATTE }}>
          {sheen}
          <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent animate-shine" />
          <div className="grid h-full place-items-center">
            <EcnLogo className="w-[46%] text-[#f1efea]" />
          </div>
        </div>
        <div className={FACE} style={{ background: MATTE, transform: "rotateY(180deg)" }}>
          {sheen}
          <div className="flex h-full items-center justify-between gap-[4cqw] px-[8%] text-[#f1efea]">
            <div className="min-w-0">
              <div className="font-display text-[length:9cqw] font-medium leading-none tracking-[0.12em]">MEMBER</div>
              <div className="mt-[1.6cqw] whitespace-nowrap text-[length:2.5cqw] font-semibold tracking-[0.2em]">PRIVATE BUSINESS NETWORK</div>
              <div className="mt-[1.4cqw] flex items-center gap-[1cqw] opacity-70">
                <span className="h-px flex-1 bg-current" />
                <span className="h-[1cqw] w-[1cqw] rounded-full bg-current" />
                <span className="h-px flex-1 bg-current" />
              </div>
            </div>
            <ShieldLock className="w-[20%] shrink-0" />
          </div>
          {name && <span className="absolute bottom-[8%] left-[8%] truncate text-[length:2.7cqw] font-semibold uppercase tracking-[0.2em] text-white/45">{name}</span>}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Tap the card on the phone ---------- */

export type TapState = "idle" | "reading" | "done" | "error";

export function TapReader({ state, light }: { state: TapState; light?: boolean }) {
  const stroke = light ? "rgba(247,242,233,0.9)" : "#0f1b2d";
  return (
    <div className="relative mx-auto flex h-72 w-60 items-center justify-center [perspective:900px]">
      {(state === "reading" || state === "idle") &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute h-40 w-40 rounded-full border-2 border-gold"
            initial={{ scale: 0.4, opacity: 0.8 }}
            animate={{ scale: state === "reading" ? 1.7 : 1.3, opacity: 0 }}
            transition={{ duration: state === "reading" ? 1.2 : 2.4, repeat: Infinity, delay: i * (state === "reading" ? 0.4 : 0.8), ease: "easeOut" }}
          />
        ))}
      {/* Phone and card share one tilted 3D plane, so the card really lands on the back of the phone. */}
      <motion.div className="relative [transform-style:preserve-3d]" initial={false} animate={{ rotateX: 18, rotateY: state === "done" ? -4 : -16, rotateZ: -3 }} transition={{ type: "spring", stiffness: 60, damping: 14 }}>
        <svg viewBox="0 0 120 220" className="relative h-60 w-auto drop-shadow-2xl" aria-hidden>
          <rect x="6" y="4" width="108" height="212" rx="22" fill={light ? "rgba(255,255,255,0.08)" : "#fffdf9"} stroke={stroke} strokeWidth="3" />
          <rect x="44" y="12" width="32" height="8" rx="4" fill={stroke} opacity="0.5" />
          <motion.rect x="12" y="26" width="96" height="176" rx="14" fill="#4f8a62" initial={false} animate={{ opacity: state === "done" ? 0.35 : 0 }} />
        </svg>
        <motion.div
          className="absolute inset-0 m-auto h-fit w-40"
          initial={false}
          animate={
            state === "idle"
              ? { y: 130, z: 60, rotate: -10, x: 0, scale: 1 }
              : state === "reading"
                ? { y: 10, z: 8, rotate: 0, x: 0, scale: 1 }
                : state === "error"
                  ? { y: 10, z: 8, rotate: 0, x: [0, -10, 10, -6, 6, 0], scale: 1 }
                  : { y: -4, z: 4, rotate: 0, x: 0, scale: 0.94 }
          }
          transition={{ type: "spring", stiffness: 110, damping: 15 }}
        >
          <NfcCard interactive={false} />
        </motion.div>
        {state === "done" && (
          <motion.div initial={{ scale: 0, z: 0 }} animate={{ scale: 1, z: 50 }} transition={{ type: "spring", stiffness: 300, damping: 15 }} className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-sage text-paper shadow-lift">
            <Check className="h-8 w-8" strokeWidth={3} />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// Self-running version for explanations (landing page, guided tour).
export function TapDemo({ light }: { light?: boolean }) {
  const [state, setState] = useState<TapState>("idle");
  useEffect(() => {
    const seq: TapState[] = ["idle", "reading", "done"];
    let i = 0;
    const t = setInterval(() => setState(seq[(i = (i + 1) % seq.length)]), 1800);
    return () => clearInterval(t);
  }, []);
  return <TapReader state={state} light={light} />;
}

/* ---------- Score ring ---------- */

export function ScoreRing({ value, size = 172, label = "préparé", dark }: { value: number; size?: number; label?: string; dark?: boolean }) {
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const a = animate(0, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => a.stop();
  }, [value]);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ead7a8" />
            <stop offset="100%" stopColor="#c9a55c" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? "rgba(255,255,255,0.1)" : "#ede3d1"} strokeWidth="12" fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-[2.6rem] font-semibold leading-none">
            {shown}
            <span className="text-[1.2rem] text-mist">%</span>
          </div>
          <div className="mt-1 text-[0.8rem] font-semibold uppercase tracking-[0.15em] text-mist">{label}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Vault opening ---------- */

export function VaultReveal({ onDone }: { onDone: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-night" initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 0] }} transition={{ duration: 1.9, times: [0, 0.75, 1] }} onAnimationComplete={onDone}>
      <motion.div className="relative h-64 w-64" initial={{ scale: 0.9 }} animate={{ scale: [0.9, 1, 3.2] }} transition={{ duration: 1.9, times: [0, 0.45, 1], ease: [0.7, 0, 0.3, 1] }}>
        <motion.svg viewBox="0 0 200 200" className="absolute inset-0" animate={{ rotate: 200 }} transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="#c9a55c" strokeWidth="3" />
          <circle cx="100" cy="100" r="72" fill="none" stroke="#c9a55c" strokeWidth="1.5" opacity="0.6" />
          {Array.from({ length: 24 }).map((_, i) => (
            <line key={i} x1="100" y1="12" x2="100" y2={i % 3 ? "20" : "28"} stroke="#ead7a8" strokeWidth="2" transform={`rotate(${i * 15} 100 100)`} />
          ))}
        </motion.svg>
        <div className="absolute inset-0 grid place-items-center">
          <Emblem className="h-20 w-20" light />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Countdown({ to, now }: { to: number; now: number }) {
  const ms = Math.max(0, to - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return (
    <span className="font-display tabular-nums">
      {d > 0 && `${d} j `}
      {h} h {String(m).padStart(2, "0")} min
    </span>
  );
}
