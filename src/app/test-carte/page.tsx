"use client";
// Card diagnostic, before ordering cards in volume: tells in one minute whether a card can open a Coffre.
import { motion } from "motion/react";
import { CircleCheck, CircleX, Nfc } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { Aurora, Logo } from "@/components/visuals";
import { testCard } from "@/lib/cards";
import { isNative } from "@/lib/native";

type Result = Awaited<ReturnType<typeof testCard>>;
const still = () => () => {};

export default function TestCarte() {
  // The static page is built as the website; the app finds out it is the app once loaded.
  const app = useSyncExternalStore(still, isNative, () => false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setResult(null);
    setError(null);
    try {
      setResult(await testCard(setStep));
    } catch (e) {
      setError((e as Error).message);
    }
    setStep(0);
  }

  const ok = result?.valid && result.deterministic;
  const line = (good: boolean, text: string) => (
    <li className="flex items-center gap-3">
      {good ? <CircleCheck className="h-6 w-6 shrink-0 text-sage-soft" /> : <CircleX className="h-6 w-6 shrink-0 text-coral-soft" />}
      <span>{text}</span>
    </li>
  );

  return (
    <div className="grain relative grid min-h-dvh overflow-hidden bg-night text-paper">
      <Aurora dark className="opacity-80" />
      <div className="relative mx-auto flex w-full max-w-md flex-col px-6 pb-10 pt-5">
        <Logo light />
        <div className="flex flex-1 flex-col justify-center py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 ring-1 ring-gold/40">
            <Nfc className="h-8 w-8 text-gold-soft" />
          </div>
          <h1 className="mt-5 text-[1.9rem] font-semibold leading-tight">Test de carte</h1>
          {!app ? (
            <p className="mx-auto mt-2 max-w-xs text-paper/70">Disponible dans l&apos;application iPhone et Android : la carte se lit en NFC.</p>
          ) : (
            <>
              <p className="mx-auto mt-2 max-w-xs text-paper/70">Vérifie qu&apos;une carte peut ouvrir un Coffre. Posez-la trois fois au dos du téléphone, quand c&apos;est demandé.</p>
              {step > 0 && <p className="mt-6 font-semibold text-gold-soft">Contact {step} sur 3…</p>}
              {result && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-[1.6rem] bg-paper/5 p-5 text-left ring-1 ring-paper/10">
                  <ul className="space-y-3">
                    {line(true, `Carte lue (${result.cardId.slice(-4)})`)}
                    {line(result.valid, result.valid ? "Signature Ed25519 valide" : "Signature invalide")}
                    {line(result.deterministic, result.deterministic ? "Même signature à chaque fois" : "Signature différente à chaque fois")}
                  </ul>
                  <p className={`mt-4 font-semibold ${ok ? "text-sage-soft" : "text-coral-soft"}`}>{ok ? "Cette carte convient pour ouvrir un Coffre." : "Cette carte ne convient pas : aucune clé ne peut en être tirée."}</p>
                </motion.div>
              )}
              {error && <p className="mt-6 font-semibold text-coral-soft">{error}</p>}
              <Button className="mt-8" full variant="gold" icon={<Nfc className="h-5 w-5" />} disabled={step > 0} onClick={run}>
                {result || error ? "Recommencer le test" : "Lancer le test"}
              </Button>
            </>
          )}
        </div>
        <Link href="/connexion" className="text-center text-[0.9rem] font-semibold text-paper/60">
          Retour
        </Link>
      </div>
    </div>
  );
}
