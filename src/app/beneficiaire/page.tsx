"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, ConciergeBell, FileUp, Hourglass, Lock, Nfc, SearchCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PinPad } from "@/components/pinpad";
import { useHydrated, useNow } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Button, Card, Notice, Sheet } from "@/components/ui";
import { Aurora, Countdown, Logo, NfcCard } from "@/components/visuals";
import { DELAYS, POST_DEATH_ACCESS_DAYS } from "@/lib/config";
import { declare, procedureStatus } from "@/lib/rules";
import { holderCards, now, personName, useApp, type Card as CardT } from "@/lib/store";
import { lock, unlock } from "@/lib/vault";

const STEPS = [
  { icon: Nfc, t: "Identifiez-vous avec votre carte et votre code" },
  { icon: FileUp, t: "Déposez l'acte de décès et votre pièce d'identité" },
  { icon: SearchCheck, t: "Notre équipe vérifie : registre INSEE, acte de décès, votre identité" },
  { icon: Hourglass, t: `Un délai de ${Math.round(DELAYS.deces / 86_400_000)} jours s'écoule, avec des alertes, pour éviter toute erreur` },
  { icon: Lock, t: `Vous ouvrez ce qui vous a été confié avec votre carte, pendant ${Math.round(POST_DEATH_ACCESS_DAYS / 30)} mois` },
];

// The beneficiary's side of a death: certificate, verification, delay, then opening with their own card.
export default function Beneficiaire() {
  const hydrated = useHydrated();
  const cards = useApp((s) => s.cards);
  const people = useApp((s) => s.people);
  const account = useApp((s) => s.account);
  const procedures = useApp((s) => s.procedures);
  const set = useApp((s) => s.set);
  const t = useNow(1000);
  const [step, setStep] = useState<"intro" | "card" | "code" | "docs">("intro");
  const [card, setCard] = useState<CardT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acte, setActe] = useState<File | null>(null);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [sure, setSure] = useState(false);
  if (!hydrated) return <Loader />;

  const owner = account ? `${account.firstName} ${account.lastName}` : "votre proche";
  const active = holderCards({ cards }).filter((c) => c.status === "active");
  const current = procedures.find((p) => p.kind === "deces" && ["verification", "delai", "terminee"].includes(procedureStatus(p, t)) && !p.erasedAt);
  const status = current && procedureStatus(current, t);
  const who = card ? personName(people, card.holderId) : "";

  function submit() {
    // shortcut: the demo keeps only the file names; in production both files go to the verification team, not to the Coffre.
    const info = { by: who, file: acte!.name, idChecked: false, at: now() };
    set((s) => {
      const open = s.procedures.find((p) => p.kind === "deces" && procedureStatus(p, now()) === "verification");
      return open
        ? { procedures: s.procedures.map((p) => (p.id === open.id ? { ...p, acte: info, note: `${p.note ? `${p.note} · ` : ""}Pièce d'identité : ${idDoc!.name}` } : p)) }
        : { procedures: [declare("deces", "beneficiaire", who, now(), { acte: info, note: `Pièce d'identité : ${idDoc!.name}` }), ...s.procedures] };
    });
    setStep("intro");
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Aurora className="fixed opacity-60" />
      <div className="relative mx-auto max-w-lg px-5 pb-16 pt-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[0.92rem] font-semibold text-ink-soft">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
          <Logo />
        </div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold-deep">Espace bénéficiaire</div>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight">Un proche nous a quittés</h1>
          <p className="mt-3 text-[1.05rem] text-ink-soft">Toutes nos condoléances. Si {owner} vous a confié des éléments, voici comment y accéder. Nous vous accompagnons à chaque étape.</p>
        </motion.div>

        {current && status ? (
          <Card className="mt-6">
            <div className="font-semibold">Votre demande pour {owner}</div>
            <ol className="mt-4 space-y-3">
              {[
                { t: "Acte de décès déposé", done: !!current.acte },
                { t: "Vérification par notre équipe (INSEE, acte, identité)", done: status !== "verification" },
                { t: "Délai d'annulation", done: status === "terminee" },
                { t: "Accès ouvert avec votre carte", done: status === "terminee" },
              ].map((x) => (
                <li key={x.t} className="flex items-center gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${x.done ? "bg-sage text-paper" : "bg-ink/[0.07]"}`}>{x.done && <Check className="h-4 w-4" strokeWidth={3} />}</span>
                  <span className={x.done ? "text-mist" : "font-semibold"}>{x.t}</span>
                </li>
              ))}
            </ol>
            {status === "verification" && !current.acte && (
              <div className="mt-4">
                <Notice tone="gold">Une correspondance a été trouvée dans le registre des décès. Pour la confirmer, notre équipe a besoin de l&apos;acte de décès.</Notice>
              </div>
            )}
            {status === "delai" && current.endsAt && (
              <div className="mt-4 rounded-2xl bg-ink/[0.04] p-4 text-center">
                <div className="text-[0.85rem] text-mist">Ouverture dans</div>
                <div className="mt-1 text-[1.6rem] font-semibold">
                  <Countdown to={current.endsAt} now={t} />
                </div>
              </div>
            )}
            {status === "terminee" && (
              <Button className="mt-5" full variant="gold" href="/coffre" icon={<Lock className="h-5 w-5" />}>
                Ouvrir avec ma carte
              </Button>
            )}
            {status === "verification" && !current.acte && (
              <Button className="mt-4" full onClick={() => setStep("card")} icon={<FileUp className="h-5 w-5" />}>
                Déposer l&apos;acte de décès
              </Button>
            )}
          </Card>
        ) : (
          <>
            <div className="mt-6 space-y-2.5">
              {STEPS.map((x, i) => (
                <motion.div key={x.t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="flex items-center gap-3 rounded-2xl bg-paper p-3.5 ring-1 ring-line">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-soft/60">
                    <x.icon className="h-5 w-5 text-gold-deep" />
                  </span>
                  <span className="text-[0.95rem] font-semibold leading-snug">{x.t}</span>
                </motion.div>
              ))}
            </div>
            <Button className="mt-6" full variant="gold" icon={<Nfc className="h-5 w-5" />} onClick={() => setStep("card")} disabled={active.length === 0}>
              Commencer avec ma carte
            </Button>
            {active.length === 0 && <p className="mt-2 text-center text-[0.88rem] text-mist">Aucune carte de bénéficiaire active sur cet appareil.</p>}
          </>
        )}

        <div className="mt-6 grid gap-2.5">
          <Button variant="outline" full href="/espace/services" icon={<ConciergeBell className="h-5 w-5" />}>
            Se faire aider par la conciergerie
          </Button>
          <p className="text-center text-[0.85rem] text-mist">Pas de carte ? Seuls les bénéficiaires désignés, avec leurs cartes, peuvent accéder au Coffre.</p>
        </div>
      </div>

      <Sheet open={step === "card"} onClose={() => setStep("intro")} title="Démo : quelle carte posez-vous ?">
        <div className="grid grid-cols-2 gap-3">
          {active.map((c) => (
            <button key={c.id} onClick={() => { setCard(c); setStep("code"); setError(null); }} className="text-left">
              <NfcCard name={c.printedName} flipped interactive={false} />
              <span className="mt-1.5 block text-[0.85rem] font-semibold text-ink-soft">{personName(people, c.holderId).split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={step === "code"} onClose={() => setStep("intro")} title="Votre code">
        <p className="mb-5 text-center text-ink-soft">Le code choisi à l&apos;activation de vos cartes.</p>
        <PinPad
          error={error}
          onComplete={async (pin) => {
            try {
              await unlock(card!.id, pin);
              lock(); // only proves who you are; nothing opens before the verification and the delay
              setStep("docs");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      </Sheet>

      <Sheet open={step === "docs"} onClose={() => setStep("intro")} title="Les documents">
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="flex items-center gap-2 font-semibold text-sage">
              <ShieldCheck className="h-5 w-5" /> {who}, votre carte est reconnue.
            </p>
            {[
              { label: "Acte de décès", file: acte, setFile: setActe },
              { label: "Votre pièce d'identité", file: idDoc, setFile: setIdDoc },
            ].map((d) => (
              <label key={d.label} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
                <FileUp className="h-6 w-6 shrink-0 text-gold-deep" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{d.label}</span>
                  <span className="block truncate text-[0.85rem] text-mist">{d.file ? d.file.name : "Photo ou PDF"}</span>
                </span>
                {d.file && <Check className="h-5 w-5 text-sage" />}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => d.setFile(e.target.files?.[0] ?? null)} />
              </label>
            ))}
            <button type="button" onClick={() => setSure(!sure)} aria-pressed={sure} className="flex w-full items-start gap-3 text-left">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ring-2 ${sure ? "bg-ink ring-ink" : "ring-line"}`}>{sure && <Check className="h-4 w-4 text-paper" strokeWidth={3} />}</span>
              <span className="text-[0.92rem]">Je certifie que ces documents sont authentiques.</span>
            </button>
            <p className="text-[0.85rem] text-mist">Ils servent uniquement à la vérification par notre équipe. Le titulaire est prévenu et peut encore annuler pendant le délai.</p>
            <Button full variant="gold" disabled={!acte || !idDoc || !sure} onClick={submit}>
              Envoyer pour vérification
            </Button>
          </motion.div>
        </AnimatePresence>
      </Sheet>
    </div>
  );
}
