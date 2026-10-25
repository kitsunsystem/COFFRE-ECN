"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, BadgeCheck, Building, Check, FileUp, KeyRound, Plus, ScanFace, Trash, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlmaFace } from "@/components/alma";
import { useHydrated } from "@/components/providers";
import { Button, Eyebrow, Field, Notice } from "@/components/ui";
import { Aurora, Logo } from "@/components/visuals";
import { createProfile, sendCode, submitKyc, verifyCode } from "@/lib/api";
import { ASSISTANT_NAME } from "@/lib/config";
import { PROD } from "@/lib/env";
import { uid, useApp, type Account, type Person } from "@/lib/store";

const SITUATIONS = ["En couple", "Marié(e)", "Pacsé(e)", "Célibataire", "Veuf ou veuve", "Divorcé(e)"];
const RELATIONS = ["Conjoint", "Enfant", "Parent", "Frère ou sœur", "Ami", "Autre"];

type Draft = Omit<Account, "kyc" | "createdAt">;
const empty: Draft = { firstName: "", lastName: "", email: "", phone: "", birthDate: "", birthCity: "", birthCountry: "France", address: "", situation: "", isBusinessOwner: false };

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onClick} className={`rounded-2xl px-4 py-3.5 text-left font-semibold ring-2 transition-colors ${on ? "bg-ink text-paper ring-ink" : "bg-paper ring-line hover:ring-ink/30"}`}>
      {children}
    </motion.button>
  );
}

export default function Inscription() {
  const router = useRouter();
  const hydrated = useHydrated();
  const existing = useApp((s) => s.account);
  const me = useApp((s) => s.me);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [d, setD] = useState<Draft>(empty);
  const [people, setPeople] = useState<Person[]>([]);
  const [p, setP] = useState({ firstName: "", lastName: "", relation: "Conjoint", email: "" });
  const [kyc, setKyc] = useState<"idle" | "checking" | "done">("idle");
  // Production: the e-mail address is verified with a one-time code before anything is created.
  const [otp, setOtp] = useState<{ sent: boolean; code: string; busy: boolean; error: string | null }>({ sent: false, code: "", busy: false, error: null });
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [later, setLater] = useState(false);
  const [saving, setSaving] = useState(false);
  const up = (k: keyof Draft) => (v: string | boolean) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (hydrated && existing) router.replace("/espace");
  }, [hydrated, existing, router]);
  useEffect(() => {
    if (me?.email) setD((x) => ({ ...x, email: me.email }));
  }, [me?.email]);

  async function otpStep(fn: () => Promise<void>) {
    setOtp((o) => ({ ...o, busy: true, error: null }));
    try {
      await fn();
      setOtp((o) => ({ ...o, busy: false }));
    } catch (e) {
      setOtp((o) => ({ ...o, busy: false, error: (e as Error).message }));
    }
  }

  const steps = [
    { valid: true },
    { valid: d.firstName && d.lastName && /.+@.+\..+/.test(d.email) && d.phone.length >= 6 && (!PROD || !!me) },
    { valid: d.birthDate && d.birthCity },
    { valid: d.address.length > 5 },
    { valid: !!d.situation },
    { valid: true },
    { valid: PROD ? !!kycFile || later : kyc === "done" },
    { valid: true },
  ];
  const last = steps.length - 1;
  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  async function finish() {
    setSaving(true);
    try {
      await createProfile(d, people);
      if (kycFile) await submitKyc(kycFile);
      router.push("/espace");
    } catch (e) {
      setOtp((o) => ({ ...o, error: (e as Error).message }));
      setSaving(false);
    }
  }

  function verify() {
    // shortcut: simulated; plug the group's existing KYC system here (brief §4.2) — it returns verified identity data.
    setKyc("checking");
    setTimeout(() => setKyc("done"), 2200);
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Aurora />
      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8 pt-5">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          {step > 0 && step < last && <span className="text-[0.9rem] font-semibold text-mist">Étape {step} sur {last - 1}</span>}
        </div>
        {step > 0 && step < last && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-gold-soft to-gold" animate={{ width: `${(step / (last - 1)) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
        )}

        <div className="relative mt-8 flex-1">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ type: "spring", stiffness: 160, damping: 22 }}
              className="space-y-5"
            >
              {step === 0 && (
                <div className="pt-6 text-center">
                  <div className="mx-auto w-fit">
                    <AlmaFace size={120} speaking />
                  </div>
                  <h1 className="mt-6 text-[2.2rem] font-semibold leading-tight">Bonjour, je suis {ASSISTANT_NAME}.</h1>
                  <p className="mt-3 text-[1.1rem] text-ink-soft">Je vais vous aider à créer votre Espace, vérification d&apos;identité comprise. Vous pourrez tout modifier ensuite.</p>
                  <Notice tone="ink">
                    <span className="font-semibold">Rien à retenir.</span> Vous ouvrirez votre Coffre avec une carte et un code, sans mot de passe compliqué.
                  </Notice>
                </div>
              )}

              {step === 1 && (
                <>
                  <div>
                    <Eyebrow>Vous</Eyebrow>
                    <h1 className="mt-2 text-[2rem] font-semibold">Faisons connaissance</h1>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Prénom" value={d.firstName} onChange={up("firstName")} autoFocus />
                    <Field label="Nom" value={d.lastName} onChange={up("lastName")} />
                  </div>
                  {PROD && me ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-sage-soft/60 p-4 text-[0.95rem]">
                      <BadgeCheck className="h-5 w-5 shrink-0 text-sage" /> Adresse vérifiée : <b className="truncate">{me.email}</b>
                    </div>
                  ) : (
                    <Field label="Adresse e-mail" type="email" inputMode="email" value={d.email} onChange={up("email")} hint="Nous recommandons Proton pour une adresse chiffrée, sans obligation." />
                  )}
                  {PROD && !me && (
                    <div className="space-y-3 rounded-2xl bg-paper/70 p-4 ring-1 ring-line">
                      {!otp.sent ? (
                        <Button full variant="outline" disabled={otp.busy || !/.+@.+\..+/.test(d.email)} onClick={() => otpStep(async () => { await sendCode(d.email); setOtp((o) => ({ ...o, sent: true })); })}>
                          {otp.busy ? "Envoi…" : "Vérifier mon adresse (code par e-mail)"}
                        </Button>
                      ) : (
                        <>
                          <Field label="Code reçu par e-mail" inputMode="numeric" value={otp.code} onChange={(v) => setOtp((o) => ({ ...o, code: v.replace(/\D/g, "").slice(0, 6) }))} />
                          <Button full icon={<KeyRound className="h-5 w-5" />} disabled={otp.busy || otp.code.length !== 6} onClick={() => otpStep(() => verifyCode(d.email, otp.code))}>
                            {otp.busy ? "Vérification…" : "Valider le code"}
                          </Button>
                        </>
                      )}
                      {otp.error && <p className="text-[0.9rem] font-semibold text-coral">{otp.error}</p>}
                    </div>
                  )}
                  <Field label="Téléphone mobile" type="tel" inputMode="tel" value={d.phone} onChange={up("phone")} hint="Pour vous alerter en cas d'urgence." />
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <Eyebrow>Votre naissance</Eyebrow>
                    <h1 className="mt-2 text-[2rem] font-semibold">Où et quand êtes-vous né(e) ?</h1>
                  </div>
                  <Field label="Date de naissance" type="date" value={d.birthDate} onChange={up("birthDate")} />
                  <Field label="Ville de naissance" value={d.birthCity} onChange={up("birthCity")} />
                  <Field label="Pays de naissance" value={d.birthCountry} onChange={up("birthCountry")} />
                  <Notice>Ces informations restent dans votre Espace, où notre équipe peut les lire. Elles servent à vérifier votre identité et à la veille mensuelle du fichier public des décès. Le contenu de votre Coffre, lui, reste illisible pour nous.</Notice>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <Eyebrow>Vos cartes</Eyebrow>
                    <h1 className="mt-2 text-[2rem] font-semibold">Où livrer vos cartes ?</h1>
                  </div>
                  <Field label="Adresse postale" multiline value={d.address} onChange={up("address")} placeholder={"12 rue des Lilas\n75011 Paris"} />
                </>
              )}

              {step === 4 && (
                <>
                  <div>
                    <Eyebrow>Votre famille</Eyebrow>
                    <h1 className="mt-2 text-[2rem] font-semibold">Qui compte pour vous ?</h1>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SITUATIONS.map((s) => (
                      <Choice key={s} on={d.situation === s} onClick={() => up("situation")(s)}>
                        {s}
                      </Choice>
                    ))}
                  </div>
                  <div className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {people.map((x) => (
                        <motion.div key={x.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 rounded-2xl bg-paper p-3.5 ring-1 ring-line">
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-sage-soft text-sage">
                            <UserRound className="h-5 w-5" />
                          </span>
                          <span className="flex-1">
                            <span className="block font-semibold">{x.firstName} {x.lastName}</span>
                            <span className="text-[0.85rem] text-mist">{x.relation}</span>
                          </span>
                          <button onClick={() => setPeople((l) => l.filter((y) => y.id !== x.id))} aria-label="Retirer" className="rounded-full p-2 hover:bg-ink/5">
                            <Trash className="h-4 w-4" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="space-y-3 rounded-[1.75rem] bg-paper/70 p-4 ring-1 ring-line">
                    <div className="text-[0.95rem] font-semibold">Ajouter un proche</div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Prénom" value={p.firstName} onChange={(v) => setP({ ...p, firstName: v })} />
                      <Field label="Nom" value={p.lastName} onChange={(v) => setP({ ...p, lastName: v })} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {RELATIONS.map((r) => (
                        <button key={r} type="button" onClick={() => setP({ ...p, relation: r })} className={`rounded-full px-3.5 py-2 text-[0.88rem] font-semibold ring-1 ${p.relation === r ? "bg-ink text-paper ring-ink" : "ring-line"}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                    <Field label="E-mail (facultatif)" type="email" value={p.email} onChange={(v) => setP({ ...p, email: v })} />
                    <Button
                      variant="outline"
                      full
                      icon={<Plus className="h-5 w-5" />}
                      disabled={!p.firstName}
                      onClick={() => {
                        setPeople((l) => [...l, { id: uid(), ...p }]);
                        setP({ firstName: "", lastName: d.lastName, relation: "Enfant", email: "" });
                      }}
                    >
                      Ajouter
                    </Button>
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <div>
                    <Eyebrow>Votre activité</Eyebrow>
                    <h1 className="mt-2 text-[2rem] font-semibold">Êtes-vous chef d'entreprise ?</h1>
                    <p className="mt-2 text-ink-soft">Si oui, une rubrique « Entreprise » s'ajoute à votre Coffre : banques professionnelles, baux, clients, équipe, accès.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[true, false].map((v) => (
                      <motion.button key={String(v)} whileTap={{ scale: 0.97 }} onClick={() => up("isBusinessOwner")(v)} className={`flex flex-col items-center gap-3 rounded-[1.75rem] p-6 ring-2 ${d.isBusinessOwner === v ? "bg-ink text-paper ring-ink" : "bg-paper ring-line"}`}>
                        {v ? <Building className="h-8 w-8" /> : <UserRound className="h-8 w-8" />}
                        <span className="font-semibold">{v ? "Oui" : "Non"}</span>
                      </motion.button>
                    ))}
                  </div>
                </>
              )}

              {step === 6 && PROD && (
                <>
                  <div>
                    <Eyebrow>Vérification</Eyebrow>
                    <h1 className="mt-2 text-[2rem] font-semibold">Vérifions votre identité</h1>
                    <p className="mt-2 text-ink-soft">Déposez une photo de votre carte d&apos;identité ou de votre passeport. Notre équipe la vérifie ; elle ne sert qu&apos;à cela.</p>
                  </div>
                  {/* shortcut: manual check by the team until the group's KYC system is connected (kyc-webhook function). */}
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
                    <FileUp className="h-6 w-6 shrink-0 text-gold-deep" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Pièce d&apos;identité</span>
                      <span className="block truncate text-[0.85rem] text-mist">{kycFile ? kycFile.name : "Photo ou PDF, 20 Mo maximum"}</span>
                    </span>
                    {kycFile && <Check className="h-5 w-5 text-sage" />}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && f.size <= 20 * 1024 * 1024 && (f.type.startsWith("image/") || f.type === "application/pdf")) setKycFile(f);
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => setLater(!later)} aria-pressed={later} className="flex w-full items-start gap-3 text-left">
                    <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ring-2 ${later ? "bg-ink ring-ink" : "ring-line"}`}>{later && <Check className="h-4 w-4 text-paper" strokeWidth={3} />}</span>
                    <span className="text-[0.95rem] text-ink-soft">Je le ferai plus tard, depuis « Mon compte ».</span>
                  </button>
                </>
              )}

              {step === 6 && !PROD && (
                <>
                  <div>
                    <Eyebrow>Vérification</Eyebrow>
                    <h1 className="mt-2 text-[2rem] font-semibold">Vérifions votre identité</h1>
                    <p className="mt-2 text-ink-soft">Avec le système de vérification utilisé par votre conseiller. Cela prend une minute.</p>
                  </div>
                  <div className="grid place-items-center rounded-[2rem] bg-paper p-8 ring-1 ring-line">
                    <AnimatePresence mode="wait">
                      {kyc === "done" ? (
                        <motion.div key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                          <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-sage text-paper shadow-lift">
                            <BadgeCheck className="h-12 w-12" />
                          </span>
                          <div className="mt-4 text-[1.2rem] font-semibold">Identité vérifiée</div>
                        </motion.div>
                      ) : (
                        <motion.div key="scan" className="relative grid h-32 w-32 place-items-center">
                          <ScanFace className="h-20 w-20 text-ink-soft" />
                          {kyc === "checking" && <motion.span className="absolute inset-x-2 h-1 rounded-full bg-gold shadow-glow" initial={{ top: 8 }} animate={{ top: [8, 120, 8] }} transition={{ duration: 1.6, repeat: Infinity }} />}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {kyc !== "done" && (
                      <Button className="mt-6" onClick={verify} disabled={kyc === "checking"}>
                        {kyc === "checking" ? "Vérification…" : "Vérifier mon identité"}
                      </Button>
                    )}
                  </div>
                </>
              )}

              {step === last && (
                <div className="pt-8 text-center">
                  <div className="relative mx-auto h-28 w-28">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <motion.span key={i} className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full bg-gold" initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos((i / 14) * Math.PI * 2) * 90, y: Math.sin((i / 14) * Math.PI * 2) * 90, opacity: 0 }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }} />
                    ))}
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-b from-gold-soft to-gold shadow-glow">
                      <Check className="h-14 w-14 text-night" strokeWidth={2.5} />
                    </motion.span>
                  </div>
                  <h1 className="mt-8 text-[2.2rem] font-semibold leading-tight">Votre Espace est prêt, {d.firstName}.</h1>
                  <p className="mt-3 text-[1.1rem] text-ink-soft">Prochaine étape : commander vos trois cartes et désigner vos bénéficiaires. Ensuite, l&apos;essentiel de votre Coffre, à votre rythme.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex gap-3">
          {step > 0 && step < last && (
            <Button variant="outline" onClick={() => go(step - 1)} aria-label="Retour" className="!px-4">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {step < last ? (
            <Button full variant={step === 0 ? "gold" : "primary"} disabled={!steps[step].valid} onClick={() => go(step + 1)} icon={<ArrowRight className="h-5 w-5" />}>
              {step === 0 ? "Commencer" : "Continuer"}
            </Button>
          ) : (
            <Button full variant="gold" onClick={finish} disabled={saving} icon={<ArrowRight className="h-5 w-5" />}>
              {saving ? "Création de votre Espace…" : "Découvrir mon Espace"}
            </Button>
          )}
        </div>
        {step === last && otp.error && <p className="mt-3 text-center font-semibold text-coral">{otp.error}</p>}
        {step === 0 && (
          <Link href="/connexion" className="mt-4 text-center font-semibold text-ink-soft underline-offset-4 hover:underline">
            J'ai déjà un compte
          </Link>
        )}
      </div>
    </div>
  );
}
