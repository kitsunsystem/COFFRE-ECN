// The Coffre as the app runs it (demo driver, simulated chips): who can decrypt what, and what the PDF contains.
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { exportContent } from "@/app/coffre/(ouvert)/rubriques/export";
import { enroll, read } from "./cards";
import { useApp, useSession, type Card } from "./store";
import { activateHolderCard, activateOwnerCard, decryptFile, encryptFile, lock, readItems, saveItem, setRight, unlock, visibleSubsections, type FileMeta } from "./vault";

const PIN = "246810";
const card = (id: string, holderId: string): Card => ({ id, holderId, printedName: holderId === "owner" ? "Claire Durand" : "Marc Durand", status: "recue", orderedAt: 0, extra: false });
const get = (id: string) => useApp.getState().cards.find((c) => c.id === id)!;
const open = async (id: string, pin = PIN) => unlock(await read([get(id)], get(id)), pin);
let file: FileMeta;

beforeAll(async () => {
  useApp.getState().set({
    account: { firstName: "Claire", lastName: "Durand", email: "c@x.fr", phone: "", birthDate: "1972-03-14", birthCity: "Lyon", birthCountry: "France", address: "", isBusinessOwner: false, kyc: "verifie", createdAt: 0 },
    people: [{ id: "marc", firstName: "Marc", lastName: "Durand", relation: "Conjoint" }],
    cards: [card("c1", "owner"), card("c2", "owner"), card("m1", "marc")],
    phase: "lancement",
  });
  await activateOwnerCard(get("c1"), await enroll(get("c1")), PIN);
  file = await encryptFile("a-prevenir", new File([new TextEncoder().encode("ordonnance")], "ordonnance.pdf", { type: "application/pdf" }));
  await saveItem("a-prevenir", { title: "Marc, mon mari", fields: { name: "Marc", phone: "0612" }, files: [file] });
  await saveItem("banques", { title: "Banque du Rhône", fields: { bank: "Banque du Rhône" }, files: [] });
  await saveItem("mots-de-passe", { title: "Messagerie", fields: { account: "mail", password: "secret!" }, files: [] });
  await activateHolderCard(get("m1"), await enroll(get("m1")), PIN);
  await setRight("marc", "a-prevenir", "now");
  await setRight("marc", "banques", "coup_dur");
  lock();
});

describe("Coffre", () => {
  it("opens only with the card and the right code", async () => {
    await expect(open("c1", "000000")).rejects.toThrow("Code incorrect");
    expect(await open("c1")).toBe("owner");
    lock();
  });

  it("a second card can only be added once the Coffre is open", async () => {
    await expect(activateOwnerCard(get("c2"), await enroll(get("c2")), PIN)).rejects.toThrow("Ouvrez d'abord");
  });

  it("a beneficiary card opens only what is released to it", async () => {
    expect(await open("m1")).toBe("holder");
    expect(visibleSubsections()).toEqual(["a-prevenir"]);
    expect(await readItems("banques")).toEqual([]);
    const [item] = await readItems("a-prevenir");
    expect(item.payload.title).toBe("Marc, mon mari");
    expect(await (await decryptFile("a-prevenir", file)).text()).toBe("ordonnance");
    await expect(decryptFile("banques", file)).rejects.toThrow();
  });

  it("the beneficiary's PDF holds only their part, without codes or passwords", async () => {
    const pdf = await exportContent();
    expect(pdf.map((s) => s.title)).toEqual(["Urgence et santé"]);
    expect(pdf[0].subs[0].items[0].rows).toEqual([
      ["Personne à prévenir", "Marc"],
      ["Téléphone", "0612"],
      ["Documents", "ordonnance.pdf"],
    ]);
    lock();
  });

  it("the owner's PDF holds everything except secret fields", async () => {
    await open("c1");
    const pdf = await exportContent();
    expect(pdf.map((s) => s.title)).toEqual(["Urgence et santé", "Argent et contrats", "Vie numérique"]);
    expect(JSON.stringify(pdf)).not.toContain("secret!");
  });

  it("withdrawing a right changes the key: the card opens nothing any more", async () => {
    await setRight("marc", "a-prevenir", "jamais");
    lock();
    await open("m1");
    expect(visibleSubsections()).toEqual([]);
    expect(await readItems("a-prevenir")).toEqual([]);
    lock();
    expect(useSession.getState().session.mode).toBe("locked");
  });
});
