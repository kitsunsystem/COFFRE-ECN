// Who sees what, and when (brief §7 and §9). Pure functions: the same rules run in the app and, later, in the database policies.
import { DELAYS } from "./config";

export type Moment = "now" | "coup_dur" | "deces" | "jamais";
export type ProcedureKind = "coup_dur" | "deces";

export const MOMENTS: { id: Moment; label: string; short: string }[] = [
  { id: "now", label: "Tout de suite", short: "Maintenant" },
  { id: "coup_dur", label: "En cas de coup dur", short: "Coup dur" },
  { id: "deces", label: "Au décès", short: "Décès" },
  { id: "jamais", label: "Jamais", short: "Jamais" },
];

export interface Procedure {
  id: string;
  kind: ProcedureKind;
  source: "garant" | "insee";
  declaredBy: string; // guarantor name, or "Veille INSEE"
  declaredAt: number;
  needsVerification: boolean;
  verifiedAt?: number;
  rejectedAt?: number;
  cancelledAt?: number;
  endsAt?: number; // end of the cancellation window, set when the window starts
  closedAt?: number; // owner ended a coup dur ("je vais mieux")
  finalizedAt?: number; // "À effacer" destroyed, holders notified
  note?: string;
  match?: { score: number; doubtful: boolean; reasons: string[] };
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
