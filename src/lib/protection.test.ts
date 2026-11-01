import { describe, expect, it } from "vitest";
import { PROTECTION_IDS } from "../../supabase/functions/_shared/protection";
import { applicable, protectionDone, PROTECTION } from "./protection";

describe("démarches de protection", () => {
  it("the server reminds about the same démarches as the app shows", () => {
    expect(PROTECTION_IDS).toEqual(PROTECTION.map((d) => (d.business ? { id: d.id, business: true } : { id: d.id })));
  });
  it("done and « pas concerné » both count; the company one only for business owners", () => {
    expect(applicable(false).some((d) => d.business)).toBe(false);
    expect(applicable(true)).toHaveLength(PROTECTION.length);
    expect(protectionDone({ "protection:mandat": true, "protection-na:tuteur": true, "protection:delegation": true }, false)).toBe(2);
  });
});
