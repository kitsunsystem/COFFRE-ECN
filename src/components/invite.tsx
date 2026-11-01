"use client";
// Every relative has their own account. Nothing is sent for the owner: they send this message themselves, from their
// own e-mail (or anywhere else, copied), so their relatives hear it from them.
import { Check, ClipboardCopy, Mail } from "lucide-react";
import { useState } from "react";
import { APP_NAME } from "@/lib/config";
import { APP_URL } from "@/lib/env";
import { tr } from "@/lib/i18n";
import { copyText } from "@/lib/native";
import { useApp, type Person } from "@/lib/store";
import { Button, Notice } from "./ui";

export function inviteMessage(p: Person, owner: { firstName: string; lastName: string }) {
  const link = `${APP_URL || location.origin + (process.env.NEXT_PUBLIC_BASE_PATH ?? "")}/connexion/?suite=/proche`;
  const subject = tr(`${owner.firstName} ${owner.lastName} vous a ajouté(e) à ses proches`);
  const body = [
    tr(`Bonjour ${p.firstName},`),
    tr(`Je vous ai ajouté(e) parmi mes proches dans ${APP_NAME}, mon coffre de vie et de succession.`),
    tr(`Pour pouvoir un jour ouvrir ce que je vous confie, créez votre compte gratuit avec cette adresse : ${p.email}.`),
    tr("Installez ensuite l'application sur votre téléphone et demandez votre accès : votre visage et un code à 6 chiffres. Je validerai votre demande."),
    link,
    tr("Merci,"),
    owner.firstName,
  ].join("\n\n");
  return { subject, body };
}

export function Invite({ person, onDone }: { person: Person; onDone: () => void }) {
  const account = useApp((s) => s.account)!;
  const [copied, setCopied] = useState(false);
  if (!person.email) return <Notice tone="gold">Ajoutez d&apos;abord son adresse e-mail : c&apos;est avec elle qu&apos;il ou elle crée son compte.</Notice>;
  const m = inviteMessage(person, account);
  const email = person.email;
  return (
    <div className="space-y-4">
      <p className="text-ink-soft">{`${person.firstName} doit créer son compte avec ${person.email}. Envoyez-lui ce message vous-même : il part de votre messagerie, rien n'est envoyé à votre place.`}</p>
      <div className="notranslate whitespace-pre-line rounded-2xl bg-ink/[0.04] p-4 text-[0.92rem] text-ink-soft">{m.body}</div>
      <Button
        full
        variant="gold"
        icon={<Mail className="h-5 w-5" />}
        onClick={() => {
          // Opens the owner's own e-mail app with the message ready: they press send themselves.
          location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
          onDone();
        }}
      >
        Envoyer par e-mail
      </Button>
      <Button
        full
        variant="outline"
        icon={copied ? <Check className="h-5 w-5" /> : <ClipboardCopy className="h-5 w-5" />}
        onClick={async () => {
          await copyText(m.body);
          setCopied(true);
        }}
      >
        {copied ? "Copié : collez-le où vous voulez" : "Copier le message"}
      </Button>
    </div>
  );
}
