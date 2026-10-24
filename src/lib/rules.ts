// Who sees what, and when (brief §7 and §9, follow-up §2). Pure functions: the same rules run in the app and, later, in the database policies.
import { DELAYS, GRACE_DAYS, POST_DEATH_ACCESS_DAYS } from "./config";

export type Moment = "now" | "coup_dur" | "deces" | "jamais";
export type ProcedureKind = "coup_dur" | "deces";

// The three access levels, with ONE colour code used everywhere (Urgence green, Coup dur red, Décès gold).
export const MOMENTS: { id: Moment; label: string; short: string; dot: string; pill: string }[] = [
  { id: "now", label: "Urgence : tout de suite, à tout moment", short: "Urgence", dot: "bg-sage", pill: "bg-sage text-paper" },
  { id: "coup_dur", label: "En cas de coup dur", short: "Coup dur", dot: "bg-coral", pill: "bg-coral text-paper" },
  { id: "deces", label: "Au décès", short: "Décès", dot: "bg-gold", pill: "bg-gold text-ink" },
  { id: "jamais", label: "Jamais", short: "Jamais", dot: "bg-mist/40", pill: "bg-mist/15 text-mist" },
];
export const moment = (id: Moment) => MOMENTS.find((m) => m.id === id)!;

export interface Procedure {
  id: string;
  kind: ProcedureKind;
  source: "garant" | "insee" | "beneficiaire";
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
  match?: { score: number; doubtful: boolean; reasons: string[] };
  acte?: { by: string; file: string; idChecked: boolean; at: number }; // death certificate supplied by a beneficiary
}

export type ProcedureStatus = "verification" | "delai" | "active" | "terminee" | "annulee" | "rejetee" | "cloturee";

export function procedureStatus(p: Procedure, now: number): ProcedureStatus {
  if (p.cancelledAt) return "annulee";
  if (p.rejectedAt) return "rejetee";
  if (p.closedAt) return "cloturee";
  if (p.needsVerification && !p.verifiedAt) return "verification";
  if (p.endsAt === undefined || now < p.endsAt) return "delai";
  return p.kind === "coup_dur" ? "active" : "terminee";
}

export function declare(kind: ProcedureKind, source: Procedure["source"], declaredBy: string, now: number, extra: Partial<Procedure> = {}): Procedure {
  // A death always goes through a human check first (brief §9); a coup dur starts its short window at once.
  const needsVerification = kind === "deces";
  return {
    id: crypto.randomUUID(),
    kind,
    source,
    declaredBy,
    declaredAt: now,
    needsVerification,
    endsAt: needsVerification ? undefined : now + DELAYS.coupDur,
    ...extra,
  };
}

export const verify = (p: Procedure, now: number): Procedure => ({ ...p, verifiedAt: now, endsAt: now + (p.kind === "deces" ? DELAYS.deces : DELAYS.coupDur) });

export function isReleased(moment: Moment, procedures: Procedure[], now: number) {
  if (moment === "now") return true;
  if (moment === "jamais") return false;
  const dead = procedures.some((p) => p.kind === "deces" && procedureStatus(p, now) === "terminee");
  if (moment === "deces") return dead;
  // Someone trusted for a coup dur is trusted after a death too.
  return dead || procedures.some((p) => p.kind === "coup_dur" && procedureStatus(p, now) === "active");
}

export function activeProcedure(procedures: Procedure[], now: number) {
  return procedures.find((p) => ["verification", "delai", "active"].includes(procedureStatus(p, now)));
}

// A death is confirmed only on concordance: INSEE match or guarantor report, plus the certificate supplied by a beneficiary.
export const canConfirmDeath = (p: Procedure) => p.kind === "deces" && !!p.acte?.idChecked;

// End of the beneficiaries' access after a death (then the Coffre is erased for good).
export const accessEnd = (p: Procedure) => (p.kind === "deces" && p.endsAt !== undefined ? p.endsAt + POST_DEATH_ACCESS_DAYS * 86_400_000 : undefined);

// Unpaid since `since`: everything is erased at the end of the grace period.
export const graceEnd = (since: number) => since + GRACE_DAYS * 86_400_000;
