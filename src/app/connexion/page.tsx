"use client";
import { motion } from "motion/react";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated } from "@/components/providers";
import { Button, Field, Notice } from "@/components/ui";
import { Aurora, Logo } from "@/components/visuals";
import { DEMO_PIN, seedDemo } from "@/lib/demo";
import { useApp } from "@/lib/store";

export default function Connexion() {
  const router = useRouter();
  useHydrated();
  const account = useApp((s) => s.account);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

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
        <p className="mt-3 text-[1.08rem] text-ink-soft">Recevez un lien de connexion par e-mail. Pas de mot de passe à retenir.</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            // shortcut: Supabase magic link (signInWithOtp) once the project keys are provided.
            if (account && account.email.toLowerCase() === email.toLowerCase()) router.push("/espace");
            else setSent(true);
          }}
        >
          <Field label="Adresse e-mail" type="email" inputMode="email" value={email} onChange={setEmail} />
          <Button full icon={<Mail className="h-5 w-5" />} disabled={!/.+@.+\..+/.test(email)}>
            Recevoir mon lien
          </Button>
        </form>
        {sent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <Notice tone="sage">Si un compte existe pour cette adresse, un lien vient de vous être envoyé.</Notice>
          </motion.div>
        )}
        <div className="my-8 flex items-center gap-3 text-[0.85rem] text-mist">
          <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
        </div>
        <Button
          variant="gold"
          full
          disabled={busy}
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
        <Link href="/inscription" className="mt-8 flex items-center justify-center gap-2 font-semibold">
          Créer un compte <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
