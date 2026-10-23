# Sillage — application (nom de travail)

Application conforme au *Brief développeurs — coffre familial* : un **Espace** (compte, famille, garants, cartes, aide, services, assistante) et un **Coffre** chiffré qui s'ouvre avec une **carte NFC + code**.

**Démo en ligne : https://kitsunsystem.github.io/COFFRE-ECN/**

## Lancer

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 15 tests : règles d'ouverture, veille INSEE, chiffrement, e-mails
npm run build      # export statique dans out/ (web + Capacitor)
npm run deploy     # met à jour la démo en ligne (branche gh-pages)
```

**Démonstration sans aucune clé** : page *Connexion* → « Découvrir la démonstration ». Famille Durand préremplie, code de toutes les cartes : `123456`. Le *Mode démonstration* (Compte → Mode démonstration) avance le temps, simule la veille INSEE et ouvre l'administration (`/admin`).

Parcours à montrer : ouvrir le Coffre avec la carte de Claire → « Qui voit quoi » → Procédures : signaler un coup dur comme garant → Démo : « Aller à la fin du délai » → ouvrir le Coffre avec la carte de Marc (il voit Banques et Téléphone, pas l'assurance-vie) → Démo : correspondance INSEE → Admin : « Décès confirmé » → fin du délai → carte de Léa, et « À effacer » a disparu.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/app/` | Pages : accueil, inscription (8 étapes), connexion, `espace/*` (accueil, cartes, famille, aide + 4 rubriques, services, compte, procédures, démo), `coffre/*` (verrou, rubriques, l'essentiel, qui voit quoi), `admin` |
| `src/lib/config.ts` | **Tous les points « à décider »** : nom, délais (48 h / 15 j), prix, conciergerie |
| `src/lib/sections.ts` | Rubriques et sous-rubriques du Coffre (liste à valider avec le client) |
| `src/lib/rules.ts` | Qui voit quoi et quand (même logique que `is_released` en SQL) |
| `src/lib/crypto.ts`, `cards.ts`, `vault.ts` | Chiffrement de bout en bout (libsodium) |
| `src/lib/aide.ts` | Listes, étapes et courriers vierges des 4 rubriques d'aide |
| `src/lib/store.ts` | État de l'app ; en démo dans le navigateur, à remplacer action par action par Supabase |
| `supabase/migrations/` | Schéma, RLS (l'éditeur ne lit jamais le Coffre), bucket chiffré, cron |
| `supabase/functions/` | `send-email` (Brevo), `insee-watch`, `procedures-tick`, `relances`, `assistant` |

### Le chiffrement en bref
- Chaque sous-rubrique a sa clé. La clé du Coffre les protège toutes ; elle n'existe en clair qu'en mémoire, Coffre ouvert (fermeture auto après 5 min).
- Une carte du titulaire = clé du Coffre chiffrée par (secret de la puce + code). Les 3 cartes ouvrent le même Coffre ; pas de 24 mots, pas de kit papier.
- Une carte de proche = son identité : il ne reçoit que des clés de sous-rubriques scellées pour sa carte, libérées au moment choisi (tout de suite / coup dur / décès). Retirer un droit change la clé de la sous-rubrique.
- « À effacer » n'est attribuable à personne et est détruit au décès confirmé.
- Les e-mails ne contiennent jamais le contenu du Coffre ; les rappels d'échéance ne connaissent que la date.

## Ce qui reste à brancher (vos clés et comptes)

| Élément | Où | À fournir |
|---|---|---|
| Supabase (UE, offre HDS) | `.env.local`, `supabase link`, `supabase db push`, `supabase functions deploy` | URL, clé anon, clé service ; remplacer les actions de `store.ts`/`vault.ts` par des appels Supabase (raccourcis marqués `shortcut:`) |
| Brevo | `supabase secrets set BREVO_API_KEY=… MAIL_FROM=… MAIL_FROM_NAME=… APP_URL=…` | Clé API, domaine expéditeur vérifié ; SMS : expéditeur validé |
| Webhooks + cron | Supabase → Database Webhooks (`send-email` sur `profiles`, `guarantors`, `cards`) ; `migrations/0002_cron.sql` | Référence du projet |
| Assistante | `supabase secrets set ANTHROPIC_API_KEY=…` puis `NEXT_PUBLIC_ASSISTANT_URL` | Clé API ; avatar vidéo (fournisseur à choisir) |
| Cartes NFC | `src/lib/cards.ts` : remplacer `demoChip` par le SDK Tangem (plugin Capacitor) | Confirmer avec Tangem la dérivation d'une clé par signature déterministe |
| App iPhone / Android | `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`, `npx cap add ios android`, `npm run build && npx cap sync` | Comptes Apple / Google ; Face ID via un plugin biométrie |
| KYC | Étape 7 de l'inscription (simulée) | Accès au système KYC du réseau ECN |

## Points encore « à décider » (brief)
Nom définitif · délais d'annulation · liste finale des sous-rubriques · prix (formule famille, carte supplémentaire, conciergerie) · partenaire conciergerie · fournisseur d'avatar · hébergeur HDS · rôle facultatif du notaire.
