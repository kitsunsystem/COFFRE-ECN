// Who sees what, and when (brief §7 and §9, follow-up §2). Pure functions: the same rules run in the app and, later, in the database policies.
import { DELAYS, GRACE_DAYS, POST_DEATH_ACCESS_DAYS } from "./config";

export type Moment = "now" | "coup_dur" | "deces" | "jamais";
export type ProcedureKind = "coup_dur" | "deces";

// The three access levels, with ONE colour code used everywhere (Maintenant green, Coup dur red, Décès gold).
export const MOMENTS: { id: Moment; label: string; short: string; dot: string; pill: string }[] = [
  { id: "now", label: "Maintenant : tout de suite, depuis son compte", short: "Maintenant", dot: "bg-sage", pill: "bg-sage text-paper" },
  { id: "coup_dur", label: "Coup dur : sur sa demande, vérifiée par notre équipe, pour un temps limité", short: "Coup dur", dot: "bg-coral", pill: "bg-coral text-paper" },
  { id: "deces", label: "Décès : après la vérification et le délai d'annulation", short: "Décès", dot: "bg-gold", pill: "bg-gold text-night" },
  { id: "jamais", label: "Jamais", short: "Jamais", dot: "bg-mist/40", pill: "bg-mist/15 text-mist" },
];
export const moment = (id: Moment) => MOMENTS.find((m) => m.id === id)!;

export interface Procedure {
  id: string;
  kind: ProcedureKind;
  source: "garant" | "insee" | "beneficiaire" | "proche";
  declaredBy: string; // guarantor or beneficiary name, or "Veille INSEE"
  declaredAt: number;
  needsVerification: boolean;
  verifiedAt?: number;
  rejectedAt?: number;
  cancelledAt?: number;
  endsAt?: number; // end of the cancellation window, set when the window starts
  closedAt?: number; // owner ended a coup dur ("je vais mieux")
  finalizedAt?: number; // "À effacer" destroyed, holders notified
  erasedAt?: number; // death: the whole Coffre erased once the post-death access period is over
  note?: string;
  match?: { score: number; doubtful: boolean; reasons: string[] }; // INSEE match, or the AI's opinion on a coup dur proof
  acte?: { by: string; file: string; idChecked: boolean; at: number }; // death certificate, or coup dur proof, with the ID (and face) checked
  requestedBy?: string; // coup dur: the relative who asked; only their access opens
}

// Why a relative asks to open what is planned for a coup dur.
export const MOTIFS = [
  { id: "hospitalisation", label: "Hospitalisation" },
  { id: "coma", label: "Coma" },
  { id: "incapacite", label: "Incapacité" },
] as const;
export type Motif = (typeof MOTIFS)[number]["id"];

export type ProcedureStatus = "verification" | "delai" | "active" | "terminee" | "annulee" | "rejetee" | "cloturee";

export function procedureStatus(p: Procedure, now: number): ProcedureStatus {
  if (p.cancelledAt) return "annulee";
  if (p.rejectedAt) return "rejetee";
  if (p.closedAt) return "cloturee";
  if (p.needsVerification && !p.verifiedAt) return "verification";
  if (p.endsAt === undefined || now < p.endsAt) return "delai";
  // A validated coup dur opens for a limited time, then closes by itself.
  if (p.kind === "coup_dur") return now >= p.endsAt + DELAYS.coupDurAccess ? "cloturee" : "active";
  return "terminee";
}

// Both always go through a person of the team first: a coup dur request (proof, identity), a death (certificate, identity).
export function declare(kind: ProcedureKind, source: Procedure["source"], declaredBy: string, now: number, extra: Partial<Procedure> = {}): Procedure {
  return { id: crypto.randomUUID(), kind, source, declaredBy, declaredAt: now, needsVerification: true, ...extra };
}

// Validated: a coup dur opens at once (for its limited time), a death starts its cancellation delay.
export const verify = (p: Procedure, now: number): Procedure => ({ ...p, verifiedAt: now, endsAt: p.kind === "deces" ? now + DELAYS.deces : now });

// What a relative (`personId`) may open: « Coup dur » only through their own validated request, everything planned after a death.
export function isReleased(moment: Moment, procedures: Procedure[], now: number, personId?: string) {
  if (moment === "now") return true;
  if (moment === "jamais") return false;
  const dead = procedures.some((p) => p.kind === "deces" && procedureStatus(p, now) === "terminee");
  if (moment === "deces") return dead;
  return dead || procedures.some((p) => p.kind === "coup_dur" && !!personId && p.requestedBy === personId && procedureStatus(p, now) === "active");
}

export function activeProcedure(procedures: Procedure[], now: number) {
  return procedures.find((p) => ["verification", "delai", "active"].includes(procedureStatus(p, now)));
}

// A death is confirmed only on concordance: INSEE match or guarantor report, plus the certificate supplied by a beneficiary.
export const canConfirmDeath = (p: Procedure) => p.kind === "deces" && !!p.acte?.idChecked;
// A coup dur opens only once the proof and the relative's identity (ID and face) have been checked by the team.
export const canOpenCoupDur = (p: Procedure) => p.kind === "coup_dur" && !!p.acte?.idChecked;

// End of the beneficiaries' access after a death (then the Coffre is erased for good).
export const accessEnd = (p: Procedure) => (p.kind === "deces" && p.endsAt !== undefined ? p.endsAt + POST_DEATH_ACCESS_DAYS * 86_400_000 : undefined);

// Unpaid since `since`: everything is erased at the end of the grace period.
export const graceEnd = (since: number) => since + GRACE_DAYS * 86_400_000;
