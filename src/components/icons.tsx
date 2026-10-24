import { BedDouble, Building, EyeOff, Feather, FileText, Flower2, HandHeart, HeartPulse, Landmark, Siren, Smartphone, type LucideIcon } from "lucide-react";

// Icons referenced by name from content files (sections, help rubrics).
const BY_NAME: Record<string, LucideIcon> = { BedDouble, Building, EyeOff, Feather, FileText, Flower2, HandHeart, HeartPulse, Landmark, Siren, Smartphone };

export function NamedIcon({ name, className }: { name: string; className?: string }) {
  const I = BY_NAME[name] ?? FileText;
  return <I className={className} aria-hidden />;
}

export const TONES = {
  coral: { bg: "bg-coral-soft", fg: "text-coral", ring: "ring-coral/20", solid: "bg-coral" },
  gold: { bg: "bg-gold-soft/60", fg: "text-gold-deep", ring: "ring-gold/25", solid: "bg-gold" },
  sage: { bg: "bg-sage-soft", fg: "text-sage", ring: "ring-sage/20", solid: "bg-sage" },
  ink: { bg: "bg-ink/[0.06]", fg: "text-ink", ring: "ring-ink/10", solid: "bg-ink" },
  mist: { bg: "bg-mist/10", fg: "text-ink-soft", ring: "ring-mist/20", solid: "bg-mist" },
} as const;
