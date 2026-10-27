// Creates the Android upload key once, on your computer (Google Play keeps the real signing key: "Play App Signing").
// Usage: node scripts/android-upload-key.mjs
// Writes to <your home>/coffre-cles/ the key, its password and the key encoded for GitHub. Nothing is printed:
// paste the two .txt files into GitHub › Settings › Secrets › Actions (names below), then keep the folder somewhere safe.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function keytool() {
  const exe = process.platform === "win32" ? "keytool.exe" : "keytool";
  const homes = [process.env.JAVA_HOME, ...["C:/Program Files/Java", "C:/Program Files/Eclipse Adoptium", "C:/Program Files/Android/Android Studio"].flatMap((d) => (existsSync(d) ? readdirSync(d).map((x) => path.join(d, x)).concat(d) : []))];
  for (const h of homes.filter(Boolean)) for (const sub of ["bin", "jbr/bin", "jre/bin"]) if (existsSync(path.join(h, sub, exe))) return path.join(h, sub, exe);
  return exe; // on the PATH
}

const dir = path.join(homedir(), "coffre-cles");
const store = path.join(dir, "upload.p12");
if (existsSync(store)) throw new Error(`Une clé existe déjà : ${store}. Ne la recréez pas, Google Play attend celle-ci.`);
mkdirSync(dir, { recursive: true });
const password = randomBytes(24).toString("base64url");
execFileSync(keytool(), ["-genkeypair", "-storetype", "PKCS12", "-keystore", store, "-alias", "upload", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-storepass", password, "-keypass", password, "-dname", "CN=Upload"], { stdio: "ignore" });
writeFileSync(path.join(dir, "ANDROID_KEYSTORE_BASE64.txt"), readFileSync(store).toString("base64"));
writeFileSync(path.join(dir, "ANDROID_KEYSTORE_PASSWORD.txt"), password);
console.log(`Clé créée dans ${dir}.\nCollez le contenu de ANDROID_KEYSTORE_BASE64.txt et ANDROID_KEYSTORE_PASSWORD.txt dans les secrets GitHub du même nom,\npuis rangez ce dossier en lieu sûr (sauvegarde chiffrée) : il sert à chaque mise à jour.`);
