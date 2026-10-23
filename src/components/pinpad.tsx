"use client";
import { motion } from "motion/react";
import { Delete } from "lucide-react";
import { useEffect, useState } from "react";

// Big keys, high contrast: designed for people who are not at ease with phones.
export function PinPad({ length = 6, onComplete, dark, error, label }: { length?: number; onComplete: (pin: string) => void; dark?: boolean; error?: string | null; label?: string }) {
  const [pin, setPin] = useState("");
  useEffect(() => {
    if (error) setPin("");
  }, [error]);
  const press = (d: string) => {
    const next = (pin + d).slice(0, length);
    setPin(next);
    if (next.length === length) setTimeout(() => onComplete(next), 120);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const key = `grid h-[4.2rem] place-items-center rounded-full text-[1.6rem] font-semibold transition-colors ${dark ? "bg-paper/8 ring-1 ring-paper/10 active:bg-paper/20" : "bg-paper ring-1 ring-line active:bg-sand"}`;
  return (
    <div className="mx-auto w-full max-w-xs">
      {label && <div className={`mb-4 text-center text-[1.05rem] font-semibold ${dark ? "text-paper" : ""}`}>{label}</div>}
      <motion.div className="mb-2 flex justify-center gap-3" animate={error ? { x: [0, -12, 12, -8, 8, 0] } : {}} transition={{ duration: 0.4 }} key={error ?? "ok"}>
        {Array.from({ length }).map((_, i) => (
          <motion.span key={i} animate={{ scale: i < pin.length ? 1.15 : 1 }} className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-gold" : dark ? "bg-paper/20" : "bg-ink/15"}`} />
        ))}
      </motion.div>
      <div className={`mb-4 h-6 text-center text-[0.9rem] font-semibold ${dark ? "text-coral-soft" : "text-coral"}`}>{error}</div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <motion.button key={d} type="button" whileTap={{ scale: 0.9 }} onClick={() => press(d)} className={key}>
            {d}
          </motion.button>
        ))}
        <span />
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => press("0")} className={key}>
          0
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => setPin((p) => p.slice(0, -1))} className="grid h-[4.2rem] place-items-center rounded-full" aria-label="Effacer">
          <Delete className={`h-7 w-7 ${dark ? "text-paper/70" : "text-mist"}`} />
        </motion.button>
      </div>
    </div>
  );
}
