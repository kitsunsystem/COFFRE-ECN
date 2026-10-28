"use client";
// Production: the page of a relative who signs in — what they are for others (guarantor, beneficiary), their access
// from this phone, and their cards, which only arrive after a death.
import { motion } from "motion/react";
import { ArrowRight, FileUp, Lock, LogOut, ScanFace, ShieldAlert, ShieldCheck, Smartphone, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessRequest } from "@/components/access";
import { Activation, type ActivationMode } from "@/components/activation";
import { useHydrated, useNow } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Badge, Button, Card, Field, Notice, Segmented, Sheet } from "@/components/ui";
import { Aurora, Countdown, Logo, NfcCard } from "@/components/visuals";
import { hasAccessKey } from "@/lib/access";
import { declareAsGuarantor, declareLost, setPackAddress, signOut } from "@/lib/api";
import { DELAYS } from "@/lib/config";
import { PROD } from "@/lib/env";
import { isNative } from "@/lib/native";
import { activeProcedure, procedureStatus, type ProcedureKind } from "@/lib/rules";
import { isPhone, useApp, type Card as CardT, type Trust } from "@/lib/store";

const hours = (ms: number) => (ms >= 86_400_000 ? `${Math.round(ms / 86_400_000)} jours` : `${Math.round(ms / 3_600_000)} heures`);
const STATUS: Record<string, string> = { reservee: "Réservée", commandee: "En fabrication", en_route: "En livraison", recue: "À activer", active: "Active", perdue: "Désactivée" };

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
  const [asking, setAsking] = useState<Trust | null>(null);
  // Whether this phone holds the person's access key (it never leaves the phone where it was made).
  const [here, setHere] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!hydrated) return;
    if (!PROD) router.replace("/espace");
    else if (!me) router.replace("/connexion?suite=/proche");
  }, [hydrated, me, router]);
  useEffect(() => {
    let alive = true;
    void Promise.all(trusts.map(async (x) => [x.personId, await hasAccessKey(x.personId).catch(() => false)] as const)).then((r) => alive && setHere(Object.fromEntries(r)));
    return () => {
      alive = false;
    };
  }, [trusts, asking]);
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
          <p className="mt-2 text-ink-soft">Connecté avec {me.email}. Ici, seulement votre rôle, votre accès et vos cartes : leur Coffre s&apos;ouvre à part, avec Face ID et votre code.</p>
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
            const pack = x.cards.filter((c) => !isPhone(c));
            const phone = x.cards.find((c) => isPhone(c) && c.status !== "perdue");
            const isBeneficiary = pack.some((c) => c.status !== "perdue");
            const ready = phone?.status === "active" && here[x.personId];
            const toActivate = pack.filter((c) => c.status === "en_route" || c.status === "recue");
            const toShip = pack.filter((c) => c.status === "commandee");
            const first = x.ownerName.split(" ")[0];
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
                  <div className="mt-4 rounded-2xl bg-ink/[0.04] p-4">
                    <div className="flex items-center gap-2 font-semibold">
                      <Smartphone className="h-5 w-5 text-gold-deep" /> Mon accès depuis ce téléphone
                    </div>
                    {ready ? (
                      <>
                        <p className="mt-1 text-[0.92rem] text-ink-soft">Accès validé. Avec Face ID et votre code, vous ouvrez ce que {first} vous confie, au moment prévu.</p>
                        <Button className="mt-3" full variant="gold" href="/coffre" icon={<ScanFace className="h-5 w-5" />}>
                          Ouvrir avec Face ID et mon code
                        </Button>
                      </>
                    ) : phone?.status === "demandee" && here[x.personId] ? (
                      <p className="mt-1 text-[0.92rem] text-ink-soft">Demande envoyée : {x.ownerName} doit l&apos;accepter depuis son Coffre. Vous serez prévenu par e-mail.</p>
                    ) : !isNative() ? (
                      <p className="mt-1 text-[0.92rem] text-ink-soft">Votre accès se demande depuis l&apos;application, sur votre téléphone : Face ID et un code à 6 chiffres.</p>
                    ) : (
                      <>
                        <p className="mt-1 text-[0.92rem] text-ink-soft">
                          {phone?.status === "active"
                            ? `Votre accès est validé sur un autre téléphone. Pour utiliser celui-ci, demandez-le de nouveau : ${first} devra l'accepter.`
                            : `Pour l'urgence ou un coup dur, pas besoin de cartes : demandez votre accès, avec Face ID et un code à 6 chiffres. ${first} reçoit un e-mail pour l'accepter.`}
                        </p>
                        <Button className="mt-3" full onClick={() => setAsking(x)}>
                          Demander mon accès
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {isBeneficiary && (
                  <div className="mt-4">
                    <div className="mb-2 text-[0.92rem] font-semibold text-ink-soft">Mes cartes pour ce Coffre</div>
                    <div className="grid grid-cols-2 gap-3">
                      {pack.map((c) => (
                        <div key={c.id} className="space-y-1.5">
                          <NfcCard name={c.printedName} flipped dim={c.status === "perdue" || c.status === "reservee"} />
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={c.status === "active" ? "sage" : c.status === "perdue" || c.status === "reservee" ? "mist" : "gold"}>{STATUS[c.status]}</Badge>
                            {c.status === "active" && (
                              <button onClick={() => setLost(c)} className="rounded-full px-2.5 py-1 text-[0.75rem] font-semibold text-coral ring-1 ring-coral/30">
                                Perdue
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {pack.every((c) => c.status === "reservee") && <p className="mt-3 text-[0.88rem] text-mist">Elles sont réservées à votre nom et vous seront envoyées le moment venu, pendant le délai de vérification. Rangées des années, des cartes se perdent : elles ne partent qu&apos;à ce moment-là.</p>}
                    {toShip.length > 0 && <ShipTo personId={x.personId} address={toShip[0].shipTo} />}
                    <div className="mt-3 grid gap-2">
                      {toActivate.length > 0 &&
                        (ready ? (
                          <Button full onClick={() => setMode({ kind: "holder", cards: toActivate, who: x.ownerName, phone: phone! })}>
                            Activer mes cartes
                          </Button>
                        ) : (
                          <Notice tone="gold">Vos cartes s&apos;activent depuis le téléphone où votre accès est validé.</Notice>
                        ))}
                      {pack.some((c) => c.status === "active") && (
                        <Button full variant="gold" href="/coffre" icon={<Lock className="h-5 w-5" />}>
                          Ouvrir avec ma carte
                        </Button>
                      )}
                      <Button full variant="ghost" href="/beneficiaire" icon={<FileUp className="h-5 w-5" />}>
                        {first} est décédé(e) : déposer l&apos;acte
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

      <Sheet open={!!asking} onClose={() => setAsking(null)} title="Mon accès">
        {asking && <AccessRequest personId={asking.personId} ownerName={asking.ownerName} onDone={() => setAsking(null)} />}
      </Sheet>

      <Sheet open={!!declaring} onClose={() => setDeclaring(null)} title="Votre signalement">
        {declaring && <Declare ownerName={declaring.ownerName} onDeclare={async (kind, note) => (await declareAsGuarantor(declaring.ownerId, kind, "", note)) && setDeclaring(null)} />}
      </Sheet>

      <Sheet open={!!lost} onClose={() => setLost(null)} title="Désactiver cette carte ?">
        <p className="text-ink-soft">Elle ne pourra plus rien ouvrir, même avec le code. Votre autre carte et votre téléphone continuent de fonctionner.</p>
        <Button className="mt-6" variant="danger" full onClick={async () => lost && (await declareLost(lost)) && setLost(null)}>
          Désactiver la carte
        </Button>
      </Sheet>
    </div>
  );
}

// After a confirmed death: where to send the cards. The address only serves this shipment.
function ShipTo({ personId, address }: { personId: string; address?: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  if (address)
    return (
      <p className="mt-3 flex items-start gap-2 text-[0.9rem] text-ink-soft">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" /> Envoi en préparation, à : {address.replace(/\n/g, ", ")}
      </p>
    );
  return (
    <div className="mt-4 space-y-3">
      <Notice tone="gold">Vos cartes partent dès que vous indiquez votre adresse. Elle ne sert qu&apos;à cet envoi : elle est effacée dès le départ des cartes.</Notice>
      <Field label="Adresse postale" multiline value={value} onChange={setValue} placeholder={"12 rue des Lilas\n75011 Paris"} />
      <Button
        full
        variant="gold"
        disabled={busy || value.trim().length < 6}
        icon={<Truck className="h-5 w-5" />}
        onClick={async () => {
          setBusy(true);
          await setPackAddress(personId, value);
          setBusy(false);
        }}
      >
        Recevoir mes cartes à cette adresse
      </Button>
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
