// The cards. Three kinds share one contract: tapping a card yields a secret that only exists in memory, never on a server.
//  - "fido": FIDO2 NFC/USB security cards, read by the browser (WebAuthn, PRF extension). The card checks its own PIN,
//    with a hardware retry limit. Works on the website (Chrome, Edge, Safari, Android) — the default for the web version.
//  - "tangem": Tangem cards, read by the iOS/Android app through the native plugin (see native/tangem/README.md).
//    The card only signs; Ed25519 signatures are deterministic (RFC 8032), so hashing one gives a reproducible secret.
//    Our own 6-digit code (Argon2id) is combined with it. To be validated with Tangem (open point of the follow-up).
//  - "demo": a simulated chip whose seed stays in the browser. Demo and end-to-end tests only.
import { registerPlugin } from "@capacitor/core";
import { get, set } from "idb-keyval";
import { combine, fromB64, na, pinKey, toB64 } from "./crypto";
import { CARD_DRIVER, FIDO_RP_ID, PROD } from "./env";
import { APP_NAME } from "./config";
import { isNative } from "./native";
import type { Card, CardKind } from "./store";

export type Purpose = "unlock" | "box";
export const purposeOf = (c: Pick<Card, "holderId">): Purpose => (c.holderId === "owner" ? "unlock" : "box");
// A FIDO2 card verifies its own PIN; the other kinds need our code on top of the card.
export const needsPin = (kind: CardKind | undefined) => kind !== "fido";

export function driver(): CardKind {
  if (!PROD || CARD_DRIVER === "demo") return "demo";
  return isNative() ? "tangem" : "fido";
}

export interface Enrolled {
  kind: CardKind;
  chipId: string;
  secret: Uint8Array;
}
export interface Tap {
  card: Card;
  secret: Uint8Array;
}

const encoder = new TextEncoder();
const label = (p: Purpose) => encoder.encode(`sillage:v1:${p}`);

// Card secret + code: neither one alone opens the Coffre (for FIDO2 cards the code is checked inside the card).
export async function keyFrom(secret: Uint8Array, kind: CardKind | undefined, pin: string | undefined, salt: string) {
  if (!needsPin(kind)) return combine(secret, label("unlock"));
  if (!pin) throw new Error("Code manquant.");
  return combine(secret, await pinKey(pin, salt));
}

/* ---------- demo ---------- */

// shortcut: the seed sits in IndexedDB to stand in for the card's secure element; demo and tests only.
async function demoSecret(cardId: string, purpose: Purpose, create: boolean) {
  const s = await na();
  let seed = await get<Uint8Array>(`chip:${cardId}`);
  if (!seed) {
    if (!create) throw new Error("Cette carte n'a pas été activée sur cet appareil.");
    seed = s.randombytes_buf(s.crypto_sign_SEEDBYTES);
    await set(`chip:${cardId}`, seed);
  }
  const { privateKey } = s.crypto_sign_seed_keypair(seed);
  return combine(s.crypto_sign_detached(label(purpose), privateKey));
}

/* ---------- FIDO2 (WebAuthn PRF) ---------- */

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const prfSalt = async (p: Purpose) => new Uint8Array(await crypto.subtle.digest("SHA-256", label(p)));

type PrfResults = { enabled?: boolean; results?: { first?: ArrayBuffer } };
const prfOf = (cred: PublicKeyCredential) => (cred.getClientExtensionResults() as { prf?: PrfResults }).prf;

export const fidoSupported = () => typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;

function fidoError(e: unknown): Error {
  const n = (e as Error)?.name;
  if (n === "NotAllowedError") return new Error("Lecture annulée ou délai dépassé. Posez la carte et réessayez.");
  if (n === "InvalidStateError") return new Error("Cette carte est déjà enregistrée.");
  if (n === "SecurityError") return new Error("Ouvrez l'application depuis son adresse officielle (https).");
  return e instanceof Error ? e : new Error("La carte n'a pas pu être lue.");
}

async function fidoGet(candidates: Card[]): Promise<Tap> {
  const fido = candidates.filter((c) => c.kind === "fido" && c.chipId);
  if (!fido.length) throw new Error("Aucune carte active à lire.");
  const evalByCredential: Record<string, { first: Uint8Array }> = {};
  for (const c of fido) evalByCredential[c.chipId!] = { first: await prfSalt(purposeOf(c)) };
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: FIDO_RP_ID,
        allowCredentials: fido.map((c) => ({ type: "public-key" as const, id: unb64url(c.chipId!), transports: ["nfc", "usb", "ble", "hybrid"] as AuthenticatorTransport[] })),
        userVerification: "required",
        timeout: 120_000,
        extensions: { prf: { evalByCredential } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw fidoError(e);
  }
  const card = fido.find((c) => c.chipId === b64url(cred.rawId));
  const first = prfOf(cred)?.results?.first;
  if (!card) throw new Error("Cette carte n'appartient pas à ce Coffre.");
  if (!first) throw new Error("Ce navigateur ne sait pas lire la clé de cette carte. Essayez Chrome, Edge ou Safari à jour.");
  return { card, secret: new Uint8Array(first) };
}

async function fidoEnroll(card: Card): Promise<Enrolled> {
  const salt = await prfSalt(purposeOf(card));
  let cred: PublicKeyCredential;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: APP_NAME, id: FIDO_RP_ID },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: card.printedName, displayName: card.printedName },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [
          { type: "public-key", alg: -8 },
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "cross-platform", residentKey: "discouraged", userVerification: "required" },
        attestation: "none",
        timeout: 120_000,
        extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential;
  } catch (e) {
    throw fidoError(e);
  }
  const prf = prfOf(cred);
  if (!prf?.enabled) throw new Error("Cette carte ne permet pas de chiffrer (extension PRF absente). Utilisez une carte compatible.");
  const chipId = b64url(cred.rawId);
  // Most cards only give the secret on a read, not at creation: one more tap.
  const first = prf.results?.first;
  if (first) return { kind: "fido", chipId, secret: new Uint8Array(first) };
  const tap = await fidoGet([{ ...card, kind: "fido", chipId }]);
  return { kind: "fido", chipId, secret: tap.secret };
}

/* ---------- Tangem (native app) ---------- */

interface TangemPlugin {
  scan(): Promise<{ cardId: string; publicKey: string }>;
  sign(o: { cardId: string; publicKey: string; hash: string }): Promise<{ signature: string }>;
}
const Tangem = registerPlugin<TangemPlugin>("Tangem");

async function tangemSecret(cardId: string, publicKey: string, purpose: Purpose) {
  const s = await na();
  const hash = toB64(s, new Uint8Array(await crypto.subtle.digest("SHA-256", label(purpose))));
  const { signature } = await Tangem.sign({ cardId, publicKey, hash });
  return combine(fromB64(s, signature));
}

async function tangemScan() {
  try {
    return await Tangem.scan();
  } catch (e) {
    const m = (e as Error)?.message ?? "";
    throw new Error(/not implemented|unimplemented/i.test(m) ? "La lecture NFC n'est pas disponible sur cet appareil." : "La carte n'a pas pu être lue. Gardez-la contre le téléphone.");
  }
}

// Card diagnostic (app, 3 taps): our keys only exist if the card signs the same value identically every time, with a
// valid Ed25519 signature. A card that adds randomness to its signatures can never open a Coffre.
export async function testCard(onStep: (step: number) => void) {
  const s = await na();
  onStep(1);
  const { cardId, publicKey } = await tangemScan();
  const message = new Uint8Array(await crypto.subtle.digest("SHA-256", label("unlock")));
  const sign = async (step: number) => {
    onStep(step);
    return fromB64(s, (await Tangem.sign({ cardId, publicKey, hash: toB64(s, message) })).signature);
  };
  const [a, b] = [await sign(2), await sign(3)];
  return { cardId, valid: s.crypto_sign_verify_detached(a, message, s.from_hex(publicKey)), deterministic: s.memcmp(a, b) };
}

/* ---------- contract ---------- */

// A new physical card for this record.
export async function enroll(card: Card): Promise<Enrolled> {
  const kind = driver();
  if (kind === "demo") return { kind, chipId: card.id, secret: await demoSecret(card.id, purposeOf(card), true) };
  if (kind === "fido") return fidoEnroll(card);
  const { cardId, publicKey } = await tangemScan();
  return { kind, chipId: publicKey, secret: await tangemSecret(cardId, publicKey, purposeOf(card)) };
}

// The card being tapped, among the ones that may open this Coffre. Demo: the person picks it on screen.
export async function read(candidates: Card[], picked?: Card): Promise<Tap> {
  const kind = driver();
  if (kind === "demo") {
    if (!picked) throw new Error("Choisissez une carte.");
    return { card: picked, secret: await demoSecret(picked.id, purposeOf(picked), false) };
  }
  if (kind === "fido") return fidoGet(candidates);
  const { cardId, publicKey } = await tangemScan();
  const card = candidates.find((c) => c.chipId === publicKey);
  if (!card) throw new Error("Cette carte n'appartient pas à ce Coffre, ou elle a été désactivée.");
  return { card, secret: await tangemSecret(cardId, publicKey, purposeOf(card)) };
}

export async function chipExists(cardId: string) {
  return !!(await get(`chip:${cardId}`));
}
