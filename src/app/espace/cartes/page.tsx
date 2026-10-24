"use client";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, Gift, Nfc, Plus, RefreshCw, Truck } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { PinPad } from "@/components/pinpad";
import { Badge, Button, Card, Notice, PageTitle, Sheet } from "@/components/ui";
import { NfcCard, TapReader, type TapState } from "@/components/visuals";
import { OFFER } from "@/lib/config";
import { now, ownerCards, packOf, personName, uid, useApp, useSession, type Card as CardT, type CardStatus } from "@/lib/store";
import { activateHolderCard, activateOwnerCard, unlock } from "@/lib/vault";

const STATUS: Record<CardStatus, { label: string; tone: "ink" | "gold" | "sage" | "coral" | "mist" }> = {
  commandee: { label: "En fabrication", tone: "gold" },
  en_route: { label: "En livraison", tone: "gold" },
  recue: { label: "À activer", tone: "coral" },
  active: { label: "Active", tone: "sage" },
  perdue: { label: "Désactivée", tone: "mist" },
};
const NEXT: Partial<Record<CardStatus, CardStatus>> = { commandee: "en_route", en_route: "recue" };
const PACK_WARNING = "Rangez les 2 cartes dans deux endroits différents. Tant que le titulaire est en vie, une carte perdue se remplace. Après son décès, perdre les deux cartes fait perdre l'accès définitivement.";

type Mode = { kind: "owner" | "holder"; cards: CardT[] };

function Activation({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const [phase, setPhase] = useState<"code" | "confirm" | "open" | "tap" | "done">("code");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tap, setTap] = useState<TapState>("idle");
  const [i, setI] = useState(0);
  const st = useApp.getState();
  const existing = ownerCards(st).find((c) => c.status === "active");
  const needOpen = mode.kind === "owner" && !!existing && useSession.getState().session.mode !== "owner";
  const list = mode.cards;
  const current = list[i];

  async function doTap() {
    setTap("reading");
    try {
      // shortcut: the demo reads a simulated chip; the Tangem SDK reads the real card via NFC in the app.
      if (phase === "open") {
        await unlock(existing!.id, pin);
        setTap("done");
        setTimeout(() => { setTap("idle"); setPhase("tap"); }, 900);
        return;
      }
      if (mode.kind === "owner") await activateOwnerCard(current.id, pin);
      else await activateHolderCard(current.id, pin);
      setTap("done");
      setTimeout(() => {
        setTap("idle");
        if (i + 1 < list.length) setI(i + 1);
        else setPhase("done");
      }, 1000);
    } catch (e) {
      setTap("error");
      setError((e as Error).message);
      setTimeout(() => setTap("idle"), 900);
    }
  }

  const who = mode.kind === "holder" ? personName(st.people, list[0].holderId) : "vous";
  return (
    <div>
      <AnimatePresence mode="wait">
        {(phase === "code" || phase === "confirm") && (
          <motion.div key={phase} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <p className="mb-6 text-center text-ink-soft">
              {needOpen ? "Tapez votre code habituel." : phase === "code" ? `Choisissez un code à 6 chiffres pour ${who}. Il sera demandé avec chaque carte.` : "Tapez-le une seconde fois."}
            </p>
            <PinPad
              key={phase}
              error={error}
              label={phase === "code" ? (needOpen ? "Votre code" : "Nouveau code") : "Confirmez le code"}
              onComplete={(p) => {
                setError(null);
                if (needOpen) {
                  setPin(p);
                  setPhase("open");
                } else if (phase === "code") {
                  setPin(p);
                  setPhase("confirm");
                } else if (p !== pin) {
                  setError("Les deux codes ne correspondent pas.");
                  setPhase("code");
                } else setPhase("tap");
              }}
            />
          </motion.div>
        )}
        {(phase === "tap" || phase === "open") && (
          <motion.div key={`tap${i}${phase}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="text-center">
            <div className="text-[1.15rem] font-semibold">
              {phase === "open" ? "Posez une carte déjà active" : list.length > 1 ? `Posez la carte ${i + 1} sur ${list.length}` : "Posez la carte au dos du téléphone"}
            </div>
            <p className="mt-1 text-[0.92rem] text-mist">{phase === "open" ? "Pour ouvrir votre Coffre avant d'ajouter la nouvelle carte." : "La carte crée son secret dans sa puce. Il n'en sortira jamais."}</p>
            <TapReader state={tap} />
            {error && <p className="mb-3 font-semibold text-coral">{error}</p>}
            <Button full icon={<Nfc className="h-5 w-5" />} onClick={doTap} disabled={tap === "reading"}>
              {tap === "reading" ? "Lecture de la carte…" : "J'ai posé la carte"}
            </Button>
          </motion.div>
        )}
        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <TapReader state="done" />
            <div className="text-[1.3rem] font-semibold">{list.length > 1 ? "Les cartes sont actives" : "La carte est active"}</div>
            <p className="mt-2 text-ink-soft">{mode.kind === "owner" ? "Chacune ouvre votre Coffre, avec votre code." : `${who} pourra ouvrir ce que vous lui attribuez, avec l'une ou l'autre carte.`}</p>
            {mode.kind === "holder" && (
              <div className="mt-4 text-left">
                <Notice tone="coral">{PACK_WARNING}</Notice>
              </div>
            )}
            <Button full className="mt-6" variant="gold" onClick={onClose}>
              Terminer
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Cartes() {
  const s = useApp(useShallow((x) => ({ cards: x.cards, people: x.people, account: x.account!, set: x.set, email: x.email })));
  const [mode, setMode] = useState<Mode | null>(null);
  const [assign, setAssign] = useState(false);
  const [lost, setLost] = useState<CardT | null>(null);
  const mine = ownerCards(s);
  const toActivate = mine.filter((c) => c.status === "recue");
  const beneficiaries = s.people.filter((p) => s.cards.some((c) => c.holderId === p.id));
  const name = (personId: string) => (personId === "owner" ? `${s.account.firstName} ${s.account.lastName}` : personName(s.people, personId));
  const newCard = (holderId: string): CardT => ({ id: uid(), holderId, printedName: name(holderId), status: "commandee", orderedAt: now(), extra: holderId !== "owner" });

  function order() {
    s.set({ cards: [...s.cards, ...Array.from({ length: OFFER.ownerCards }, () => newCard("owner"))] });
    s.email(s.account.email, "cartes-commandees", { count: String(OFFER.ownerCards) });
  }

  function orderPack(personId: string) {
    const p = s.people.find((x) => x.id === personId)!;
    s.set((x) => ({ cards: [...x.cards, ...Array.from({ length: OFFER.packCards }, () => newCard(personId))] }));
    s.email(p.email ?? name(personId), "invitation-porteur", { ownerName: name("owner") });
    setAssign(false);
  }

  const advance = (cards: CardT[]) => s.set((x) => ({ cards: x.cards.map((y) => (cards.some((c) => c.id === y.id) && NEXT[y.status] ? { ...y, status: NEXT[y.status]! } : y)) }));

  // The card stops opening anything; rights stay with the person, so a replacement card gets them back.
  function declareLost(c: CardT) {
    s.set((x) => ({
      cards: x.cards.map((y) => (y.id === c.id ? { ...y, status: "perdue", wrappedVmk: undefined, boxPk: undefined } : y)),
      vault: { ...x.vault, envelopes: x.vault.envelopes.filter((e) => e.cardId !== c.id) },
    }));
    setLost(null);
  }

  const actions = (c: CardT) => (
    <>
      {c.status === "active" && (
        <button onClick={() => setLost(c)} className="rounded-full px-3 py-1.5 text-[0.8rem] font-semibold text-coral ring-1 ring-coral/30">
          Carte perdue
        </button>
      )}
      {c.status === "perdue" && (
        <button onClick={() => s.set((x) => ({ cards: [...x.cards, newCard(c.holderId)] }))} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold ring-1 ring-line">
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
          <p className="mt-2 text-[0.9rem] text-mist">Livraison à : {s.account.address.replace(/\n/g, ", ")}</p>
          <Button className="mt-6" variant="gold" full icon={<Gift className="h-5 w-5" />} onClick={order}>
            Commander mes cartes
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {toActivate.length > 0 && (
            <Notice tone="coral">
              <div className="flex items-center gap-3">
                <CircleAlert className="h-5 w-5 shrink-0 text-coral" />
                <span className="flex-1 font-semibold">{toActivate.length === 1 ? "Une carte est arrivée" : `${toActivate.length} cartes sont arrivées`}</span>
                <Button className="!min-h-10 !px-4" onClick={() => setMode({ kind: "owner", cards: toActivate })}>
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
                {NEXT[c.status] && (
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
            const received = all.filter((c) => c.status === "recue");
            const shipping = all.filter((c) => NEXT[c.status]);
            return (
              <Card key={p.id} layout className="!p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-[0.85rem] text-mist">
                      Pack de {OFFER.packCards} cartes · {packOf(s, p.id).filter((c) => c.status === "active").length} active{packOf(s, p.id).filter((c) => c.status === "active").length > 1 ? "s" : ""}
                    </div>
                  </div>
                  {received.length > 0 && (
                    <Button className="!min-h-10 !px-4 !text-[0.9rem]" onClick={() => setMode({ kind: "holder", cards: received })}>
                      Activer
                    </Button>
                  )}
                  {shipping.length > 0 && (
                    <button onClick={() => advance(shipping)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold text-mist ring-1 ring-line">
                      <Truck className="h-4 w-4" /> Démo : livrer
                    </button>
                  )}
                </div>
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
          Pack bénéficiaire : {OFFER.packPrice ? `${OFFER.packPrice} €` : "inclus ou payant, à décider"}. {PACK_WARNING}
        </p>
        <div className="space-y-2.5">
          {s.people
            .filter((p) => !beneficiaries.includes(p))
            .map((p) => (
              <button key={p.id} onClick={() => orderPack(p.id)} className="flex w-full items-center justify-between rounded-2xl bg-paper p-4 text-left ring-1 ring-line hover:ring-ink/30">
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

      <Sheet open={!!lost} onClose={() => setLost(null)} title="Désactiver cette carte ?">
        <p className="text-ink-soft">
          Elle ne pourra plus rien ouvrir, même avec le code.{" "}
          {lost?.holderId === "owner" ? "Vos autres cartes continuent de fonctionner." : "L'autre carte du pack continue de fonctionner, et une carte de remplacement peut être appairée."}
        </p>
        {lost?.holderId === "owner" && mine.filter((c) => c.status === "active").length < 2 && <p className="mt-3 font-semibold text-coral">C&apos;est votre dernière carte active : commandez-en une autre avant de la désactiver.</p>}
        <Button className="mt-6" variant="danger" full disabled={lost?.holderId === "owner" && mine.filter((c) => c.status === "active").length < 2} onClick={() => lost && declareLost(lost)}>
          Désactiver la carte
        </Button>
      </Sheet>
    </div>
  );
}
