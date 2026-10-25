"use client";
import { motion } from "motion/react";
import { ArrowRight, KeyRound, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useHydrated } from "@/components/providers";
import { Button, Field, Notice } from "@/components/ui";
import { Aurora, Logo } from "@/components/visuals";
import { sendCode, verifyCode } from "@/lib/api";
import { DEMO_PIN, seedDemo } from "@/lib/demo";
import { PROD } from "@/lib/env";
import { useApp } from "@/lib/store";

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
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
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
        <Link href="/" className="mb-10">
          <Logo />
        </Link>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-[2.2rem] font-semibold leading-tight">
          Bon retour parmi nous
        </motion.h1>
        <p className="mt-3 text-[1.08rem] text-ink-soft">{PROD ? "Recevez un code de connexion par e-mail. Pas de mot de passe à retenir." : "Recevez un lien de connexion par e-mail. Pas de mot de passe à retenir."}</p>

        {!sent ? (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!PROD) {
                if (account && account.email.toLowerCase() === email.toLowerCase()) router.push("/espace");
                else setSent(true);
                return;
              }
              void run(async () => {
                await sendCode(email);
                setSent(true);
              });
            }}
          >
            <Field label="Adresse e-mail" type="email" inputMode="email" value={email} onChange={setEmail} />
            <Button full icon={<Mail className="h-5 w-5" />} disabled={busy || !/.+@.+\..+/.test(email)}>
              {busy ? "Envoi…" : PROD ? "Recevoir mon code" : "Recevoir mon lien"}
            </Button>
          </form>
        ) : PROD ? (
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
            <Notice tone="sage">Un code à 6 chiffres vient d&apos;être envoyé à {email}. Il est valable une heure.</Notice>
            <Field label="Code reçu par e-mail" inputMode="numeric" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} autoFocus />
            <Button full icon={<KeyRound className="h-5 w-5" />} disabled={busy || code.length !== 6}>
              {busy ? "Vérification…" : "Me connecter"}
            </Button>
            <button type="button" className="w-full text-center text-[0.92rem] font-semibold text-ink-soft" onClick={() => { setSent(false); setCode(""); }}>
              Changer d&apos;adresse ou renvoyer un code
            </button>
          </form>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <Notice tone="sage">Si un compte existe pour cette adresse, un lien vient de vous être envoyé.</Notice>
          </motion.div>
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
      </div>
    </div>
  );
}
