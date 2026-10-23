"use client";
import { AnimatePresence, motion } from "motion/react";
import { HeartHandshake, Hourglass, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { PinPad } from "@/components/pinpad";
import { useNow } from "@/components/providers";
import { Badge, Button, Card, Field, Notice, PageTitle, Segmented, Sheet } from "@/components/ui";
import { Countdown, rise, stagger } from "@/components/visuals";
import { DELAYS } from "@/lib/config";
import { declare, procedureStatus, type Procedure, type ProcedureKind, type ProcedureStatus } from "@/lib/rules";
import { now, ownerCards, useApp } from "@/lib/store";
import { closeCoupDur, lock, unlock } from "@/lib/vault";

const LABEL: Record<ProcedureStatus, { text: string; tone: "gold" | "coral" | "sage" | "mist" | "ink" }> = {
  verification: { text: "Vérification en cours", tone: "gold" },
  delai: { text: "Délai d'annulation", tone: "coral" },
  active: { text: "Accès ouverts", tone: "coral" },
  terminee: { text: "Transmission faite", tone: "ink" },
  annulee: { text: "Annulée", tone: "sage" },
  rejetee: { text: "Rejetée", tone: "mist" },
  cloturee: { text: "Clôturée", tone: "sage" },
};
const fmt = (t: number) => new Date(t).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
const days = (ms: number) => (ms >= 86_400_000 ? `${Math.round(ms / 86_400_000)} jours` : `${Math.round(ms / 3_600_000)} heures`);

export default function Procedures() {
  const s = useApp(useShallow((x) => ({ procedures: x.procedures, guarantors: x.guarantors, people: x.people, account: x.account!, cards: x.cards, set: x.set, email: x.email })));
  const t = useNow(1000);
  const [prove, setProve] = useState<{ p: Procedure; action: "cancel" | "close" } | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const list = [...s.procedures].sort((a, b) => b.declaredAt - a.declaredAt);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <PageTitle eyebrow="Coup dur et décès" title="Rien ne s'ouvre sans délai" lead={`Un garant signale, vous êtes prévenu partout, et vous pouvez annuler : ${days(DELAYS.coupDur)} pour un coup dur, ${days(DELAYS.deces)} après la vérification d'un décès.`} />

      {list.length === 0 && (
        <motion.div variants={rise}>
          <Notice tone="sage">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 shrink-0 text-sage" />
              <span>Aucun signalement. Votre Coffre reste fermé à tous, sauf ce que vous avez ouvert « tout de suite ».</span>
            </div>
          </Notice>
        </motion.div>
      )}

      <AnimatePresence>
        {list.map((p) => {
          const st = procedureStatus(p, t);
          const live = st === "verification" || st === "delai" || st === "active";
          return (
            <motion.div key={p.id} layout variants={rise} exit={{ opacity: 0, scale: 0.96 }}>
              <Card className={live ? "ring-2 !ring-coral/40" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[1.2rem] font-semibold">{p.kind === "coup_dur" ? "Coup dur signalé" : "Décès signalé"}</div>
                    <div className="text-[0.88rem] text-mist">
                      Par {p.declaredBy} · {fmt(p.declaredAt)}
                    </div>
                  </div>
                  <Badge tone={LABEL[st].tone}>{LABEL[st].text}</Badge>
                </div>
                {p.note && <p className="mt-3 rounded-2xl bg-ink/[0.04] p-3 text-[0.92rem] text-ink-soft">« {p.note} »</p>}
                {p.match && <p className="mt-2 text-[0.85rem] text-mist">Correspondance registre : {Math.round(p.match.score * 100)} %{p.match.doubtful ? " (douteuse, vérifiée par une personne)" : ""}</p>}

                {st === "verification" && <p className="mt-4 flex items-center gap-2 text-ink-soft"><Hourglass className="h-5 w-5 text-gold-deep" /> Notre équipe vérifie le décès auprès de l'état civil avant tout délai.</p>}
                {st === "delai" && p.endsAt && (
                  <div className="mt-4 rounded-2xl bg-coral-soft p-4 text-center">
                    <div className="text-[0.85rem] font-semibold text-coral">Ouverture des accès dans</div>
                    <div className="mt-1 text-[1.9rem] font-semibold text-ink">
                      <Countdown to={p.endsAt} now={t} />
                    </div>
                    <div className="mt-1 text-[0.82rem] text-ink-soft">Alertes envoyées par e-mail, SMS et notification</div>
                  </div>
                )}
                {st === "active" && <p className="mt-4 text-ink-soft">Les proches désignés pour un coup dur peuvent ouvrir ce que vous leur avez attribué. Quand vous allez mieux, reprenez la main : leurs clés sont changées.</p>}
                {st === "terminee" && <p className="mt-4 text-ink-soft">Chaque proche a reçu uniquement ce qui lui était destiné. La rubrique « À effacer » a été détruite sans être lue.</p>}

                {(st === "verification" || st === "delai") && (
                  <Button className="mt-4" full variant="gold" icon={<HeartHandshake className="h-5 w-5" />} onClick={() => setProve({ p, action: "cancel" })}>
                    Tout va bien, j'annule
                  </Button>
                )}
                {st === "active" && (
                  <Button className="mt-4" full variant="gold" onClick={() => setProve({ p, action: "close" })}>
                    Je vais mieux, je reprends la main
                  </Button>
                )}
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <motion.section variants={rise}>
        <Card className="bg-gradient-to-br from-paper to-sand/50">
          <ShieldAlert className="h-8 w-8 text-coral" />
          <h2 className="mt-3 text-[1.3rem] font-semibold">Espace garant</h2>
          <p className="mt-1 text-ink-soft">Vos garants font leur signalement depuis leur propre Espace. Pour la démonstration, vous pouvez le faire ici à leur place.</p>
          <Button className="mt-4" full variant="outline" disabled={s.guarantors.length === 0} onClick={() => setDeclaring(true)}>
            Signaler comme garant
          </Button>
          {s.guarantors.length === 0 && <p className="mt-2 text-center text-[0.85rem] text-mist">Désignez d'abord un garant dans « Famille ».</p>}
        </Card>
      </motion.section>

      <Sheet open={!!prove} onClose={() => setProve(null)} title={prove?.action === "cancel" ? "Prouvez que c'est vous" : "Reprendre la main"}>
        {prove && (
          <Prove
            onProved={async () => {
              if (prove.action === "cancel") s.set((x) => ({ procedures: x.procedures.map((y) => (y.id === prove.p.id ? { ...y, cancelledAt: now() } : y)) }));
              else await closeCoupDur(prove.p.id);
              setProve(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={declaring} onClose={() => setDeclaring(false)} title="Signalement d'un garant">
        <Declare
          guarantors={s.guarantors.map((g) => ({ id: g.personId, name: (() => { const p = s.people.find((x) => x.id === g.personId); return p ? `${p.firstName} ${p.lastName}` : "—"; })() }))}
          onDeclare={(kind, by, note) => {
            const p = declare(kind, "garant", by, now(), { note: note || undefined });
            s.set((x) => ({ procedures: [p, ...x.procedures] }));
            if (p.kind === "coup_dur") s.email(s.account.email, "coup-dur-declare", { declaredBy: by, endsAt: fmt(p.endsAt!) });
            setDeclaring(false);
          }}
        />
      </Sheet>
    </motion.div>
  );
}

// Cancelling must prove the owner is alive and well: their card and their code, nothing less.
function Prove({ onProved }: { onProved: () => Promise<void> }) {
  const cards = ownerCards({ cards: useApp((x) => x.cards) }).filter((c) => c.status === "active");
  const [error, setError] = useState<string | null>(null);
  if (cards.length === 0) return <p className="text-ink-soft">Aucune carte active : contactez-nous pour annuler.</p>;
  return (
    <div>
      <p className="mb-6 text-center text-ink-soft">Posez votre carte et tapez votre code.</p>
      <PinPad
        error={error}
        label="Votre code"
        onComplete={async (pin) => {
          try {
            // shortcut: the demo uses the first active card; the app reads whichever card is tapped (Tangem SDK).
            await unlock(cards[0].id, pin);
            await onProved();
            lock();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function Declare({ guarantors, onDeclare }: { guarantors: { id: string; name: string }[]; onDeclare: (k: ProcedureKind, by: string, note: string) => void }) {
  const [kind, setKind] = useState<ProcedureKind>("coup_dur");
  const [by, setBy] = useState(guarantors[0]?.id ?? "");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      <Segmented layoutKey="declare" value={kind} onChange={setKind} options={[{ id: "coup_dur", label: "Coup dur" }, { id: "deces", label: "Décès" }]} />
      <label className="block">
        <span className="mb-1.5 block text-[0.92rem] font-semibold text-ink-soft">Je suis</span>
        <select value={by} onChange={(e) => setBy(e.target.value)} className="w-full rounded-2xl bg-paper px-4 py-3.5 text-[1.05rem] ring-1 ring-line outline-none focus:ring-2 focus:ring-gold">
          {guarantors.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <Field
        label={kind === "coup_dur" ? "Que se passe-t-il ?" : "Mairie et date du décès, si vous les connaissez"}
        multiline
        value={note}
        onChange={setNote}
        placeholder={kind === "coup_dur" ? "Ex. Hospitalisée à Lyon depuis ce matin" : "Ex. Mairie de Nantes, le 3 mars"}
      />
      <Notice tone={kind === "coup_dur" ? "gold" : "coral"}>
        {kind === "coup_dur"
          ? `Le titulaire est prévenu partout et peut annuler pendant ${days(DELAYS.coupDur)}. Ensuite, seuls les éléments prévus pour un coup dur s'ouvrent.`
          : `Un décès est toujours vérifié par une personne de notre équipe. Puis un délai de ${days(DELAYS.deces)} s'ouvre, avec des alertes, avant toute transmission.`}
      </Notice>
      <Button full variant="danger" disabled={!by} onClick={() => onDeclare(kind, guarantors.find((g) => g.id === by)!.name, note.trim())}>
        Envoyer le signalement
      </Button>
    </div>
  );
}
