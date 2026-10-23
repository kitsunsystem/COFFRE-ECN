// All Coffre encryption runs here, on the device, with libsodium (audited). Nothing in this file talks to a server.
import sodiumLib from "libsodium-wrappers-sumo";

export type Sodium = typeof sodiumLib;
export interface Sealed {
  n: string; // nonce, base64
  c: string; // ciphertext, base64
}

export async function na(): Promise<Sodium> {
  await sodiumLib.ready;
  return sodiumLib;
}

export const toB64 = (s: Sodium, u: Uint8Array) => s.to_base64(u, s.base64_variants.ORIGINAL);
export const fromB64 = (s: Sodium, b: string) => s.from_base64(b, s.base64_variants.ORIGINAL);
const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();

export async function newKey() {
  return (await na()).crypto_aead_xchacha20poly1305_ietf_keygen();
}

export async function newSalt() {
  const s = await na();
  return toB64(s, s.randombytes_buf(s.crypto_pwhash_SALTBYTES));
}

// Code (PIN) to key with Argon2id, so a stolen card alone never opens anything.
export async function pinKey(pin: string, saltB64: string) {
  const s = await na();
  return s.crypto_pwhash(32, pin, fromB64(s, saltB64), s.crypto_pwhash_OPSLIMIT_INTERACTIVE, s.crypto_pwhash_MEMLIMIT_INTERACTIVE, s.crypto_pwhash_ALG_ARGON2ID13);
}

export async function combine(...parts: Uint8Array[]) {
  const s = await na();
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  return s.crypto_generichash(32, all, null);
}

// XChaCha20-Poly1305; `aad` binds a ciphertext to its place (id, version) so it cannot be swapped.
export async function seal(key: Uint8Array, data: Uint8Array, aad: string): Promise<Sealed> {
  const s = await na();
  const n = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const c = s.crypto_aead_xchacha20poly1305_ietf_encrypt(data, aad, null, n, key);
  return { n: toB64(s, n), c: toB64(s, c) };
}

export async function open(key: Uint8Array, sealed: Sealed, aad: string) {
  const s = await na();
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, fromB64(s, sealed.c), aad, fromB64(s, sealed.n), key);
}

export const sealJson = (key: Uint8Array, value: unknown, aad: string) => seal(key, utf8.encode(JSON.stringify(value)), aad);
export async function openJson<T>(key: Uint8Array, sealed: Sealed, aad: string): Promise<T> {
  return JSON.parse(fromUtf8.decode(await open(key, sealed, aad))) as T;
}

// Anonymous sealed box: only the holder of `publicKeyB64`'s secret key can open it.
export async function sealTo(publicKeyB64: string, data: Uint8Array) {
  const s = await na();
  return toB64(s, s.crypto_box_seal(data, fromB64(s, publicKeyB64)));
}

export async function openFrom(sealedB64: string, publicKey: Uint8Array, secretKey: Uint8Array) {
  const s = await na();
  return s.crypto_box_seal_open(fromB64(s, sealedB64), publicKey, secretKey);
}
