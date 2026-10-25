// Phone app only. Face ID (or the fingerprint, or the phone's own code) is required before a card opens anything, and it
// keeps the card's code so it is typed once per phone. The code stays part of the key: without the card, nothing opens.
import { tr } from "./i18n";

const plugin = async () => (await import("@capgo/capacitor-native-biometric")).NativeBiometric;
const key = (cardId: string) => `code:${cardId}`;

// The saved code once Face ID has confirmed; null when none is saved yet (Face ID is still required, then the code is typed).
export async function faceIdThenCode(cardId: string): Promise<string | null> {
  const bio = await plugin();
  const a = await bio.isAvailable({ useFallback: true });
  if (!a.isAvailable && !a.deviceIsSecure) throw new Error("Activez Face ID, l'empreinte ou un code de verrouillage sur ce téléphone : c'est obligatoire pour ouvrir le Coffre.");
  const reason = tr("Confirmez que c'est bien vous");
  try {
    if ((await bio.isDataSaved({ key: key(cardId) })).isSaved) return (await bio.getSecureData({ key: key(cardId), reason, title: tr("Ouvrir le Coffre") })).value;
    await bio.verifyIdentity({ reason, title: tr("Ouvrir le Coffre"), useFallback: true, maxAttempts: 3 });
    return null;
  } catch {
    throw new Error("Identité non confirmée sur ce téléphone. Réessayez.");
  }
}

// After a code typed correctly. A phone with only a passcode (no Face ID or fingerprint) cannot keep it: typed each time.
export async function rememberCode(cardId: string, pin: string) {
  const { NativeBiometric, AccessControl } = await import("@capgo/capacitor-native-biometric");
  await NativeBiometric.setData({ key: key(cardId), value: pin, accessControl: AccessControl.BIOMETRY_ANY, title: tr("Retenir le code avec Face ID") }).catch(console.error);
}

export async function forgetCode(cardId: string) {
  await (await plugin()).deleteData({ key: key(cardId) }).catch(() => {});
}
