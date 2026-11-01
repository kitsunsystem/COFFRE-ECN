"use client";
import { motion } from "motion/react";
import { Check, ClipboardCopy, Handshake, Hourglass, Send, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Notice, PageTitle, Segmented } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { applyPartner, loadPayouts, partnerDashboard, requestPayout, setPartnerSplit, simulateSale } from "@/lib/api";
import { euros, PAYOUT_STEPS, POOL, type Dashboard, type Payout } from "@/lib/affiliation";
import { APP_URL, PROD } from "@/lib/env";
import { copyText } from "@/lib/native";
import { useApp } from "@/lib/store";

export default function Partenaire() {
  const partner = useApp((s) => s.partner);
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <PageTitle
        eyebrow="Espace partenaire"
        title="Recommandez le Coffre, soyez rémunéré"
        lead={`Sur chaque coffre vendu grâce à vous, ${POOL} % du prix hors taxes sont reversés : vous choisissez la part que vous gardez sur vos ventes directes et celle que vous prenez sur les ventes de vos filleuls.`}
      />
      {partner?.status === "actif" ? <Active code={partner.code} n1={partner.n1} /> : <Apply status={partner?.status} />}
    </motion.div>
  );
}

function Apply({ status }: { status?: "candidat" | "refuse" | "actif" }) {
  const [why, setWhy] = useState("");
  if (status === "candidat")
    return (
      <motion.div variants={rise}>
        <Notice tone="gold">
          <div className="flex items-center gap-3">
            <Hourglass className="h-5 w-5 shrink-0 text-gold-deep" /> Votre candidature est en cours d&apos;examen par notre équipe. Vous serez prévenu par e-mail.
          </div>
        </Notice>
      </motion.div>
    );
  return (
    <motion.div variants={rise}>
      <Card>
        <Handshake className="h-8 w-8 text-gold-deep" />
        <h2 className="mt-3 text-[1.3rem] font-semibold">Devenir partenaire</h2>
        {status === "refuse" && <p className="mt-1 text-coral">Votre dernière candidature n&apos;a pas été retenue. Vous pouvez en envoyer une nouvelle.</p>}
        <ul className="mt-3 space-y-1.5 text-ink-soft">
          {[`${POOL} % de chaque première vente, sur deux niveaux`, "Votre lien à partager, et vos statistiques", "Vos retraits quand vous le voulez, par virement ou en crypto"].map((x) => (
            <li key={x} className="flex gap-2">
              <Check className="mt-1 h-4 w-4 shrink-0 text-sage" /> {x}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Field label="Pourquoi souhaitez-vous devenir partenaire ?" multiline value={why} onChange={setWhy} placeholder="Votre activité, votre réseau, comment vous comptez recommander le Coffre" />
        </div>
        <Button className="mt-4" full variant="gold" icon={<Send className="h-5 w-5" />} disabled={why.trim().length < 20} onClick={() => applyPartner(why.trim())}>
          Envoyer ma candidature
        </Button>
        <p className="mt-2 text-[0.85rem] text-mist">Notre équipe examine chaque candidature. Une fois acceptée, votre espace partenaire apparaît dans le menu.</p>
      </Card>
    </motion.div>
  );
}

function Active({ code, n1 }: { code?: string; n1: number }) {
  const [split, setSplit] = useState(n1);
  const [copied, setCopied] = useState(false);
  const [d, setD] = useState<Dashboard | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const sales = useApp((s) => s.partnerDemo.sales.length); // demo: refresh when a sale is simulated
  const reload = useCallback(() => {
    void partnerDashboard().then(setD).catch(() => setD(null));
    void loadPayouts().then(setPayouts).catch(() => setPayouts([]));
  }, []);
  useEffect(reload, [reload, sales]);
  const link = `${APP_URL || location.origin + (process.env.NEXT_PUBLIC_BASE_PATH ?? "")}/?ref=${code ?? ""}`;
  const max = Math.max(1, ...(d?.months.map((m) => m.cents) ?? []));

  return (
    <>
      <motion.div variants={rise}>
        <Card>
          <div className="font-semibold">Votre lien de parrainage</div>
          <div className="notranslate mt-2 break-all rounded-2xl bg-ink/[0.04] p-3 text-[0.92rem]">{link}</div>
          <Button
            className="mt-3"
            full
            variant="outline"
            icon={copied ? <Check className="h-5 w-5" /> : <ClipboardCopy className="h-5 w-5" />}
            onClick={async () => {
              await copyText(link);
              setCopied(true);
            }}
          >
            {copied ? "Lien copié" : "Copier mon lien"}
          </Button>
        </Card>
      </motion.div>

      <motion.div variants={rise}>
        <Card>
          <div className="font-semibold">Répartition de vos {POOL} %</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-ink/[0.04] p-3">
              <div className="font-display text-[1.6rem] font-semibold">{split} %</div>
              <div className="text-[0.85rem] text-mist">Niveau 1 : vos ventes directes</div>
            </div>
            <div className="rounded-2xl bg-ink/[0.04] p-3">
              <div className="font-display text-[1.6rem] font-semibold">{POOL - split} %</div>
              <div className="text-[0.85rem] text-mist">Niveau 2 : les ventes de vos filleuls</div>
            </div>
          </div>
          <input type="range" min={0} max={POOL} step={1} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="mt-4 w-full accent-[var(--color-gold)]" aria-label="Part du niveau 1" />
          <p className="mt-2 text-[0.85rem] text-mist">
            {`Une vente ne coûte jamais plus de ${POOL} % : sur la vente d'un filleul, votre part de niveau 2 passe en premier ; sur vos ventes directes, vous recevez votre part de niveau 1, dans la limite de ce que votre propre parrain ne prend pas. Le changement vaut pour les ventes à venir.`}
          </p>
          <Button className="mt-3" full variant="gold" disabled={split === n1} onClick={() => setPartnerSplit(split)}>
            Enregistrer la répartition
          </Button>
        </Card>
      </motion.div>

      {d && (
        <motion.div variants={rise} className="grid grid-cols-2 gap-3">
          {[
            { label: "Volume d'affaires", value: euros(d.volume_cents) },
            { label: "Commissions gagnées", value: euros(d.earned_cents) },
            { label: "Coffres vendus", value: `${d.n1_sales} en direct · ${d.n2_sales} par vos filleuls` },
            { label: "Clics et inscriptions", value: `${d.clicks} · ${d.signups}${d.clicks ? ` (${Math.round((d.signups / d.clicks) * 100)} %)` : ""}` },
          ].map((x) => (
            <div key={x.label} className="rounded-[1.5rem] bg-paper p-4 shadow-soft ring-1 ring-line/70">
              <div className="text-[0.82rem] text-mist">{x.label}</div>
              <div className="mt-1 font-semibold">{x.value}</div>
            </div>
          ))}
        </motion.div>
      )}

      {d && d.months.length > 0 && (
        <motion.div variants={rise}>
          <Card>
            <div className="mb-3 font-semibold">Commissions par mois</div>
            <div className="space-y-2">
              {d.months.slice(-6).map((m) => (
                <div key={m.month} className="flex items-center gap-3 text-[0.88rem]">
                  <span className="w-16 shrink-0 text-mist">{m.month}</span>
                  <span className="h-3 rounded-full bg-gold" style={{ width: `${Math.max(4, (m.cents / max) * 100)}%` }} />
                  <span className="shrink-0">{euros(m.cents)}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {d && d.team.length > 0 && (
        <motion.div variants={rise}>
          <Card>
            <div className="mb-2 font-semibold">Vos filleuls (niveau 2)</div>
            {d.team.map((x) => (
              <div key={x.name} className="flex justify-between border-t border-line/70 py-2 text-[0.92rem] first:border-0">
                <span>{x.name}</span>
                <span className="text-mist">{`${x.sales} vente${x.sales > 1 ? "s" : ""}`}</span>
              </div>
            ))}
          </Card>
        </motion.div>
      )}

      {!PROD && (
        <motion.div variants={rise} className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => simulateSale(1)}>
            Démo : vente directe
          </Button>
          <Button variant="outline" onClick={() => simulateSale(2)}>
            Démo : vente d&apos;un filleul
          </Button>
        </motion.div>
      )}

      {d && <Withdraw balance={d.balance_cents} payouts={payouts} onDone={reload} />}
    </>
  );
}

function Withdraw({ balance, payouts, onDone }: { balance: number; payouts: Payout[]; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Payout["method"]>("sepa");
  const [dest, setDest] = useState("");
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  const pending = payouts.some((p) => ["demande", "validation", "traitement"].includes(p.status));
  return (
    <motion.div variants={rise}>
      <Card>
        <div className="flex items-center gap-2 font-semibold">
          <Wallet className="h-5 w-5 text-gold-deep" /> {`Solde disponible : ${euros(balance)}`}
        </div>
        {!pending && balance > 0 && (
          <div className="mt-4 space-y-3">
            <Field label="Montant (€)" value={amount} onChange={setAmount} placeholder={(balance / 100).toFixed(2)} />
            <Segmented layoutKey="payout-method" value={method} onChange={setMethod} options={[{ id: "sepa", label: "Virement SEPA" }, { id: "crypto", label: "Crypto" }]} />
            <Field label={method === "sepa" ? "IBAN" : "Adresse du portefeuille"} value={dest} onChange={setDest} placeholder={method === "sepa" ? "FR76 …" : ""} />
            <p className="text-[0.85rem] text-mist">Cette coordonnée n&apos;est gardée que le temps du retrait : elle est effacée dès qu&apos;il est clôturé.</p>
            <Button
              full
              variant="gold"
              disabled={!(cents > 0 && cents <= balance) || dest.trim().length < 8}
              onClick={async () => {
                if (!(await requestPayout(cents, method, dest))) return;
                setAmount("");
                setDest("");
                onDone();
              }}
            >
              Demander le retrait
            </Button>
          </div>
        )}
        {payouts.length > 0 && (
          <div className="mt-5 space-y-3">
            {payouts.map((p) => {
              const at = PAYOUT_STEPS.findIndex((s) => s.id === p.status);
              return (
                <div key={p.id} className="rounded-2xl bg-ink/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{euros(p.amount_cents)}</span>
                    <Badge tone={p.status === "reussi" ? "sage" : p.status === "refuse" ? "coral" : "gold"}>{p.status === "refuse" ? "Refusé" : PAYOUT_STEPS[at].label}</Badge>
                  </div>
                  <div className="mt-1 text-[0.82rem] text-mist">{`${p.method === "sepa" ? "Virement SEPA" : "Crypto"} · ${new Date(p.requested_at).toLocaleDateString("fr-FR", { dateStyle: "long" })}`}</div>
                  {p.status !== "refuse" && (
                    <div className="mt-2 flex gap-1">
                      {PAYOUT_STEPS.map((s, i) => (
                        <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= at ? "bg-sage" : "bg-ink/[0.08]"}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
