// Key pair of the concierge partner, generated once on the partner's own computer.
// The public key goes into app_settings.concierge_public_key; the private key never leaves the partner.
// Usage: node scripts/concierge-keys.mjs
import sodium from "libsodium-wrappers-sumo";

await sodium.ready;
const { publicKey, privateKey } = sodium.crypto_box_keypair();
const b64 = (u) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL);
console.log(`Clé publique (à donner à l'application) :\n${b64(publicKey)}\n`);
console.log(`Clé privée (à garder secrète, chez le partenaire uniquement) :\n${b64(privateKey)}`);
