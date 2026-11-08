"use client";
import { motion } from "motion/react";
import { ArrowLeft, BadgeCheck, ConciergeBell, FileSearch, Handshake, Mail, ShieldAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useHydrated, useNow } from "@/components/providers";
import { Loader } from "@/components/shell";
import { Badge, Button, Card, Segmented } from "@/components/ui";
import { Logo } from "@/components/visuals";
import { openFrom } from "@/lib/crypto";
import { canConfirmDeath, canOpenCoupDur, MOTIFS, procedureStatus, verify, type Procedure } from "@/lib/rules";
import { DELAYS } from "@/lib/config";
import { PROD } from "@/lib/env";
import { euros, PAYOUT_STEPS, type Payout } from "@/lib/affiliation";
import { now, useApp, type ConciergeCase } from "@/lib/store";
import { ProdAdmin } from "./prod";
import { conciergeKeys } from "@/lib/vault";

type Tab = "deces" | "conciergerie" | "comptes" | "partenaires" | "retraits" | "stats";
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
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Logo />
          <span className="rounded-full bg-ink px-3 py-1 text-[0.75rem] font-bold uppercase tracking-wider text-paper">Administration</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6">
        <Link href="/espace/demo" className="mb-4 inline-flex items-center gap-2 text-[0.95rem] font-semibold text-ink-soft">
          <ArrowLeft className="h-4 w-4" /> Retour à la démonstration
        </Link>
        <div className="-mx-5 overflow-x-auto px-5">
          <div className="min-w-[44rem]">
            <Segmented
              layoutKey="admin"
              value={tab}
              onChange={setTab}
              options={[
                { id: "deces", label: `Vérifications (${queue.length})` },
                { id: "conciergerie", label: `Conciergerie (${s.concierge.length})` },
                { id: "partenaires", label: "Partenaires" },
                { id: "retraits", label: "Retraits" },
                { id: "stats", label: "Statistiques" },
                { id: "comptes", label: "Comptes" },
              ]}
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {tab === "deces" && (
            <>
              <p className="text-ink-soft">Un coup dur ne s&apos;ouvre qu&apos;après la vérification du justificatif et de l&apos;identité du proche (pièce d&apos;identité et visage), pour lui seul. Un décès n&apos;est confirmé que sur concordance : registre INSEE (ou signalement d&apos;un garant), acte de décès fourni par un bénéficiaire, et identité de ce bénéficiaire vérifiée. L&apos;IA donne un avis ; une personne décide toujours.</p>
              {queue.length === 0 && <Card className="text-center text-mist">Rien à vérifier.</Card>}
              {queue.map((p) =>
                p.kind === "coup_dur" ? (
                  <CoupDurCheck key={p.id} p={p} owner={owner} />
                ) : (
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
                          {p.acte.idChecked ? "Identité et visage du bénéficiaire vérifiés" : "Vérifier l'identité et le visage du bénéficiaire"}
                        </button>
                      ) : (
                        "Identité et visage du bénéficiaire"
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
                ),
              )}
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

          {tab === "partenaires" && <DemoPartners owner={owner} />}
          {tab === "retraits" && <DemoPayouts owner={owner} />}
          {tab === "stats" && <DemoStats />}

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

// Demo: the team accepts or refuses the member's application (production: staff_partner_decision).
function DemoPartners({ owner }: { owner: string }) {
  const s = useApp(useShallow((x) => ({ partner: x.partner, account: x.account, set: x.set, email: x.email, sales: x.partnerDemo.sales.length })));
  const decide = (ok: boolean) => {
    const code = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, "0");
    s.set({ partner: ok ? { status: "actif", code, n1: 25 } : { status: "refuse", n1: 25 } });
    if (s.account) s.email(s.account.email, ok ? "partenaire-valide" : "partenaire-refuse", ok ? { code } : {});
  };
  if (!s.partner) return <Card className="text-center text-mist">Aucune candidature. Espace › Compte › Programme partenaires.</Card>;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Handshake className="h-6 w-6 text-gold-deep" />
          <div>
            <div className="font-semibold">{owner}</div>
            <div className="text-[0.88rem] text-mist">{s.account?.email}</div>
          </div>
        </div>
        <Badge tone={s.partner.status === "actif" ? "sage" : s.partner.status === "refuse" ? "mist" : "gold"}>{s.partner.status === "actif" ? "Partenaire" : s.partner.status === "refuse" ? "Refusé" : "Candidature"}</Badge>
      </div>
      {s.partner.status === "actif" && <p className="mt-3 text-[0.92rem] text-ink-soft">{`Code ${s.partner.code} · niveau 1 : ${s.partner.n1} %, niveau 2 : ${25 - s.partner.n1} % · ${s.sales} vente${s.sales > 1 ? "s" : ""}`}</p>}
      {s.partner.status === "candidat" && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="gold" onClick={() => decide(true)}>
            Accepter
          </Button>
          <Button variant="outline" onClick={() => decide(false)}>
            Refuser
          </Button>
        </div>
      )}
    </Card>
  );
}

// Demo: the finance team moves each payout step by step; the IBAN or address is erased at the end.
function DemoPayouts({ owner }: { owner: string }) {
  const s = useApp(useShallow((x) => ({ payouts: x.partnerDemo.payouts, account: x.account, set: x.set, email: x.email })));
  const move = (p: Payout, status: Payout["status"]) => {
    const closed = status === "reussi" || status === "refuse";
    s.set((x) => ({ partnerDemo: { ...x.partnerDemo, payouts: x.partnerDemo.payouts.map((y) => (y.id === p.id ? { ...y, status, destination: closed ? null : y.destination } : y)) } }));
    if (closed && s.account) s.email(s.account.email, status === "reussi" ? "retrait-reussi" : "retrait-refuse", { amount: (p.amount_cents / 100).toFixed(2), currency: "EUR" });
  };
  if (s.payouts.length === 0) return <Card className="text-center text-mist">Aucune demande de retrait.</Card>;
  return (
    <>
      {s.payouts.map((p) => {
        const i = PAYOUT_STEPS.findIndex((x) => x.id === p.status);
        const next = p.status === "refuse" ? undefined : PAYOUT_STEPS[i + 1];
        return (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Wallet className="h-6 w-6 text-gold-deep" />
                <div>
                  <div className="font-semibold">{`${euros(p.amount_cents)} · ${owner}`}</div>
                  <div className="text-[0.88rem] text-mist">{`${p.method === "sepa" ? "Virement SEPA" : "Crypto"} · ${p.destination ?? "coordonnée effacée"}`}</div>
                </div>
              </div>
              <Badge tone={p.status === "reussi" ? "sage" : p.status === "refuse" ? "coral" : "gold"}>{p.status === "refuse" ? "Refusé" : PAYOUT_STEPS[i].label}</Badge>
            </div>
            {next && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="gold" onClick={() => move(p, next.id)}>
                  {next.label}
                </Button>
                <Button variant="outline" onClick={() => move(p, "refuse")}>
                  Refuser
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}

// Demo: the anonymous counters of this browser, and what the team can count without reading anything.
function DemoStats() {
  const s = useApp(useShallow((x) => ({ t: x.telemetry, guarantors: x.guarantors.length, cards: x.cards, procedures: x.procedures, partner: x.partner })));
  const openings = s.t.coffre_ouvert ?? 0;
  const fails = s.t.carte_echec ?? 0;
  const tries = fails + (s.t.carte_ok ?? 0);
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Ouvertures du Coffre", value: String(openings) },
        { label: "Temps moyen dans le Coffre", value: openings ? `${Math.round((s.t.coffre_secondes ?? 0) / openings / 60)} min` : "—" },
        { label: "Échecs d'authentification par carte", value: tries ? `${Math.round((fails / tries) * 100)} %` : "—" },
        { label: "Titulaires avec un garant", value: s.guarantors ? "1 sur 1" : "0 sur 1" },
        { label: "Demandes coup dur", value: String(s.procedures.filter((p) => p.kind === "coup_dur").length) },
        { label: "Partenaires actifs", value: s.partner?.status === "actif" ? "1" : "0" },
      ].map((x) => (
        <Card key={x.label} className="!p-4">
          <div className="text-[0.82rem] text-mist">{x.label}</div>
          <div className="mt-1 font-display text-[1.4rem] font-semibold">{x.value}</div>
        </Card>
      ))}
    </div>
  );
}

// A relative's coup dur request: the proof and their identity (ID and face) checked, then it opens for them only.
function CoupDurCheck({ p, owner }: { p: Procedure; owner: string }) {
  const s = useApp(useShallow((x) => ({ account: x.account, people: x.people, set: x.set, email: x.email })));
  const asker = s.people.find((x) => x.id === p.requestedBy);
  const update = (fn: (y: Procedure) => Procedure) => s.set((x) => ({ procedures: x.procedures.map((y) => (y.id === p.id ? fn(y) : y)) }));
  return (
    <Card layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[1.15rem] font-semibold">Coup dur : {owner}</div>
          <div className="text-[0.88rem] text-mist">
            Demande de {p.declaredBy} · {fmt(p.declaredAt)}
          </div>
        </div>
        <Badge tone="coral">{MOTIFS.find((m) => m.id === p.note)?.label ?? p.note}</Badge>
      </div>
      <p className="mt-3 rounded-2xl bg-ink/[0.04] p-3 text-[0.88rem] text-ink-soft">Avis de l&apos;IA sur le justificatif : en production, il est analysé dès le dépôt (document cohérent, nom, dates). Il n&apos;ouvre jamais rien seul.</p>
      <ul className="mt-3 space-y-1.5 text-[0.9rem]">
        <li className="flex items-center gap-2">
          <Dot ok={!!p.acte} /> Justificatif déposé{p.acte ? ` (${p.acte.file})` : ""}
        </li>
        <li className="flex items-center gap-2">
          <Dot ok={!!p.acte?.idChecked} />
          <button className="font-semibold underline" onClick={() => update((y) => (y.acte ? { ...y, acte: { ...y.acte, idChecked: !y.acte.idChecked } } : y))}>
            {p.acte?.idChecked ? "Pièce d'identité et visage du proche vérifiés" : "Vérifier la pièce d'identité et le visage du proche"}
          </button>
        </li>
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="danger"
          disabled={!canOpenCoupDur(p)}
          onClick={() => {
            const v = verify(p, now());
            update(() => v);
            // shortcut: e-mail only in the demo; production also sends SMS (Brevo) and a push notification.
            const until = new Date(v.endsAt! + DELAYS.coupDurAccess).toISOString();
            if (s.account) s.email(s.account.email, "coup-dur-ouvert", { declaredBy: p.declaredBy, until });
            if (asker) s.email(asker.email || p.declaredBy, "coup-dur-acces", { ownerName: owner, until });
          }}
        >
          Ouvrir l&apos;accès
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            update((y) => ({ ...y, rejectedAt: now() }));
            if (asker) s.email(asker.email || p.declaredBy, "coup-dur-ferme", { ownerName: owner });
          }}
        >
          Rejeter
        </Button>
      </div>
    </Card>
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
