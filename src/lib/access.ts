// A relative's access from their own phone, without cards: Face ID and a 6-digit code. The phone makes its own key;
// only the public half leaves it, with the request. Once the owner agrees, their open Coffre seals to it what they
// attribute to this person (vault.approveAccess), released at the chosen moment like any card.
// App: kept in the Keychain / Keystore, readable only after Face ID, and sealed by the code. Demo: in this browser.
import { get, set } from "idb-keyval";
import { fromB64, na, newSalt, open, pinKey, seal, toB64, type Sealed } from "./crypto";
import { tr } from "./i18n";
import { isNative } from "./native";
import type { Card, HolderSession } from "./store";

export interface AccessKey {
  pk: string;
  salt: string;
  sk: Sealed; // the private key, sealed by the code
}

const slot = (personId: string) => `acces:${personId}`;
const aad = (pk: string) => `acces:${pk}`;
const plugin = () => import("@capgo/capacitor-native-biometric");

let fails = 0;
let lockedUntil = 0;

export async function hasAccessKey(personId: string) {
  if (!isNative()) return !!(await get(slot(personId)));
  return (await (await plugin()).NativeBiometric.isDataSaved({ key: slot(personId) })).isSaved;
}

// A new key for this person's access on this phone; its public half goes with the request.
export async function newAccessKey(personId: string, pin: string) {
  const s = await na();
  const { publicKey, privateKey } = s.crypto_box_keypair();
  const pk = toB64(s, publicKey);
  const salt = await newSalt();
  const k: AccessKey = { pk, salt, sk: await seal(await pinKey(pin, salt), privateKey, aad(pk)) };
  if (!isNative()) await set(slot(personId), k);
  else {
    const { NativeBiometric, AccessControl } = await plugin();
    if (!(await NativeBiometric.isAvailable()).isAvailable) throw new Error("Activez Face ID ou l'empreinte sur ce téléphone : votre accès en a besoin.");
    await NativeBiometric.setData({ key: slot(personId), value: JSON.stringify(k), accessControl: AccessControl.BIOMETRY_ANY });
  }
  return pk;
}

// Face ID (the phone only gives the key after it), or null when this phone holds no access for this person.
export async function readAccessKey(personId: string): Promise<AccessKey | null> {
  if (!isNative()) return (await get<AccessKey>(slot(personId))) ?? null;
  const { NativeBiometric } = await plugin();
  if (!(await NativeBiometric.isDataSaved({ key: slot(personId) })).isSaved) return null;
  try {
    return JSON.parse((await NativeBiometric.getSecureData({ key: slot(personId), reason: tr("Confirmez que c'est bien vous"), title: tr("Ouvrir le Coffre") })).value) as AccessKey;
  } catch {
    throw new Error("Identité non confirmée sur ce téléphone. Réessayez.");
  }
}

// Then the code: the open session of the approved phone `phone`.
export async function unlockAccess(k: AccessKey, phone: Pick<Card, "id" | "boxPk">, pin: string): Promise<HolderSession> {
  if (phone.boxPk && phone.boxPk !== k.pk) throw new Error("Votre accès a été validé sur un autre téléphone. Demandez-le de nouveau depuis celui-ci.");
  if (Date.now() < lockedUntil) throw new Error("Trop d'essais. Patientez quelques minutes.");
  try {
    const privateKey = await open(await pinKey(pin, k.salt), k.sk, aad(k.pk));
    fails = 0;
    return { mode: "holder", cardId: phone.id, publicKey: fromB64(await na(), k.pk), privateKey };
  } catch {
    if (++fails >= 5) {
      lockedUntil = Date.now() + 5 * 60_000;
      fails = 0;
    }
    throw new Error("Code incorrect. Réessayez.");
  }
}

// Shown on both phones: in doubt, the owner calls the relative, who reads the same 6 digits on theirs.
export async function fingerprint(pk: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", fromB64(await na(), pk).slice()));
  const n = String(((d[0] << 16) | (d[1] << 8) | d[2]) % 1_000_000).padStart(6, "0");
  return `${n.slice(0, 3)} ${n.slice(3)}`;
}
