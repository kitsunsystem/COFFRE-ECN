"use client";
import { motion } from "motion/react";
import { ArrowRight, FileDown, Hourglass, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCoffreView } from "@/components/coffre-view";
import { useNow } from "@/components/providers";
import { SafeDoor } from "@/components/safe-door";
import { Button } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { accessEnd } from "@/lib/rules";
import { essentialsDone } from "@/lib/score";
import { ESSENTIALS, SECTIONS } from "@/lib/sections";
import { useApp } from "@/lib/store";
import { visibleSubsections } from "@/lib/vault";
import { exportPdf } from "./export";

export default function Rubriques() {
  const vault = useApp((s) => s.vault);
  const view = useCoffreView();
  useNow(5000); // re-render when a moment is reached
  const { owner, ownerName, holderName, procedures } = view;
  const death = procedures.find((p) => p.kind === "deces" && p.finalizedAt && !p.erasedAt);
  const end = death && accessEnd(death);
  const visible = new Set(visibleSubsections());
  const shown = SECTIONS.filter((s) => (s.optional ? view.business : true)).filter((s) => owner || s.subsections.some((x) => visible.has(x.id)));
  // "À effacer" always last.
  const sections = [...shown.filter((s) => s.id !== "effacer"), ...shown.filter((s) => s.id === "effacer")];
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
          <Link href="/coffre/essentiels" className="mb-6 flex items-center gap-4 rounded-[1.6rem] bg-gradient-to-r from-gold-soft to-gold p-5 text-night shadow-glow">
            <Sparkles className="h-7 w-7 shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold">Commencer par l'essentiel</span>
              <span className="text-[0.88rem] text-night/70">
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

      {/* Each rubric is a small safe; an odd last one sits centred. */}
      <div className="grid grid-cols-2 gap-4">
        {sections.map((s, i) => {
          const subs = s.subsections.map((x) => x.id).filter((id) => owner || visible.has(id));
          const count = view.items.filter((it) => subs.includes(it.subsectionId)).length;
          const lastOdd = sections.length % 2 === 1 && i === sections.length - 1;
          return (
            <motion.div key={s.id} variants={rise} className={lastOdd ? "col-span-2 mx-auto w-[calc(50%-0.5rem)]" : ""}>
              <SafeDoor href={`/coffre/rubriques/${s.id}`} title={s.title} icon={s.icon} count={count} sealed={s.id === "effacer"} />
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
