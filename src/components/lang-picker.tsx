"use client";
// Language choice. Each language is named in its own words, whatever the current one.
import { Check, Globe } from "lucide-react";
import { useSyncExternalStore } from "react";
import { currentLang, LANGS, setLang, type Lang } from "@/lib/i18n";

// The language only changes through a reload: nothing to subscribe to.
const still = () => () => {};

export function LangPicker({ compact }: { compact?: boolean }) {
  const lang = useSyncExternalStore(still, currentLang, () => "fr" as Lang);
  if (compact)
    return (
      // The globe only from tablets up: on a phone, the landing page header has no room left.
      <label className="relative inline-flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 font-semibold text-ink-soft ring-1 ring-line hover:text-ink">
        <Globe className="hidden h-5 w-5 sm:block" aria-hidden />
        <span translate="no" className="text-[0.82rem] uppercase">
          {lang}
        </span>
        <select aria-label="Langue" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="absolute inset-0 cursor-pointer opacity-0">
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Langue">
      {LANGS.map((l) => {
        const on = lang === l.id;
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && setLang(l.id)}
            className={`flex items-center gap-3 rounded-2xl bg-paper p-3 text-left ring-1 ${on ? "ring-2 ring-gold" : "ring-line"}`}
          >
            <span translate="no" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-[0.75rem] font-bold uppercase">
              {l.id}
            </span>
            <span className="flex-1 font-semibold">{l.label}</span>
            {on && <Check className="h-4 w-4 shrink-0 text-gold-deep" />}
          </button>
        );
      })}
    </div>
  );
}
