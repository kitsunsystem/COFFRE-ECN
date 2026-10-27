// E-mails and notifications in the reader's language, dates included.
import { describe, expect, it } from "vitest";
import { pushMessage, render } from "../functions/_shared/templates.ts";

describe("e-mails multilingues", () => {
  it("writes the texts and the dates in the reader's language", () => {
    expect(render("bienvenue", { firstName: "Claire" }, "en").title).toBe("Welcome, Claire");
    const es = render("deces-delai", { endsAt: "2026-11-11T14:30:00.123456+00:00" }, "es");
    expect(es.body[1]).toContain("11 de noviembre de 2026");
    expect(render("deces-delai", { endsAt: "2026-11-11T14:30:00+00:00" }).body[1]).toContain("11 novembre 2026 à 15:30");
    expect(pushMessage("Chrome · Windows", "ca").body).toBe("Chrome · Windows espera la vostra aprovació. Toqueu per respondre.");
  });

  it("keeps French, and a text already written, when there is nothing better", () => {
    expect(render("impaye", { until: "12/03/2027" }, "de").body[0]).toContain("avant le 12/03/2027");
  });
});
