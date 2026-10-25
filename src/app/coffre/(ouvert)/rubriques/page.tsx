"use client";
import { motion } from "motion/react";
import { ArrowRight, FileDown, Hourglass, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCoffreView } from "@/components/coffre-view";
import { NamedIcon } from "@/components/icons";
import { useNow } from "@/components/providers";
import { Button } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { accessEnd } from "@/lib/rules";
import { essentialsDone } from "@/lib/score";
import { ESSENTIALS, SECTIONS } from "@/lib/sections";
import { useApp } from "@/lib/store";
import { visibleSubsections } from "@/lib/vault";
import { exportPdf } from "./export";

const GLOW: Record<string, string> = { coral: "from-coral/35", gold: "from-gold/35", sage: "from-sage/35", ink: "from-[#2c4c7a]/50", mist: "from-mist/35" };

export default function Rubriques() {
  const vault = useApp((s) => s.vault);
  const view = useCoffreView();
  useNow(5000); // re-render when a moment is reached
  const { owner, ownerName, holderName, procedures } = view;
  const death = procedures.find((p) => p.kind === "deces" && p.finalizedAt && !p.erasedAt);
  const end = death && accessEnd(death);
  const visible = new Set(visibleSubsections());
  const shown = SECTIONS.filter((s) => (s.optional ? view.business : true)).filter((s) => owner || s.subsections.some((x) => visible.has(x.id)));
  // Two-column grid: the first section and "À effacer" (always last) span both columns; so does a leftover odd tile.
  const sections = [...shown.filter((s) => s.id !== "effacer"), ...shown.filter((s) => s.id === "effacer")];
  const narrow = sections.filter((s, i) => i > 0 && s.id !== "effacer");
  const isWide = (s: (typeof sections)[number], i: number) => i === 0 || s.id === "effacer" || (narrow.length % 2 === 1 && s === narrow[narrow.length - 1]);
  const done = essentialsDone({ vault });
  const [exporting, setExporting] = useState(false);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.header variants={rise} className="mb-6">
        <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold-soft">{owner ? "Coffre ouvert" : "Ce qui vous a été confié"}</div>
        <h1 className="mt-2 text-[2.1rem] font-semibold leading-tight">{owner ? "Tout ce qui est personnel, ici" : `De la part de ${ownerName.split(" ")[0]}`}</h1>
        <p className="mt-2 text-paper/65">{owner ? "Chiffré sur votre téléphone avant d'être envoyé. Personne d'autre ne peut le lire." : "Vous ne voyez que ce qui vous a été attribué, au moment prévu."}</p>
      </motion.header>

      {owner && done < ESSENTIALS.length && (
        <motion.div variants={rise}>
          <Link href="/coffre/essentiels" className="mb-6 flex items-center gap-4 rounded-[1.6rem] bg-gradient-to-r from-gold-soft to-gold p-5 text-ink shadow-glow">
            <Sparkles className="h-7 w-7 shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold">Commencer par l'essentiel</span>
              <span className="text-[0.88rem] text-ink/70">
                {done} sur {ESSENTIALS.length} · à votre rythme
              </span>
            </span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
      )}

      {!owner && end && (
        <motion.div variants={rise} className="mb-6 flex items-start gap-3 rounded-[1.4rem] bg-gold/15 p-4 ring-1 ring-gold/30">
          <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-gold-soft" />
          <p className="text-[0.92rem] text-paper/85">
            Ce Coffre reste ouvert jusqu&apos;au <b>{new Date(end).toLocaleDateString("fr-FR", { dateStyle: "long" })}</b>, puis il sera effacé définitivement. Pensez à exporter ce qui vous est utile.
          </p>
        </motion.div>
      )}

      {sections.length === 0 && (
        <motion.div variants={rise} className="rounded-[1.6rem] bg-paper/5 p-6 text-center ring-1 ring-paper/10">
          <Lock className="mx-auto h-8 w-8 text-gold-soft" />
          <p className="mt-3 text-paper/75">Rien ne vous est encore ouvert. Les éléments prévus « en cas de coup dur » ou « au décès » apparaîtront ici le moment venu.</p>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {sections.map((s, i) => {
          const subs = s.subsections.map((x) => x.id).filter((id) => owner || visible.has(id));
          const count = view.items.filter((it) => subs.includes(it.subsectionId)).length;
          const wide = isWide(s, i);
          return (
            <motion.div key={s.id} variants={rise} className={wide ? "col-span-2" : ""}>
              <Link href={`/coffre/rubriques/${s.id}`}>
                <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} className={`relative h-full overflow-hidden rounded-[1.6rem] bg-night-2 p-5 ring-1 ring-paper/10 ${wide ? "min-h-[9.5rem]" : "min-h-[11rem]"}`}>
                  <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${GLOW[s.tone]} to-transparent blur-2xl`} />
                  <div className="relative flex h-full flex-col">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-paper/10 ring-1 ring-paper/15">
                      <NamedIcon name={s.icon} className="h-6 w-6 text-gold-soft" />
                    </span>
                    <div className="mt-auto pt-4">
                      <div className="text-[1.12rem] font-semibold leading-snug">{s.title}</div>
                      <div className="mt-0.5 text-[0.82rem] text-paper/55">{wide ? s.tagline : `${count} élément${count > 1 ? "s" : ""}`}</div>
                    </div>
                  </div>
                  {wide && <span className="absolute bottom-5 right-5 rounded-full bg-paper/10 px-3 py-1 text-[0.8rem] font-bold">{count}</span>}
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {sections.length > 0 && (
        <motion.div variants={rise} className="mt-6">
          <Button
            full
            variant="light"
            disabled={exporting}
            icon={<FileDown className="h-5 w-5" />}
            onClick={async () => {
              setExporting(true);
              await exportPdf(ownerName, owner ? ownerName : holderName).catch(console.error);
              setExporting(false);
            }}
          >
            {exporting ? "Préparation du PDF…" : owner ? "Télécharger en PDF (notaire, hôpital)" : "Télécharger ce qui m'est confié (PDF)"}
          </Button>
          <p className="mt-2 text-center text-[0.8rem] text-paper/50">
            {owner ? "Tout votre Coffre" : "Uniquement ce que vous avez le droit de voir"}, sans les codes ni les mots de passe, ni la rubrique « À effacer ».
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
