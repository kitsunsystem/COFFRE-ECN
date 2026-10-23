"use client";
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import Link from "next/link";
import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

type Variant = "primary" | "gold" | "ghost" | "outline" | "danger" | "light";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft shadow-soft",
  gold: "bg-gradient-to-b from-gold-soft to-gold text-ink shadow-glow hover:brightness-105",
  ghost: "text-ink hover:bg-ink/5",
  outline: "border-2 border-ink/15 text-ink hover:border-ink/35 bg-paper/60",
  danger: "bg-coral text-paper hover:brightness-110 shadow-soft",
  light: "bg-paper/10 text-paper border border-paper/15 hover:bg-paper/15 backdrop-blur",
};

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  href?: string;
  icon?: ReactNode;
  full?: boolean;
  children: ReactNode;
}

const base = "inline-flex items-center justify-center gap-2.5 rounded-full px-6 min-h-[3.25rem] font-semibold text-[1rem] transition-colors disabled:opacity-40 disabled:pointer-events-none select-none";

export function Button({ variant = "primary", href, icon, full, className = "", children, ...rest }: ButtonProps) {
  const cls = `${base} ${VARIANTS[variant]} ${full ? "w-full" : ""} ${className}`;
  const inner = (
    <>
      {icon}
      <span>{children}</span>
    </>
  );
  if (href)
    return (
      <motion.div whileTap={{ scale: 0.97 }} className={full ? "w-full" : "inline-flex"}>
        <Link href={href} className={cls}>
          {inner}
        </Link>
      </motion.div>
    );
  return (
    <motion.button whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} className={cls} {...rest}>
      {inner}
    </motion.button>
  );
}

export function Card({ className = "", children, ...rest }: HTMLMotionProps<"div"> & { children: ReactNode }) {
  return (
    <motion.div className={`rounded-[1.75rem] bg-paper p-5 shadow-soft ring-1 ring-line/70 ${className}`} {...rest}>
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold-deep ${className}`}>{children}</div>;
}

export function PageTitle({ eyebrow, title, lead }: { eyebrow?: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <motion.header initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 18 }} className="mb-6">
      {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
      <h1 className="text-[2rem] leading-[1.1] font-semibold">{title}</h1>
      {lead && <p className="mt-3 text-[1.05rem] text-ink-soft">{lead}</p>}
    </motion.header>
  );
}

export function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  multiline,
  placeholder,
  autoFocus,
  inputMode,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  const id = useId();
  const cls =
    "w-full rounded-2xl bg-paper px-4 py-3.5 text-[1.05rem] ring-1 ring-line focus:ring-2 focus:ring-gold outline-none transition-shadow placeholder:text-mist/60";
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[0.92rem] font-semibold text-ink-soft">{label}</span>
      {multiline ? (
        <textarea id={id} rows={4} className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type={type} inputMode={inputMode} autoFocus={autoFocus} className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="mt-1.5 block text-[0.85rem] text-mist">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center gap-4 rounded-2xl bg-paper p-4 text-left ring-1 ring-line">
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-[0.88rem] text-mist">{hint}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-sage" : "bg-line"}`}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className={`absolute top-1 h-6 w-6 rounded-full bg-paper shadow ${checked ? "right-1" : "left-1"}`} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange, layoutKey }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; layoutKey: string }) {
  return (
    <div className="flex rounded-full bg-ink/[0.06] p-1">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} className="relative flex-1 whitespace-nowrap rounded-full px-1.5 py-2 text-[0.78rem] font-semibold">
          {value === o.id && <motion.span layoutId={layoutKey} className="absolute inset-0 rounded-full bg-paper shadow-soft" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className={`relative ${value === o.id ? "text-ink" : "text-mist"}`}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "gold" | "sage" | "coral" | "mist" }) {
  const t = { ink: "bg-ink/[0.07] text-ink", gold: "bg-gold-soft text-gold-deep", sage: "bg-sage-soft text-sage", coral: "bg-coral-soft text-coral", mist: "bg-mist/10 text-mist" }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-bold ${t}`}>{children}</span>;
}

export function Sheet({ open, onClose, title, children, dark }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; dark?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-night/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => i.offset.y > 120 && onClose()}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className={`relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] p-6 pt-3 safe-bottom sm:rounded-[2rem] ${dark ? "bg-night-2 text-paper ring-1 ring-paper/10" : "bg-cream text-ink"}`}
          >
            <div className={`mx-auto mb-4 h-1.5 w-12 rounded-full ${dark ? "bg-paper/20" : "bg-ink/15"}`} />
            <div className="mb-4 flex items-start gap-3">
              {title && <h2 className="flex-1 text-[1.5rem] font-semibold leading-tight">{title}</h2>}
              <button onClick={onClose} aria-label="Fermer" className={`rounded-full p-2 ${dark ? "hover:bg-paper/10" : "hover:bg-ink/5"}`}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Notice({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "coral" | "sage" | "ink" }) {
  const t = { gold: "bg-gold-soft/50 ring-gold/30", coral: "bg-coral-soft ring-coral/25", sage: "bg-sage-soft ring-sage/25", ink: "bg-ink/[0.05] ring-ink/10" }[tone];
  return <div className={`rounded-2xl p-4 text-[0.95rem] ring-1 ${t}`}>{children}</div>;
}
