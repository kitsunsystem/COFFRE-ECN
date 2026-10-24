import { describe, expect, it } from "vitest";
import { DELAYS, GRACE_DAYS, POST_DEATH_ACCESS_DAYS } from "./config";
import { accessEnd, activeProcedure, canConfirmDeath, declare, graceEnd, isReleased, procedureStatus, verify } from "./rules";

const T = 1_700_000_000_000;

describe("coup dur", () => {
  const p = declare("coup_dur", "garant", "Marc", T);
  it("opens nothing during the cancellation window", () => {
    expect(procedureStatus(p, T + 1000)).toBe("delai");
    expect(isReleased("coup_dur", [p], T + 1000)).toBe(false);
  });
  it("opens only coup-dur rights after the window", () => {
    const after = T + DELAYS.coupDur + 1;
    expect(procedureStatus(p, after)).toBe("active");
    expect(isReleased("coup_dur", [p], after)).toBe(true);
    expect(isReleased("deces", [p], after)).toBe(false);
    expect(isReleased("jamais", [p], after)).toBe(false);
  });
  it("is closed by the owner, and cancelled before the end", () => {
    expect(isReleased("coup_dur", [{ ...p, closedAt: T + 5 }], T + DELAYS.coupDur + 1)).toBe(false);
    expect(procedureStatus({ ...p, cancelledAt: T + 5 }, T + DELAYS.coupDur + 1)).toBe("annulee");
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
