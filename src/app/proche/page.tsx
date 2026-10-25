"use client";
// Production: the page of a relative who signs in — what they are for others (guarantor, beneficiary) and what they can do.
import { motion } from "motion/react";
import { ArrowRight, FileUp, Lock, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activation, PACK_WARNING, type ActivationMode } from "@/components/activation";
import { useHydrated, useNow } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Badge, Button, Card, Field, Notice, Segmented, Sheet } from "@/components/ui";
import { Aurora, Countdown, Logo, NfcCard } from "@/components/visuals";
import { declareAsGuarantor, declareLost, signOut } from "@/lib/api";
import { DELAYS } from "@/lib/config";
import { PROD } from "@/lib/env";
import { activeProcedure, procedureStatus, type ProcedureKind } from "@/lib/rules";
import { useApp, type Card as CardT, type Trust } from "@/lib/store";

const hours = (ms: number) => (ms >= 86_400_000 ? `${Math.round(ms / 86_400_000)} jours` : `${Math.round(ms / 3_600_000)} heures`);
const STATUS: Record<string, string> = { commandee: "En fabrication", en_route: "En livraison", recue: "À activer", active: "Active", perdue: "Désactivée" };

export default function Proche() {
  const hydrated = useHydrated();
  const me = useApp((s) => s.me);
  const account = useApp((s) => s.account);
  const trusts = useApp((s) => s.trusts);
  const router = useRouter();
  const t = useNow(1000);
  const [mode, setMode] = useState<ActivationMode | null>(null);
  const [declaring, setDeclaring] = useState<Trust | null>(null);
  const [lost, setLost] = useState<CardT | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!PROD) router.replace("/espace");
    else if (!me) router.replace("/connexion?suite=/proche");
  }, [hydrated, me, router]);
  if (!hydrated || !me) return <Loader />;

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Aurora className="fixed opacity-60" />
      <div className="relative mx-auto max-w-lg px-5 pb-16 pt-5">
        <div className="flex items-center justify-between">
          <Logo />
          <button
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
            className="flex items-center gap-2 rounded-full px-3 py-2 text-[0.9rem] font-semibold text-ink-soft ring-1 ring-line"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold-deep">Mon espace de proche</div>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight">Ceux qui comptent sur vous</h1>
          <p className="mt-2 text-ink-soft">Connecté avec {me.email}. Vous ne voyez ici aucun contenu de leur Coffre : seulement votre rôle et vos cartes.</p>
        </motion.div>

        {trusts.length === 0 && (
          <div className="mt-6">
            <Notice tone="ink">Personne ne vous a encore désigné avec cette adresse. Si un proche l&apos;a fait avec une autre adresse, connectez-vous avec celle-là.</Notice>
          </div>
        )}

        <div className="mt-6 space-y-5">
          {trusts.map((x) => {
            const live = activeProcedure(x.procedures, t);
            const status = live && procedureStatus(live, t);
            const isBeneficiary = x.cards.some((c) => c.status !== "perdue");
            const toActivate = x.cards.filter((c) => c.status === "en_route" || c.status === "recue");
            const active = x.cards.filter((c) => c.status === "active");
            return (
              <Card key={x.ownerId} layout>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 text-[1.25rem] font-semibold">{x.ownerName}</div>
                  {x.guarantorRole && <Badge tone="gold">Garant</Badge>}
                  {isBeneficiary && <Badge tone="sage">Bénéficiaire</Badge>}
                </div>
                {x.guarantorRole && <p className="mt-2 text-ink-soft">Votre rôle : « {x.guarantorRole} »</p>}

                {live && (
                  <div className="mt-4 rounded-2xl bg-coral-soft p-4">
                    <div className="font-semibold">{live.kind === "coup_dur" ? "Coup dur signalé" : "Décès signalé"}</div>
                    <div className="text-[0.9rem] text-ink-soft">
                      {status === "verification" ? "Vérification en cours par notre équipe." : status === "delai" && live.endsAt ? (
                        <>
                          Ouverture des accès dans <Countdown to={live.endsAt} now={t} />, sauf annulation.
                        </>
                      ) : (
                        "Les accès prévus sont ouverts."
                      )}
                    </div>
                  </div>
                )}

                {isBeneficiary && (
                  <div className="mt-4">
                    <div className="mb-2 text-[0.92rem] font-semibold text-ink-soft">Mes cartes pour ce Coffre</div>
                    <div className="grid grid-cols-2 gap-3">
                      {x.cards.map((c) => (
                        <div key={c.id} className="space-y-1.5">
                          <NfcCard name={c.printedName} flipped dim={c.status === "perdue"} />
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={c.status === "active" ? "sage" : c.status === "perdue" ? "mist" : "gold"}>{STATUS[c.status]}</Badge>
                            {c.status === "active" && (
                              <button onClick={() => setLost(c)} className="rounded-full px-2.5 py-1 text-[0.75rem] font-semibold text-coral ring-1 ring-coral/30">
                                Perdue
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2">
                      {toActivate.length > 0 && (
                        <Button full onClick={() => setMode({ kind: "holder", cards: toActivate, who: "vous" })}>
                          Activer mes cartes
                        </Button>
                      )}
                      {active.length > 0 && (
                        <Button full variant="gold" href="/coffre" icon={<Lock className="h-5 w-5" />}>
                          Ouvrir avec ma carte
                        </Button>
                      )}
                      <Button full variant="ghost" href="/beneficiaire" icon={<FileUp className="h-5 w-5" />}>
                        {x.ownerName.split(" ")[0]} est décédé(e) : déposer l&apos;acte
                      </Button>
                    </div>
                  </div>
                )}

                {x.guarantorRole && !live && (
                  <Button className="mt-4" full variant="outline" icon={<ShieldAlert className="h-5 w-5" />} onClick={() => setDeclaring(x)}>
                    Signaler un coup dur ou un décès
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        <Link href={account ? "/espace" : "/inscription"} className="mt-8 flex items-center justify-between rounded-[1.5rem] bg-night p-5 text-paper shadow-lift">
          <span className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-gold-soft" />
            <span className="font-semibold">{account ? "Mon propre Espace" : "Préparer mon propre Coffre"}</span>
          </span>
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>

      <Sheet open={!!mode} onClose={() => setMode(null)} title="Activer mes cartes">
        {mode && <Activation mode={mode} onClose={() => setMode(null)} />}
      </Sheet>

      <Sheet open={!!declaring} onClose={() => setDeclaring(null)} title="Votre signalement">
        {declaring && <Declare ownerName={declaring.ownerName} onDeclare={async (kind, note) => (await declareAsGuarantor(declaring.ownerId, kind, "", note)) && setDeclaring(null)} />}
      </Sheet>

      <Sheet open={!!lost} onClose={() => setLost(null)} title="Désactiver cette carte ?">
        <p className="text-ink-soft">Elle ne pourra plus rien ouvrir, même avec le code. {PACK_WARNING}</p>
        <Button className="mt-6" variant="danger" full onClick={async () => lost && (await declareLost(lost)) && setLost(null)}>
          Désactiver la carte
        </Button>
      </Sheet>
    </div>
  );
}

function Declare({ ownerName, onDeclare }: { ownerName: string; onDeclare: (k: ProcedureKind, note: string) => void }) {
  const [kind, setKind] = useState<ProcedureKind>("coup_dur");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      <Segmented layoutKey="declare-proche" value={kind} onChange={setKind} options={[{ id: "coup_dur", label: "Coup dur" }, { id: "deces", label: "Décès" }]} />
      <Field
        label={kind === "coup_dur" ? "Que se passe-t-il ?" : "Mairie et date du décès, si vous les connaissez"}
        multiline
        value={note}
        onChange={setNote}
        placeholder={kind === "coup_dur" ? "Ex. Hospitalisée à Lyon depuis ce matin" : "Ex. Mairie de Nantes, le 3 mars"}
      />
      <Notice tone={kind === "coup_dur" ? "gold" : "coral"}>
        {kind === "coup_dur"
          ? `${ownerName} est prévenu(e) partout et peut annuler pendant ${hours(DELAYS.coupDur)}. Ensuite, seuls les éléments prévus pour un coup dur s'ouvrent.`
          : `Un décès est toujours vérifié par notre équipe : registre INSEE, acte de décès fourni par un bénéficiaire et son identité. Puis un délai de ${hours(DELAYS.deces)} s'ouvre, avec des alertes, avant toute transmission.`}
      </Notice>
      <Button full variant="danger" onClick={() => onDeclare(kind, note.trim())}>
        Envoyer le signalement
      </Button>
    </div>
  );
}
