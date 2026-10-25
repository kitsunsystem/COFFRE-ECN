"use client";
// Language choice. Each language is named in its own words, whatever the current one. The compact version is our own
// menu in the app's colours (the browser's list looked out of place).
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { currentLang, LANGS, setLang, type Lang } from "@/lib/i18n";

// The language only changes through a reload: nothing to subscribe to.
const still = () => () => {};

export function LangPicker({ compact }: { compact?: boolean }) {
  const lang = useSyncExternalStore(still, currentLang, () => "fr" as Lang);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Closes on a tap elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (l: Lang) => {
    setOpen(false);
    if (l !== lang) setLang(l);
  };

  if (compact)
    return (
      <div ref={box} className="relative shrink-0">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Langue"
          className={`inline-flex h-11 items-center gap-1 rounded-full px-2.5 font-semibold ring-1 transition-colors ${open ? "text-ink ring-gold/60" : "text-ink-soft ring-line hover:text-ink"}`}
        >
          {/* The globe only from tablets up: on a phone, the landing page header has no room left. */}
          <Globe className="hidden h-5 w-5 sm:block" aria-hidden />
          <span translate="no" className="text-[0.82rem] uppercase">
            {lang}
          </span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </motion.span>
        </motion.button>
        <AnimatePresence>
          {open && (
            <motion.ul
              role="listbox"
              aria-label="Langue"
              initial={{ opacity: 0, y: -8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 460, damping: 32 }}
              className="absolute right-0 top-full z-50 mt-2 w-48 origin-top-right rounded-2xl bg-paper p-1.5 shadow-lift ring-1 ring-line"
            >
              {LANGS.map((l, i) => (
                <motion.li key={l.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={lang === l.id}
                    onClick={() => choose(l.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.95rem] font-semibold transition-colors ${lang === l.id ? "bg-gold/15 text-ink" : "text-ink-soft hover:bg-ink/[0.06] hover:text-ink"}`}
                  >
                    <span translate="no" className="w-6 text-[0.72rem] font-bold uppercase tracking-wider text-gold-deep">
                      {l.id}
                    </span>
                    <span className="flex-1">{l.label}</span>
                    {lang === l.id && <Check className="h-4 w-4 text-gold-deep" aria-hidden />}
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Langue">
      {LANGS.map((l) => {
        const on = lang === l.id;
        return (
          <motion.button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={on}
            whileTap={{ scale: 0.97 }}
            onClick={() => choose(l.id)}
            className={`flex items-center gap-3 rounded-2xl bg-paper p-3 text-left ring-1 ${on ? "ring-2 ring-gold" : "ring-line"}`}
          >
            <span translate="no" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-[0.75rem] font-bold uppercase">
              {l.id}
            </span>
            <span className="flex-1 font-semibold">{l.label}</span>
            {on && <Check className="h-4 w-4 shrink-0 text-gold-deep" />}
          </motion.button>
        );
      })}
    </div>
  );
}
