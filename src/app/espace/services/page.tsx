"use client";
import { motion } from "motion/react";
import { Check, ConciergeBell, FileSignature, Lock, MailCheck, Send } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge, Button, Card, Field, Notice, PageTitle, Sheet } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { CONCIERGE } from "@/lib/config";
import { now, uid, useApp, type ConciergeCase } from "@/lib/store";

const KINDS = [
  { id: "mise-en-place", title: "Mettre en place mon Coffre", sub: "Cartes, bénéficiaires, l'essentiel : on le fait avec vous" },
  { id: "deces", title: "Démarches après un décès", sub: "Banques, assurances, caisses de retraite, résiliations" },
  { id: "hospitalisation", title: "Pendant une hospitalisation", sub: "Employeur, mutuelle, factures, quotidien" },
  { id: "autonomie", title: "Perte d'autonomie", sub: "Aides, aménagement, aide à domicile" },
  { id: "resiliations", title: "Résilier des abonnements", sub: "Téléphone, énergie, plateformes, presse" },
];
const STATUS: Record<ConciergeCase["status"], { label: string; tone: "gold" | "sage" | "ink" | "mist" }> = {
  demande: { label: "Mandat à signer", tone: "gold" },
  mandat_signe: { label: "Mandat signé", tone: "ink" },
  en_cours: { label: "En cours", tone: "gold" },
  termine: { label: "Terminé", tone: "sage" },
};

export default function Services() {
  const s = useApp(useShallow((x) => ({ concierge: x.concierge, account: x.account!, set: x.set })));
  const [kind, setKind] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sign, setSign] = useState<ConciergeCase | null>(null);

  function request() {
    const k = KINDS.find((x) => x.id === kind)!;
    s.set((x) => ({ concierge: [{ id: uid(), kind: k.title, createdAt: now(), partner: CONCIERGE.partner, status: "demande", shared: [], message: message.trim() || undefined }, ...x.concierge] }));
    setKind(null);
    setMessage("");
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <PageTitle eyebrow="Services" title="On s'occupe de tout" lead="Quand les démarches sont trop lourdes, une conciergerie les fait pour vous. Elle ne voit que les documents que vous lui confiez, avec votre mandat." />

      <motion.div variants={rise}>
        {/* !bg-night: Card's own bg-paper otherwise wins, leaving light text on a light card. */}
        <Card className="relative overflow-hidden !bg-night !p-6 text-paper !ring-paper/10">
          <motion.div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gold/30 blur-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 7, repeat: Infinity }} />
          <ConciergeBell className="relative h-9 w-9 text-gold-soft" />
          <h2 className="relative mt-3 text-[1.5rem] font-semibold">La conciergerie</h2>
          <ul className="relative mt-3 space-y-2 text-paper/80">
            {["Un interlocuteur unique, par téléphone ou e-mail", "Un mandat simple, signé en ligne", "Accès uniquement aux documents partagés", "Service optionnel et payant, devis avant tout engagement"].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-sage-soft" /> {t}
              </li>
            ))}
          </ul>
          {CONCIERGE.price && <p className="relative mt-3 font-semibold text-gold-soft">{CONCIERGE.price}</p>}
        </Card>
      </motion.div>

      <motion.section variants={rise} className="mt-8">
        <h2 className="mb-3 text-[1.4rem] font-semibold">De quoi avez-vous besoin ?</h2>
        <div className="grid gap-2.5">
          {KINDS.map((k) => (
            <motion.button key={k.id} whileTap={{ scale: 0.98 }} onClick={() => setKind(k.id)} className="flex items-center gap-4 rounded-2xl bg-paper p-4 text-left shadow-soft ring-1 ring-line/70">
              <span className="flex-1">
                <span className="block font-semibold">{k.title}</span>
                <span className="text-[0.9rem] text-mist">{k.sub}</span>
              </span>
              <Send className="h-5 w-5 text-gold-deep" />
            </motion.button>
          ))}
        </div>
      </motion.section>

      {s.concierge.length > 0 && (
        <motion.section variants={rise} className="mt-8">
          <h2 className="mb-3 text-[1.4rem] font-semibold">Mes demandes</h2>
          <div className="space-y-3">
            {s.concierge.map((c) => (
              <Card key={c.id} layout className="!p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{c.kind}</div>
                    <div className="text-[0.85rem] text-mist">
                      {c.partner} · {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                </div>
                {c.status === "demande" ? (
                  <Button className="mt-4" full icon={<FileSignature className="h-5 w-5" />} onClick={() => setSign(c)}>
                    Lire et signer le mandat
                  </Button>
                ) : (
                  <p className="mt-3 flex items-center gap-2 text-[0.9rem] text-ink-soft">
                    <Lock className="h-4 w-4" /> {c.shared.length} document{c.shared.length > 1 ? "s" : ""} partagé{c.shared.length > 1 ? "s" : ""} depuis le Coffre
                  </p>
                )}
              </Card>
            ))}
          </div>
          <p className="mt-3 text-[0.88rem] text-mist">Pour partager un document, ouvrez-le dans votre Coffre et choisissez « Confier à la conciergerie ».</p>
        </motion.section>
      )}

      <motion.section variants={rise} className="mt-10">
        <h2 className="mb-3 text-[1.4rem] font-semibold">Nos conseils</h2>
        <Card className="!p-5">
          <MailCheck className="h-7 w-7 text-sage" />
          <div className="mt-3 font-semibold">Une messagerie chiffrée pour la famille</div>
          <p className="mt-1 text-ink-soft">Pour échanger des documents confidentiels entre proches, nous recommandons une messagerie chiffrée de bout en bout, comme Proton Mail.</p>
        </Card>
      </motion.section>

      <Sheet open={!!kind} onClose={() => setKind(null)} title={KINDS.find((k) => k.id === kind)?.title}>
        <div className="space-y-4">
          <Field label="Quelques mots sur votre situation (facultatif)" multiline value={message} onChange={setMessage} placeholder="Ex. Mon père est hospitalisé depuis lundi…" />
          <Notice tone="ink">N'écrivez rien de confidentiel ici : les documents se partagent depuis le Coffre, une fois le mandat signé.</Notice>
          <Button full variant="gold" onClick={request}>
            Envoyer la demande
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!sign} onClose={() => setSign(null)} title="Mandat">
        {sign && <Mandate c={sign} owner={`${s.account.firstName} ${s.account.lastName}`} onSigned={(name) => {
          s.set((x) => ({ concierge: x.concierge.map((y) => (y.id === sign.id ? { ...y, status: "mandat_signe", mandate: { name, signedAt: now() } } : y)) }));
          setSign(null);
        }} />}
      </Sheet>
    </motion.div>
  );
}

function Mandate({ c, owner, onSigned }: { c: ConciergeCase; owner: string; onSigned: (name: string) => void }) {
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  // shortcut: simple electronic signature (typed name + consent); switch to a qualified provider if the partner requires it.
  return (
    <div className="space-y-4">
      <div className="max-h-64 overflow-y-auto rounded-2xl bg-paper p-4 text-[0.92rem] leading-relaxed text-ink-soft ring-1 ring-line">
        <p>
          Je soussigné(e) <b>{owner}</b> donne mandat à <b>{c.partner}</b> pour accomplir en mon nom les démarches suivantes : <b>{c.kind.toLowerCase()}</b>.
        </p>
        <p className="mt-3">Le mandataire n'a accès qu'aux documents que je partage explicitement depuis mon Coffre. Il s'engage à la plus stricte confidentialité, à ne conserver ces documents que le temps de la mission et à les supprimer à son terme.</p>
        <p className="mt-3">Je peux mettre fin à ce mandat à tout moment depuis mon Espace. Aucune prestation payante n'est engagée sans devis accepté.</p>
      </div>
      <button type="button" onClick={() => setOk(!ok)} aria-pressed={ok} className="flex w-full items-start gap-3 text-left">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ring-2 ${ok ? "bg-ink ring-ink" : "ring-line"}`}>{ok && <Check className="h-4 w-4 text-paper" strokeWidth={3} />}</span>
        <span className="text-[0.95rem]">J'ai lu le mandat et l'engagement de confidentialité, et je les accepte.</span>
      </button>
      <Field label="Signez en tapant votre nom complet" value={name} onChange={setName} placeholder={owner} />
      <Button full variant="gold" disabled={!ok || name.trim().toLowerCase() !== owner.toLowerCase()} onClick={() => onSigned(name.trim())}>
        Signer le mandat
      </Button>
    </div>
  );
}
