// The lookup behind every translated screen: exact texts, sentences with inserted values, plurals, lowercased labels.
import { describe, expect, it } from "vitest";
import en from "../i18n/en.json";
import es from "../i18n/es.json";
import { loadDict, tr } from "./i18n";

describe("traduction des écrans", () => {
  it("texte exact, espaces autour conservés", () => {
    loadDict(en);
    expect(tr("Fermer")).toBe("Close");
    expect(tr(" le Coffre")).toBe(" the Vault");
  });

  it("phrase avec des valeurs insérées, traduites quand elles sont connues", () => {
    loadDict(en);
    expect(tr("9 sur 10 · à votre rythme")).toBe("9 of 10 · at your own pace");
    expect(tr("Bonsoir, Claire")).toBe("Good evening, Claire");
    expect(tr("Carte de Marc Durand")).toBe("Marc Durand's card");
  });

  it("pluriels assemblés par le code", () => {
    loadDict(en);
    expect(tr("2 étapes restent : revenez quand vous voulez.")).toBe("2 steps left: come back whenever you like.");
    expect(tr("1 étape reste : revenez quand vous voulez.")).toBe("1 step left: come back whenever you like.");
    expect(tr("3 éléments")).toBe("3 items");
  });

  it("libellé mis en minuscules par le code", () => {
    loadDict(en);
    expect(tr("Prochaine étape : vérifier votre identité.")).toBe("Next step: verify your identity.");
  });

  it("nom propre et texte inconnu laissés tels quels", () => {
    loadDict(es);
    expect(tr("Claire Durand")).toBe("Claire Durand");
    expect(tr("Urgence et santé")).toBe("Urgencia y salud");
  });
});
