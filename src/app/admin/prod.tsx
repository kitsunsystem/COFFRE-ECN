"use client";
// Production back-office, reserved to staff accounts (table "staff"). It sees the Espace, never the Coffre:
// every action goes through a database function that checks the staff role and writes the audit log.
import { motion } from "motion/react";
import { BadgeCheck, ConciergeBell, FileSearch, Handshake, KeyRound, Loader2, Package, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Segmented, Toggle } from "@/components/ui";
import { Logo } from "@/components/visuals";
import { na, openFrom, fromB64 } from "@/lib/crypto";
import { sb, q } from "@/lib/supabase";
import { euros, PAYOUT_STEPS } from "@/lib/affiliation";
import { MOTIFS } from "@/lib/rules";
import { toast, useApp } from "@/lib/store";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows straight from supabase-js */
type Row = Record<string, any>;
type Tab = "deces" | "kyc" | "cartes" | "conciergerie" | "partenaires" | "retraits" | "stats" | "reglages";
const fmt = (t?: string) => (t ? new Date(t).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—");
const Dot = ({ ok }: { ok: boolean }) => <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-sage" : "bg-coral"}`} />;

async function rpc(fn: string, args: Record<string, unknown>) {
  try {
    await q(sb().rpc(fn, args));
    return true;
  } catch (e) {
    toast((e as Error).message);
    return false;
  }
}

// Documents are only ever shown through short-lived links (5 minutes).
async function openDoc(bucket: string, path?: string) {
  if (!path) return;
  const w = window.open("", "_blank");
  const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data) {
    w?.close();
    return toast("Document inaccessible.");
  }
  if (w) w.location.href = data.signedUrl;
}

async function fetchTab(tab: Tab): Promise<{ rows: Row[]; launched?: boolean; planned?: string }> {
  const c = sb();
  if (tab === "deces")
    return { rows: await q<Row[]>(c.from("procedures").select("*, profiles!inner(first_name,last_name,birth_date,birth_city,email), acteur:people!acte_by(first_name,last_name,email)").is("verified_at", null).is("rejected_at", null).is("cancelled_at", null).eq("needs_verification", true).order("declared_at") as never) };
  if (tab === "kyc") return { rows: await q<Row[]>(c.from("profiles").select("id,first_name,last_name,birth_date,birth_city,email,kyc,kyc_doc_path,created_at").eq("kyc", "en_cours").order("created_at") as never) };
  if (tab === "cartes") return { rows: await q<Row[]>(c.from("cards").select("id,printed_name,status,ordered_at,holder_person_id,ship_to,profiles!inner(first_name,last_name,address)").in("status", ["commandee", "en_route"]).order("ordered_at") as never) };
  // partners.user_id and profiles.referred_by link the same two tables: the foreign key says which one.
  if (tab === "partenaires") return { rows: await q<Row[]>(c.from("partners").select("user_id, status, motivation, code, n1, applied_at, profiles!partners_user_id_fkey(first_name,last_name,email)").in("status", ["candidat", "actif"]).order("applied_at") as never) };
  if (tab === "retraits") return { rows: await q<Row[]>(c.from("payouts").select("*, partners!inner(profiles!partners_user_id_fkey(first_name,last_name,email))").in("status", ["demande", "validation", "traitement"]).order("requested_at") as never) };
  if (tab === "stats") return { rows: [await q<Row>(c.rpc("staff_metrics") as never)] };
  if (tab === "conciergerie") return { rows: await q<Row[]>(c.from("concierge_cases").select("*, profiles!inner(first_name,last_name,email,phone), concierge_shares(item_id,sealed)").order("created_at", { ascending: false }) as never) };
  const s = await q<Row>(c.from("app_settings").select("launched, planned_launch").single() as never);
  return { rows: [], launched: s.launched, planned: s.planned_launch ?? "" };
}

export function ProdAdmin() {
  const role = useApp((s) => s.staffRole);
  const [tab, setTab] = useState<Tab>("deces");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [launched, setLaunched] = useState(false);
  const [planned, setPlanned] = useState("");

  const [version, setVersion] = useState(0);
  const load = useCallback(() => {
    setRows(null);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let live = true;
    fetchTab(tab)
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        if (r.launched !== undefined) setLaunched(r.launched);
        if (r.planned !== undefined) setPlanned(r.planned);
      })
      .catch((e) => {
        toast((e as Error).message);
        if (live) setRows([]);
      });
    return () => {
      live = false;
    };
  }, [tab, version]);

  if (!role)
    return (
      <div className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
        <div>
          <ShieldAlert className="mx-auto h-10 w-10 text-coral" />
          <p className="mt-3 text-ink-soft">Espace réservé à l&apos;équipe.</p>
          <Link href="/" className="mt-4 inline-block font-semibold underline">
            Retour
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Logo />
          <span className="rounded-full bg-ink px-3 py-1 text-[0.75rem] font-bold uppercase tracking-wider text-paper">Équipe · {role}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/espace" className="text-[0.95rem] font-semibold text-ink-soft">
            ← Mon Espace
          </Link>
          <button onClick={load} className="flex items-center gap-1.5 text-[0.9rem] font-semibold text-ink-soft">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
        <div className="-mx-5 overflow-x-auto px-5">
          <div className="min-w-[54rem]">
            <Segmented
              layoutKey="admin-prod"
              value={tab}
              onChange={(x) => {
                setRows(null);
                setTab(x);
              }}
              options={[
                { id: "deces", label: "Vérifications" },
                { id: "kyc", label: "Identités" },
                { id: "cartes", label: "Cartes" },
                { id: "conciergerie", label: "Conciergerie" },
                { id: "partenaires", label: "Partenaires" },
                { id: "retraits", label: "Retraits" },
                { id: "stats", label: "Statistiques" },
                { id: "reglages", label: "Réglages" },
              ]}
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {rows === null && <Loader2 className="mx-auto h-6 w-6 animate-spin text-mist" />}
          {rows?.length === 0 && tab !== "reglages" && <Card className="text-center text-mist">Rien à traiter.</Card>}

          {tab === "partenaires" &&
            rows?.map((p) => (
              <Card key={p.user_id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Handshake className="h-6 w-6 text-gold-deep" />
                    <div>
                      <div className="font-semibold">
                        {p.profiles.first_name} {p.profiles.last_name}
                      </div>
                      <div className="text-[0.88rem] text-mist">
                        {p.profiles.email} · {fmt(p.applied_at)}
                      </div>
                    </div>
                  </div>
                  <Badge tone={p.status === "actif" ? "sage" : "gold"}>{p.status === "actif" ? "Partenaire" : "Candidature"}</Badge>
                </div>
                {p.motivation && <p className="mt-3 rounded-2xl bg-ink/[0.04] p-3 text-[0.92rem]">« {p.motivation} »</p>}
                {p.status === "actif" ? (
                  <p className="mt-3 text-[0.9rem] text-ink-soft">{`Code ${p.code} · niveau 1 : ${p.n1} %, niveau 2 : ${25 - p.n1} %`}</p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="gold" onClick={async () => (await rpc("staff_partner_decision", { partner: p.user_id, ok: true })) && load()}>
                      Accepter
                    </Button>
                    <Button variant="outline" onClick={async () => (await rpc("staff_partner_decision", { partner: p.user_id, ok: false })) && load()}>
                      Refuser
                    </Button>
                  </div>
                )}
              </Card>
            ))}

          {tab === "retraits" && rows?.map((p) => <PayoutCard key={p.id} p={p} reload={load} />)}

          {tab === "stats" && rows?.[0] && <Stats m={rows[0]} />}

          {tab === "deces" &&
            rows?.map((p) =>
              p.kind === "coup_dur" ? (
                <CoupDurCheck key={p.id} p={p} reload={load} />
              ) : (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[1.15rem] font-semibold">
                      {p.profiles.first_name} {p.profiles.last_name}
                    </div>
                    <div className="text-[0.88rem] text-mist">
                      {p.source === "insee" ? "Veille INSEE" : p.source === "garant" ? `Garant : ${p.declared_by}` : `Bénéficiaire : ${p.declared_by}`} · {fmt(p.declared_at)}
                    </div>
                  </div>
                  {p.match && <Badge tone={p.match.doubtful ? "coral" : "sage"}>{Math.round(p.match.score * 100)} %</Badge>}
                </div>
                <div className="mt-3 grid gap-1 rounded-2xl bg-ink/[0.04] p-3 text-[0.9rem]">
                  <span>
                    Né(e) le {new Date(p.profiles.birth_date).toLocaleDateString("fr-FR")} à {p.profiles.birth_city}
                  </span>
                  {p.match?.reasons?.length ? <span className="text-coral">À vérifier : {p.match.reasons.join(", ")}</span> : null}
                  {p.match?.record && (
                    <span className="text-mist">
                      Registre : {p.match.record.lastName} {p.match.record.firstNames?.join(" ")}, né(e) le {p.match.record.birthDate} à {p.match.record.birthCity}, décès le {p.match.record.deathDate}
                    </span>
                  )}
                  {p.note && <span>Note : « {p.note} »</span>}
                </div>
                <ul className="mt-3 space-y-1.5 text-[0.9rem]">
                  <li className="flex items-center gap-2">
                    <Dot ok={p.source === "insee" || !!p.match} /> Registre INSEE {p.source === "insee" ? "(correspondance trouvée)" : "(à consulter)"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Dot ok={!!p.acte_path} />
                    {p.acte_path ? (
                      <button className="font-semibold underline" onClick={() => openDoc("verification", p.acte_path)}>
                        Acte de décès déposé par {p.acteur ? `${p.acteur.first_name} ${p.acteur.last_name}` : "un bénéficiaire"}
                      </button>
                    ) : (
                      "Acte de décès en attente d'un bénéficiaire"
                    )}
                  </li>
                  <li className="flex items-center gap-2">
                    <Dot ok={p.acte_id_checked} />
                    {p.acte_id_path ? (
                      <span>
                        <button className="font-semibold underline" onClick={() => openDoc("verification", p.acte_id_path)}>
                          Pièce d&apos;identité du bénéficiaire
                        </button>{" "}
                        {p.selfie_path && (
                          <>
                            ·{" "}
                            <button className="font-semibold underline" onClick={() => openDoc("verification", p.selfie_path)}>
                              son visage
                            </button>{" "}
                          </>
                        )}
                        ·{" "}
                        <button className="font-semibold text-gold-deep underline" onClick={async () => (await rpc("staff_check_identity", { proc: p.id, ok: !p.acte_id_checked })) && load()}>
                          {p.acte_id_checked ? "vérifiée (annuler)" : "marquer vérifiée"}
                        </button>
                      </span>
                    ) : (
                      "Identité du bénéficiaire"
                    )}
                  </li>
                </ul>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="danger" disabled={!p.acte_path || !p.acte_id_checked} onClick={async () => (await rpc("staff_confirm_death", { proc: p.id })) && load()}>
                    Décès confirmé
                  </Button>
                  <Button variant="outline" onClick={async () => (await rpc("staff_reject_procedure", { proc: p.id })) && load()}>
                    Rejeter
                  </Button>
                </div>
              </Card>
              ),
            )}

          {tab === "kyc" &&
            rows?.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-7 w-7 text-gold-deep" />
                  <div className="flex-1">
                    <div className="font-semibold">
                      {p.first_name} {p.last_name}
                    </div>
                    <div className="text-[0.88rem] text-mist">
                      {p.email} · né(e) le {new Date(p.birth_date).toLocaleDateString("fr-FR")} à {p.birth_city}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button variant="outline" icon={<FileSearch className="h-4 w-4" />} onClick={() => openDoc("kyc", p.kyc_doc_path)}>
                    Pièce
                  </Button>
                  <Button variant="gold" onClick={async () => (await rpc("staff_set_kyc", { owner: p.id, status: "verifie" })) && load()}>
                    Vérifiée
                  </Button>
                  <Button variant="ghost" className="!text-coral" onClick={async () => (await rpc("staff_set_kyc", { owner: p.id, status: "refuse" })) && load()}>
                    Refuser
                  </Button>
                </div>
              </Card>
            ))}

          {tab === "cartes" &&
            rows?.map((c) => (
              <Card key={c.id} className="!p-4">
                <div className="flex items-start gap-3">
                  <Package className="mt-0.5 h-6 w-6 shrink-0 text-gold-deep" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.printed_name}</div>
                    <div className="text-[0.85rem] text-mist">
                      {c.holder_person_id ? `Pack bénéficiaire (Coffre de ${c.profiles.first_name} ${c.profiles.last_name}), après le décès` : "Carte du titulaire"} · commandée le {fmt(c.ordered_at)}
                    </div>
                    {/* A pack goes to the beneficiary's own address, given in their app once the death is confirmed. */}
                    <div className="mt-1 whitespace-pre-line text-[0.9rem]">{c.holder_person_id ? (c.ship_to ?? "En attente de l'adresse du bénéficiaire") : c.profiles.address}</div>
                  </div>
                  <Badge tone="gold">{c.status === "commandee" ? "À expédier" : "En livraison"}</Badge>
                </div>
                <Button className="mt-3" full variant="outline" disabled={c.status === "commandee" && !!c.holder_person_id && !c.ship_to} onClick={async () => (await rpc("staff_card_status", { card: c.id, new_status: c.status === "commandee" ? "en_route" : "recue" })) && load()}>
                  {c.status === "commandee" ? "Marquer expédiée" : "Marquer livrée"}
                </Button>
              </Card>
            ))}

          {tab === "conciergerie" && <Concierge rows={rows ?? []} reload={load} />}

          {tab === "reglages" && (
            <Card>
              <Toggle
                checked={launched}
                onChange={async (v) => (await rpc("staff_set_launched", { on_off: v })) && setLaunched(v)}
                label="Lancement officiel"
                hint="Désactivé : pré-lancement, les Coffres ne s'ouvrent pas et aucun document ne peut y être déposé."
              />
              <div className="mt-4 flex items-end gap-2">
                <div className="flex-1">
                  <Field label="Date de lancement annoncée" type="date" value={planned} onChange={setPlanned} />
                </div>
                <Button variant="outline" onClick={async () => (await rpc("staff_set_planned_launch", { d: planned || null })) && toast("Date enregistrée.")}>
                  Enregistrer
                </Button>
              </div>
              <p className="mt-2 text-[0.85rem] text-mist">Affichée à tous les abonnés. Si elle est repoussée, prévenez-les : chacun choisit de reporter ou d&apos;être remboursé.</p>
              <p className="mt-3 text-[0.85rem] text-mist">Réservé au rôle « admin ». Chaque changement est inscrit au journal.</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

// A partner's withdrawal, step by step; the IBAN or the address is erased by the database once it is closed.
function PayoutCard({ p, reload }: { p: Row; reload: () => void }) {
  const [ref, setRef] = useState("");
  const i = PAYOUT_STEPS.findIndex((x) => x.id === p.status);
  const next = PAYOUT_STEPS[i + 1];
  const who = p.partners.profiles;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-gold-deep" />
          <div>
            <div className="font-semibold">{`${euros(p.amount_cents)} · ${who.first_name} ${who.last_name}`}</div>
            <div className="text-[0.88rem] text-mist">
              {who.email} · {fmt(p.requested_at)}
            </div>
          </div>
        </div>
        <Badge tone="gold">{PAYOUT_STEPS[i].label}</Badge>
      </div>
      <p className="mt-3 break-all rounded-2xl bg-ink/[0.04] p-3 text-[0.92rem]">{`${p.method === "sepa" ? "IBAN" : "Adresse crypto"} : ${p.destination}`}</p>
      {next.id === "reussi" && (
        <div className="mt-3">
          <Field label="Référence du virement ou de la transaction" value={ref} onChange={setRef} />
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="gold" disabled={next.id === "reussi" && !ref.trim()} onClick={async () => (await rpc("staff_payout_status", { payout: p.id, new_status: next.id, ref: ref.trim() || null })) && reload()}>
          {next.label}
        </Button>
        <Button variant="outline" onClick={async () => (await rpc("staff_payout_status", { payout: p.id, new_status: "refuse" })) && reload()}>
          Refuser
        </Button>
      </div>
    </Card>
  );
}

// Anonymous counters and totals: never a person.
function Stats({ m }: { m: Row }) {
  const tries = m.card_ok + m.card_fail;
  const share = (n: number) => (m.owners ? `${Math.round((n / m.owners) * 100)} %` : "—");
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Sessions actives", value: String(m.active_sessions) },
        { label: "Ouvertures du Coffre (30 jours)", value: String(m.openings) },
        { label: "Temps moyen dans le Coffre", value: m.openings ? `${Math.round(m.seconds / m.openings / 60)} min` : "—" },
        { label: "Échecs d'authentification par carte", value: tries ? `${Math.round((m.card_fail / tries) * 100)} %` : "—" },
        { label: "Titulaires", value: String(m.owners) },
        { label: "Avec au moins un garant", value: share(m.with_guarantors) },
        { label: "Avec au moins un bénéficiaire", value: share(m.with_beneficiaries) },
        { label: "Demandes coup dur (30 jours)", value: String(m.coup_dur) },
        { label: "Décès signalés (30 jours)", value: String(m.deces) },
        { label: "Partenaires actifs", value: `${m.partners} (+${m.candidates} en attente)` },
        { label: "Commissions dues au total", value: euros(m.commissions_cents) },
        { label: "Retraits en cours", value: String(m.payouts_pending) },
      ].map((x) => (
        <Card key={x.label} className="!p-4">
          <div className="text-[0.82rem] text-mist">{x.label}</div>
          <div className="mt-1 font-display text-[1.3rem] font-semibold">{x.value}</div>
        </Card>
      ))}
    </div>
  );
}

// A relative's coup dur request: proof, ID and face; the AI's opinion helps, the person of the team decides.
function CoupDurCheck({ p, reload }: { p: Row; reload: () => void }) {
  const who = p.acteur ? `${p.acteur.first_name} ${p.acteur.last_name}` : p.declared_by;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[1.15rem] font-semibold">
            Coup dur : {p.profiles.first_name} {p.profiles.last_name}
          </div>
          <div className="text-[0.88rem] text-mist">
            Demande de {who} · {fmt(p.declared_at)}
          </div>
        </div>
        <Badge tone="coral">{MOTIFS.find((m) => m.id === p.note)?.label ?? p.note}</Badge>
      </div>
      <div className="mt-3 rounded-2xl bg-ink/[0.04] p-3 text-[0.9rem]">
        {p.match ? (
          <>
            <span className={p.match.doubtful ? "font-semibold text-coral" : "font-semibold text-sage"}>
              Avis de l&apos;IA : {p.match.doubtful ? "à examiner de près" : "cohérent"} ({Math.round(p.match.score * 100)} %)
            </span>
            {p.match.reasons?.length ? <span className="block text-ink-soft">{p.match.reasons.join(" · ")}</span> : null}
          </>
        ) : (
          <span className="text-mist">Avis de l&apos;IA en cours (quelques minutes).</span>
        )}
      </div>
      <ul className="mt-3 space-y-1.5 text-[0.9rem]">
        <li className="flex items-center gap-2">
          <Dot ok={!!p.acte_path} />
          <button className="font-semibold underline" onClick={() => openDoc("verification", p.acte_path)}>
            Justificatif
          </button>
        </li>
        <li className="flex items-center gap-2">
          <Dot ok={p.acte_id_checked} />
          <span>
            <button className="font-semibold underline" onClick={() => openDoc("verification", p.acte_id_path)}>
              Pièce d&apos;identité
            </button>{" "}
            ·{" "}
            <button className="font-semibold underline" onClick={() => openDoc("verification", p.selfie_path)}>
              visage
            </button>{" "}
            ·{" "}
            <button className="font-semibold text-gold-deep underline" onClick={async () => (await rpc("staff_check_identity", { proc: p.id, ok: !p.acte_id_checked })) && reload()}>
              {p.acte_id_checked ? "vérifiés (annuler)" : "marquer vérifiés"}
            </button>
          </span>
        </li>
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="danger" disabled={!p.acte_path || !p.acte_id_checked} onClick={async () => (await rpc("staff_open_coup_dur", { proc: p.id })) && reload()}>
          Ouvrir l&apos;accès
        </Button>
        <Button variant="outline" onClick={async () => (await rpc("staff_reject_procedure", { proc: p.id })) && reload()}>
          Rejeter
        </Button>
      </div>
    </Card>
  );
}

// The partner's private key is pasted for the session only: it is never stored, neither here nor on the server.
function Concierge({ rows, reload }: { rows: Row[]; reload: () => void }) {
  const [key, setKey] = useState("");
  const [docs, setDocs] = useState<Record<string, { title: string; fields: Record<string, string>; files: string[] }[]>>({});
  async function open(c: Row) {
    try {
      const s = await na();
      const sk = fromB64(s, key.trim());
      const pk = s.crypto_scalarmult_base(sk);
      const list = await Promise.all((c.concierge_shares as Row[]).map(async (x) => JSON.parse(new TextDecoder().decode(await openFrom(x.sealed, pk, sk)))));
      setDocs((d) => ({ ...d, [c.id]: list }));
    } catch {
      toast("Clé de la conciergerie incorrecte.");
    }
  }
  return (
    <>
      <Card className="!p-4">
        <Field label="Clé privée de la conciergerie (jamais enregistrée)" value={key} onChange={setKey} type="password" />
      </Card>
      {rows.map((c) => (
        <Card key={c.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <ConciergeBell className="h-6 w-6 text-gold-deep" />
              <div>
                <div className="font-semibold">{c.kind}</div>
                <div className="text-[0.88rem] text-mist">
                  {c.profiles.first_name} {c.profiles.last_name} · {c.profiles.email} · {c.profiles.phone} · {fmt(c.created_at)}
                </div>
              </div>
            </div>
            <Badge tone={c.status === "termine" ? "sage" : "gold"}>{c.status.replace("_", " ")}</Badge>
          </div>
          {c.message && <p className="mt-3 rounded-2xl bg-ink/[0.04] p-3 text-[0.92rem]">« {c.message} »</p>}
          {c.mandate_name && <p className="mt-2 text-[0.85rem] text-mist">Mandat signé par {c.mandate_name} le {fmt(c.mandate_signed_at)}</p>}
          {c.concierge_shares.length > 0 && (
            <Button className="mt-3" variant="outline" full icon={<KeyRound className="h-5 w-5" />} disabled={!key} onClick={() => open(c)}>
              Ouvrir les {c.concierge_shares.length} élément(s) confié(s)
            </Button>
          )}
          {docs[c.id] && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
              {docs[c.id].map((d, i) => (
                <div key={i} className="rounded-2xl bg-paper p-3 text-[0.9rem] ring-1 ring-line">
                  <div className="font-semibold">{d.title}</div>
                  {Object.entries(d.fields)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="text-ink-soft">
                        {v}
                      </div>
                    ))}
                  {d.files.length > 0 && <div className="text-mist">Documents : {d.files.join(", ")}</div>}
                </div>
              ))}
            </motion.div>
          )}
          <div className="mt-3 flex gap-2">
            {c.status === "mandat_signe" && <Button onClick={async () => (await rpc("staff_concierge_status", { case_id: c.id, new_status: "en_cours" })) && reload()}>Prendre en charge</Button>}
            {c.status === "en_cours" && (
              <Button variant="gold" onClick={async () => (await rpc("staff_concierge_status", { case_id: c.id, new_status: "termine" })) && reload()}>
                Marquer terminé
              </Button>
            )}
          </div>
        </Card>
      ))}
    </>
  );
}
