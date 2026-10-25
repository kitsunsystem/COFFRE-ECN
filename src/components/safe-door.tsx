"use client";
// A rubric of the Coffre drawn as a small square safe: brushed metal, rivets, hinges, locking bolts, a wheel handle
// and the name engraved on a plate. Tapping it swings the door open on its hinges, then the rubric opens.
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { NamedIcon } from "./icons";

const BRUSHED = "repeating-linear-gradient(115deg, rgb(255 255 255 / 0.025) 0 2px, transparent 2px 5px)";

function Rivet({ className }: { className: string }) {
  return <span className={`absolute h-[5px] w-[5px] rounded-full bg-gradient-to-br from-gold-soft to-gold-deep shadow-[0_1px_1px_rgb(0_0_0/0.6)] ${className}`} />;
}

// The wheel of a vault door: graduated ring, three spokes with knobs.
function Wheel({ spinning }: { spinning: boolean }) {
  return (
    <motion.svg viewBox="0 0 100 100" className="h-full w-full" animate={{ rotate: spinning ? 120 : 0 }} transition={{ type: "spring", stiffness: 70, damping: 14 }} aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" style={{ stroke: "var(--color-gold)" }} strokeOpacity="0.55" strokeWidth="2" />
      {Array.from({ length: 36 }).map((_, i) => (
        <line key={i} x1="50" y1="6" x2="50" y2={i % 3 ? "10" : "13"} style={{ stroke: "var(--color-gold-soft)" }} strokeOpacity="0.55" strokeWidth="1.2" transform={`rotate(${i * 10} 50 50)`} />
      ))}
      {[0, 120, 240].map((a) => (
        <g key={a} transform={`rotate(${a} 50 50)`}>
          <line x1="50" y1="50" x2="50" y2="20" style={{ stroke: "var(--color-gold)" }} strokeWidth="5" strokeLinecap="round" />
          <circle cx="50" cy="19" r="5.5" style={{ fill: "var(--color-gold-soft)" }} />
        </g>
      ))}
      <circle cx="50" cy="50" r="12" style={{ fill: "var(--color-night)", stroke: "var(--color-gold)" }} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="4" style={{ fill: "var(--color-gold-soft)" }} />
    </motion.svg>
  );
}

export function SafeDoor({ href, title, icon, count, sealed }: { href: string; title: string; icon: string; count: number; sealed?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  function go(e: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/⌘-click, middle click: let the browser open it normally.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (open) return;
    setOpen(true);
    setTimeout(() => router.push(href), 520);
  }

  return (
    <Link href={href} onClick={go} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-label={`${title}, ${count} élément${count > 1 ? "s" : ""}`} className="group block">
      <motion.div whileTap={{ scale: 0.98 }} className="relative aspect-square [perspective:900px]">
        {/* The safe's body and its interior, seen when the door opens. */}
        <div className="absolute inset-0 rounded-[1.4rem] bg-night-2 shadow-lift ring-1 ring-gold/25" style={{ backgroundImage: BRUSHED }}>
          <div className="absolute inset-[6%] grid place-items-center overflow-hidden rounded-[1.05rem] bg-night shadow-[inset_0_6px_18px_rgb(0_0_0/0.75)]">
            <motion.div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgb(212_175_55/0.35),transparent_65%)]" animate={{ opacity: open ? 1 : 0 }} />
            <div className="relative text-center">
              <NamedIcon name={icon} className="mx-auto h-9 w-9 text-gold-soft" />
              <div className="mt-2 text-[0.8rem] font-semibold text-paper/80">
                {count} élément{count > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>

        {/* The door, on its hinges (left edge). */}
        <motion.div
          className="absolute inset-[5%] origin-left rounded-[1.05rem] [transform-style:preserve-3d]"
          initial={false}
          animate={{ rotateY: open ? -108 : hover ? -9 : 0 }}
          transition={{ type: "spring", stiffness: open ? 90 : 160, damping: open ? 16 : 18 }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-[1.05rem] bg-gradient-to-br from-paper/[0.13] via-paper/[0.05] to-paper/[0.02] ring-1 ring-gold/35 [backface-visibility:hidden]"
            style={{ backgroundColor: "var(--color-night-2)", backgroundImage: `${BRUSHED}, linear-gradient(135deg, rgb(255 255 255 / 0.09), rgb(255 255 255 / 0.01) 55%, rgb(0 0 0 / 0.25))` }}
          >
            {/* Bevel: a second frame inside the door. */}
            <div className="absolute inset-[7%] rounded-[0.8rem] ring-1 ring-gold/20 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_-2px_6px_rgb(0_0_0/0.4)]" />
            <Rivet className="left-[4%] top-[4%]" />
            <Rivet className="right-[4%] top-[4%]" />
            <Rivet className="bottom-[4%] left-[4%]" />
            <Rivet className="bottom-[4%] right-[4%]" />

            <div className="absolute left-[12%] top-[11%] flex items-center gap-1.5 text-gold-soft/90">
              <NamedIcon name={icon} className="h-[1.05rem] w-[1.05rem]" />
            </div>
            <span className="absolute right-[11%] top-[10%] min-w-[1.6rem] rounded-md bg-night/70 px-1.5 py-0.5 text-center font-display text-[0.75rem] font-semibold text-gold-soft ring-1 ring-gold/30">{count}</span>

            {/* Wheel handle. */}
            <div className="absolute left-1/2 top-[40%] h-[36%] w-[36%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_3px_4px_rgb(0_0_0/0.55)]">
              <Wheel spinning={open || hover} />
            </div>

            {/* Engraved name plate. */}
            <div className="absolute inset-x-[11%] bottom-[10%] rounded-md bg-gradient-to-b from-night/85 to-night/60 px-1.5 py-1.5 text-center ring-1 ring-gold/35 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]">
              <div className="font-display text-[0.7rem] font-semibold uppercase leading-[1.15] tracking-[0.1em] text-gold-soft [text-shadow:0_1px_0_rgb(0_0_0/0.7)]">{title}</div>
              {sealed && <div className="mt-0.5 text-[0.55rem] font-bold uppercase tracking-[0.2em] text-coral-soft/90">Scellé</div>}
            </div>
          </div>
          {/* Inner side of the door, seen once it has swung open: the bolt mechanism. */}
          <div
            className="absolute inset-0 rounded-[1.05rem] ring-1 ring-gold/30 [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={{ backgroundColor: "var(--color-night)", backgroundImage: `${BRUSHED}, linear-gradient(225deg, rgb(255 255 255 / 0.07), rgb(0 0 0 / 0.3))` }}
          >
            {["top-[30%]", "top-[48%]", "top-[66%]"].map((p) => (
              <span key={p} className={`absolute left-[12%] right-[12%] ${p} h-[5px] rounded-full bg-gradient-to-r from-gold-deep/70 to-gold-soft/70`} />
            ))}
          </div>
        </motion.div>

        {/* Hinges (left) and locking bolts (right), outside the door so they stay put while it swings. */}
        {["top-[20%]", "bottom-[20%]"].map((p) => (
          <span key={p} className={`absolute left-[2.5%] ${p} h-[14%] w-[6px] rounded-full bg-gradient-to-r from-gold-deep via-gold-soft to-gold-deep shadow-[0_1px_2px_rgb(0_0_0/0.6)]`} />
        ))}
        {["top-[30%]", "top-[48%]", "top-[66%]"].map((p) => (
          <motion.span key={p} className={`absolute right-[2%] ${p} h-[5px] w-[7%] rounded-full bg-gradient-to-r from-gold-deep to-gold-soft`} animate={{ x: open ? -6 : 0, opacity: open ? 0.4 : 1 }} />
        ))}
      </motion.div>
    </Link>
  );
}
