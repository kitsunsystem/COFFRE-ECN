// NFC cards, Tangem model: the secret is generated in the card chip and never leaves it.
// The card only signs; we derive stable secrets from Ed25519 signatures, which are deterministic (RFC 8032):
// signing the same message twice gives the same bytes, so hashing the signature yields a reproducible key.
// This is the method to confirm with Tangem's technical team (open point in the brief).
import { get, set } from "idb-keyval";
import { combine, na, pinKey, toB64 } from "./crypto";

export interface CardChip {
  id: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
}

// shortcut: the demo chip keeps its seed in the browser (IndexedDB) to stand in for the card's secure element;
// replace with the Tangem SDK (Capacitor plugin, CoreNFC on iPhone) when the native app is built.
export async function demoChip(cardId: string): Promise<CardChip> {
  const s = await na();
  let seed = await get<Uint8Array>(`chip:${cardId}`);
  if (!seed) {
    seed = s.randombytes_buf(s.crypto_sign_SEEDBYTES);
    await set(`chip:${cardId}`, seed);
  }
  const { privateKey } = s.crypto_sign_seed_keypair(seed);
  return { id: cardId, sign: async (m) => s.crypto_sign_detached(m, privateKey) };
}

export async function chipExists(cardId: string) {
  return !!(await get(`chip:${cardId}`));
}

const encoder = new TextEncoder();

export async function cardSecret(chip: CardChip, purpose: "unlock" | "box") {
  return combine(await chip.sign(encoder.encode(`sillage:v1:${purpose}`)));
}

// Card + code together: neither one alone opens the Coffre.
export async function cardAndCode(chip: CardChip, purpose: "unlock" | "box", pin: string, salt: string) {
  return combine(await cardSecret(chip, purpose), await pinKey(pin, salt));
}

export async function holderKeys(chip: CardChip, pin: string, salt: string) {
  const s = await na();
  const kp = s.crypto_box_seed_keypair(await cardAndCode(chip, "box", pin, salt));
  return { publicKey: kp.publicKey, privateKey: kp.privateKey, publicKeyB64: toB64(s, kp.publicKey) };
}
