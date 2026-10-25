# Cartes Tangem dans l'application iOS / Android

Le site web lit les cartes **FIDO2** (WebAuthn, extension PRF) : c'est le choix par défaut de la version web.
Les cartes **Tangem** ne se lisent que depuis l'application native (sur iPhone, un site ne peut pas lire une carte NFC).
Côté JavaScript, tout est prêt (`src/lib/cards.ts`, pilote `tangem`) : il reste à ajouter le plugin natif
`Tangem` décrit ici, une fois l'accord technique obtenu avec Tangem (point ouvert du document de suivi).

## Contrat attendu par l'application

```ts
interface TangemPlugin {
  // Lit la carte posée ; renvoie son identifiant et la clé publique (hex) du portefeuille Ed25519 de la carte.
  // À la première lecture, crée ce portefeuille Ed25519 s'il n'existe pas.
  scan(): Promise<{ cardId: string; publicKey: string }>;
  // Signe un condensat SHA-256 (base64) avec ce portefeuille ; renvoie la signature (base64).
  sign(o: { cardId: string; publicKey: string; hash: string }): Promise<{ signature: string }>;
}
```

Pourquoi Ed25519 : ses signatures sont déterministes (RFC 8032). Signer toujours le même message donne toujours
les mêmes octets, donc une clé de chiffrement reproductible, combinée au code à 6 chiffres (Argon2id).
**À faire valider par Tangem** : que la carte signe bien en Ed25519 pur (sans aléa ajouté) et que la clé ne peut
pas être exportée.

## Android (Kotlin)

1. `android/app/build.gradle` : ajouter le SDK Tangem (`com.tangem:tangem-sdk-android` ou la version indiquée par Tangem).
2. Créer `android/app/src/main/java/app/sillage/famille/TangemPlugin.kt` :

```kotlin
@CapacitorPlugin(name = "Tangem")
class TangemPlugin : Plugin() {
  private val sdk by lazy { TangemSdk.init(activity as ComponentActivity) }

  @PluginMethod fun scan(call: PluginCall) {
    sdk.scanCard { result ->
      when (result) {
        is CompletionResult.Success -> {
          val card = result.data
          val wallet = card.wallets.firstOrNull { it.curve == EllipticCurve.Ed25519 }
          if (wallet != null) call.resolve(JSObject().put("cardId", card.cardId).put("publicKey", wallet.publicKey.toHexString()))
          else sdk.createWallet(EllipticCurve.Ed25519, card.cardId) { r ->
            if (r is CompletionResult.Success) call.resolve(JSObject().put("cardId", card.cardId).put("publicKey", r.data.wallet.publicKey.toHexString()))
            else call.reject("wallet")
          }
        }
        is CompletionResult.Failure -> call.reject(result.error.customMessage)
      }
    }
  }

  @PluginMethod fun sign(call: PluginCall) {
    val hash = Base64.decode(call.getString("hash"), Base64.NO_WRAP)
    sdk.sign(hash, call.getString("publicKey")!!.hexToBytes(), call.getString("cardId")) { r ->
      if (r is CompletionResult.Success) call.resolve(JSObject().put("signature", Base64.encodeToString(r.data.signature, Base64.NO_WRAP)))
      else call.reject("sign")
    }
  }
}
```

3. L'enregistrer dans `MainActivity.java` : `registerPlugin(TangemPlugin.class);` avant `super.onCreate(...)`.
   La permission NFC est déjà déclarée dans `AndroidManifest.xml`.

## iOS (Swift)

1. Xcode › App › Package Dependencies : ajouter `https://github.com/tangem/tangem-sdk-ios`.
2. Capability **Near Field Communication Tag Reading** (ajoute l'entitlement `com.apple.developer.nfc.readersession.formats` = `TAG`).
   Le texte `NFCReaderUsageDescription` est déjà dans `Info.plist`. Ajouter dans `Info.plist` la liste
   `com.apple.developer.nfc.readersession.iso7816.select-identifiers` fournie par Tangem.
3. Créer `ios/App/App/TangemPlugin.swift` :

```swift
import Capacitor
import TangemSdk

@objc(TangemPlugin)
public class TangemPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "TangemPlugin"
  public let jsName = "Tangem"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "sign", returnType: CAPPluginReturnPromise),
  ]
  private lazy var sdk = TangemSdk()

  @objc func scan(_ call: CAPPluginCall) {
    sdk.scanCard(initialMessage: Message(header: "Posez votre carte")) { result in
      switch result {
      case .success(let card):
        if let w = card.wallets.first(where: { $0.curve == .ed25519 }) {
          call.resolve(["cardId": card.cardId, "publicKey": w.publicKey.hexString])
        } else {
          self.sdk.startSession(with: CreateWalletTask(curve: .ed25519), cardId: card.cardId) { r in
            if case .success(let resp) = r { call.resolve(["cardId": card.cardId, "publicKey": resp.wallet.publicKey.hexString]) }
            else { call.reject("wallet") }
          }
        }
      case .failure(let e): call.reject(e.localizedDescription)
      }
    }
  }

  @objc func sign(_ call: CAPPluginCall) {
    guard let hash = Data(base64Encoded: call.getString("hash") ?? ""), let pk = Data(hexString: call.getString("publicKey") ?? "") else { return call.reject("args") }
    sdk.sign(hash: hash, walletPublicKey: pk, cardId: call.getString("cardId")) { r in
      if case .success(let resp) = r { call.resolve(["signature": resp.signature.base64EncodedString()]) } else { call.reject("sign") }
    }
  }
}
```

4. Enregistrer le plugin (Capacitor 8) : dans `AppDelegate.swift` ou via un `MainViewController` qui appelle
   `bridge?.registerPluginInstance(TangemPlugin())`.

Les noms exacts des méthodes du SDK Tangem peuvent changer selon sa version : se référer à leur documentation.
Le reste de l'application (activation, ouverture, code, enveloppes) n'a pas à changer.
