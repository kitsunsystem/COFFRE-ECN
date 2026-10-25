"use client";
// The phone answers a computer: the right number among three (only someone looking at the computer knows it), then the
// card with Face ID. The keys are sealed to that computer; nothing opens on the phone. Demo: this page is the simulated phone.
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Monitor, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CardUnlock, openableCards } from "@/components/card-flow";
import { PhoneInbox } from "@/components/phone-open";
import { useHydrated } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Button } from "@/components/ui";
import { Aurora, Logo } from "@/components/visuals";
import { devices } from "@/lib/api";
import { approve } from "@/lib/devices";
import { PROD } from "@/lib/env";
import { isNative } from "@/lib/native";
import { useApp, type DeviceRequest } from "@/lib/store";

const still = () => () => {};

export default function Appareil() {
  const hydrated = useHydrated();
  const me = useApp((s) => s.me);
  const search = useSyncExternalStore(still, () => location.search, () => "");
  const params = new URLSearchParams(search);
  const id = params.get("r");
  const qrKey = params.get("k") ?? undefined;
  const [req, setReq] = useState<DeviceRequest | null | undefined>(undefined);
  const [choice, setChoice] = useState<number | null>(null);
  const [state, setState] = useState<"ask" | "card" | "sending" | "done" | "wrong" | "refused">("ask");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [t, setT] = useState(() => Date.now());

  useEffect(() => {
    if (!hydrated || !id || (PROD && !me)) return;
    devices.get(id).then(setReq, (e: Error) => {
      setReq(null);
      setError(e.message);
    });
    const i = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(i);
  }, [hydrated, id, me]);

  if (!hydrated) return <Loader dark />;
  const expired = !!req && (req.status !== "pending" || req.expiresAt < t) && state !== "done";

  async function refuse() {
    if (req) await devices.refuse(req.id).catch(() => {});
    setState("refused");
  }

  return (
    <div className="grain relative grid min-h-dvh overflow-hidden bg-night text-paper">
      <Aurora dark className="opacity-80" />
      <div className="relative mx-auto flex w-full max-w-md flex-col px-6 pb-10 pt-5">
        <div className="flex items-center justify-between">
          <Logo light />
          {!PROD && <span className="rounded-full bg-gold/15 px-3 py-1 text-[0.75rem] font-bold text-gold-soft">Téléphone (démo)</span>}
        </div>

        <div className="flex flex-1 flex-col justify-center py-8 text-center">
          {PROD && !isNative() ? (
            <Message icon={<Monitor className="h-8 w-8 text-gold-soft" />} title="Répondez depuis l'application">
              Ouvrez l&apos;application sur votre téléphone, puis touchez « Scanner un ordinateur » dans le Coffre.
            </Message>
          ) : PROD && !me ? (
            <Message icon={<Monitor className="h-8 w-8 text-gold-soft" />} title="Connectez-vous d'abord">
              <Button className="mt-6" full variant="gold" href={`/connexion/?suite=${encodeURIComponent(`/appareil/${search}`)}`}>
                Se connecter
              </Button>
            </Message>
          ) : !id ? (
            <>
              <h1 className="text-[1.9rem] font-semibold leading-tight">Vos ordinateurs</h1>
              <p className="mx-auto mt-2 mb-6 max-w-xs text-paper/70">Les demandes d&apos;ouverture de vos ordinateurs de confiance s&apos;affichent ici.</p>
              <PhoneInbox />
            </>
          ) : req === undefined ? (
            <p className="text-paper/60">Un instant…</p>
          ) : !req ? (
            <Message icon={<ShieldAlert className="h-8 w-8 text-coral-soft" />} title="Demande introuvable">
              {error ?? "Elle a peut-être été faite depuis un autre compte."}
            </Message>
          ) : state === "done" ? (
            <Message icon={<CircleCheck className="h-8 w-8 text-sage-soft" />} title="C'est fait">
              {req.kind === "pairing" ? "Cet ordinateur est maintenant un appareil de confiance, et le Coffre s'y ouvre." : "Le Coffre s'ouvre sur l'ordinateur."} Rien n&apos;est resté ouvert sur ce téléphone.
            </Message>
          ) : state === "wrong" ? (
            <Message icon={<ShieldAlert className="h-8 w-8 text-coral-soft" />} title="Ce n'est pas le bon nombre">
              Par sécurité, la demande est annulée. Si elle ne venait pas de vous, changez votre mot de passe dans Compte.
            </Message>
          ) : state === "refused" ? (
            <Message icon={<X className="h-8 w-8 text-coral-soft" />} title="Demande refusée">
              Rien ne s&apos;est ouvert. Si elle ne venait pas de vous, changez votre mot de passe dans Compte.
            </Message>
          ) : expired ? (
            <Message icon={<ShieldAlert className="h-8 w-8 text-gold-soft" />} title="Demande expirée">
              Recommencez depuis l&apos;ordinateur.
            </Message>
          ) : (
            <AnimatePresence mode="wait">
              {state === "ask" ? (
                <motion.div key="ask" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 ring-1 ring-gold/40">
                    <Monitor className="h-8 w-8 text-gold-soft" />
                  </div>
                  <h1 className="mt-5 text-[1.8rem] font-semibold leading-tight">{req.kind === "pairing" ? "Faire confiance à cet ordinateur ?" : "Ouvrir le Coffre sur l'ordinateur ?"}</h1>
                  <p className="mt-2 font-semibold text-paper/85" translate="no">
                    {req.name}
                  </p>
                  <p className="text-[0.88rem] text-paper/55">
                    Demandé à {new Date(req.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {req.kind === "pairing" && (
                    <p className="mx-auto mt-4 max-w-xs rounded-2xl bg-coral/10 p-3 text-[0.88rem] text-paper/80 ring-1 ring-coral/30">N&apos;acceptez que si cet ordinateur est devant vous. Il pourra ensuite demander l&apos;ouverture du Coffre, toujours avec votre accord ici.</p>
                  )}
                  <p className="mt-6 font-semibold">Quel nombre s&apos;affiche sur l&apos;ordinateur ?</p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {req.choices.map((n) => (
                      <motion.button
                        key={n}
                        whileTap={{ scale: 0.92 }}
                        whileHover={{ y: -3 }}
                        onClick={() => {
                          setChoice(n);
                          setState("card");
                        }}
                        className="tile rounded-[1.4rem] bg-night-2 py-5 text-[2.2rem] font-semibold text-gold-soft ring-1 ring-paper/10"
                        translate="no"
                      >
                        {n}
                      </motion.button>
                    ))}
                  </div>
                  <button onClick={refuse} className="mt-6 text-[0.92rem] font-semibold text-coral-soft underline">
                    Ce n&apos;est pas moi : refuser
                  </button>
                </motion.div>
              ) : (
                <motion.div key="card" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
                  <h1 className="text-[1.8rem] font-semibold leading-tight">Posez votre carte</h1>
                  <p className="mx-auto mt-2 max-w-xs text-paper/70">Pour confirmer, avec Face ID. Le Coffre s&apos;ouvrira sur l&apos;ordinateur, pas ici.</p>
                  <div className="mt-6">
                    <CardUnlock
                      key={attempt}
                      dark
                      keysOnly
                      candidates={openableCards()}
                      onOpened={async (_m, _pin, keys) => {
                        setState("sending");
                        setError(null);
                        const ok = await approve(req, choice!, keys!, qrKey).catch((e: Error) => {
                          setError(e.message);
                          setAttempt((a) => a + 1);
                          return null;
                        });
                        setState(ok === null ? "card" : ok ? "done" : "wrong");
                      }}
                    />
                  </div>
                  {error && <p className="mt-3 font-semibold text-coral-soft">{error}</p>}
                  <button onClick={() => setState("ask")} className="mt-5 text-[0.9rem] font-semibold text-paper/60">
                    Revenir au choix du nombre
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {PROD || isNative() ? (
          <Link href="/coffre" className="text-center text-[0.9rem] font-semibold text-paper/60">
            Retour au Coffre
          </Link>
        ) : (
          <button onClick={() => window.close()} className="text-center text-[0.9rem] font-semibold text-paper/60">
            Fermer le téléphone simulé
          </button>
        )}
      </div>
    </div>
  );
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-paper/10 ring-1 ring-paper/15">{icon}</div>
      <h1 className="mt-5 text-[1.8rem] font-semibold leading-tight">{title}</h1>
      <div className="mx-auto mt-2 max-w-xs text-paper/70">{children}</div>
    </motion.div>
  );
}
