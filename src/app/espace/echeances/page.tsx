"use client";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, CalendarClock, Check, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNow } from "@/components/providers";
import { Badge, Button, Card, Field, Notice, PageTitle, Sheet } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { addReminder, removeReminder, setReminderConsent } from "@/lib/api";
import { useApp } from "@/lib/store";

const TYPES = ["Passeport", "Carte d'identité", "Permis de conduire", "Contrat d'assurance", "Bail", "Crédit", "Abonnement"];
const DAY = 86_400_000;

// Reminders are typed here, in the Espace, with consent: the service can remind without ever reading the Coffre.
export default function Echeances() {
  const s = useApp(useShallow((x) => ({ reminders: x.reminders, consent: x.reminderConsent })));
  const t = useNow(60_000);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [ok, setOk] = useState(false);
  const list = [...s.reminders].sort((a, b) => a.date.localeCompare(b.date));

  async function add() {
    if (!(await addReminder(label, date))) return;
    setAdding(false);
    setLabel("");
    setDate("");
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <PageTitle eyebrow="Mes échéances" title="On vous prévient avant" lead="Passeport, contrats, baux… Indiquez le type de document et sa date de fin. Ces deux informations restent dans l'Espace : le contenu de votre Coffre, lui, reste illisible pour nous." />

      {!s.consent ? (
        <motion.div variants={rise}>
          <Card>
            <BellRing className="h-8 w-8 text-gold-deep" />
            <h2 className="mt-3 text-[1.3rem] font-semibold">Activer les rappels</h2>
            <button type="button" onClick={() => setOk(!ok)} aria-pressed={ok} className="mt-3 flex w-full items-start gap-3 text-left">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ring-2 ${ok ? "bg-ink ring-ink" : "ring-line"}`}>{ok && <Check className="h-4 w-4 text-paper" strokeWidth={3} />}</span>
              <span className="text-[0.95rem] text-ink-soft">J&apos;accepte que le type de document et sa date de fin soient enregistrés dans mon Espace pour recevoir des rappels. Je peux les supprimer à tout moment.</span>
            </button>
            <Button className="mt-4" full variant="gold" disabled={!ok} onClick={() => setReminderConsent()}>
              Activer les rappels
            </Button>
          </Card>
        </motion.div>
      ) : (
        <>
          <motion.div variants={rise} className="space-y-2.5">
            <AnimatePresence initial={false}>
              {list.map((r) => {
                const left = Math.ceil((new Date(r.date).getTime() - t) / DAY);
                return (
                  <motion.div key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center gap-3 rounded-2xl bg-paper p-4 shadow-soft ring-1 ring-line/70">
                    <CalendarClock className="h-6 w-6 shrink-0 text-gold-deep" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.label}</div>
                      <div className="text-[0.85rem] text-mist">Fin le {new Date(r.date).toLocaleDateString("fr-FR", { dateStyle: "long" })}</div>
                    </div>
                    <Badge tone={left < 0 ? "mist" : left <= 30 ? "coral" : left <= 90 ? "gold" : "sage"}>{left < 0 ? "Expiré" : `${left} j`}</Badge>
                    <button onClick={() => removeReminder(r.id)} aria-label={`Supprimer ${r.label}`} className="rounded-full p-2 hover:bg-coral/10">
                      <Trash className="h-4 w-4 text-coral" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {list.length === 0 && <Notice tone="ink">Aucune échéance pour l&apos;instant.</Notice>}
          </motion.div>
          <motion.div variants={rise}>
            <Button full variant="outline" icon={<Plus className="h-5 w-5" />} onClick={() => setAdding(true)}>
              Ajouter une échéance
            </Button>
          </motion.div>
          <motion.div variants={rise}>
            <Notice tone="gold">Nous vous écrivons 30 jours puis 7 jours avant chaque date. Et tous les 3 mois, un petit message vous demande si tout est à jour.</Notice>
          </motion.div>
        </>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Nouvelle échéance">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((x) => (
              <button key={x} type="button" onClick={() => setLabel(x)} className={`rounded-full px-3.5 py-2 text-[0.9rem] font-semibold ring-1 ${label === x ? "bg-ink text-paper ring-ink" : "bg-paper ring-line"}`}>
                {x}
              </button>
            ))}
          </div>
          <Field label="Type de document" value={label} onChange={setLabel} placeholder="Ex. Bail de l'appartement" />
          <Field label="Date de fin" type="date" value={date} onChange={setDate} />
          <Button full variant="gold" disabled={!label.trim() || !date} onClick={add}>
            Enregistrer
          </Button>
        </div>
      </Sheet>
    </motion.div>
  );
}
