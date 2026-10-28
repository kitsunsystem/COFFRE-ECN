// The Coffre as the app runs it (demo driver, simulated chips): who can decrypt what, and what the PDF contains.
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { exportContent } from "@/app/coffre/(ouvert)/rubriques/export";
import { newAccessKey, readAccessKey, unlockAccess } from "./access";
import { enroll, read } from "./cards";
import { useApp, useSession, type Card } from "./store";
import { activateOwnerCard, activatePackCard, approveAccess, decryptFile, encryptFile, lock, openSession, readItems, saveItem, setRight, unlock, visibleSubsections, type FileMeta } from "./vault";

const PIN = "246810";
const card = (id: string, holderId: string, status: Card["status"] = "recue"): Card => ({ id, holderId, printedName: holderId === "owner" ? "Claire Durand" : "Marc Durand", status, orderedAt: 0, extra: false });
const get = (id: string) => useApp.getState().cards.find((c) => c.id === id)!;
const open = async (id: string, pin = PIN) => unlock(await read([get(id)], get(id)), pin);
// Marc, from his phone: Face ID (nothing to do here), then his code.
const phoneKeys = async (pin = PIN) => unlockAccess((await readAccessKey("marc"))!, get("m1"), pin);
let file: FileMeta;

beforeAll(async () => {
  useApp.getState().set({
    account: { firstName: "Claire", lastName: "Durand", email: "c@x.fr", phone: "", birthDate: "1972-03-14", birthCity: "Lyon", birthCountry: "France", address: "", isBusinessOwner: false, kyc: "verifie", createdAt: 0 },
    people: [{ id: "marc", firstName: "Marc", lastName: "Durand", relation: "Conjoint" }],
    // p1: one of Marc's pack cards, received after Claire's death.
    cards: [card("c1", "owner"), card("c2", "owner"), card("p1", "marc")],
    phase: "lancement",
  });
  await activateOwnerCard(get("c1"), await enroll(get("c1")), PIN);
  file = await encryptFile("a-prevenir", new File([new TextEncoder().encode("ordonnance")], "ordonnance.pdf", { type: "application/pdf" }));
  await saveItem("a-prevenir", { title: "Marc, mon mari", fields: { name: "Marc", phone: "0612" }, files: [file] });
  await saveItem("banques", { title: "Banque du Rhône", fields: { bank: "Banque du Rhône" }, files: [] });
  await saveItem("mots-de-passe", { title: "Messagerie", fields: { account: "mail", password: "secret!" }, files: [] });
  await setRight("marc", "a-prevenir", "now");
  await setRight("marc", "banques", "coup_dur");
  // Marc asks from his phone; Claire, Coffre open, accepts: the rights already chosen are sealed to it.
  const phone: Card = { ...card("m1", "marc", "demandee"), kind: "telephone", boxPk: await newAccessKey("marc", PIN) };
  useApp.getState().set((s) => ({ cards: [...s.cards, phone] }));
  await approveAccess(get("m1"));
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

  it("a relative's phone opens only what is released to it, with the right code", async () => {
    await expect(phoneKeys("000000")).rejects.toThrow("Code incorrect");
    expect(await openSession(await phoneKeys())).toBe("holder");
    expect(visibleSubsections()).toEqual(["a-prevenir"]);
    expect(await readItems("banques")).toEqual([]);
    const [item] = await readItems("a-prevenir");
    expect(item.payload.title).toBe("Marc, mon mari");
    expect(await (await decryptFile("a-prevenir", file)).text()).toBe("ordonnance");
    await expect(decryptFile("banques", file)).rejects.toThrow();
  });

  it("the relative's PDF holds only their part, without codes or passwords", async () => {
    const pdf = await exportContent();
    expect(pdf.map((s) => s.title)).toEqual(["Urgence et santé"]);
    expect(pdf[0].subs[0].items[0].rows).toEqual([
      ["Personne à prévenir", "Marc"],
      ["Téléphone", "0612"],
      ["Documents", "ordonnance.pdf"],
    ]);
    lock();
  });

  it("after the death, each card keeps the phone's key: it opens the same part, phone or not", async () => {
    await activatePackCard(get("p1"), await enroll(get("p1")), PIN, await phoneKeys());
    expect(get("p1")).toMatchObject({ status: "active", phoneId: "m1" });
    await expect(open("p1", "000000")).rejects.toThrow("Code incorrect");
    expect(await open("p1")).toBe("holder");
    expect(useSession.getState().session).toMatchObject({ mode: "holder", cardId: "m1" });
    expect(visibleSubsections()).toEqual(["a-prevenir"]);
    lock();
  });

  it("the owner's PDF holds everything except secret fields", async () => {
    await open("c1");
    const pdf = await exportContent();
    expect(pdf.map((s) => s.title)).toEqual(["Urgence et santé", "Argent et contrats", "Vie numérique"]);
    expect(JSON.stringify(pdf)).not.toContain("secret!");
  });

  it("withdrawing a right changes the key: neither the phone nor the card opens anything any more", async () => {
    await setRight("marc", "a-prevenir", "jamais");
    lock();
    await openSession(await phoneKeys());
    expect(visibleSubsections()).toEqual([]);
    expect(await readItems("a-prevenir")).toEqual([]);
    lock();
    await open("p1");
    expect(visibleSubsections()).toEqual([]);
    lock();
    expect(useSession.getState().session.mode).toBe("locked");
  });
});
