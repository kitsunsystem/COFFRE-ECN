"use client";
import { motion } from "motion/react";
import { BadgeCheck, Bell, CalendarClock, ChevronRight, CreditCard, FileUp, FlaskConical, Info, LogOut, Mail, ShieldCheck, Trash, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { LangPicker } from "@/components/lang-picker";
import { tr } from "@/lib/i18n";
import { ThemePicker } from "@/components/theme-picker";
import { Badge, Button, Card, Field, Notice, PageTitle, Sheet, Toggle } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { deleteAccount, openBillingPortal, openCheckout, saveAccount, setAssistantVoice, signOut, submitKyc } from "@/lib/api";
import { LAUNCH, OFFER, SUPPORT_EMAIL } from "@/lib/config";
import { PROD } from "@/lib/env";
import { graceEnd } from "@/lib/rules";
import { useApp, type Account } from "@/lib/store";
import { lock } from "@/lib/vault";

export default function Compte() {
  const s = useApp(useShallow((x) => ({ account: x.account!, outbox: x.outbox, reminders: x.reminders, cards: x.cards, people: x.people, assistantVoice: x.assistantVoice, billing: x.billing, phase: x.phase, staffRole: x.staffRole, set: x.set })));
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [erase, setErase] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState<string | null>(null);
  const a = s.account;
  const packs = new Set(s.cards.filter((c) => c.holderId !== "owner").map((c) => c.holderId)).size;
  const opened = s.outbox.find((m) => m.id === mail);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <PageTitle eyebrow="Mon compte" title={`${a.firstName} ${a.lastName}`} lead={a.email} />

      <motion.div variants={rise}>
        <Card>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Mes coordonnées</div>
            <button onClick={() => setEdit(true)} className="text-[0.9rem] font-semibold text-gold-deep">
              Modifier
            </button>
          </div>
          <dl className="mt-3 grid gap-2 text-[0.95rem]">
            {[
              ["Téléphone", a.phone],
              ["Naissance", `${new Date(a.birthDate).toLocaleDateString("fr-FR")} à ${a.birthCity} (${a.birthCountry})`],
              ["Adresse", a.address.replace(/\n/g, ", ")],
              ["Situation", a.situation],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-28 shrink-0 text-mist">{k}</dt>
                <dd className="flex-1">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </motion.div>

      <motion.div variants={rise}>
        <Card>
          <div className="flex items-center gap-3">
            <BadgeCheck className={`h-7 w-7 ${a.kyc === "verifie" ? "text-sage" : "text-gold-deep"}`} />
            <div className="flex-1">
              <div className="font-semibold">Identité {a.kyc === "verifie" ? "vérifiée" : a.kyc === "en_cours" ? "en cours de vérification" : "à vérifier"}</div>
              <div className="text-[0.88rem] text-mist">Pour que personne ne puisse se faire passer pour vous</div>
            </div>
          </div>
          {PROD && a.kyc === "a_faire" && (
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-gold-soft/50 p-4 ring-1 ring-gold/30">
              <FileUp className="h-6 w-6 shrink-0 text-gold-deep" />
              <span className="flex-1 font-semibold">{busy ? "Envoi…" : "Déposer ma pièce d'identité"}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  await submitKyc(f);
                  setBusy(false);
                }}
              />
            </label>
          )}
          <div className="mt-4 rounded-2xl bg-ink/[0.04] p-4 text-[0.92rem] text-ink-soft">
            <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
              <Info className="h-4 w-4" /> Qui peut lire quoi ?
            </div>
            Votre identité, vos coordonnées et les noms de vos proches sont dans l'Espace : nous pouvons les lire, pour vérifier votre identité, surveiller le registre des décès et vous accompagner. Le contenu de votre Coffre, lui, est chiffré sur votre téléphone : personne chez nous ne peut le lire.
          </div>
        </Card>
      </motion.div>

      <motion.div variants={rise}>
        <Card>
          <div className="flex items-center gap-3">
            <Users className="h-7 w-7 text-gold-deep" />
            <div className="flex-1">
              <div className="font-semibold">Formule simple</div>
              <div className="text-[0.88rem] text-mist">
                {OFFER.ownerCards} cartes incluses · un pack de {OFFER.packCards} cartes par bénéficiaire
              </div>
            </div>
            <Badge tone={s.billing.status === "a_jour" ? "sage" : "coral"}>{s.billing.status === "a_jour" ? "À jour" : s.billing.status === "impaye" ? "Impayé" : "Effacé"}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-ink/[0.04] p-3">
              <div className="font-display text-[1.6rem] font-semibold">{OFFER.price ? `${OFFER.price} €` : "—"}</div>
              <div className="text-[0.8rem] text-mist">par an</div>
            </div>
            <div className="rounded-2xl bg-ink/[0.04] p-3">
              <div className="font-display text-[1.6rem] font-semibold">{packs}</div>
              <div className="text-[0.8rem] text-mist">pack{packs > 1 ? "s" : ""} bénéficiaire{packs > 1 ? "s" : ""}</div>
            </div>
          </div>
          {s.phase === "decouverte" && <p className="mt-3 text-[0.85rem] text-mist">Phase découverte{LAUNCH.discoveryPrice ? ` (${LAUNCH.discoveryPrice} €)` : ""} : tout est ouvert sauf l&apos;ajout de documents. Lancement officiel prévu {LAUNCH.plannedDate ?? "à une date communiquée prochainement"}.</p>}
          {!OFFER.price && <p className="mt-2 text-[0.85rem] text-mist">Tarifs communiqués au lancement.</p>}
          {s.billing.status === "impaye" && s.billing.since && (
            <div className="mt-4">
              <Notice tone="coral">
                <p>Paiement non reçu. Sans régularisation avant le {new Date(graceEnd(s.billing.since)).toLocaleDateString("fr-FR", { dateStyle: "long" })}, votre Coffre sera effacé définitivement.</p>
                <Button className="mt-3" variant="danger" onClick={() => (PROD ? openBillingPortal() : s.set({ billing: { status: "a_jour" } }))}>
                  {PROD ? "Régulariser maintenant" : "Régulariser (démo)"}
                </Button>
              </Notice>
            </div>
          )}
          {s.billing.status === "efface" && <p className="mt-3 text-[0.88rem] font-semibold text-coral">Le délai de grâce est dépassé : le contenu du Coffre a été effacé.</p>}
          {PROD && OFFER.price && (
            <div className="mt-4 grid gap-2">
              <Button full variant="gold" icon={<CreditCard className="h-5 w-5" />} onClick={() => openCheckout()}>
                Souscrire ou renouveler
              </Button>
              <Button full variant="ghost" onClick={() => openBillingPortal()}>
                Factures et moyen de paiement
              </Button>
            </div>
          )}
        </Card>
      </motion.div>

      <motion.section variants={rise}>
        <h2 className="mb-3 text-[1.3rem] font-semibold">Couleurs de l&apos;application</h2>
        <ThemePicker />
      </motion.section>

      <motion.section variants={rise}>
        <h2 className="mb-3 text-[1.3rem] font-semibold">Langue</h2>
        <LangPicker />
      </motion.section>

      <motion.div variants={rise} className="space-y-2.5">
        <Toggle checked={s.assistantVoice} onChange={(v) => void setAssistantVoice(v)} label="L'assistante parle à voix haute" hint="Les réponses sont lues automatiquement" />
        <Link href="/espace/cartes" className="flex items-center gap-4 rounded-2xl bg-paper p-4 ring-1 ring-line">
          <CreditCard className="h-6 w-6 text-gold-deep" />
          <span className="flex-1 font-semibold">Mes cartes</span>
          <ChevronRight className="h-5 w-5 text-mist" />
        </Link>
        <Link href="/espace/echeances" className="flex items-center gap-4 rounded-2xl bg-paper p-4 ring-1 ring-line">
          <CalendarClock className="h-6 w-6 text-gold-deep" />
          <span className="flex-1 font-semibold">Mes échéances et rappels</span>
          <ChevronRight className="h-5 w-5 text-mist" />
        </Link>
        <Link href="/espace/procedures" className="flex items-center gap-4 rounded-2xl bg-paper p-4 ring-1 ring-line">
          <Bell className="h-6 w-6 text-gold-deep" />
          <span className="flex-1 font-semibold">Coup dur et décès : signalements</span>
          <ChevronRight className="h-5 w-5 text-mist" />
        </Link>
        {!PROD && (
          <Link href="/espace/demo" className="flex items-center gap-4 rounded-2xl bg-paper p-4 ring-1 ring-line">
            <FlaskConical className="h-6 w-6 text-gold-deep" />
            <span className="flex-1">
              <span className="block font-semibold">Mode démonstration</span>
              <span className="text-[0.85rem] text-mist">Avancer le temps, simuler la veille des décès</span>
            </span>
            <ChevronRight className="h-5 w-5 text-mist" />
          </Link>
        )}
        {PROD && s.staffRole && (
          <Link href="/admin" className="flex items-center gap-4 rounded-2xl bg-paper p-4 ring-1 ring-line">
            <ShieldCheck className="h-6 w-6 text-gold-deep" />
            <span className="flex-1 font-semibold">Administration</span>
            <ChevronRight className="h-5 w-5 text-mist" />
          </Link>
        )}
      </motion.div>

      {!PROD && (
      <motion.section variants={rise}>
        <h2 className="mb-1 text-[1.3rem] font-semibold">E-mails envoyés</h2>
        <p className="mb-3 text-[0.9rem] text-mist">
          {s.reminders.length} rappel{s.reminders.length > 1 ? "s" : ""} d'échéance programmé{s.reminders.length > 1 ? "s" : ""}. Les e-mails ne contiennent jamais le contenu du Coffre.
        </p>
        <div className="space-y-2">
          {s.outbox.slice(0, 12).map((m) => (
            <button key={m.id} onClick={() => setMail(m.id)} className="flex w-full items-center gap-3 rounded-2xl bg-paper p-3.5 text-left ring-1 ring-line">
              <Mail className="h-5 w-5 shrink-0 text-mist" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{m.subject}</span>
                <span className="block truncate text-[0.82rem] text-mist">
                  À {m.to} · {new Date(m.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </span>
            </button>
          ))}
          {s.outbox.length === 0 && <p className="text-[0.9rem] text-mist">Aucun e-mail pour l'instant.</p>}
        </div>
      </motion.section>
      )}

      <motion.div variants={rise} className="space-y-3 pt-2">
        <Button
          full
          variant="outline"
          icon={<LogOut className="h-5 w-5" />}
          onClick={async () => {
            // Demo: signing out wipes the data on this device. Production: the session ends, nothing stays on the device.
            lock();
            await signOut();
            router.replace("/");
          }}
        >
          Se déconnecter
        </Button>
        {PROD && (
          <Button full variant="ghost" className="!text-coral" icon={<Trash className="h-4 w-4" />} onClick={() => setErase(true)}>
            Supprimer mon compte
          </Button>
        )}
        <p className="text-center text-[0.85rem] text-mist">
          Une question ? <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-ink underline">{SUPPORT_EMAIL}</a>
        </p>
      </motion.div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Mes coordonnées">
        <AccountForm value={a} onSave={async (account) => { if (await saveAccount(account)) setEdit(false); }} />
      </Sheet>

      <Sheet open={erase} onClose={() => setErase(false)} title="Supprimer mon compte">
        <div className="space-y-4">
          <p className="text-ink-soft">Votre Espace, votre Coffre, ses documents et les accès de vos proches seront effacés définitivement. Personne, pas même nous, ne pourra les récupérer.</p>
          <Field label="Pour confirmer, tapez SUPPRIMER" value={confirmText} onChange={setConfirmText} />
          <Button full variant="danger" disabled={busy || confirmText.trim().toUpperCase() !== tr("SUPPRIMER")} onClick={async () => { setBusy(true); if (await deleteAccount()) router.replace("/"); setBusy(false); }}>
            {busy ? "Suppression…" : "Tout supprimer définitivement"}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!opened} onClose={() => setMail(null)} title={opened?.subject}>
        {opened && (
          <div className="rounded-2xl bg-paper p-5 ring-1 ring-line">
            <div className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-gold-deep">À {opened.to}</div>
            <h3 className="mt-2 text-[1.4rem] font-semibold">{opened.title}</h3>
            {opened.body.map((p) => (
              <p key={p} className="mt-3 text-ink-soft">{p}</p>
            ))}
          </div>
        )}
      </Sheet>
    </motion.div>
  );
}

function AccountForm({ value, onSave }: { value: Account; onSave: (a: Account) => void }) {
  const [a, setA] = useState(value);
  const up = (k: keyof Account) => (v: string) => setA({ ...a, [k]: v });
  return (
    <div className="space-y-4">
      <Field label="Téléphone" type="tel" inputMode="tel" value={a.phone} onChange={up("phone")} />
      <Field label="E-mail" type="email" inputMode="email" value={a.email} onChange={up("email")} />
      <Field label="Adresse" multiline value={a.address} onChange={up("address")} />
      <Field label="Situation familiale" value={a.situation} onChange={up("situation")} />
      <Toggle checked={a.isBusinessOwner} onChange={(isBusinessOwner) => setA({ ...a, isBusinessOwner })} label="Je dirige une entreprise" hint="Ajoute la rubrique « Entreprise » au Coffre" />
      <p className="text-[0.85rem] text-mist">Nom, prénom et naissance sont vérifiés avec votre identité : pour les corriger, contactez-nous.</p>
      <Button full variant="gold" onClick={() => onSave(a)}>
        Enregistrer
      </Button>
    </div>
  );
}
