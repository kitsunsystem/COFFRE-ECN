"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Nfc, ScanFace, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PinPad } from "@/components/pinpad";
import { useHydrated } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Button, Sheet } from "@/components/ui";
import { Aurora, Logo, NfcCard, TapReader, VaultReveal, type TapState } from "@/components/visuals";
import { personName, useApp, useSession, type Card } from "@/lib/store";
import { unlock } from "@/lib/vault";

export default function Verrou() {
  const hydrated = useHydrated();
  const cards = useApp((s) => s.cards);
  const people = useApp((s) => s.people);
  const account = useApp((s) => s.account);
  const session = useSession((s) => s.session);
  const router = useRouter();
  const [picker, setPicker] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [tap, setTap] = useState<TapState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [faceId, setFaceId] = useState(false);
  const [opening, setOpening] = useState(false);
  const active = cards.filter((c) => c.status === "active");

  useEffect(() => {
    if (session.mode !== "locked" && !opening) router.replace("/coffre/rubriques");
  }, [session.mode, opening, router]);

  if (!hydrated) return <Loader dark />;

  function choose(c: Card) {
    setPicker(false);
    setTap("reading");
    // shortcut: the tap is simulated; in the iOS/Android app the Tangem SDK reads the card over NFC.
    setTimeout(() => {
      setCard(c);
      setTap("done");
    }, 1100);
  }

  return (
    <div className="grain relative grid min-h-dvh overflow-hidden bg-night text-paper">
      <Aurora dark className="opacity-80" />
      <div className="relative mx-auto flex w-full max-w-md flex-col px-6 pb-10 pt-5">
        <div className="flex items-center justify-between">
          <Link href={account ? "/espace" : "/"} className="flex items-center gap-2 rounded-full px-3 py-2 text-[0.92rem] font-semibold text-paper/75 hover:bg-paper/10">
            <ArrowLeft className="h-4 w-4" /> {account ? "Espace" : "Accueil"}
          </Link>
          <Logo light />
        </div>

        <AnimatePresence mode="wait">
          {!card ? (
            <motion.div key="tap" className="flex flex-1 flex-col items-center justify-center text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-2 flex items-center gap-2 rounded-full bg-sage/15 px-3 py-1 text-[0.78rem] font-bold text-sage-soft">
                <ShieldCheck className="h-4 w-4" /> Chiffré sur ce téléphone
              </motion.div>
              <h1 className="text-[2.2rem] font-semibold leading-tight">Le Coffre</h1>
              <p className="mt-2 max-w-xs text-paper/70">Posez votre carte au dos du téléphone. Elle seule peut l'ouvrir, avec votre code.</p>
              <TapReader state={tap} light />
              {active.length === 0 ? (
                <div className="w-full space-y-3">
                  <p className="text-paper/70">Aucune carte n'est encore active.</p>
                  <Button full variant="gold" href={account ? "/espace/cartes" : "/connexion"}>
                    {account ? "Activer mes cartes" : "Se connecter"}
                  </Button>
                </div>
              ) : (
                <Button full variant="gold" icon={<Nfc className="h-5 w-5" />} disabled={tap === "reading"} onClick={() => setPicker(true)}>
                  {tap === "reading" ? "Lecture de la carte…" : "Poser ma carte"}
                </Button>
              )}
              <Link href="/beneficiaire" className="mt-4 text-[0.9rem] font-semibold text-paper/70 underline">
                Un proche est décédé ? Espace bénéficiaire
              </Link>
            </motion.div>
          ) : (
            <motion.div key="code" className="flex flex-1 flex-col justify-center pt-6" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="mx-auto mb-6 w-56">
                <NfcCard name={card.printedName} flipped interactive={false} />
              </div>
              <p className="mb-5 text-center text-paper/70">{card.holderId === "owner" ? "Carte reconnue. Tapez votre code." : `Carte de ${personName(people, card.holderId)}. Tapez votre code.`}</p>
              <PinPad
                dark
                error={error}
                onComplete={async (pin) => {
                  setError(null);
                  try {
                    setOpening(true);
                    await unlock(card.id, pin);
                  } catch (e) {
                    setOpening(false);
                    setError((e as Error).message);
                  }
                }}
              />
              <div className="mt-4 flex justify-center gap-3">
                <button onClick={() => setFaceId(true)} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.92rem] font-semibold text-paper/75 ring-1 ring-paper/15">
                  <ScanFace className="h-5 w-5" /> Face ID
                </button>
                <button onClick={() => { setCard(null); setTap("idle"); setError(null); }} className="rounded-full px-4 py-2.5 text-[0.92rem] font-semibold text-paper/75 ring-1 ring-paper/15">
                  Autre carte
                </button>
              </div>
              {faceId && <p className="mt-4 text-center text-[0.88rem] text-paper/60">Dans l'application iPhone et Android, Face ID ou votre empreinte remplacent le code, toujours avec la carte.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Démo : quelle carte posez-vous ?" dark>
        <div className="grid grid-cols-2 gap-3">
          {active.map((c) => (
            <button key={c.id} onClick={() => choose(c)} className="text-left">
              <NfcCard name={c.printedName} flipped interactive={false} />
              <span className="mt-1.5 block text-[0.85rem] font-semibold text-paper/75">{c.holderId === "owner" ? "Ma carte" : `Carte de ${personName(people, c.holderId).split(" ")[0]}`}</span>
            </button>
          ))}
        </div>
      </Sheet>

      {opening && session.mode !== "locked" && <VaultReveal onDone={() => router.replace("/coffre/rubriques")} />}
    </div>
  );
}
