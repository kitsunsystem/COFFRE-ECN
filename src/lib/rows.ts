// Database rows (snake_case, ISO dates) <-> app state (camelCase, timestamps). Production only.
import type { Sealed } from "./crypto";
import type { Moment, Procedure } from "./rules";
import type { Account, Card, CardKind, CardStatus, ConciergeCase, Envelope, Person, Reminder, Trust, VaultItem } from "./store";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come untyped from supabase-js */
type Row = Record<string, any>;

const ms = (t?: string | null) => (t ? new Date(t).getTime() : undefined);

export const toAccount = (r: Row): Account => ({
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  phone: r.phone ?? "",
  birthDate: r.birth_date,
  birthCity: r.birth_city ?? "",
  birthCountry: r.birth_country ?? "",
  address: r.address ?? "",
  situation: r.situation ?? "",
  isBusinessOwner: r.is_business_owner,
  kyc: r.kyc === "refuse" ? "a_faire" : r.kyc,
  createdAt: ms(r.created_at)!,
});

export const profileRow = (id: string, a: Omit<Account, "kyc" | "createdAt" | "email">) => ({
  id,
  first_name: a.firstName,
  last_name: a.lastName,
  phone: a.phone,
  birth_date: a.birthDate,
  birth_city: a.birthCity,
  birth_country: a.birthCountry,
  address: a.address,
  situation: a.situation,
  is_business_owner: a.isBusinessOwner,
});

export const toPerson = (r: Row): Person => ({ id: r.id, firstName: r.first_name, lastName: r.last_name, relation: r.relation, email: r.email ?? "", phone: r.phone ?? "", managesMe: r.manages_me });
export const personRow = (p: Person, ownerId: string) => ({ id: p.id, owner_id: ownerId, first_name: p.firstName, last_name: p.lastName, relation: p.relation, email: p.email || null, phone: p.phone || null });

export const toCard = (r: Row): Card => ({
  id: r.id,
  holderId: r.holder_person_id ?? "owner",
  printedName: r.printed_name,
  status: r.status as CardStatus,
  orderedAt: ms(r.ordered_at)!,
  activatedAt: ms(r.activated_at),
  extra: !!r.extra,
  kind: (r.kind ?? undefined) as CardKind | undefined,
  chipId: r.chip_id ?? undefined,
  wrappedVmk: (r.wrapped_vmk ?? undefined) as Sealed | undefined,
  boxPk: r.box_pk ?? undefined,
  salt: r.salt ?? undefined,
});

export const toProcedure = (r: Row): Procedure => ({
  id: r.id,
  kind: r.kind,
  source: r.source,
  declaredBy: r.declared_by,
  declaredAt: ms(r.declared_at)!,
  needsVerification: r.needs_verification,
  verifiedAt: ms(r.verified_at),
  rejectedAt: ms(r.rejected_at),
  cancelledAt: ms(r.cancelled_at),
  endsAt: ms(r.ends_at),
  closedAt: ms(r.closed_at),
  finalizedAt: ms(r.finalized_at),
  erasedAt: ms(r.erased_at),
  note: r.note ?? undefined,
  match: r.match ? { score: r.match.score, doubtful: r.match.doubtful, reasons: r.match.reasons ?? [] } : undefined,
  acte: r.acte_path ? { by: r.acte_by_name ?? "un bénéficiaire", file: "acte de décès", idChecked: !!r.acte_id_checked, at: ms(r.acte_at) ?? 0 } : undefined,
});

export const toReminder = (r: Row): Reminder => ({ id: r.id, label: r.label, date: r.date });

export const toCase = (r: Row, shares: Row[]): ConciergeCase => ({
  id: r.id,
  kind: r.kind,
  createdAt: ms(r.created_at)!,
  partner: r.partner,
  status: r.status,
  mandate: r.mandate_name ? { name: r.mandate_name, signedAt: ms(r.mandate_signed_at)! } : undefined,
  shared: shares.filter((s) => s.case_id === r.id).map((s) => ({ itemId: s.item_id, sealed: s.sealed })),
  message: r.message ?? undefined,
});

export const toItem = (r: Row): VaultItem => ({ id: r.id, subsectionId: r.subsection_id, data: r.data, fileIds: r.file_ids ?? [], updatedAt: ms(r.updated_at)! });
export const itemRow = (i: VaultItem, ownerId: string) => ({ id: i.id, owner_id: ownerId, subsection_id: i.subsectionId, data: i.data, file_ids: i.fileIds, updated_at: new Date(i.updatedAt).toISOString() });

export const toEnvelope = (r: Row): Envelope => ({ cardId: r.card_id, subsectionId: r.subsection_id, moment: r.moment, sealed: r.sealed });
export const envelopeRow = (e: Envelope, ownerId: string) => ({ card_id: e.cardId, owner_id: ownerId, subsection_id: e.subsectionId, moment: e.moment, sealed: e.sealed });

export function toRights(rows: Row[]) {
  const out: Record<string, Record<string, Moment>> = {};
  for (const r of rows) (out[r.person_id] ??= {})[r.subsection_id] = r.moment;
  return out;
}

export const toTrust = (r: Row): Trust => ({
  ownerId: r.owner_id,
  ownerName: r.owner_name,
  personId: r.person_id,
  guarantorRole: r.guarantor_role ?? undefined,
  cards: (r.cards as Row[]).map((c) => toCard({ ...c, holder_person_id: r.person_id })),
  procedures: (r.procedures as Row[]).map((p) => ({ ...toProcedure(p), hasActe: !!p.acte, acteByMe: !!p.acte_by_me })),
});
