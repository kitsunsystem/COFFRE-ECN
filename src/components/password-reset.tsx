"use client";
// A new password with a 6-digit code received by e-mail: forgotten on the sign-in page, or changed from Compte.
import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";
import { forgotPassword, PASSWORD_RULE, resetPassword } from "@/lib/api";
import { Button, Field, Notice } from "./ui";

export function PasswordReset({ email, onDone }: { email: string; onDone: () => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-4">
      {!sent ? (
        <Button full variant="outline" icon={<Mail className="h-5 w-5" />} disabled={busy || !/.+@.+\..+/.test(email)} onClick={() => run(async () => (await forgotPassword(email), setSent(true)))}>
          {busy ? "Envoi…" : "Recevoir un code par e-mail"}
        </Button>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => (await resetPassword(email, code, password), onDone()));
          }}
        >
          <Notice tone="sage">Un code à 6 chiffres vient d&apos;être envoyé à {email}.</Notice>
          <Field label="Code reçu par e-mail" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} />
          <Field label="Nouveau mot de passe" type="password" autoComplete="new-password" value={password} onChange={setPassword} hint="10 caractères au moins, avec une majuscule, une minuscule et un chiffre." />
          <Button full icon={<KeyRound className="h-5 w-5" />} disabled={busy || code.length !== 6 || !PASSWORD_RULE.test(password)}>
            {busy ? "Vérification…" : "Changer le mot de passe"}
          </Button>
        </form>
      )}
      {error && <p className="font-semibold text-coral">{error}</p>}
    </div>
  );
}
