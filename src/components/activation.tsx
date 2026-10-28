"use client";
// Activating cards: the owner's own, or a beneficiary's pack, received after the death (from their approved phone).
import { AnimatePresence, motion } from "motion/react";
import { Nfc } from "lucide-react";
import { useState } from "react";
import { driver, enroll, needsPin } from "@/lib/cards";
import { ownerCards, useApp, useSession, type Card, type HolderSession } from "@/lib/store";
import { activateOwnerCard, activatePackCard } from "@/lib/vault";
import { AccessUnlock } from "./access";
import { CardUnlock } from "./card-flow";
import { PinPad } from "./pinpad";
import { Button, Notice } from "./ui";
import { TapReader, type TapState } from "./visuals";

export const PACK_INFO = "Les 2 cartes sont réservées à son nom et lui sont envoyées à votre décès, pendant le délai de vérification. D'ici là, il ou elle ouvre ce que vous lui confiez depuis son téléphone, avec Face ID et son code, une fois sa demande acceptée.";

// holder: the beneficiary's own cards, activated with their approved phone (`phone`), whose key each card keeps.
export type ActivationMode = { kind: "owner"; cards: Card[]; who: string } | { kind: "holder"; cards: Card[]; who: string; phone: Card };

export function Activation({ mode, onClose }: { mode: ActivationMode; onClose: () => void }) {
  const newKind = driver();
  const pinNeeded = needsPin(newKind);
  const st = useApp.getState();
  const openers = ownerCards(st).filter((c) => c.status === "active");
  const needOpen = mode.kind === "owner" && openers.length > 0 && useSession.getState().session.mode !== "owner";
  const [phase, setPhase] = useState<"open" | "phone" | "code" | "confirm" | "tap" | "done">(mode.kind === "holder" ? "phone" : needOpen ? "open" : pinNeeded ? "code" : "tap");
  const [pin, setPin] = useState("");
  const [phoneKeys, setPhoneKeys] = useState<HolderSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tap, setTap] = useState<TapState>("idle");
  const [i, setI] = useState(0);
  const list = mode.cards;
  const current = list[i];

  async function doTap() {
    setTap("reading");
    setError(null);
    try {
      const enrolled = await enroll(current);
      if (mode.kind === "owner") await activateOwnerCard(current, enrolled, pinNeeded ? pin : undefined);
      else await activatePackCard(current, enrolled, pinNeeded ? pin : undefined, phoneKeys!);
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

  return (
    <div>
      <AnimatePresence mode="wait">
        {phase === "open" && (
          <motion.div key="open" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <CardUnlock
              candidates={openers}
              intro="Ouvrez d'abord votre Coffre avec une carte déjà active."
              onOpened={(_m, typed) => {
                if (typed) setPin(typed);
                setPhase(pinNeeded && !typed ? "code" : "tap");
              }}
            />
          </motion.div>
        )}
        {phase === "phone" && mode.kind === "holder" && (
          <motion.div key="phone" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <AccessUnlock
              candidates={[{ personId: mode.phone.holderId, phone: mode.phone, label: mode.who }]}
              intro="Confirmez d'abord votre accès : chaque carte gardera la clé de votre téléphone, protégée par votre code."
              onKeys={(keys, typed) => {
                setPhoneKeys(keys);
                setPin(typed);
                setPhase("tap");
              }}
            />
          </motion.div>
        )}
        {(phase === "code" || phase === "confirm") && (
          <motion.div key={phase} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <p className="mb-6 text-center text-ink-soft">{phase === "code" ? `Choisissez un code à 6 chiffres pour ${mode.who}. Il sera demandé avec chaque carte.` : "Tapez-le une seconde fois."}</p>
            <PinPad
              key={phase}
              error={error}
              label={phase === "code" ? "Nouveau code" : "Confirmez le code"}
              onComplete={(p) => {
                setError(null);
                if (phase === "code") {
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
        {phase === "tap" && (
          <motion.div key={`tap${i}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="text-center">
            <div className="text-[1.15rem] font-semibold">{list.length > 1 ? `Posez la carte ${i + 1} sur ${list.length}` : "Posez la carte au dos du téléphone"}</div>
            <p className="mt-1 text-[0.92rem] text-mist">
              {newKind === "fido"
                ? "Votre appareil vous demandera de choisir le code de la carte (ou de le taper), puis de la poser une seconde fois."
                : "La carte crée son secret dans sa puce. Il n'en sortira jamais."}
            </p>
            <TapReader state={tap} />
            {error && <p className="mb-3 font-semibold text-coral">{error}</p>}
            <Button full icon={<Nfc className="h-5 w-5" />} onClick={doTap} disabled={tap === "reading"}>
              {tap === "reading" ? "Lecture de la carte…" : newKind === "demo" ? "Démo : j'ai posé la carte" : "Lire la carte"}
            </Button>
          </motion.div>
        )}
        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <TapReader state="done" />
            <div className="text-[1.3rem] font-semibold">{list.length > 1 ? "Les cartes sont actives" : "La carte est active"}</div>
            <p className="mt-2 text-ink-soft">{mode.kind === "owner" ? "Chacune ouvre votre Coffre, avec votre code." : "Chacune ouvre votre part avec votre code, même sans ce téléphone."}</p>
            {mode.kind === "holder" && (
              <div className="mt-4 text-left">
                <Notice tone="coral">Rangez les 2 cartes dans deux endroits différents : si vous perdez ou changez de téléphone, elles seules vous donnent encore accès.</Notice>
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
