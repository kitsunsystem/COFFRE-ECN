"use client";
// Colour theme choice: each swatch shows the theme's own colours, whatever the current one.
import { Check } from "lucide-react";
import { useSyncExternalStore } from "react";
import { currentTheme, DEFAULT_THEME, setTheme, subscribeTheme, THEMES } from "@/lib/theme";

const SWATCH: Record<string, string[]> = {
  sillage: ["#f7f2e9", "#0f1b2d", "#c9a55c"],
  noir: ["#050608", "#f6e29e", "#d4af37"],
};

export function ThemePicker({ compact }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => DEFAULT_THEME);
  return (
    <div className={`grid gap-2.5 ${compact ? "max-w-xs grid-cols-2" : "grid-cols-1"}`} role="radiogroup" aria-label="Couleurs de l'application">
      {THEMES.map((t) => {
        const on = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(t.id)}
            className={`flex items-center rounded-2xl bg-paper text-left ring-1 transition-shadow ${compact ? "gap-2 px-2.5 py-2" : "gap-3 p-3"} ${on ? "ring-2 ring-gold" : "ring-line"}`}
          >
            <span className="flex shrink-0 -space-x-1.5">
              {SWATCH[t.id].map((c) => (
                <span key={c} className={`rounded-full ring-2 ring-paper ${compact ? "h-4 w-4" : "h-6 w-6"}`} style={{ background: c }} />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block whitespace-nowrap font-semibold leading-tight ${compact ? "text-[0.85rem]" : "text-[0.95rem]"}`}>{t.label}</span>
              {!compact && <span className="block text-[0.78rem] text-mist">{t.hint}</span>}
            </span>
            {on && !compact && <Check className="h-4 w-4 shrink-0 text-gold-deep" />}
          </button>
        );
      })}
    </div>
  );
}
