"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, ConciergeBell, FileUp, Hourglass, Lock, LogIn, ScanFace, SearchCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AccessUnlock } from "@/components/access";
import { useHydrated, useNow } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Button, Card, Notice, Sheet } from "@/components/ui";
import { Aurora, Countdown, Logo } from "@/components/visuals";
import { declareDeath } from "@/lib/api";
import { DELAYS, POST_DEATH_ACCESS_DAYS } from "@/lib/config";
import { PROD } from "@/lib/env";
import { procedureStatus, type Procedure } from "@/lib/rules";
import { isPhone, personName, useApp } from "@/lib/store";

const STEPS = [
  { icon: ScanFace, t: PROD ? "Connectez-vous avec l'adresse e-mail à laquelle vous avez été désigné" : "Identifiez-vous avec votre téléphone : Face ID et votre code" },
  { icon: FileUp, t: "Déposez l'acte de décès et votre pièce d'identité" },
  { icon: SearchCheck, t: "Notre équipe vérifie : registre INSEE, acte de décès, votre identité" },
  { icon: Hourglass, t: `Un délai de ${Math.round(DELAYS.deces / 86_400_000)} jours s'écoule, avec des alertes, pour éviter toute erreur` },
  { icon: Lock, t: `Vous ouvrez ce qui vous a été confié avec votre téléphone, ou vos cartes reçues pendant le délai, pendant ${Math.round(POST_DEATH_ACCESS_DAYS / 30)} mois` },
];
const ACCEPT = ["image/", "application/pdf"];
const MAX = 20 * 1024 * 1024;

// The beneficiary's side of a death: certificate, verification, delay (their cards arrive), then opening their part.
export default function Beneficiaire() {
  const hydrated = useHydrated();
  const cards = useApp((s) => s.cards);
  const people = useApp((s) => s.people);
  const account = useApp((s) => s.account);
  const me = useApp((s) => s.me);
  const trusts = useApp((s) => s.trusts);
  const ownProcedures = useApp((s) => s.procedures);
  const t = useNow(1000);
  const [step, setStep] = useState<"intro" | "phone" | "docs">("intro");
  const [who, setWho] = useState("");
  const [acte, setActe] = useState<File | null>(null);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  // Production: the Coffres the signed-in person holds a pack for.
  const mine = trusts.filter((x) => x.cards.some((c) => c.status !== "perdue"));
  const [ownerId, setOwnerId] = useState<string | null>(null);
  if (!hydrated) return <Loader />;

  const trust = PROD ? (mine.find((x) => x.ownerId === ownerId) ?? mine[0]) : undefined;
  const owner = PROD ? (trust?.ownerName ?? "votre proche") : account ? `${account.firstName} ${account.lastName}` : "votre proche";
  const procedures: Procedure[] = PROD ? (trust?.procedures ?? []) : ownProcedures;
  // Demo: the beneficiaries' approved phones, in this browser, prove who is speaking.
  const phones = cards.filter((c) => isPhone(c) && c.status === "active");
  const current = procedures.find((p) => p.kind === "deces" && ["verification", "delai", "terminee"].includes(procedureStatus(p, t)) && !p.erasedAt);
  const status = current && procedureStatus(current, t);
  const hasActe = current && (PROD ? (current as { hasActe?: boolean }).hasActe : !!current.acte);
  const canStart = PROD ? !!trust : phones.length > 0;

  async function submit() {
    setBusy(true);
    const name = PROD ? (trust?.cards[0]?.printedName ?? "") : who;
    const ok = await declareDeath(trust?.ownerId ?? null, name, acte!, idDoc!);
    setBusy(false);
    if (ok) {
      setStep("intro");
      setActe(null);
      setIdDoc(null);
      setSure(false);
    }
  }

  const pick = (setFile: (f: File | null) => void) => (f: File | undefined) => {
    if (f && (f.size > MAX || !ACCEPT.some((a) => f.type.startsWith(a)))) return setFileError("Photo ou PDF uniquement, 20 Mo maximum.");
    setFileError(null);
    setFile(f ?? null);
  };

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Aurora className="fixed opacity-60" />
      <div className="relative mx-auto max-w-lg px-5 pb-16 pt-5">
        <div className="flex items-center justify-between">
          <Link href={PROD && me ? (account ? "/espace" : "/proche") : "/"} className="flex items-center gap-2 text-[0.92rem] font-semibold text-ink-soft">
            <ArrowLeft className="h-4 w-4" /> {PROD && me ? "Mon espace" : "Accueil"}
          </Link>
          <Logo />
        </div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-gold-deep">Espace bénéficiaire</div>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight">Un proche nous a quittés</h1>
          <p className="mt-3 text-[1.05rem] text-ink-soft">Toutes nos condoléances. Si {owner} vous a confié des éléments, voici comment y accéder. Nous vous accompagnons à chaque étape.</p>
        </motion.div>

        {PROD && !me && (
          <Card className="mt-6">
            <p className="text-ink-soft">Connectez-vous avec l&apos;adresse e-mail à laquelle vous avez été désigné comme bénéficiaire. Première fois ? Créez votre accès : un code de confirmation vous est envoyé.</p>
            <Button className="mt-4" full variant="gold" href="/connexion?suite=/beneficiaire" icon={<LogIn className="h-5 w-5" />}>
              Me connecter
            </Button>
          </Card>
        )}
        {PROD && me && mine.length === 0 && (
          <div className="mt-6">
            <Notice tone="gold">Aucun Coffre ne vous désigne comme bénéficiaire avec l&apos;adresse {me.email}. Seuls les bénéficiaires désignés peuvent y accéder.</Notice>
          </div>
        )}
        {PROD && mine.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {mine.map((x) => (
              <button key={x.ownerId} onClick={() => setOwnerId(x.ownerId)} className={`rounded-full px-4 py-2 text-[0.92rem] font-semibold ring-1 ${trust?.ownerId === x.ownerId ? "bg-ink text-paper ring-ink" : "bg-paper ring-line"}`}>
                {x.ownerName}
              </button>
            ))}
          </div>
        )}

        {current && status ? (
          <Card className="mt-6">
            <div className="font-semibold">Votre demande pour {owner}</div>
            <ol className="mt-4 space-y-3">
              {[
                { t: "Acte de décès déposé", done: !!hasActe },
                { t: "Vérification par notre équipe (INSEE, acte, identité)", done: status !== "verification" },
                { t: "Délai d'annulation", done: status === "terminee" },
                { t: "Accès ouvert : votre téléphone ou vos cartes", done: status === "terminee" },
              ].map((x) => (
                <li key={x.t} className="flex items-center gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${x.done ? "bg-sage text-paper" : "bg-ink/[0.07]"}`}>{x.done && <Check className="h-4 w-4" strokeWidth={3} />}</span>
                  <span className={x.done ? "text-mist" : "font-semibold"}>{x.t}</span>
                </li>
              ))}
            </ol>
            {status === "verification" && !hasActe && (
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
                Ouvrir le Coffre
              </Button>
            )}
            {status === "verification" && !hasActe && (
              <Button className="mt-4" full onClick={() => setStep(PROD ? "docs" : "phone")} icon={<FileUp className="h-5 w-5" />}>
                Déposer l&apos;acte de décès
              </Button>
            )}
          </Card>
        ) : (
          (!PROD || me) && (
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
              <Button className="mt-6" full variant="gold" icon={<FileUp className="h-5 w-5" />} onClick={() => setStep(PROD ? "docs" : "phone")} disabled={!canStart}>
                {PROD ? "Déposer l'acte de décès" : "Commencer avec mon téléphone"}
              </Button>
              {!PROD && phones.length === 0 && <p className="mt-2 text-center text-[0.88rem] text-mist">Aucun accès de bénéficiaire validé sur cet appareil.</p>}
            </>
          )
        )}

        <div className="mt-6 grid gap-2.5">
          {(!PROD || account) && (
            <Button variant="outline" full href="/espace/services" icon={<ConciergeBell className="h-5 w-5" />}>
              Se faire aider par la conciergerie
            </Button>
          )}
          <p className="text-center text-[0.85rem] text-mist">Seuls les bénéficiaires désignés peuvent accéder au Coffre, avec leur téléphone validé ou leurs cartes.</p>
        </div>
      </div>

      {/* Demo: the approved phone and its code prove who you are (nothing opens here). Production: your account does, then the team checks your ID. */}
      <Sheet open={step === "phone"} onClose={() => setStep("intro")} title="Votre accès">
        <AccessUnlock
          candidates={phones.map((c) => ({ personId: c.holderId, phone: c, label: personName(people, c.holderId) }))}
          intro="Votre téléphone, Face ID, puis votre code."
          onKeys={(keys) => {
            setWho(personName(people, cards.find((c) => c.id === keys.cardId)?.holderId ?? ""));
            setStep("docs");
          }}
        />
      </Sheet>

      <Sheet open={step === "docs"} onClose={() => setStep("intro")} title="Les documents">
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {!PROD && (
              <p className="flex items-center gap-2 font-semibold text-sage">
                <ShieldCheck className="h-5 w-5" /> {who}, votre accès est reconnu.
              </p>
            )}
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
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pick(d.setFile)(e.target.files?.[0])} />
              </label>
            ))}
            {fileError && <p className="font-semibold text-coral">{fileError}</p>}
            <button type="button" onClick={() => setSure(!sure)} aria-pressed={sure} className="flex w-full items-start gap-3 text-left">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ring-2 ${sure ? "bg-ink ring-ink" : "ring-line"}`}>{sure && <Check className="h-4 w-4 text-paper" strokeWidth={3} />}</span>
              <span className="text-[0.92rem]">Je certifie que ces documents sont authentiques.</span>
            </button>
            <p className="text-[0.85rem] text-mist">Ils servent uniquement à la vérification par notre équipe. Le titulaire est prévenu et peut encore annuler pendant le délai.</p>
            <Button full variant="gold" disabled={!acte || !idDoc || !sure || busy} onClick={submit}>
              {busy ? "Envoi…" : "Envoyer pour vérification"}
            </Button>
          </motion.div>
        </AnimatePresence>
      </Sheet>
    </div>
  );
}
