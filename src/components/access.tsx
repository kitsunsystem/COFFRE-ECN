"use client";
// A relative's access from their phone: asking for it (a new code, the key made on the phone), opening with it (Face ID,
// then the code) and, on the owner's side, the requests waiting for an answer in the Coffre.
import { motion } from "motion/react";
import { Check, ScanFace, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { fingerprint, newAccessKey, readAccessKey, unlockAccess, type AccessKey } from "@/lib/access";
import { refuseAccess, requestAccess } from "@/lib/api";
import { isNative } from "@/lib/native";
import { isPhone, personName, useApp, type Card, type HolderSession } from "@/lib/store";
import { approveAccess } from "@/lib/vault";
import { PinPad } from "./pinpad";
import { Button } from "./ui";

export type AccessCandidate = { personId: string; phone: Card; label: string };

// Face ID first (the phone only gives the key after it), then the code.
export function AccessUnlock({ candidates, onKeys, dark, intro }: { candidates: AccessCandidate[]; onKeys: (keys: HolderSession, pin: string) => void | Promise<void>; dark?: boolean; intro?: string }) {
  const [picked, setPicked] = useState<AccessCandidate | null>(null);
  const [key, setKey] = useState<AccessKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const soft = dark ? "text-paper/70" : "text-ink-soft";

  async function faceId(c: AccessCandidate) {
    setPicked(c);
    setError(null);
    setBusy(true);
    try {
      const k = await readAccessKey(c.personId);
      if (!k) throw new Error("Aucun accès n'est enregistré sur ce téléphone. Demandez-le depuis votre espace de proche.");
      setKey(k);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function code(pin: string) {
    setError(null);
    setBusy(true);
    try {
      await onKeys(await unlockAccess(key!, picked!.phone, pin), pin);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (key)
    return (
      <div>
        <p className={`mb-5 text-center ${soft}`}>{busy ? "Ouverture…" : "Tapez votre code d'accès."}</p>
        <PinPad dark={dark} error={error} label="Votre code" onComplete={code} />
      </div>
    );
  return (
    <div className="text-center">
      {intro && <p className={soft}>{intro}</p>}
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto my-6 grid h-20 w-20 place-items-center rounded-3xl bg-gold/15 ring-1 ring-gold/40">
        <ScanFace className={`h-10 w-10 ${dark ? "text-gold-soft" : "text-gold-deep"}`} />
      </motion.div>
      {error && <p className={`mb-3 font-semibold ${dark ? "text-coral-soft" : "text-coral"}`}>{error}</p>}
      <div className="grid gap-2.5">
        {candidates.map((c) => (
          <Button key={c.phone.id} full variant="gold" icon={<ScanFace className="h-5 w-5" />} disabled={busy} onClick={() => faceId(c)}>
            {candidates.length > 1 ? c.label : isNative() ? "Confirmer avec Face ID" : "Démo : Face ID confirmé"}
          </Button>
        ))}
      </div>
    </div>
  );
}

// The beneficiary asks for their access from this phone: a code chosen twice, a key made here, an e-mail to the owner.
export function AccessRequest({ personId, ownerName, onDone }: { personId: string; ownerName: string; onDone: () => void }) {
  const [step, setStep] = useState<"code" | "confirm" | "sending" | "sent">("code");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState("");

  async function send(p: string) {
    setStep("sending");
    try {
      const pk = await newAccessKey(personId, p);
      await requestAccess(personId, pk);
      setCheck(await fingerprint(pk));
      setStep("sent");
    } catch (e) {
      setError((e as Error).message);
      setStep("code");
    }
  }

  if (step === "sent")
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage text-paper">
          <Check className="h-8 w-8" strokeWidth={3} />
        </div>
        <div className="mt-4 text-[1.3rem] font-semibold">Demande envoyée</div>
        <p className="mt-2 text-ink-soft">{ownerName} reçoit un e-mail et accepte depuis son Coffre. Vous serez prévenu par e-mail.</p>
        <div className="mt-4 rounded-2xl bg-ink/[0.04] p-4">
          <div className="text-[0.85rem] text-mist">Code de contrôle</div>
          <div className="mt-1 font-display text-[1.8rem] font-semibold tracking-wider" translate="no">
            {check}
          </div>
          <p className="mt-1 text-[0.85rem] text-mist">S&apos;il ou elle vous appelle pour vérifier, son écran affiche le même code.</p>
        </div>
        <Button className="mt-5" full variant="gold" onClick={onDone}>
          Terminer
        </Button>
      </div>
    );
  return (
    <div>
      <p className="mb-6 text-center text-ink-soft">
        {step === "confirm" ? "Tapez-le une seconde fois." : step === "sending" ? "Envoi de la demande…" : `Choisissez un code à 6 chiffres. Avec Face ID, il ouvrira ce que ${ownerName} vous confie, au moment prévu.`}
      </p>
      <PinPad
        key={step}
        error={error}
        label={step === "confirm" ? "Confirmez le code" : "Nouveau code"}
        onComplete={(p) => {
          setError(null);
          if (step === "code") {
            setPin(p);
            setStep("confirm");
          } else if (p !== pin) {
            setError("Les deux codes ne correspondent pas.");
            setStep("code");
          } else void send(p);
        }}
      />
    </div>
  );
}

// Owner, Coffre open: accepting seals to that phone what this person may open, at the moments already chosen.
export function AccessRequests() {
  const cards = useApp((s) => s.cards);
  const people = useApp((s) => s.people);
  const pending = cards.filter((c) => isPhone(c) && c.status === "demandee");
  if (!pending.length) return null;
  return (
    <div className="mt-6 space-y-3">
      {pending.map((c) => (
        <PendingRequest key={c.id} phone={c} name={personName(people, c.holderId)} />
      ))}
    </div>
  );
}

function PendingRequest({ phone, name }: { phone: Card; name: string }) {
  const [check, setCheck] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fingerprint(phone.boxPk!).then(setCheck);
  }, [phone.boxPk]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await approveAccess(phone);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.5rem] bg-gold/10 p-4 ring-1 ring-gold/40">
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 shrink-0 text-gold-soft" />
        <div className="flex-1">
          <div className="font-semibold">{name} demande l&apos;accès</div>
          <div className="text-[0.85rem] text-paper/60">Depuis son téléphone, le {new Date(phone.orderedAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}</div>
        </div>
      </div>
      <p className="mt-3 text-[0.88rem] text-paper/70">
        Code de contrôle :{" "}
        <b className="text-gold-soft" translate="no">
          {check}
        </b>
        . En cas de doute, appelez {name.split(" ")[0]} : son téléphone affiche le même code.
      </p>
      {error && <p className="mt-2 font-semibold text-coral-soft">{error}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="gold" disabled={busy} onClick={accept}>
          Accepter
        </Button>
        <Button variant="light" disabled={busy} onClick={() => refuseAccess(phone)}>
          Refuser
        </Button>
      </div>
    </motion.div>
  );
}
