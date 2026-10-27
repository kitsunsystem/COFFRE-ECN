# Cartes Tangem dans l'application iOS / Android

Module Capacitor local (`capacitor-tangem`, installé depuis ce dossier), appelé « Tangem » par `src/lib/cards.ts` :

```ts
scan(): Promise<{ cardId: string; publicKey: string }>   // clé publique Ed25519 (hex), créée au premier usage
sign(o: { cardId: string; publicKey: string; hash: string }): Promise<{ signature: string }>   // base64
```

- iOS : `ios/Sources/TangemPlugin/TangemPlugin.swift`, SDK Tangem 3.15.0 (Swift Package Manager, iOS 15).
  Droits NFC déclarés dans `ios/App/App/App.entitlements`, identifiants des cartes dans `Info.plist`.
- Android : `android/src/main/java/app/sillage/tangem/TangemPlugin.kt`, SDK Tangem 3.9.3 (JitPack, commit `5d8617f2d1` :
  Tangem ne publie plus de versions numérotées en accès libre).

Pourquoi Ed25519 : ses signatures sont déterministes (RFC 8032). Signer toujours le même message donne toujours
les mêmes octets, donc une clé reproductible, combinée au code à 6 chiffres (Argon2id).

**État : écrit d'après la documentation et les intégrations publiques du SDK, compilé par la CI, jamais essayé sur
une vraie carte.** Avant toute commande en volume :
1. Installer l'application de test (TestFlight / tests internes Google Play).
2. Page de connexion › « Tester une carte » : trois contacts. Les deux lignes doivent être vertes
   (signature valide, identique à chaque fois). Sinon, la carte ne peut pas ouvrir de Coffre.
3. Faire confirmer par écrit par Tangem : signature Ed25519 pure (sans aléa) et clé impossible à extraire.