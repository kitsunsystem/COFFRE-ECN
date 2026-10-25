// What differs between the website and the iOS/Android app (Capacitor): saving a file, copying text, reading a QR code.
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
// A phone or tablet's browser (not the app): the cards cannot be read there, the Coffre opens in the app.
export const isPhoneBrowser = () => !isNative() && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

// App: a computer's QR code, read with the camera. Returns the page where the phone answers, or null if it is not ours.
export async function scanComputer(instructions: string): Promise<string | null> {
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import("@capacitor/barcode-scanner");
  const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHint.QR_CODE, scanInstructions: instructions });
  try {
    const u = new URL(ScanResult);
    const [r, k] = [u.searchParams.get("r"), u.searchParams.get("k")];
    return u.pathname.endsWith("/appareil/") && r && k ? `/appareil/?r=${encodeURIComponent(r)}&k=${encodeURIComponent(k)}` : null;
  } catch {
    return null;
  }
}

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
