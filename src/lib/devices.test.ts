// Computer ↔ phone, as the demo runs it (same code as production, local storage instead of the database):
// only the computer that showed the QR code can open what the phone sends, and only for that request.
import "fake-indexeddb/auto";
import { set } from "idb-keyval";
import { beforeAll, describe, expect, it } from "vitest";
import { devices } from "./api";
import { approve, receive, startOpening, startPairing, trustedHere, waitForPhone } from "./devices";
import type { OpenSession } from "./store";

const mem = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) } });
Object.defineProperty(globalThis, "location", { configurable: true, value: { origin: "https://exemple.fr" } });

const keys: OpenSession = { mode: "owner", cardId: "c1", vmk: new Uint8Array(32).fill(7) };
const never = new AbortController().signal;
const qrKey = (url: string) => new URL(url).searchParams.get("k")!;
const phoneSees = async (id: string) => (await devices.get(id))!;
const code = (id: string) => (JSON.parse(mem.get("sillage-appareils")!) as { requests: { id: string; code: number }[] }).requests.find((r) => r.id === id)!.code;
let device: string;

describe("appairage par code QR", () => {
  beforeAll(() => mem.clear());

  it("a wrong number refuses the request and delivers nothing", async () => {
    const p = await startPairing();
    const req = await phoneSees(p.id);
    expect(req.choices).toHaveLength(3);
    expect(await approve(req, req.choices.find((n) => n !== p.code)!, keys, qrKey(p.url))).toBe(false);
    expect(await waitForPhone(p.id, never)).toBe("refused");
  });

  it("refuses a QR code that does not match the computer's key", async () => {
    const p = await startPairing();
    await expect(approve(await phoneSees(p.id), p.code, keys, "AAAA" + qrKey(p.url).slice(4))).rejects.toThrow(/code QR/);
  });

  it("the right number makes the computer trusted and opens the Coffre there with the phone's keys", async () => {
    const p = await startPairing();
    expect(p.url).toMatch(/^https:\/\/exemple\.fr\/appareil\/\?r=.+&k=.+/);
    expect(await approve(await phoneSees(p.id), code(p.id), keys, qrKey(p.url))).toBe(true);
    expect(await waitForPhone(p.id, never)).toEqual(keys);
    device = (await trustedHere())!;
    expect(device).toBeTruthy();
    // Taken once: the sealed keys are gone.
    expect((await devices.take(p.id)).sealed).toBeUndefined();
  });
});

describe("ouverture depuis l'ordinateur de confiance", () => {
  it("the phone seals to the key it pinned at pairing; a holder's keys travel too", async () => {
    const r = await startOpening(device);
    const holder: OpenSession = { mode: "holder", cardId: "m1", publicKey: new Uint8Array(32).fill(1), privateKey: new Uint8Array(32).fill(2) };
    expect(await approve(await phoneSees(r.id), r.code, holder)).toBe(true);
    expect(await waitForPhone(r.id, never)).toEqual(holder);
  });

  it("refuses when the server shows another key than the pinned one", async () => {
    const r = await startOpening(device);
    await set(`pinned:${device}`, "B".repeat(43) + "=");
    await expect(approve(await phoneSees(r.id), r.code, keys)).rejects.toThrow(/pas été approuvé depuis ce téléphone/);
  });

  it("a cancelled wait refuses the request", async () => {
    const r = await startOpening(device);
    const stop = new AbortController();
    stop.abort();
    expect(await waitForPhone(r.id, stop.signal)).toBe("cancelled");
    expect((await phoneSees(r.id)).status).toBe("refused");
  });

  it("an answer only opens the request it was made for", async () => {
    const p = await startPairing();
    const req = await phoneSees(p.id);
    await approve(req, code(p.id), keys, qrKey(p.url));
    const { sealed } = await devices.take(p.id);
    await expect(receive("une-autre-demande", sealed!)).rejects.toThrow(/inattendue/);
  });
});
