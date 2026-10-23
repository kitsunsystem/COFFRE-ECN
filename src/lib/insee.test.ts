import { describe, expect, it } from "vitest";
import { findMatches, formatLine, parseLine } from "../../supabase/functions/_shared/insee";
import { render, toHtml } from "../../supabase/functions/_shared/templates";

const claire = { id: "c1", lastName: "Durand", firstNames: "Claire", birthDate: "1972-03-14", birthCity: "Lyon" };
const line = (last: string, first: string, birth = "19720314", city = "LYON") => formatLine({ last, first, sex: "2", birth, city, death: "20260901" });

describe("INSEE file", () => {
  it("parses the fixed-width format", () => {
    const r = parseLine(line("DURAND", "CLAIRE MARIE"))!;
    expect(r.lastName).toBe("DURAND");
    expect(r.firstNames).toEqual(["CLAIRE", "MARIE"]);
    expect(r.birthDate).toBe("19720314");
    expect(r.birthCity).toBe("LYON");
    expect(r.deathDate).toBe("20260901");
  });

  it("finds an exact match, not doubtful", () => {
    const [m] = findMatches([claire], [line("DURAND", "CLAIRE")]);
    expect(m.score).toBe(1);
    expect(m.doubtful).toBe(false);
  });

  it("flags spelling differences as doubtful", () => {
    const [m] = findMatches([claire], [line("DURANDE", "CLAIRE")]);
    expect(m.doubtful).toBe(true);
    expect(m.reasons).toContain("nom écrit différemment");
  });

  it("ignores homonyms born another day and different people", () => {
    expect(findMatches([claire], [line("DURAND", "CLAIRE", "19720315")])).toHaveLength(0);
    expect(findMatches([claire], [line("MARTIN", "SOPHIE")])).toHaveLength(0);
  });
});

describe("e-mails", () => {
  it("never inject user-supplied HTML", () => {
    const html = toHtml(render("invitation-garant", { ownerName: "<script>x</script>", role: "a" }), "https://app");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
