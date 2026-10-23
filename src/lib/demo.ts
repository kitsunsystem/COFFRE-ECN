// Demo family, so the whole service can be shown before Supabase is connected. Code for every card: 123456.
import { uid, useApp, useSession, type Card, type Person } from "./store";
import { activateHolderCard, activateOwnerCard, lock, saveItem, setRight, setSectionRight } from "./vault";

export const DEMO_PIN = "123456";

export async function seedDemo() {
  const st = useApp.getState();
  st.reset();
  lock();
  const marc: Person = { id: uid(), firstName: "Marc", lastName: "Durand", relation: "Conjoint", email: "marc.durand@exemple.fr", phone: "06 12 34 56 78" };
  const lea: Person = { id: uid(), firstName: "Léa", lastName: "Durand", relation: "Enfant", email: "lea.durand@exemple.fr" };
  const paul: Person = { id: uid(), firstName: "Paul", lastName: "Durand", relation: "Enfant", email: "paul.durand@exemple.fr" };
  const sophie: Person = { id: uid(), firstName: "Sophie", lastName: "Martin", relation: "Ami", email: "sophie.martin@exemple.fr" };
  const t = Date.now();
  const card = (holderId: string, printedName: string, extra = false): Card => ({ id: uid(), holderId, printedName, status: "recue", orderedAt: t - 9 * 86_400_000, extra });
  const owner = [card("owner", "Claire Durand"), card("owner", "Claire Durand"), card("owner", "Claire Durand")];
  const cMarc = card(marc.id, "Marc Durand", true);
  const cLea = card(lea.id, "Léa Durand", true);
  st.set({
    account: { firstName: "Claire", lastName: "Durand", email: "claire.durand@exemple.fr", phone: "06 98 76 54 32", birthDate: "1972-03-14", birthCity: "Lyon", birthCountry: "France", address: "12 rue des Lilas\n69003 Lyon", situation: "Marié(e)", isBusinessOwner: true, kyc: "verifie", createdAt: t - 12 * 86_400_000 },
    people: [marc, lea, paul, sophie],
    cards: [...owner, cMarc, cLea],
    guarantors: [
      { personId: marc.id, role: "Prévenir les enfants et déclarer un coup dur si je suis hospitalisée." },
      { personId: sophie.id, role: "Confirmer, avec Marc, s'il m'arrive quelque chose." },
    ],
  });
  for (const c of owner) await activateOwnerCard(c.id, DEMO_PIN);
  await activateHolderCard(cMarc.id, DEMO_PIN);
  await activateHolderCard(cLea.id, DEMO_PIN);

  const items: [string, string, Record<string, string>][] = [
    ["a-prevenir", "Marc, mon mari", { name: "Marc Durand", phone: "06 12 34 56 78", note: "À appeler en premier, à toute heure." }],
    ["groupe-allergies", "Groupe et allergies", { blood: "A+", allergies: "Pénicilline", note: "" }],
    ["medecins", "Dr Lefèvre, médecin traitant", { name: "Dr Anne Lefèvre", phone: "04 78 00 00 00", note: "Cabinet place Bellecour" }],
    ["identite-famille", "Passeport", { doc: "Passeport", number: "18AB12345", expiry: new Date(t + 40 * 86_400_000).toISOString().slice(0, 10), note: "Dans le tiroir du bureau" }],
    ["banques", "Banque principale", { bank: "Banque du Rhône", advisor: "M. Petit", phone: "04 72 00 00 00", note: "Compte joint et livret A" }],
    ["assurances", "Assurance-vie", { insurer: "Assurances Avenir", contract: "AV-778899", beneficiaries: "Léa et Paul, à parts égales", expiry: "", note: "" }],
    ["telephone", "Mon iPhone", { device: "iPhone", code: "4 8 1 5 1 6", note: "Le code du téléphone de secours est le même." }],
    ["juridique", "Testament", { doc: "Testament olographe", where: "Chez Maître Roux, notaire à Lyon", pro: "Maître Roux", note: "" }],
    ["obseques", "Mes souhaits", { contract: "Contrat obsèques Sérénité", wishes: "Une cérémonie simple, avec de la musique.", note: "" }],
    ["lettres", "Pour Léa", { to: "Léa", text: "Ma chérie, je suis si fière de toi…" }],
    ["prive", "Journal", { title: "Mon journal", note: "À détruire sans le lire." }],
  ];
  for (const [sub, title, fields] of items) await saveItem(sub, { title, fields, files: [] });

  await setSectionRight(cMarc.id, "urgence", "now");
  await setRight(cMarc.id, "banques", "coup_dur");
  await setRight(cMarc.id, "assurances", "deces");
  await setRight(cMarc.id, "telephone", "coup_dur");
  await setRight(cLea.id, "a-prevenir", "coup_dur");
  await setRight(cLea.id, "lettres", "deces");
  await setRight(cLea.id, "obseques", "deces");
  await setRight(cLea.id, "juridique", "deces");
  useSession.getState().setSession({ mode: "locked" });
  useApp.getState().set({ tourPending: true });
}
