"use client";
// The Coffre outside the app. On a computer it opens with the phone: the first time the phone scans this QR code (the
// computer becomes trusted for 90 days), then a notification is enough. On a phone's browser: install the app.
import { AnimatePresence, motion } from "motion/react";
import { BellRing, Monitor, QrCode, ScanLine, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { renderSVG } from "uqr";
import { devices } from "@/lib/api";
import { phoneUrl, removeDevice, startOpening, startPairing, thisDeviceId, trustedHere, waitForPhone } from "@/lib/devices";
import { PROD, STORE_ANDROID, STORE_IOS } from "@/lib/env";
import { tr } from "@/lib/i18n";
import { isNative, scanComputer } from "@/lib/native";
import type { DeviceRequest, OpenSession, TrustedDevice } from "@/lib/store";
import { Button } from "./ui";

type Asked = { id: string; code: number; expiresAt: number; url?: string };

function useClock() {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  return t;
}

const left = (until: number, t: number) => {
  const s = Math.max(0, Math.round((until - t) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Demo: the phone is a second window of this browser (same storage), sized like a phone.
const openDemoPhone = (url: string) => window.open(url, "telephone", "popup,width=420,height=860");

export function PhoneOpen({ onKeys, onBack }: { onKeys: (keys: OpenSession) => void; onBack?: () => void }) {
  const t = useClock();
  const [device, setDevice] = useState<string | null | undefined>(undefined);
  const [pairing, setPairing] = useState(false);
  const [asked, setAsked] = useState<Asked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef<AbortController | null>(null);

  useEffect(() => {
    trustedHere().then(setDevice, (e: Error) => {
      setDevice(null);
      setError(e.message);
    });
    return () => stop.current?.abort();
  }, []);

  async function ask(start: () => Promise<Asked>) {
    setBusy(true);
    setError(null);
    try {
      const a = await start();
      setAsked(a);
      const ctl = new AbortController();
      stop.current = ctl;
      const res = await waitForPhone(a.id, ctl.signal);
      if (res === "cancelled") return;
      setAsked(null);
      if (res === "refused") setError("Demande refusée sur le téléphone.");
      else if (res === "expired") setError("Délai dépassé. Recommencez.");
      else onKeys(res);
    } catch (e) {
      setAsked(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cancel = () => {
    stop.current?.abort();
    setAsked(null);
  };

  if (device === undefined) return <div className="flex flex-1 items-center justify-center text-paper/60">Un instant…</div>;
  const showQr = pairing || !device;

  return (
    <motion.div key="phone" className="flex flex-1 flex-col items-center justify-center text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <AnimatePresence mode="wait">
        {asked?.url ? (
          <motion.div key="qr" className="w-full" initial={{ opacity: 0, rotateX: -12 }} animate={{ opacity: 1, rotateX: 0 }} exit={{ opacity: 0 }}>
            <h1 className="text-[1.9rem] font-semibold leading-tight">Scannez avec votre téléphone</h1>
            <p className="mx-auto mt-2 max-w-xs text-paper/70">Dans l&apos;application, touchez « Scanner un ordinateur », puis choisissez ce nombre et posez votre carte.</p>
            <div className="mx-auto mt-6 w-56 rounded-[1.6rem] bg-white p-3 shadow-lift" aria-label={tr("Code QR à scanner avec l'application")} dangerouslySetInnerHTML={{ __html: renderSVG(asked.url, { border: 1, blackColor: "#050608" }) }} />
            <Code value={asked.code} />
            <p className="mt-2 text-[0.88rem] text-paper/55">Expire dans {left(asked.expiresAt, t)}</p>
            {!PROD && (
              <Button className="mt-5" full variant="gold" icon={<Smartphone className="h-5 w-5" />} onClick={() => openDemoPhone(asked.url!)}>
                Démo : ouvrir le téléphone simulé
              </Button>
            )}
            <button onClick={cancel} className="mt-4 text-[0.92rem] font-semibold text-paper/70 underline">
              Annuler
            </button>
          </motion.div>
        ) : asked ? (
          <motion.div key="wait" className="w-full" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <motion.div animate={{ rotate: [0, -12, 12, -8, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.4 }} className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 ring-1 ring-gold/40">
              <BellRing className="h-8 w-8 text-gold-soft" />
            </motion.div>
            <h1 className="mt-5 text-[1.9rem] font-semibold leading-tight">Regardez votre téléphone</h1>
            <p className="mx-auto mt-2 max-w-xs text-paper/70">Touchez la notification, choisissez ce nombre, puis posez votre carte.</p>
            <Code value={asked.code} />
            <p className="mt-2 text-[0.88rem] text-paper/55">Expire dans {left(asked.expiresAt, t)}</p>
            <p className="mx-auto mt-4 max-w-xs text-[0.88rem] text-paper/55">Pas de notification ? Ouvrez l&apos;application : la demande vous attend dans le Coffre.</p>
            {!PROD && (
              <Button className="mt-5" full variant="gold" icon={<Smartphone className="h-5 w-5" />} onClick={() => openDemoPhone(phoneUrl(asked.id))}>
                Démo : ouvrir la notification
              </Button>
            )}
            <button onClick={cancel} className="mt-4 text-[0.92rem] font-semibold text-paper/70 underline">
              Annuler
            </button>
          </motion.div>
        ) : showQr ? (
          <motion.div key="intro" className="w-full" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 ring-1 ring-gold/40">
              <Monitor className="h-8 w-8 text-gold-soft" />
            </div>
            <h1 className="mt-5 text-[1.9rem] font-semibold leading-tight">Ouvrir le Coffre sur cet ordinateur</h1>
            <p className="mx-auto mt-2 max-w-xs text-paper/70">Un ordinateur ne lit pas les cartes : c&apos;est votre téléphone qui donne l&apos;accord, carte posée.</p>
            <ol className="mx-auto mt-6 max-w-xs space-y-3 text-left">
              {["Ouvrez l'application sur votre téléphone", "Scannez le code QR de cet ordinateur", "Choisissez le même nombre, posez votre carte : Face ID confirme"].map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/20 text-[0.85rem] font-bold text-gold-soft">{i + 1}</span>
                  <span className="text-paper/85">{s}</span>
                </li>
              ))}
            </ol>
            <p className="mx-auto mt-5 max-w-xs text-[0.88rem] text-paper/55">Cet ordinateur devient un appareil de confiance pendant 90 jours : les fois suivantes, une notification suffit.</p>
            <Button className="mt-6" full variant="gold" icon={<QrCode className="h-5 w-5" />} disabled={busy} onClick={() => ask(startPairing)}>
              Afficher le code QR
            </Button>
          </motion.div>
        ) : (
          <motion.div key="trusted" className="w-full" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full bg-sage/15 px-3 py-1 text-[0.78rem] font-bold text-sage-soft">
              <ShieldCheck className="h-4 w-4" /> Appareil de confiance
            </div>
            <h1 className="text-[2.2rem] font-semibold leading-tight">Le Coffre</h1>
            <p className="mx-auto mt-2 max-w-xs text-paper/70">Votre téléphone va recevoir la demande. Posez votre carte dessus : le Coffre s&apos;ouvre ici.</p>
            <Button className="mt-8" full variant="gold" icon={<Smartphone className="h-5 w-5" />} disabled={busy} onClick={() => ask(() => startOpening(device!))}>
              Ouvrir avec mon téléphone
            </Button>
            <button onClick={() => setPairing(true)} className="mt-4 text-[0.9rem] font-semibold text-paper/70 underline">
              Associer avec le code QR
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="mt-4 font-semibold text-coral-soft">{error}</p>}
      {onBack && !asked && (
        <button onClick={onBack} className="mt-5 text-[0.9rem] font-semibold text-paper/60">
          Démo : revenir à la carte posée sur le téléphone
        </button>
      )}
    </motion.div>
  );
}

function Code({ value }: { value: number }) {
  return (
    <div className="mt-6">
      <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-paper/55">Nombre à choisir</div>
      <motion.div key={value} initial={{ opacity: 0, scale: 0.7, rotateX: 50 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className="mt-1 font-semibold leading-none text-gold-soft" style={{ fontSize: "4.5rem" }} translate="no">
        {value}
      </motion.div>
    </div>
  );
}

// A phone's browser: the cards are read by the app (NFC, Face ID).
export function InstallApp() {
  return (
    <motion.div key="install" className="flex flex-1 flex-col items-center justify-center text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 ring-1 ring-gold/40">
        <Smartphone className="h-8 w-8 text-gold-soft" />
      </div>
      <h1 className="mt-5 text-[1.9rem] font-semibold leading-tight">Le Coffre s&apos;ouvre dans l&apos;application</h1>
      <p className="mt-3 max-w-xs text-paper/70">Sur un téléphone, la carte se lit avec l&apos;application, avec Face ID. Installez-la et connectez-vous avec la même adresse : votre Espace et votre Coffre vous y attendent.</p>
      <div className="mt-7 w-full space-y-3">
        {STORE_IOS && (
          <Button full variant="gold" href={STORE_IOS}>
            Télécharger sur l&apos;App Store
          </Button>
        )}
        {STORE_ANDROID && (
          <Button full variant="gold" href={STORE_ANDROID}>
            Télécharger sur Google Play
          </Button>
        )}
        {!STORE_IOS && !STORE_ANDROID && <p className="rounded-2xl bg-paper/5 p-4 text-paper/70 ring-1 ring-paper/10">Bientôt sur l&apos;App Store et Google Play.</p>}
      </div>
      <p className="mt-5 max-w-xs text-[0.88rem] text-paper/55">Sur un ordinateur, le Coffre s&apos;ouvre aussi, avec l&apos;accord de votre téléphone.</p>
    </motion.div>
  );
}

// Compte: the trusted computers, each removable at once (it can be paired again with the QR code and the card).
export function TrustedDevices() {
  const t = useClock();
  const [list, setList] = useState<TrustedDevice[] | null>(null);
  const [mine, setMine] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    devices.list().then(setList, (e: Error) => setError(e.message));
    void thisDeviceId().then(setMine);
  };
  useEffect(load, []);
  const day = (ms: number) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-2.5">
      <p className="text-[0.92rem] text-mist">Les ordinateurs qui peuvent demander l&apos;ouverture du Coffre. Chaque ouverture se confirme sur votre téléphone, carte posée.</p>
      {list?.length === 0 && <p className="rounded-2xl bg-paper p-4 text-[0.92rem] text-ink-soft ring-1 ring-line">Aucun ordinateur pour l&apos;instant. Sur un ordinateur, ouvrez le Coffre : un code QR vous guidera.</p>}
      {list?.map((d) => (
        <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
          <Monitor className="h-6 w-6 shrink-0 text-gold-deep" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              <span translate="no">{d.name}</span>
              {d.id === mine && <span className="ml-2 text-[0.8rem] font-semibold text-sage">cet ordinateur</span>}
            </span>
            <span className="block text-[0.85rem] text-mist">{d.expiresAt > t ? `Approuvé le ${day(d.createdAt)} · à revalider le ${day(d.expiresAt)}` : "À revalider avec le code QR"}</span>
            {d.lastUsedAt && <span className="block text-[0.85rem] text-mist">Dernière ouverture le {day(d.lastUsedAt)}</span>}
          </span>
          <button onClick={() => removeDevice(d.id).then(load, (e: Error) => setError(e.message))} className="shrink-0 text-[0.9rem] font-semibold text-coral">
            Retirer
          </button>
        </div>
      ))}
      {error && <p className="font-semibold text-coral">{error}</p>}
    </div>
  );
}

// In the app (and the demo's simulated phone): the computers waiting for an answer, and the QR code scanner.
export function PhoneInbox() {
  const router = useRouter();
  const [pending, setPending] = useState<DeviceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => devices.pending().then((p) => alive && setPending(p.filter((r) => r.kind === "open")), console.error);
    load();
    const i = setInterval(load, 3000);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(i);
      window.removeEventListener("focus", load);
    };
  }, []);

  async function scan() {
    setError(null);
    try {
      const path = await scanComputer(tr("Visez le code QR affiché sur l'ordinateur"));
      if (path) router.push(path);
      else setError("Ce code QR ne vient pas de notre site.");
    } catch {
      setError("Lecture annulée.");
    }
  }

  return (
    <div className="w-full space-y-3 text-left">
      {pending.map((r) => (
        <Link key={r.id} href={`/appareil/?r=${r.id}`} className="flex items-center gap-3 rounded-2xl bg-gold/15 p-4 ring-1 ring-gold/40">
          <BellRing className="h-6 w-6 shrink-0 text-gold-soft" />
          <span className="flex-1">
            <span className="block font-semibold">Ouverture demandée</span>
            <span className="text-[0.88rem] text-paper/70">{r.name}</span>
          </span>
          <span className="text-[0.88rem] font-semibold text-gold-soft">Répondre</span>
        </Link>
      ))}
      {isNative() && (
        <button onClick={scan} className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[0.95rem] font-semibold text-paper/80 ring-1 ring-paper/15">
          <ScanLine className="h-5 w-5" /> Scanner un ordinateur
        </button>
      )}
      {error && <p className="text-center font-semibold text-coral-soft">{error}</p>}
    </div>
  );
}
