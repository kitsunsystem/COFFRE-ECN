"use client";
import { motion } from "motion/react";
import { Clock, FastForward, RotateCcw, ScanSearch, Sparkles, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNow } from "@/components/providers";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { DEMO_PIN, seedDemo } from "@/lib/demo";
import { activeProcedure, declare } from "@/lib/rules";
import { now, useApp } from "@/lib/store";
import { lock } from "@/lib/vault";
import { findMatches, formatLine } from "../../../../supabase/functions/_shared/insee";

const HOUR = 3_600_000;

export default function Demo() {
  const s = useApp(useShallow((x) => ({ account: x.account!, procedures: x.procedures, clockOffset: x.clockOffset, set: x.set, reset: x.reset })));
  const t = useNow(1000);
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const live = activeProcedure(s.procedures, t);

  const jump = (ms: number) => s.set((x) => ({ clockOffset: x.clockOffset + ms }));

  // Same code path as the monthly "insee-watch" function: a fixed-width INSEE line, parsed and matched.
  function insee(misspelled: boolean) {
    const a = s.account;
    const line = formatLine({
      last: (misspelled ? `${a.lastName}e` : a.lastName).toUpperCase(),
      first: a.firstName.toUpperCase(),
      sex: "2",
      birth: a.birthDate.replaceAll("-", ""),
      city: a.birthCity.toUpperCase(),
      death: new Date(now()).toISOString().slice(0, 10).replaceAll("-", ""),
    });
    const [m] = findMatches([{ id: "owner", lastName: a.lastName, firstNames: a.firstName, birthDate: a.birthDate, birthCity: a.birthCity }], [line]);
    if (!m) return setResult("Aucune correspondance trouvée dans le registre.");
    const p = declare("deces", "insee", "Veille INSEE", now(), { match: { score: m.score, doubtful: m.doubtful, reasons: m.reasons } });
    s.set((x) => ({ procedures: [p, ...x.procedures] }));
    setResult(`Correspondance à ${Math.round(m.score * 100)} %${m.doubtful ? ` (douteuse : ${m.reasons.join(", ")})` : ""}. Elle attend la vérification humaine dans l'administration.`);
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <PageTitle eyebrow="Démonstration" title="Le poste de pilotage" lead="Pour montrer tout le parcours sans attendre : avancer le temps, simuler la veille des décès, repartir de zéro." />

      <motion.div variants={rise}>
        <Card>
          <div className="flex items-center gap-3">
            <Clock className="h-7 w-7 text-gold-deep" />
            <div className="flex-1">
              <div className="font-semibold">Horloge de la démo</div>
              <div className="text-[0.88rem] text-mist">{new Date(t).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["+1 h", HOUR],
              ["+1 jour", 24 * HOUR],
              ["+1 semaine", 7 * 24 * HOUR],
            ].map(([l, ms]) => (
              <Button key={l as string} variant="outline" className="!px-2" onClick={() => jump(ms as number)}>
                {l}
              </Button>
            ))}
          </div>
          {live?.endsAt && (
            <Button className="mt-2" full icon={<FastForward className="h-5 w-5" />} onClick={() => jump(live.endsAt! - t + 1000)}>
              Aller à la fin du délai
            </Button>
          )}
          {s.clockOffset !== 0 && (
            <button onClick={() => s.set({ clockOffset: 0 })} className="mt-3 w-full text-center text-[0.9rem] font-semibold text-gold-deep">
              Revenir à l'heure réelle
            </button>
          )}
        </Card>
      </motion.div>

      <motion.div variants={rise}>
        <Card>
          <div className="flex items-center gap-3">
            <ScanSearch className="h-7 w-7 text-gold-deep" />
            <div className="flex-1">
              <div className="font-semibold">Veille des décès</div>
              <div className="text-[0.88rem] text-mist">Chaque mois, le fichier public de l'INSEE est comparé aux comptes</div>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <Button variant="outline" onClick={() => insee(false)}>
              Simuler une correspondance exacte
            </Button>
            <Button variant="outline" onClick={() => insee(true)}>
              Simuler une correspondance douteuse
            </Button>
          </div>
          {result && (
            <div className="mt-3">
              <Notice tone="gold">{result}</Notice>
            </div>
          )}
          <Button className="mt-3" full variant="ghost" icon={<UserCog className="h-5 w-5" />} href="/admin">
            Ouvrir l'administration
          </Button>
        </Card>
      </motion.div>

      <motion.div variants={rise}>
        <Card>
          <div className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-gold-deep" />
            <div className="flex-1">
              <div className="font-semibold">Famille de démonstration</div>
              <div className="text-[0.88rem] text-mist">Claire, ses proches, ses cartes et un Coffre rempli. Code des cartes : {DEMO_PIN}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <Button
              variant="gold"
              onClick={async () => {
                lock();
                await seedDemo();
                router.push("/espace");
              }}
            >
              Recharger la démonstration
            </Button>
            <Button
              variant="ghost"
              icon={<RotateCcw className="h-5 w-5" />}
              onClick={() => {
                lock();
                s.reset();
                router.replace("/");
              }}
            >
              Tout effacer
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
