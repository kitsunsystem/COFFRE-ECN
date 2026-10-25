"use client";
// Opening with a card, the same way everywhere: tap the card (demo: pick it on screen), then the code if the card needs one.
// FIDO2 cards ask for their own PIN in the browser's window, so no code screen follows.
import { Nfc } from "lucide-react";
import { useState } from "react";
import { activeTrustCards } from "@/lib/api";
import { driver, needsPin, read, type Tap } from "@/lib/cards";
import { PROD } from "@/lib/env";
import { useApp, type Card } from "@/lib/store";
import { unlock } from "@/lib/vault";
import { PinPad } from "./pinpad";
import { Button } from "./ui";
import { NfcCard, TapReader, type TapState } from "./visuals";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Every card that may open a Coffre on this device: demo, all the local ones; production, my own and the packs I hold.
export function openableCards(): Card[] {
  const st = useApp.getState();
  const own = st.cards.filter((c) => c.status === "active" && (PROD ? c.holderId === "owner" : true));
  return PROD ? [...own, ...activeTrustCards()] : own;
}

type Opened = (mode: "owner" | "holder", pin?: string) => void | Promise<void>;

export function useCardOpen(candidates: Card[], onOpened: Opened) {
  const demo = driver() === "demo";
  const [tap, setTap] = useState<Tap | null>(null);
  const [reading, setReading] = useState<TapState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [opening, setOpening] = useState(false);

  async function finish(t: Tap, pin?: string) {
    setError(null);
    setOpening(true);
    try {
      await onOpened(await unlock(t, pin), pin);
    } catch (e) {
      setOpening(false);
      setError((e as Error).message);
      if (!pin) {
        setTap(null);
        setReading("error");
        setTimeout(() => setReading("idle"), 900);
      }
    }
  }

  async function start(picked?: Card) {
    if (demo && !picked) return setPicking(true);
    setPicking(false);
    setError(null);
    setReading("reading");
    try {
      // The demo waits a moment so the reading animation is visible; a real card takes that long anyway.
      const [t] = await Promise.all([read(candidates, picked), demo ? sleep(1000) : null]);
      setReading("done");
      if (needsPin(t.card.kind)) setTap(t);
      else await finish(t);
    } catch (e) {
      setReading("error");
      setError((e as Error).message);
      setTimeout(() => setReading("idle"), 900);
    }
  }

  const reset = () => {
    setTap(null);
    setReading("idle");
    setError(null);
  };
  return { demo, tap, reading, error, picking, setPicking, opening, start, submitPin: (pin: string) => finish(tap!, pin), reset };
}

// Ready-made block (light or dark): used to prove who you are (cancel a procedure) or to open before adding a card.
export function CardUnlock({ candidates, onOpened, dark, intro }: { candidates: Card[]; onOpened: Opened; dark?: boolean; intro?: string }) {
  const f = useCardOpen(candidates, onOpened);
  if (!candidates.length) return <p className={dark ? "text-paper/70" : "text-ink-soft"}>Aucune carte active.</p>;
  if (f.tap)
    return (
      <div>
        <p className={`mb-5 text-center ${dark ? "text-paper/70" : "text-ink-soft"}`}>Carte reconnue. Tapez votre code.</p>
        <PinPad dark={dark} error={f.error} label="Votre code" onComplete={f.submitPin} />
      </div>
    );
  return (
    <div className="text-center">
      {intro && <p className={dark ? "text-paper/70" : "text-ink-soft"}>{intro}</p>}
      <TapReader state={f.reading} light={dark} />
      {f.error && <p className={`mb-3 font-semibold ${dark ? "text-coral-soft" : "text-coral"}`}>{f.error}</p>}
      {f.picking ? (
        <div className="grid grid-cols-2 gap-3 text-left">
          {candidates.map((c) => (
            <button key={c.id} type="button" onClick={() => f.start(c)}>
              <NfcCard name={c.printedName} flipped interactive={false} />
              <span className={`mt-1.5 block text-[0.85rem] font-semibold ${dark ? "text-paper/75" : "text-ink-soft"}`}>{c.holderId === "owner" ? "Ma carte" : `Carte de ${c.printedName.split(" ")[0]}`}</span>
            </button>
          ))}
        </div>
      ) : (
        <Button full variant="gold" icon={<Nfc className="h-5 w-5" />} disabled={f.reading === "reading" || f.opening} onClick={() => f.start()}>
          {f.reading === "reading" ? "Lecture de la carte…" : f.demo ? "Démo : choisir la carte posée" : "Poser ma carte"}
        </Button>
      )}
    </div>
  );
}
