"use client";
import { AnimatePresence, motion } from "motion/react";
import { HeartHandshake, Hourglass, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { CardUnlock } from "@/components/card-flow";
import { CoupDurRequest } from "@/components/proof";
import { useNow } from "@/components/providers";
import { Badge, Button, Card, Field, Notice, PageTitle, Sheet } from "@/components/ui";
import { Countdown, rise, stagger } from "@/components/visuals";
import { DELAYS } from "@/lib/config";
import { cancelProcedure, declareAsGuarantor } from "@/lib/api";
import { PROD } from "@/lib/env";
import { accessEnd, MOTIFS, procedureStatus, type Procedure, type ProcedureStatus } from "@/lib/rules";
import { isPhone, ownerCards, useApp, type Person } from "@/lib/store";
import { closeCoupDur, lock } from "@/lib/vault";

const LABEL: Record<ProcedureStatus, { text: string; tone: "gold" | "coral" | "sage" | "mist" | "ink" }> = {
  verification: { text: "Vérification en cours", tone: "gold" },
  delai: { text: "Délai d'annulation", tone: "coral" },
  active: { text: "Accès ouvert", tone: "coral" },
  terminee: { text: "Transmission faite", tone: "ink" },
  annulee: { text: "Annulée", tone: "sage" },
  rejetee: { text: "Rejetée", tone: "mist" },
  cloturee: { text: "Fermée", tone: "sage" },
};
const fmt = (t: number) => new Date(t).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
const day = (t: number) => new Date(t).toLocaleDateString("fr-FR", { dateStyle: "long" });
const days = (ms: number) => `${Math.round(ms / 86_400_000)} jours`;
const fullName = (p: Person) => `${p.firstName} ${p.lastName}`;

export default function Procedures() {
  const s = useApp(useShallow((x) => ({ procedures: x.procedures, guarantors: x.guarantors, people: x.people, cards: x.cards, rights: x.rights, account: x.account })));
  const t = useNow(1000);
  const [prove, setProve] = useState<{ p: Procedure; action: "cancel" | "close" } | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const list = [...s.procedures].sort((a, b) => b.declaredAt - a.declaredAt);
  // Demo: the relatives who could ask (an approved phone and something planned for a coup dur), as the server requires.
  const askers = s.people.filter(
    (p) =>
      s.cards.some((c) => c.holderId === p.id && isPhone(c) && c.status === "active") &&
      Object.values(s.rights[p.id] ?? {}).includes("coup_dur") &&
      !s.procedures.some((x) => x.requestedBy === p.id && ["verification", "active"].includes(procedureStatus(x, t))),
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <PageTitle
        eyebrow="Coup dur et décès"
        title="Rien ne s'ouvre sans vérification"
        lead={`Un proche demande l'ouverture pour un coup dur, avec un justificatif, ou un décès est signalé : notre équipe vérifie toujours, vous êtes prévenu partout, et vous pouvez refuser ou fermer à tout moment. Après un décès vérifié, un délai d'annulation de ${days(DELAYS.deces)} s'ouvre encore.`}
      />

      {list.length === 0 && (
        <motion.div variants={rise}>
          <Notice tone="sage">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 shrink-0 text-sage" />
              <span>Aucune demande. Votre Coffre reste fermé à tous, sauf ce que vous avez réglé sur « Maintenant ».</span>
            </div>
          </Notice>
        </motion.div>
      )}

      <AnimatePresence>
        {list.map((p) => {
          const st = procedureStatus(p, t);
          const live = st === "verification" || st === "delai" || st === "active";
          const coupDur = p.kind === "coup_dur";
          return (
            <motion.div key={p.id} layout variants={rise} exit={{ opacity: 0, scale: 0.96 }}>
              <Card className={live ? "ring-2 !ring-coral/40" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[1.2rem] font-semibold">{coupDur ? "Demande d'ouverture : coup dur" : "Décès signalé"}</div>
                    <div className="text-[0.88rem] text-mist">
                      Par {p.declaredBy} · {fmt(p.declaredAt)}
                    </div>
                  </div>
                  <Badge tone={LABEL[st].tone}>{LABEL[st].text}</Badge>
                </div>
                {coupDur && p.note && <p className="mt-3 rounded-2xl bg-ink/[0.04] p-3 text-[0.92rem] text-ink-soft">Motif : {MOTIFS.find((m) => m.id === p.note)?.label ?? p.note}</p>}
                {!coupDur && p.note && <p className="mt-3 rounded-2xl bg-ink/[0.04] p-3 text-[0.92rem] text-ink-soft">« {p.note} »</p>}
                {!coupDur && p.match && <p className="mt-2 text-[0.85rem] text-mist">Correspondance registre : {Math.round(p.match.score * 100)} %{p.match.doubtful ? " (douteuse, vérifiée par une personne)" : ""}</p>}

                {st === "verification" && (
                  <p className="mt-4 flex items-center gap-2 text-ink-soft">
                    <Hourglass className="h-5 w-5 shrink-0 text-gold-deep" />
                    {coupDur
                      ? `Notre équipe vérifie le justificatif et l'identité de ${p.declaredBy} (pièce d'identité et visage). Rien n'est ouvert pour l'instant.`
                      : p.acte
                        ? "Notre équipe vérifie l'acte de décès, le registre INSEE et l'identité du bénéficiaire."
                        : "En attente de l'acte de décès, fourni par un bénéficiaire, avant toute vérification."}
                  </p>
                )}
                {st === "delai" && p.endsAt && (
                  <div className="mt-4 rounded-2xl bg-coral-soft p-4 text-center">
                    <div className="text-[0.85rem] font-semibold text-coral">Ouverture des accès dans</div>
                    <div className="mt-1 text-[1.9rem] font-semibold text-ink">
                      <Countdown to={p.endsAt} now={t} />
                    </div>
                    <div className="mt-1 text-[0.82rem] text-ink-soft">Alertes envoyées par e-mail, SMS et notification</div>
                  </div>
                )}
                {st === "active" && p.endsAt && (
                  <p className="mt-4 text-ink-soft">{`${p.declaredBy} peut ouvrir ce que vous lui avez attribué pour un coup dur, jusqu'au ${day(p.endsAt + DELAYS.coupDurAccess)}, et personne d'autre. Vous pouvez fermer l'accès à tout moment : les clés de ces sous-rubriques sont alors changées.`}</p>
                )}
                {st === "terminee" && (
                  <p className="mt-4 text-ink-soft">
                    {p.erasedAt
                      ? "La période d'accès est terminée : le Coffre a été effacé définitivement."
                      : `Chaque bénéficiaire ouvre uniquement ce qui lui était destiné, avec son téléphone ou ses cartes, jusqu'au ${day(accessEnd(p)!)}. Ensuite, le Coffre est effacé définitivement. La rubrique « À effacer » a déjà été détruite sans être lue.`}
                  </p>
                )}

                {(st === "verification" || st === "delai") && (
                  <Button className="mt-4" full variant="gold" icon={<HeartHandshake className="h-5 w-5" />} onClick={() => setProve({ p, action: "cancel" })}>
                    {coupDur ? "Tout va bien, je refuse cette demande" : "Tout va bien, j'annule"}
                  </Button>
                )}
                {st === "active" && (
                  <Button className="mt-4" full variant="gold" icon={<Lock className="h-5 w-5" />} onClick={() => setProve({ p, action: "close" })}>
                    Je vais mieux, je ferme l&apos;accès
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
          <h2 className="mt-3 text-[1.3rem] font-semibold">Du côté de vos proches</h2>
          {PROD ? (
            <p className="mt-1 text-ink-soft">Vos proches font leurs demandes depuis leur propre compte, avec l&apos;adresse e-mail que vous avez indiquée dans « Famille ». Vous êtes prévenu aussitôt, partout.</p>
          ) : (
            <>
              <p className="mt-1 text-ink-soft">Vos proches font leurs demandes depuis leur propre compte. Pour la démonstration, vous pouvez le faire ici à leur place.</p>
              <Button className="mt-4" full variant="outline" disabled={askers.length === 0} onClick={() => setRequesting(true)}>
                Demande d&apos;ouverture d&apos;un proche (coup dur)
              </Button>
              {askers.length === 0 && <p className="mt-2 text-center text-[0.85rem] text-mist">Il faut un proche avec un accès validé et une partie réglée sur « Coup dur ».</p>}
              <Button className="mt-3" full variant="outline" disabled={s.guarantors.length === 0} onClick={() => setDeclaring(true)}>
                Signalement d&apos;un décès par un garant
              </Button>
              <Button className="mt-3" full variant="ghost" href="/beneficiaire">
                Espace bénéficiaire : déposer un acte de décès
              </Button>
            </>
          )}
        </Card>
      </motion.section>

      <Sheet open={!!prove} onClose={() => setProve(null)} title="Prouvez que c'est vous">
        {prove && (
          <Prove
            onProved={async () => {
              const ok = prove.action === "cancel" ? await cancelProcedure(prove.p.id) : await closeCoupDur(prove.p.id).then(() => true);
              if (ok) setProve(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={requesting} onClose={() => setRequesting(false)} title="Demande d'ouverture">
        {requesting && s.account && <DemoRequest people={askers} ownerName={`${s.account.firstName} ${s.account.lastName}`} onDone={() => setRequesting(false)} />}
      </Sheet>

      <Sheet open={declaring} onClose={() => setDeclaring(false)} title="Signalement d'un garant">
        <Declare
          guarantors={s.guarantors.map((g) => ({ id: g.personId, name: (() => { const p = s.people.find((x) => x.id === g.personId); return p ? fullName(p) : "—"; })() }))}
          onDeclare={async (by, note) => {
            if (await declareAsGuarantor(null, by, note)) setDeclaring(false);
          }}
        />
      </Sheet>
    </motion.div>
  );
}

// Cancelling must prove the owner is alive and well: their card and their code, nothing less.
function Prove({ onProved }: { onProved: () => Promise<void> }) {
  const cards = ownerCards({ cards: useApp((x) => x.cards) }).filter((c) => c.status === "active");
  if (cards.length === 0) return <p className="text-ink-soft">Aucune carte active : contactez-nous pour annuler.</p>;
  return (
    <CardUnlock
      candidates={cards}
      intro="Posez votre carte, puis tapez votre code."
      onOpened={async () => {
        try {
          await onProved();
        } finally {
          lock();
        }
      }}
    />
  );
}

const SELECT = "w-full rounded-2xl bg-paper px-4 py-3.5 text-[1.05rem] ring-1 ring-line outline-none focus:ring-2 focus:ring-gold";

// Demo: a relative's request, made here in their place (production: from their own account, on their phone).
function DemoRequest({ people, ownerName, onDone }: { people: Person[]; ownerName: string; onDone: () => void }) {
  const [id, setId] = useState(people[0]?.id ?? "");
  const p = people.find((x) => x.id === id);
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[0.92rem] font-semibold text-ink-soft">Je suis</span>
        <select value={id} onChange={(e) => setId(e.target.value)} className={SELECT}>
          {people.map((x) => (
            <option key={x.id} value={x.id}>
              {fullName(x)}
            </option>
          ))}
        </select>
      </label>
      {p && <CoupDurRequest key={id} ownerId={null} ownerName={ownerName} personId={id} who={fullName(p)} onDone={onDone} />}
    </div>
  );
}

function Declare({ guarantors, onDeclare }: { guarantors: { id: string; name: string }[]; onDeclare: (by: string, note: string) => void }) {
  const [by, setBy] = useState(guarantors[0]?.id ?? "");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[0.92rem] font-semibold text-ink-soft">Je suis</span>
        <select value={by} onChange={(e) => setBy(e.target.value)} className={SELECT}>
          {guarantors.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <Field label="Mairie et date du décès, si vous les connaissez" multiline value={note} onChange={setNote} placeholder="Ex. Mairie de Nantes, le 3 mars" />
      <Notice tone="coral">{`Un décès est toujours vérifié par notre équipe : registre INSEE, acte de décès fourni par un bénéficiaire, son identité et son visage. Puis un délai de ${days(DELAYS.deces)} s'ouvre, avec des alertes, avant toute transmission.`}</Notice>
      <Button full variant="danger" disabled={!by} onClick={() => onDeclare(guarantors.find((g) => g.id === by)!.name, note.trim())}>
        Envoyer le signalement
      </Button>
    </div>
  );
}
