import { describe, expect, it } from "vitest";
import { DELAYS, GRACE_DAYS, POST_DEATH_ACCESS_DAYS } from "./config";
import { accessEnd, activeProcedure, canConfirmDeath, canOpenCoupDur, declare, graceEnd, isReleased, procedureStatus, verify } from "./rules";

const T = 1_700_000_000_000;

describe("coup dur", () => {
  const p = declare("coup_dur", "proche", "Marc", T, { requestedBy: "marc", note: "hospitalisation", acte: { by: "Marc", file: "bulletin.pdf", idChecked: false, at: T } });
  it("opens nothing until the team has checked the proof and the relative's identity", () => {
    expect(procedureStatus(p, T + 365 * 86_400_000)).toBe("verification");
    expect(isReleased("coup_dur", [p], T + 1000, "marc")).toBe(false);
    expect(canOpenCoupDur(p)).toBe(false);
    expect(canOpenCoupDur({ ...p, acte: { ...p.acte!, idChecked: true } })).toBe(true);
  });
  it("then opens at once, for the relative who asked only, and only « coup dur » rights", () => {
    const v = verify(p, T + 10);
    expect(procedureStatus(v, T + 10)).toBe("active");
    expect(isReleased("coup_dur", [v], T + 11, "marc")).toBe(true);
    expect(isReleased("coup_dur", [v], T + 11, "lea")).toBe(false);
    expect(isReleased("coup_dur", [v], T + 11)).toBe(false);
    expect(isReleased("deces", [v], T + 11, "marc")).toBe(false);
    expect(isReleased("jamais", [v], T + 11, "marc")).toBe(false);
  });
  it("closes by itself after the planned time, or when the owner closes it", () => {
    const v = verify(p, T);
    expect(procedureStatus(v, T + DELAYS.coupDurAccess - 1)).toBe("active");
    expect(procedureStatus(v, T + DELAYS.coupDurAccess)).toBe("cloturee");
    expect(isReleased("coup_dur", [v], T + DELAYS.coupDurAccess, "marc")).toBe(false);
    expect(isReleased("coup_dur", [{ ...v, closedAt: T + 5 }], T + 6, "marc")).toBe(false);
  });
  it("is refused by the owner, or rejected by the team", () => {
    expect(procedureStatus({ ...p, cancelledAt: T + 5 }, T + 6)).toBe("annulee");
    expect(procedureStatus({ ...p, rejectedAt: T + 5 }, T + 6)).toBe("rejetee");
  });
});

describe("décès", () => {
  const p = declare("deces", "insee", "Veille INSEE", T);
  it("never starts a delay without a human check", () => {
    expect(procedureStatus(p, T + 365 * 86_400_000)).toBe("verification");
    expect(isReleased("deces", [p], T + 365 * 86_400_000)).toBe(false);
    expect(activeProcedure([p], T)).toBe(p);
  });
  it("releases death and coup-dur rights after verification and delay", () => {
    const v = verify(p, T + 10);
    expect(procedureStatus(v, T + 10 + DELAYS.deces - 1)).toBe("delai");
    const end = T + 10 + DELAYS.deces;
    expect(procedureStatus(v, end)).toBe("terminee");
    expect(isReleased("deces", [v], end)).toBe(true);
    expect(isReleased("coup_dur", [v], end)).toBe(true);
    expect(isReleased("coup_dur", [v], end, "lea")).toBe(true);
  });
  it("a rejected report opens nothing", () => {
    const r = { ...verify(p, T), rejectedAt: T + 1 };
    expect(isReleased("deces", [r], T + DELAYS.deces * 2)).toBe(false);
  });
  it("needs a beneficiary's death certificate, checked, before it can be confirmed", () => {
    expect(canConfirmDeath(p)).toBe(false);
    expect(canConfirmDeath({ ...p, acte: { by: "Léa", file: "acte.pdf", idChecked: false, at: T } })).toBe(false);
    expect(canConfirmDeath({ ...p, acte: { by: "Léa", file: "acte.pdf", idChecked: true, at: T } })).toBe(true);
  });
  it("keeps the Coffre open for a limited time after the delay, then it is erased", () => {
    const v = verify(p, T);
    expect(accessEnd(v)).toBe(v.endsAt! + POST_DEATH_ACCESS_DAYS * 86_400_000);
    expect(accessEnd(p)).toBeUndefined();
    expect(graceEnd(T)).toBe(T + GRACE_DAYS * 86_400_000);
  });
  it("'now' is always open, 'jamais' never", () => {
    expect(isReleased("now", [], T)).toBe(true);
    expect(isReleased("jamais", [verify(p, T)], T + DELAYS.deces * 2)).toBe(false);
  });
});
