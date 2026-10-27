"use client";
import { motion } from "motion/react";
import { CircleAlert, Gift, Plus, RefreshCw, Truck } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Activation, PACK_WARNING, type ActivationMode } from "@/components/activation";
import { Badge, Button, Card, Field, Notice, PageTitle, Sheet } from "@/components/ui";
import { NfcCard } from "@/components/visuals";
import { declareLost, orderOwnerCards, orderPack, orderReplacement, saveAccount } from "@/lib/api";
import { OFFER } from "@/lib/config";
import { PROD } from "@/lib/env";
import { isNative } from "@/lib/native";
import { ownerCards, packOf, personName, useApp, type Card as CardT, type CardStatus } from "@/lib/store";

const STATUS: Record<CardStatus, { label: string; tone: "ink" | "gold" | "sage" | "coral" | "mist" }> = {
  commandee: { label: "En fabrication", tone: "gold" },
  en_route: { label: "En livraison", tone: "gold" },
  recue: { label: "À activer", tone: "coral" },
  active: { label: "Active", tone: "sage" },
  perdue: { label: "Désactivée", tone: "mist" },
};
const NEXT: Partial<Record<CardStatus, CardStatus>> = { commandee: "en_route", en_route: "recue" };
// In production the team marks a card as shipped; it can be activated as soon as it is in hand.
const activatable = (c: CardT) => c.status === "recue" || (PROD && c.status === "en_route");

export default function Cartes() {
  const s = useApp(useShallow((x) => ({ cards: x.cards, people: x.people, account: x.account!, set: x.set })));
  const [mode, setMode] = useState<ActivationMode | null>(null);
  const [assign, setAssign] = useState(false);
  const [lost, setLost] = useState<CardT | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = ownerCards(s);
  const toActivate = mine.filter(activatable);
  const beneficiaries = s.people.filter((p) => s.cards.some((c) => c.holderId === p.id));
  const name = (personId: string) => (personId === "owner" ? `${s.account.firstName} ${s.account.lastName}` : personName(s.people, personId));
  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    return ok;
  };
  // The postal address is erased once the cards are shipped: asked again for the next order.
  const [pending, setPending] = useState<(() => Promise<boolean>) | null>(null);
  const [address, setAddress] = useState("");
  const order = (fn: () => Promise<boolean>) => (s.account.address.trim() ? run(fn) : (setPending(() => fn), Promise.resolve(false)));

  // Demo only: stands in for the delivery of the cards.
  const advance = (cards: CardT[]) => s.set((x) => ({ cards: x.cards.map((y) => (cards.some((c) => c.id === y.id) && NEXT[y.status] ? { ...y, status: NEXT[y.status]! } : y)) }));

  const actions = (c: CardT) => (
    <>
      {c.status === "active" && (
        <button onClick={() => setLost(c)} className="rounded-full px-3 py-1.5 text-[0.8rem] font-semibold text-coral ring-1 ring-coral/30">
          Carte perdue
        </button>
      )}
      {/* A replacement only while the set is short of a card (3 for the owner, 2 in a pack). */}
      {c.status === "perdue" && s.cards.filter((x) => x.holderId === c.holderId && x.status !== "perdue").length < (c.holderId === "owner" ? OFFER.ownerCards : OFFER.packCards) && (
        <button disabled={busy} onClick={() => order(() => orderReplacement(c))} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold ring-1 ring-line">
          <RefreshCw className="h-3.5 w-3.5" /> Remplacer
        </button>
      )}
    </>
  );

  return (
    <div>
      <PageTitle eyebrow="Mes cartes" title="Votre clé, c'est votre carte" lead="Posez-la au dos du téléphone et tapez votre code : votre Coffre s'ouvre. Rien d'autre à retenir." />

      {mine.length === 0 ? (
        <Card className="text-center">
          <div className="relative mx-auto mb-6 h-44 max-w-xs">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="absolute inset-x-6" style={{ top: i * 26 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0, rotate: (i - 1) * 5 }} transition={{ delay: i * 0.12, type: "spring", stiffness: 90, damping: 14 }}>
                <NfcCard name={name("owner")} flipped={i === 1} />
              </motion.div>
            ))}
          </div>
          <h2 className="text-[1.5rem] font-semibold">Vos {OFFER.ownerCards} cartes sont incluses</h2>
          <p className="mx-auto mt-2 max-w-sm text-ink-soft">Elles ouvrent toutes les trois votre Coffre. Si l&apos;une se perd, les deux autres suffisent.</p>
          {s.account.address.trim() && <p className="mt-2 text-[0.9rem] text-mist">Livraison à : {s.account.address.replace(/\n/g, ", ")}</p>}
          <p className="mt-1 text-[0.85rem] text-mist">Votre adresse est effacée dès l&apos;envoi des cartes.</p>
          <Button className="mt-6" variant="gold" full disabled={busy} icon={<Gift className="h-5 w-5" />} onClick={() => order(orderOwnerCards)}>
            Commander mes cartes
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {toActivate.length > 0 && (
            <Notice tone="coral">
              <div className="flex items-center gap-3">
                <CircleAlert className="h-5 w-5 shrink-0 text-coral" />
                <span className="flex-1 font-semibold">{toActivate.length === 1 ? "Une carte est à activer" : `${toActivate.length} cartes sont à activer`}</span>
                <Button className="!min-h-10 !px-4" onClick={() => setMode({ kind: "owner", cards: toActivate, who: "vous" })}>
                  Activer
                </Button>
              </div>
            </Notice>
          )}
          <p className="text-center text-[0.88rem] text-mist">Touchez une carte pour la retourner.</p>
          {mine.map((c) => (
            <motion.div key={c.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <NfcCard name={c.printedName} dim={c.status === "perdue"} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Ma carte</span>
                <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                <span className="flex-1" />
                {!PROD && NEXT[c.status] && (
                  <button onClick={() => advance([c])} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold text-mist ring-1 ring-line">
                    <Truck className="h-4 w-4" /> Démo : livrer
                  </button>
                )}
                {actions(c)}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-[1.5rem] font-semibold">Les cartes de vos bénéficiaires</h2>
        <p className="mt-1 text-ink-soft">Chaque bénéficiaire reçoit obligatoirement un pack de {OFFER.packCards} cartes, à son nom. Elles n&apos;ouvrent que ce que vous lui attribuez, au moment que vous avez choisi.</p>
        <div className="mt-5 space-y-5">
          {beneficiaries.map((p) => {
            const all = s.cards.filter((c) => c.holderId === p.id);
            const received = all.filter(activatable);
            const shipping = all.filter((c) => NEXT[c.status]);
            const activeCount = packOf(s, p.id).filter((c) => c.status === "active").length;
            return (
              <Card key={p.id} layout className="!p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-[0.85rem] text-mist">
                      Pack de {OFFER.packCards} cartes · {activeCount} active{activeCount > 1 ? "s" : ""}
                    </div>
                  </div>
                  {received.length > 0 && (
                    <Button className="!min-h-10 !px-4 !text-[0.9rem]" onClick={() => setMode({ kind: "holder", cards: received, who: `${p.firstName} ${p.lastName}` })}>
                      Activer
                    </Button>
                  )}
                  {!PROD && shipping.length > 0 && (
                    <button onClick={() => advance(shipping)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold text-mist ring-1 ring-line">
                      <Truck className="h-4 w-4" /> Démo : livrer
                    </button>
                  )}
                </div>
                {PROD && received.length > 0 && <p className="mt-2 text-[0.85rem] text-mist">{p.firstName} peut aussi activer ses cartes depuis son propre compte, avec l&apos;adresse {p.email || "indiquée dans Famille"}.</p>}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {all.map((c) => (
                    <div key={c.id} className="space-y-1.5">
                      <NfcCard name={c.printedName} flipped dim={c.status === "perdue"} />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                        {actions(c)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
        <Button className="mt-5" variant="outline" full icon={<Plus className="h-5 w-5" />} onClick={() => setAssign(true)} disabled={s.people.every((p) => beneficiaries.includes(p))}>
          Désigner un bénéficiaire
        </Button>
        {s.people.length === 0 && <p className="mt-2 text-center text-[0.88rem] text-mist">Ajoutez d&apos;abord vos proches dans « Famille ».</p>}
        <p className="mt-3 text-center text-[0.85rem] text-mist">Tous les 6 mois, nous demandons à chaque bénéficiaire si ses cartes sont toujours là.</p>
      </div>

      <Sheet open={!!mode} onClose={() => setMode(null)} title={mode?.kind === "holder" ? "Activer le pack" : "Activer vos cartes"}>
        {mode && <Activation mode={mode} onClose={() => setMode(null)} />}
      </Sheet>

      <Sheet open={assign} onClose={() => setAssign(false)} title="Un pack de 2 cartes pour qui ?">
        <p className="mb-4 text-ink-soft">
          {/* No price in the apps (store rules). */}
          {!isNative() && <>Pack bénéficiaire : {OFFER.packPrice ? `${OFFER.packPrice} €` : "inclus ou payant, à décider"}. </>}
          {PACK_WARNING}
        </p>
        <div className="space-y-2.5">
          {s.people
            .filter((p) => !beneficiaries.includes(p))
            .map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={async () => {
                  if (await order(() => orderPack(p.id))) setAssign(false);
                  else if (!s.account.address.trim()) setAssign(false);
                }}
                className="flex w-full items-center justify-between rounded-2xl bg-paper p-4 text-left ring-1 ring-line hover:ring-ink/30"
              >
                <span>
                  <span className="block font-semibold">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="text-[0.88rem] text-mist">{p.relation}</span>
                </span>
                <Plus className="h-5 w-5" />
              </button>
            ))}
        </div>
      </Sheet>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Où livrer les cartes ?">
        <p className="mb-4 text-ink-soft">Votre adresse ne sert qu&apos;à l&apos;envoi : elle est effacée dès que les cartes sont parties.</p>
        <Field label="Adresse postale" multiline value={address} onChange={setAddress} placeholder={"12 rue des Lilas\n75011 Paris"} />
        <Button
          className="mt-5"
          variant="gold"
          full
          disabled={busy || address.trim().length < 6}
          icon={<Truck className="h-5 w-5" />}
          onClick={async () => {
            const fn = pending!;
            if (!(await run(() => saveAccount({ ...s.account, address: address.trim() })))) return;
            setPending(null);
            await run(fn);
          }}
        >
          Commander
        </Button>
      </Sheet>

      <Sheet open={!!lost} onClose={() => setLost(null)} title="Désactiver cette carte ?">
        <p className="text-ink-soft">
          Elle ne pourra plus rien ouvrir, même avec le code.{" "}
          {lost?.holderId === "owner" ? "Vos autres cartes continuent de fonctionner." : "L'autre carte du pack continue de fonctionner, et une carte de remplacement peut être appairée."}
        </p>
        {lost?.holderId === "owner" && mine.filter((c) => c.status === "active").length < 2 && <p className="mt-3 font-semibold text-coral">C&apos;est votre dernière carte active : commandez-en une autre avant de la désactiver.</p>}
        <Button
          className="mt-6"
          variant="danger"
          full
          disabled={busy || (lost?.holderId === "owner" && mine.filter((c) => c.status === "active").length < 2)}
          onClick={async () => {
            if (lost && (await run(() => declareLost(lost)))) setLost(null);
          }}
        >
          Désactiver la carte
        </Button>
      </Sheet>
    </div>
  );
}
