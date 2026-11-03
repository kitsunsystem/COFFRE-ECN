"use client";
// Every relative has their own account. Nothing is sent for the owner: they send this message themselves, with the app
// of their choice (WhatsApp, Telegram, SMS, e-mail, the share sheet) or copied, so their relatives hear it from them.
import { Check, ClipboardCopy, Mail, MessageCircle, MessageSquare, Send, Share2 } from "lucide-react";
import { useState } from "react";
import { APP_NAME } from "@/lib/config";
import { APP_URL } from "@/lib/env";
import { tr } from "@/lib/i18n";
import { canShare, copyText, isNative, isPhoneBrowser, shareText } from "@/lib/native";
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
  return { subject, body, link };
}

export function Invite({ person, onDone }: { person: Person; onDone: () => void }) {
  const account = useApp((s) => s.account)!;
  const [copied, setCopied] = useState(false);
  if (!person.email) return <Notice tone="gold">Ajoutez d&apos;abord son adresse e-mail : c&apos;est avec elle qu&apos;il ou elle crée son compte.</Notice>;
  const m = inviteMessage(person, account);
  const text = encodeURIComponent(m.body);
  const apps = [
    { label: "WhatsApp", icon: MessageCircle, url: `https://wa.me/?text=${text}` },
    // Telegram puts the link on top of the text: the link is not repeated inside it.
    { label: "Telegram", icon: Send, url: `https://t.me/share/url?url=${encodeURIComponent(m.link)}&text=${encodeURIComponent(m.body.replace(`\n\n${m.link}`, ""))}` },
    ...(isNative() || isPhoneBrowser() ? [{ label: "SMS", icon: MessageSquare, url: `sms:?&body=${text}` }] : []),
    { label: "E-mail", icon: Mail, url: `mailto:${encodeURIComponent(person.email)}?subject=${encodeURIComponent(m.subject)}&body=${text}` },
  ];
  // Opens the owner's own app with the message ready: they choose the contact and press send themselves.
  const send = (url: string) => {
    // On a computer WhatsApp and Telegram open in a new tab; in the app, the phone opens every outside link itself.
    if (url.startsWith("https:") && !isNative()) window.open(url, "_blank", "noopener");
    else location.assign(url);
    onDone();
  };
  return (
    <div className="space-y-4">
      <p className="text-ink-soft">{`${person.firstName} doit créer son compte avec ${person.email}. Envoyez-lui ce message vous-même : il part de votre messagerie, rien n'est envoyé à votre place.`}</p>
      <div className="notranslate whitespace-pre-line rounded-2xl bg-ink/[0.04] p-4 text-[0.92rem] text-ink-soft">{m.body}</div>
      <div className="grid grid-cols-2 gap-2">
        {apps.map((a, i) => (
          <Button key={a.label} variant="outline" className={i === apps.length - 1 && apps.length % 2 ? "col-span-2" : ""} icon={<a.icon className="h-5 w-5 shrink-0" />} onClick={() => send(a.url)}>
            {a.label}
          </Button>
        ))}
      </div>
      {canShare() && (
        <Button
          full
          variant="outline"
          icon={<Share2 className="h-5 w-5" />}
          onClick={async () => {
            if (await shareText(m.subject, m.body)) onDone();
          }}
        >
          Autre application
        </Button>
      )}
      <Button
        full
        variant="ghost"
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
