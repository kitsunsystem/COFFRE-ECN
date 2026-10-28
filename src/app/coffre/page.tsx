"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Monitor, Nfc, ScanFace, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccessUnlock, type AccessCandidate } from "@/components/access";
import { openableCards, useCardOpen } from "@/components/card-flow";
import { InstallApp, PhoneInbox, PhoneOpen } from "@/components/phone-open";
import { PinPad } from "@/components/pinpad";
import { useHydrated } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Button, Sheet } from "@/components/ui";
import { Aurora, Logo, NfcCard, TapReader, VaultReveal } from "@/components/visuals";
import { driver } from "@/lib/cards";
import { DEMO_PIN } from "@/lib/demo";
import { PROD } from "@/lib/env";
import { isNative, isPhoneBrowser } from "@/lib/native";
import { isPhone, personName, useApp, useSession, type OpenSession } from "@/lib/store";
import { openSession } from "@/lib/vault";

// Where the Coffre goes once open: a page of the Coffre asked for in "?suite=" (e.g. a request to answer), else the sections.
const opened = () => {
  const next = new URLSearchParams(location.search).get("suite");
  return next?.startsWith("/coffre/") ? next : "/coffre/rubriques";
};

export default function Verrou() {
  const hydrated = useHydrated();
  const cards = useApp((s) => s.cards); // re-render when a card is activated or lost
  const trusts = useApp((s) => s.trusts);
  const people = useApp((s) => s.people);
  const account = useApp((s) => s.account);
  const me = useApp((s) => s.me);
  const session = useSession((s) => s.session);
  const router = useRouter();
  const [faceId, setFaceId] = useState(false);
  const [viaPhone, setViaPhone] = useState(false);
  const [relative, setRelative] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const active = hydrated ? openableCards() : [];
  // A relative's approved phone opens their part of someone else's Coffre (demo: Claire's relatives, in this browser).
  const accesses: AccessCandidate[] = !hydrated
    ? []
    : PROD
      ? trusts.flatMap((t) => t.cards.filter((c) => isPhone(c) && c.status === "active").map((c) => ({ personId: t.personId, phone: c, label: t.ownerName })))
      : cards.filter((c) => isPhone(c) && c.status === "active").map((c) => ({ personId: c.holderId, phone: c, label: personName(people, c.holderId) }));
  const f = useCardOpen(active, () => {});
  const home = account ? "/espace" : PROD && me ? "/proche" : "/";
  // The website cannot read the cards: a computer asks the phone, a phone's browser sends to the app.
  const where = !hydrated ? null : !PROD ? "demo" : isNative() ? "app" : isPhoneBrowser() ? "phone-browser" : "computer";

  useEffect(() => {
    if (session.mode !== "locked" && !f.opening && !revealing) router.replace(opened());
  }, [session.mode, f.opening, revealing, router]);

  if (!hydrated) return <Loader dark />;
  const fromPhone = async (keys: OpenSession) => {
    setRevealing(true);
    // Demo: the simulated phone window saved its changes (the "new device" e-mail); take them before writing anything.
    if (!PROD) await useApp.persist.rehydrate();
    await openSession(keys);
  };
  const tapped = f.tap?.card;
  // Production: a beneficiary card belongs to someone else's Coffre.
  const ownerOf = (holderId: string) => trusts.find((t) => t.personId === holderId)?.ownerName ?? "votre proche";

  return (
    <div className="grain relative grid min-h-dvh overflow-hidden bg-night text-paper">
      <Aurora dark className="opacity-80" />
      <div className="relative mx-auto flex w-full max-w-md flex-col px-6 pb-10 pt-5">
        <div className="flex items-center justify-between">
          <Link href={home} className="flex items-center gap-2 rounded-full px-3 py-2 text-[0.92rem] font-semibold text-paper/75 hover:bg-paper/10">
            <ArrowLeft className="h-4 w-4" /> {account || me ? "Espace" : "Accueil"}
          </Link>
          <Logo light />
        </div>

        <AnimatePresence mode="wait">
          {where === "phone-browser" ? (
            <InstallApp />
          ) : where === "computer" || viaPhone ? (
            <PhoneOpen onKeys={fromPhone} onBack={where === "demo" ? () => setViaPhone(false) : undefined} />
          ) : !tapped ? (
            <motion.div key="tap" className="flex flex-1 flex-col items-center justify-center text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-2 flex items-center gap-2 rounded-full bg-sage/15 px-3 py-1 text-[0.78rem] font-bold text-sage-soft">
                <ShieldCheck className="h-4 w-4" /> Chiffré sur cet appareil
              </motion.div>
              <h1 className="text-[2.2rem] font-semibold leading-tight">Le Coffre</h1>
              <p className="mt-2 max-w-xs text-paper/70">
                {driver() === "fido" ? "Posez votre carte contre le téléphone (ou branchez-la), puis tapez son code quand il est demandé." : "Posez votre carte au dos du téléphone. Elle seule peut l'ouvrir, avec votre code."}
              </p>
              <TapReader state={f.reading} light />
              {f.error && <p className="mb-3 font-semibold text-coral-soft">{f.error}</p>}
              {active.length === 0 && accesses.length === 0 ? (
                <div className="w-full space-y-3">
                  <p className="text-paper/70">Aucune carte n&apos;est encore active.</p>
                  <Button full variant="gold" href={account ? "/espace/cartes" : PROD && me ? "/proche" : "/connexion"}>
                    {account || me ? "Activer mes cartes" : "Se connecter"}
                  </Button>
                </div>
              ) : (
                active.length > 0 && (
                  <Button full variant="gold" icon={<Nfc className="h-5 w-5" />} disabled={f.reading === "reading" || f.opening} onClick={() => f.start()}>
                    {f.reading === "reading" ? "Lecture de la carte…" : "Poser ma carte"}
                  </Button>
                )
              )}
              {accesses.length > 0 && (
                <Button className="mt-3" full variant={active.length ? "light" : "gold"} icon={<ScanFace className="h-5 w-5" />} onClick={() => setRelative(true)}>
                  {where === "demo" ? "Démo : ouvrir comme un proche" : "Ouvrir avec Face ID et mon code"}
                </Button>
              )}
              {where === "app" && (
                <div className="mt-4 w-full">
                  <PhoneInbox />
                </div>
              )}
              {where === "demo" && (
                <button onClick={() => setViaPhone(true)} className="mt-4 flex items-center gap-2 text-[0.92rem] font-semibold text-gold-soft">
                  <Monitor className="h-4 w-4" /> Sur un ordinateur ? Ouvrir avec mon téléphone
                </button>
              )}
              <Link href="/beneficiaire" className="mt-4 text-[0.9rem] font-semibold text-paper/70 underline">
                Un proche est décédé ? Espace bénéficiaire
              </Link>
            </motion.div>
          ) : (
            <motion.div key="code" className="flex flex-1 flex-col justify-center pt-6" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="mx-auto mb-6 w-56">
                <NfcCard name={tapped.printedName} flipped interactive={false} />
              </div>
              <p className="mb-5 text-center text-paper/70">
                {tapped.holderId === "owner" ? "Carte reconnue. Tapez votre code." : PROD ? `Carte reconnue : Coffre de ${ownerOf(tapped.holderId)}. Tapez votre code.` : `Carte de ${personName(people, tapped.holderId)}. Tapez votre code.`}
              </p>
              <PinPad dark error={f.error} onComplete={f.submitPin} />
              <div className="mt-4 flex justify-center gap-3">
                {where !== "app" && (
                  <button onClick={() => setFaceId(true)} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.92rem] font-semibold text-paper/75 ring-1 ring-paper/15">
                    <ScanFace className="h-5 w-5" /> Face ID
                  </button>
                )}
                <button onClick={f.reset} className="rounded-full px-4 py-2.5 text-[0.92rem] font-semibold text-paper/75 ring-1 ring-paper/15">
                  Autre carte
                </button>
              </div>
              {faceId && <p className="mt-4 text-center text-[0.88rem] text-paper/60">Dans l&apos;application iPhone et Android, Face ID (ou l&apos;empreinte) est demandé à chaque ouverture : le code n&apos;est tapé qu&apos;une fois par téléphone, toujours avec la carte.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sheet open={f.picking} onClose={() => f.setPicking(false)} title="Démo : quelle carte posez-vous ?" dark>
        <div className="grid grid-cols-2 gap-3">
          {active.map((c) => (
            <button key={c.id} onClick={() => f.start(c)} className="text-left">
              <NfcCard name={c.printedName} flipped interactive={false} />
              <span className="mt-1.5 block text-[0.85rem] font-semibold text-paper/75">{c.holderId === "owner" ? "Ma carte" : `Carte de ${c.printedName.split(" ")[0]}`}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={relative} onClose={() => setRelative(false)} title={where === "demo" ? "Démo : quel proche êtes-vous ?" : "Mon accès de proche"} dark>
        <AccessUnlock
          dark
          candidates={accesses}
          intro={where === "demo" ? `Son téléphone, Face ID, puis son code : ${DEMO_PIN}.` : "Face ID, puis votre code d'accès."}
          onKeys={async (keys) => {
            setRelative(false);
            setRevealing(true);
            await openSession(keys);
          }}
        />
      </Sheet>

      {(f.opening || revealing) && session.mode !== "locked" && <VaultReveal onDone={() => router.replace(opened())} />}
    </div>
  );
}
