// What differs between the website and the iOS/Android app (Capacitor): saving a file and copying text.
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

const toBase64 = (blob: Blob) =>
  new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]);
    r.onerror = () => ko(r.error);
    r.readAsDataURL(blob);
  });

// In the app a download link does nothing: the file goes to the cache, then to the share sheet ("Enregistrer dans Fichiers").
export async function saveFile(blob: Blob, name: string) {
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const { uri } = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache });
    await Share.share({ title: name, files: [uri] });
    // The decrypted copy must not stay in the app cache once shared.
    await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function copyText(text: string) {
  if (isNative()) {
    const { Clipboard } = await import("@capacitor/clipboard");
    return Clipboard.write({ string: text });
  }
  return navigator.clipboard.writeText(text);
}
