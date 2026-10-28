"use client";
import { motion } from "motion/react";
import { ArrowLeft, BadgeCheck, ConciergeBell, FileSearch, Mail, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useHydrated, useNow } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Badge, Button, Card, Segmented } from "@/components/ui";
import { Logo } from "@/components/visuals";
import { openFrom } from "@/lib/crypto";
import { canConfirmDeath, procedureStatus, verify } from "@/lib/rules";
import { PROD } from "@/lib/env";
import { now, useApp, type ConciergeCase } from "@/lib/store";
import { ProdAdmin } from "./prod";
import { conciergeKeys } from "@/lib/vault";

type Tab = "deces" | "conciergerie" | "comptes";
const Dot = ({ ok }: { ok: boolean }) => <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-sage" : "bg-coral"}`} />;
const fmt = (t: number) => new Date(t).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

// Back-office of the publisher: it sees the Espace (identity, procedures, cases), never the Coffre.
// Demo version (open to all); production: ./prod.tsx, reserved to staff accounts.
export default function Admin() {
  const hydrated = useHydrated();
  if (PROD) return hydrated ? <ProdAdmin /> : <Loader />;
  return <DemoAdmin />;
}

function DemoAdmin() {
  const hydrated = useHydrated();
  const s = useApp(useShallow((x) => ({ account: x.account, procedures: x.procedures, concierge: x.concierge, cards: x.cards, people: x.people, outbox: x.outbox, set: x.set, email: x.email })));
  const t = useNow(5000);
  const [tab, setTab] = useState<Tab>("deces");
  if (!hydrated) return <Loader />;
  const queue = s.procedures.filter((p) => procedureStatus(p, t) === "verification");
  const owner = s.account ? `${s.account.firstName} ${s.account.lastName}` : "—";

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Logo />
          <span className="rounded-full bg-ink px-3 py-1 text-[0.75rem] font-bold uppercase tracking-wider text-paper">Administration</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6">
        <Link href="/espace/demo" className="mb-4 inline-flex items-center gap-2 text-[0.95rem] font-semibold text-ink-soft">
          <ArrowLeft className="h-4 w-4" /> Retour à la démonstration
        </Link>
        <Segmented
          layoutKey="admin"
          value={tab}
          onChange={setTab}
          options={[
            { id: "deces", label: `Décès (${queue.length})` },
            { id: "conciergerie", label: `Conciergerie (${s.concierge.length})` },
            { id: "comptes", label: "Comptes" },
          ]}
        />

        <div className="mt-6 space-y-4">
          {tab === "deces" && (
            <>
              <p className="text-ink-soft">Un décès n&apos;est confirmé que sur concordance : registre INSEE (ou signalement d&apos;un garant), acte de décès fourni par un bénéficiaire, et identité de ce bénéficiaire vérifiée. Les correspondances douteuses ont d&apos;abord été examinées par l&apos;IA. Ensuite seulement, le délai d&apos;annulation commence.</p>
              {queue.length === 0 && <Card className="text-center text-mist">Rien à vérifier.</Card>}
              {queue.map((p) => (
                <Card key={p.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[1.15rem] font-semibold">{owner}</div>
                      <div className="text-[0.88rem] text-mist">
                        {p.source === "insee" ? "Veille INSEE" : p.source === "garant" ? `Garant : ${p.declaredBy}` : `Bénéficiaire : ${p.declaredBy}`} · {fmt(p.declaredAt)}
                      </div>
                    </div>
                    {p.match && <Badge tone={p.match.doubtful ? "coral" : "sage"}>{Math.round(p.match.score * 100)} %</Badge>}
                  </div>
                  {s.account && (
                    <div className="mt-3 grid gap-1 rounded-2xl bg-ink/[0.04] p-3 text-[0.9rem]">
                      <span>Né(e) le {new Date(s.account.birthDate).toLocaleDateString("fr-FR")} à {s.account.birthCity}</span>
                      {p.match?.reasons.length ? <span className="text-coral">À vérifier : {p.match.reasons.join(", ")}</span> : null}
                      {p.note && <span>Note : « {p.note} »</span>}
                    </div>
                  )}
                  {/* Concordance: no notary by default, the team checks everything itself. */}
                  <ul className="mt-3 space-y-1.5 text-[0.9rem]">
                    <li className="flex items-center gap-2">
                      <Dot ok={p.source === "insee" || !!p.match} /> Registre INSEE {p.source === "insee" ? "(correspondance trouvée)" : "(à consulter)"}
                    </li>
                    <li className="flex items-center gap-2">
                      <Dot ok={!!p.acte} /> Acte de décès {p.acte ? `déposé par ${p.acte.by} (${p.acte.file})` : "en attente d'un bénéficiaire"}
                    </li>
                    <li className="flex items-center gap-2">
                      <Dot ok={!!p.acte?.idChecked} />
                      {p.acte ? (
                        <button className="font-semibold underline" onClick={() => s.set((x) => ({ procedures: x.procedures.map((y) => (y.id === p.id && y.acte ? { ...y, acte: { ...y.acte, idChecked: !y.acte.idChecked } } : y)) }))}>
                          {p.acte.idChecked ? "Identité et KYC du bénéficiaire vérifiés" : "Vérifier l'identité et le KYC du bénéficiaire"}
                        </button>
                      ) : (
                        "Identité et KYC du bénéficiaire"
                      )}
                    </li>
                  </ul>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      variant="danger"
                      disabled={!canConfirmDeath(p)}
                      onClick={() => {
                        const v = verify(p, now());
                        // The reserved packs leave now (as staff_confirm_death does): they arrive during the delay.
                        s.set((x) => ({ procedures: x.procedures.map((y) => (y.id === p.id ? v : y)), cards: x.cards.map((c) => (c.status === "reservee" ? { ...c, status: "commandee" as const } : c)) }));
                        // shortcut: e-mail only in the demo; production also sends SMS (Brevo) and a push notification.
                        if (s.account) s.email(s.account.email, "deces-delai", { endsAt: new Date(v.endsAt!).toISOString() });
                        for (const b of s.people.filter((x) => s.cards.some((c) => c.holderId === x.id && c.status === "reservee")))
                          s.email(b.email || `${b.firstName} ${b.lastName}`, "cartes-beneficiaire", { ownerName: owner });
                      }}
                    >
                      Décès confirmé
                    </Button>
                    <Button variant="outline" onClick={() => s.set((x) => ({ procedures: x.procedures.map((y) => (y.id === p.id ? { ...y, rejectedAt: now() } : y)) }))}>
                      Rejeter
                    </Button>
                  </div>
                </Card>
              ))}
            </>
          )}

          {tab === "conciergerie" && (
            <>
              <p className="text-ink-soft">La conciergerie ne voit que les éléments que la famille lui a confiés, chiffrés pour elle.</p>
              {s.concierge.length === 0 && <Card className="text-center text-mist">Aucune demande.</Card>}
              {s.concierge.map((c) => (
                <CaseCard key={c.id} c={c} owner={owner} />
              ))}
            </>
          )}

          {tab === "comptes" && (
            <Card>
              {s.account ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <BadgeCheck className={`h-7 w-7 ${s.account.kyc === "verifie" ? "text-sage" : "text-gold-deep"}`} />
                    <div className="flex-1">
                      <div className="font-semibold">{owner}</div>
                      <div className="text-[0.88rem] text-mist">{s.account.email}</div>
                    </div>
                    <Badge tone={s.account.kyc === "verifie" ? "sage" : "gold"}>{s.account.kyc === "verifie" ? "KYC vérifié" : "KYC en attente"}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[0.85rem]">
                    <div className="rounded-2xl bg-ink/[0.04] p-3"><div className="font-display text-[1.4rem] font-semibold">{s.people.length}</div>proches</div>
                    <div className="rounded-2xl bg-ink/[0.04] p-3"><div className="font-display text-[1.4rem] font-semibold">{s.cards.filter((x) => x.status === "active").length}</div>cartes actives</div>
                    <div className="rounded-2xl bg-ink/[0.04] p-3"><div className="font-display text-[1.4rem] font-semibold">{s.outbox.length}</div>e-mails</div>
                  </div>
                  <p className="flex items-center gap-2 text-[0.88rem] text-mist">
                    <ShieldAlert className="h-4 w-4" /> Le contenu du Coffre n'apparaît nulle part ici : il est illisible pour l'éditeur.
                  </p>
                </div>
              ) : (
                <p className="text-mist">Aucun compte.</p>
              )}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function CaseCard({ c, owner }: { c: ConciergeCase; owner: string }) {
  const set = useApp((x) => x.set);
  const [docs, setDocs] = useState<{ title: string; fields: Record<string, string>; files: string[] }[] | null>(null);
  const status = (status: ConciergeCase["status"]) => set((x) => ({ concierge: x.concierge.map((y) => (y.id === c.id ? { ...y, status } : y)) }));
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ConciergeBell className="h-6 w-6 text-gold-deep" />
          <div>
            <div className="font-semibold">{c.kind}</div>
            <div className="text-[0.88rem] text-mist">
              {owner} · {fmt(c.createdAt)}
            </div>
          </div>
        </div>
        <Badge tone={c.status === "termine" ? "sage" : "gold"}>{c.status.replace("_", " ")}</Badge>
      </div>
      {c.message && <p className="mt-3 rounded-2xl bg-ink/[0.04] p-3 text-[0.92rem]">« {c.message} »</p>}
      {c.mandate && <p className="mt-2 text-[0.85rem] text-mist">Mandat signé par {c.mandate.name} le {fmt(c.mandate.signedAt)}</p>}
      {c.mandate && (
        <Button
          className="mt-3"
          variant="outline"
          full
          icon={<FileSearch className="h-5 w-5" />}
          onClick={async () => {
            const k = await conciergeKeys();
            setDocs(await Promise.all(c.shared.map(async (x) => JSON.parse(new TextDecoder().decode(await openFrom(x.sealed, k.publicKey, k.privateKey))))));
          }}
        >
          Ouvrir les {c.shared.length} élément{c.shared.length > 1 ? "s" : ""} confié{c.shared.length > 1 ? "s" : ""}
        </Button>
      )}
      {docs && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
          {docs.map((d, i) => (
            <div key={i} className="rounded-2xl bg-paper p-3 ring-1 ring-line text-[0.9rem]">
              <div className="font-semibold">{d.title}</div>
              {Object.entries(d.fields).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="text-ink-soft">{v}</div>
              ))}
              {d.files.length > 0 && <div className="text-mist">Documents : {d.files.join(", ")}</div>}
            </div>
          ))}
        </motion.div>
      )}
      <div className="mt-3 flex gap-2">
        {c.status === "mandat_signe" && <Button onClick={() => status("en_cours")}>Prendre en charge</Button>}
        {c.status === "en_cours" && <Button variant="gold" onClick={() => status("termine")}>Marquer terminé</Button>}
        {c.status === "termine" && <span className="flex items-center gap-2 text-[0.88rem] text-mist"><Mail className="h-4 w-4" /> Documents à supprimer côté partenaire</span>}
      </div>
    </Card>
  );
}
