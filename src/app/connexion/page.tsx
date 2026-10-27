"use client";
import { motion } from "motion/react";
import { ArrowRight, KeyRound, LogIn, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PasswordReset } from "@/components/password-reset";
import { useHydrated } from "@/components/providers";
import { Button, Field, Notice } from "@/components/ui";
import { LangPicker } from "@/components/lang-picker";
import { Aurora, Logo } from "@/components/visuals";
import { PASSWORD_RULE, signIn, signUp, verifyCode } from "@/lib/api";
import { DEMO_PIN, seedDemo } from "@/lib/demo";
import { PROD } from "@/lib/env";
import { isNative } from "@/lib/native";
import { useApp } from "@/lib/store";

const still = () => () => {};

// Where to go once signed in: one's own Espace, the page for relatives (guarantor, beneficiary), or the sign-up.
function landing() {
  const st = useApp.getState();
  const next = new URLSearchParams(location.search).get("suite");
  if (next?.startsWith("/") && !next.startsWith("//")) return next;
  return st.account ? "/espace" : st.trusts.length ? "/proche" : "/inscription";
}

export default function Connexion() {
  const router = useRouter();
  const hydrated = useHydrated();
  const account = useApp((s) => s.account);
  const me = useApp((s) => s.me);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // "create": a relative invited by e-mail creates their access (the Espace sign-up is /inscription);
  // "confirm": a code has just been sent to confirm the address; "forgot": new password with a code.
  const [step, setStep] = useState<"login" | "create" | "confirm" | "forgot">("login");
  const [busy, setBusy] = useState(false);
  const app = useSyncExternalStore(still, isNative, () => false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (PROD && hydrated && me) router.replace(landing());
  }, [hydrated, me, router]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Aurora />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <LangPicker compact />
        </div>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-[2.2rem] font-semibold leading-tight">
          Bon retour parmi nous
        </motion.h1>
        <p className="mt-3 text-[1.08rem] text-ink-soft">Votre adresse e-mail et votre mot de passe ouvrent l&apos;Espace. Le Coffre, lui, s&apos;ouvre avec votre carte.</p>

        {step === "login" || step === "create" ? (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!PROD) {
                if (account && account.email.toLowerCase() === email.trim().toLowerCase()) router.push("/espace");
                else setError("Aucun compte avec cette adresse dans la démonstration : découvrez-la ci-dessous.");
                return;
              }
              void run(async () => {
                if (step === "create") {
                  await signUp(email, password);
                  setStep("confirm");
                } else if ((await signIn(email, password)) === "unconfirmed") setStep("confirm");
                else router.replace(landing());
              });
            }}
          >
            <Field label="Adresse e-mail" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} />
            {step === "create" ? (
              <Field label="Choisissez un mot de passe" type="password" autoComplete="new-password" value={password} onChange={setPassword} hint="10 caractères au moins, avec une majuscule, une minuscule et un chiffre." />
            ) : (
              <Field label="Mot de passe" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
            )}
            <Button full icon={<LogIn className="h-5 w-5" />} disabled={busy || !/.+@.+\..+/.test(email) || (step === "create" ? !PASSWORD_RULE.test(password) : !password)}>
              {busy ? "Un instant…" : step === "create" ? "Créer mon accès" : "Me connecter"}
            </Button>
            {PROD && (
              <div className="flex flex-col items-center gap-2 text-[0.92rem] font-semibold text-ink-soft">
                {step === "login" && (
                  <button type="button" onClick={() => (setError(null), setStep("forgot"))}>
                    Mot de passe oublié ?
                  </button>
                )}
                <button type="button" onClick={() => (setError(null), setStep(step === "login" ? "create" : "login"))}>
                  {step === "login" ? "Invité par un proche ? Créez votre accès" : "J'ai déjà un accès : me connecter"}
                </button>
              </div>
            )}
          </form>
        ) : step === "confirm" ? (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await verifyCode(email, code);
                router.replace(landing());
              });
            }}
          >
            <Notice tone="sage">Pour confirmer votre adresse, un code à 6 chiffres vient d&apos;être envoyé à {email}.</Notice>
            <Field label="Code reçu par e-mail" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} autoFocus />
            <Button full icon={<KeyRound className="h-5 w-5" />} disabled={busy || code.length !== 6}>
              {busy ? "Vérification…" : "Confirmer et me connecter"}
            </Button>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <Field label="Adresse e-mail" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} />
            <PasswordReset email={email} onDone={() => router.replace(landing())} />
            <button type="button" className="w-full text-center text-[0.92rem] font-semibold text-ink-soft" onClick={() => setStep("login")}>
              Revenir à la connexion
            </button>
          </div>
        )}
        {error && <p className="mt-3 font-semibold text-coral">{error}</p>}

        {!PROD && (
          <>
            <div className="my-8 flex items-center gap-3 text-[0.85rem] text-mist">
              <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
            </div>
            <Button
              variant="gold"
              full
              // Not before the saved state is loaded: it would overwrite the freshly seeded family.
              disabled={busy || !hydrated}
              icon={<Sparkles className="h-5 w-5" />}
              onClick={async () => {
                setBusy(true);
                await seedDemo();
                router.push("/espace");
              }}
            >
              {busy ? "Préparation de la démonstration…" : "Découvrir la démonstration"}
            </Button>
            <p className="mt-3 text-center text-[0.88rem] text-mist">Famille Durand fictive. Code de toutes les cartes : {DEMO_PIN}.</p>
          </>
        )}
        <Link href="/inscription" className="mt-8 flex items-center justify-center gap-2 font-semibold">
          Créer un compte <ArrowRight className="h-4 w-4" />
        </Link>
        {app && (
          <Link href="/test-carte" className="mt-4 text-center text-[0.88rem] font-semibold text-mist">
            Tester une carte
          </Link>
        )}
      </div>
    </div>
  );
}
