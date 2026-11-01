import { describe, expect, it } from "vitest";
import { rates } from "./affiliation";

describe("commissions des partenaires", () => {
  it("never pay more than 25 % for a sale: the sponsor's N2 first, the direct partner within the rest", () => {
    expect(rates(25)).toEqual({ r1: 25, r2: 0 }); // no sponsor
    expect(rates(25, 10)).toEqual({ r1: 10, r2: 15 }); // sponsor keeps 15 % on his recruits' sales
    expect(rates(13, 13)).toEqual({ r1: 13, r2: 12 });
    expect(rates(25, 0)).toEqual({ r1: 0, r2: 25 }); // « stratège réseau » captures all on his recruit's sales
    expect(rates(0)).toEqual({ r1: 0, r2: 0 });
    for (let a = 0; a <= 25; a++) for (let b = 0; b <= 25; b++) expect(rates(a, b).r1 + rates(a, b).r2).toBeLessThanOrEqual(25);
  });
});
