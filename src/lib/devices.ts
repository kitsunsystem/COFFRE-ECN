// Trusted computers. The website cannot read the cards: on a computer, the Coffre opens with the phone's consent (card
// tapped and Face ID, in the app). The phone seals the opened keys to this computer's own public key, so the server only
// relays ciphertext it cannot open. Demo: the "phone" is a second window sharing this browser's storage.
import { get, set } from "idb-keyval";
import { devices } from "./api";
import { fromB64, na, openFrom, sealTo, toB64 } from "./crypto";
import type { DeviceRequest, OpenSession } from "./store";

interface Here {
  publicKey: Uint8Array;
  privateKey: Uint8Array; // never leaves this browser
  id?: string; // once a phone has approved this computer
}
// What the phone sends, sealed: the keys of the session it opened, bound to the request.
interface Payload {
  r: string;
  m: "owner" | "holder";
  c: string;
  k: string;
  p?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function here(): Promise<Here> {
  let h = await get<Here>("device");
  if (!h) {
    const { publicKey, privateKey } = (await na()).crypto_box_keypair();
    h = { publicKey, privateKey };
    await set("device", h);
  }
  return h;
}

export function deviceName() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "Ordinateur";
  return `${browser} · ${os}`;
}

export const thisDeviceId = async () => (await get<Here>("device"))?.id;

// This computer's id while it is trusted (90 days after its approval), otherwise null: it must show its QR code.
export async function trustedHere(): Promise<string | null> {
  const id = await thisDeviceId();
  if (!id) return null;
  return (await devices.list()).some((d) => d.id === id && d.expiresAt > Date.now()) ? id : null;
}

export async function removeDevice(id: string) {
  await devices.remove(id);
  const h = await get<Here>("device");
  if (h?.id === id) await set("device", { ...h, id: undefined });
}

// The page where the phone answers. In the QR code it also carries this computer's key: the phone checks that the
// server shows it this very key.
export const phoneUrl = (id: string, pk?: string) => `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/appareil/?r=${id}${pk ? `&k=${encodeURIComponent(pk)}` : ""}`;

export async function startPairing() {
  const pk = toB64(await na(), (await here()).publicKey);
  const r = await devices.request("pairing", { pk, name: deviceName() });
  return { ...r, url: phoneUrl(r.id, pk) };
}

export async function startOpening(device: string) {
  const r = await devices.request("open", { device });
  void devices.notify(r.id);
  return r;
}

// Waits for the phone's answer. Cancelled (signal): the request is refused, so a late approval delivers nothing.
export async function waitForPhone(id: string, signal: AbortSignal): Promise<OpenSession | "refused" | "expired" | "cancelled"> {
  while (!signal.aborted) {
    const t = await devices.take(id);
    if (t.status === "approved") return receive(id, t.sealed!, t.deviceId);
    if (t.status !== "pending") return t.status === "refused" ? "refused" : "expired";
    await sleep(1500);
  }
  await devices.refuse(id).catch(() => {});
  return "cancelled";
}

export async function receive(id: string, sealed: string, deviceId?: string): Promise<OpenSession> {
  const s = await na();
  const h = await here();
  const p = JSON.parse(new TextDecoder().decode(await openFrom(sealed, h.publicKey, h.privateKey))) as Payload;
  if (p.r !== id) throw new Error("Réponse inattendue du téléphone. Recommencez.");
  if (deviceId && h.id !== deviceId) await set("device", { ...h, id: deviceId });
  return p.m === "owner" ? { mode: "owner", cardId: p.c, vmk: fromB64(s, p.k) } : { mode: "holder", cardId: p.c, privateKey: fromB64(s, p.k), publicKey: fromB64(s, p.p!) };
}

// Phone side. Pairing: the key must be the one read in the QR code. Opening: the one this phone pinned at pairing,
// so the server can never point the keys to another computer. Returns false when the number was wrong.
export async function approve(req: DeviceRequest, choice: number, keys: OpenSession, qrKey?: string): Promise<boolean> {
  const expected = req.kind === "pairing" ? qrKey : await get<string>(`pinned:${req.deviceId}`);
  if (expected !== req.pk) throw new Error(req.kind === "pairing" ? "Ce code QR ne correspond pas à la demande. Scannez-le de nouveau." : "Cet ordinateur n'a pas été approuvé depuis ce téléphone : sur l'ordinateur, choisissez « Associer avec le code QR ».");
  const s = await na();
  const p: Payload = keys.mode === "owner" ? { r: req.id, m: "owner", c: keys.cardId, k: toB64(s, keys.vmk) } : { r: req.id, m: "holder", c: keys.cardId, k: toB64(s, keys.privateKey), p: toB64(s, keys.publicKey) };
  const device = await devices.approve(req.id, choice, await sealTo(req.pk, new TextEncoder().encode(JSON.stringify(p))));
  if (!device) return false;
  if (req.kind === "pairing") await set(`pinned:${device}`, req.pk);
  return true;
}
