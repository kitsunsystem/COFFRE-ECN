// Programme partenaires (document « Spécifications techniques & devis partenaire », novembre 2026): each partner splits
// his 25 % between his direct sales (N1) and his recruits' sales (N2 = 25 - N1). A sale never costs more than 25 %:
// the sponsor of the direct partner takes his N2 rate first, the direct partner his N1 rate within what is left.
// Same rule as record_sale (migration 0008), which is the one that pays.
export const POOL = 25;

export function rates(directN1: number, sponsorN1?: number) {
  const r2 = sponsorN1 === undefined ? 0 : POOL - sponsorN1;
  return { r1: Math.min(directN1, POOL - r2), r2 };
}

export type PayoutStatus = "demande" | "validation" | "traitement" | "reussi" | "refuse";
export interface Payout {
  id: string;
  amount_cents: number;
  method: "sepa" | "crypto";
  status: PayoutStatus;
  requested_at: string;
  destination?: string | null; // erased once the payout is closed
  reference?: string | null;
  partner?: string; // the team's view: who asked
}
export interface Dashboard {
  clicks: number;
  signups: number;
  n1_sales: number;
  n2_sales: number;
  volume_cents: number;
  earned_cents: number;
  balance_cents: number;
  months: { month: string; cents: number }[];
  team: { name: string; sales: number }[];
}
// Demo only: a sale the demo simulates (production: the payment webhook calls record_sale).
export interface DemoSale {
  level: 1 | 2;
  rate: number;
  saleCents: number;
  at: number;
}

export const PAYOUT_STEPS: { id: PayoutStatus; label: string }[] = [
  { id: "demande", label: "Demandé" },
  { id: "validation", label: "Validation financière" },
  { id: "traitement", label: "Virement ou transaction en cours" },
  { id: "reussi", label: "Réussi" },
];
export const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
