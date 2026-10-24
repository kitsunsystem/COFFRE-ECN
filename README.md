# Sillage — application (nom de travail)

Maquette conforme au *Brief développeurs — coffre familial* et au *Suivi du projet* (formule simple) : un **Espace** (compte, famille, garants, cartes, échéances, aide, services, assistante) et un **Coffre** chiffré qui s'ouvre avec une **carte NFC, plus le code ou Face ID**.

**Démo en ligne : https://kitsunsystem.github.io/COFFRE-ECN/**

## Lancer

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 17 tests : règles d'accès, veille INSEE, chiffrement, e-mails
npm run build      # export statique dans out/ (web + Capacitor)
npm run deploy     # met à jour la démo en ligne (branche gh-pages)
```

**Démonstration sans aucune clé** : page *Connexion* → « Découvrir la démonstration ». Famille Durand préremplie, code de toutes les cartes : `123456`. Une visite guidée s'ouvre à l'entrée ; le *Mode démonstration* (Compte → Mode démonstration) avance le temps, simule la veille INSEE, bascule entre phase découverte et lancement officiel, simule un impayé, et ouvre l'Espace bénéficiaire et l'administration.

Parcours à montrer :
1. Coffre avec une carte de Claire → « Urgence et santé » → « Copier dans la fiche médicale de mon téléphone » → « Qui voit quoi » (Marc, Léa, Paul).
2. Coffre avec une carte de Marc : il ne voit que l'urgence.
3. Compte → Coup dur et décès → signaler un coup dur comme garant → Démo : « Aller à la fin du délai » → Marc voit Banques et Téléphone, pas l'assurance-vie.
4. Démo : correspondance INSEE → Espace bénéficiaire : Léa dépose l'acte de décès → Administration : vérifier son identité, puis « Décès confirmé ».
5. Démo : fin du délai → Léa ouvre le Coffre et exporte en PDF → Démo : « Aller à la fin de l'accès » → le Coffre est effacé.

## Décisions intégrées (suivi du projet)
- **Trois niveaux d'accès**, un seul code couleur partout : Urgence (vert, tout de suite, à tout moment), Coup dur (rouge, garant + délai), Décès (doré). « Jamais » par défaut.
- **Cartes** : 3 pour le titulaire ; **un pack de 2 cartes obligatoire par bénéficiaire** ; la carte est toujours nécessaire, le code ou Face ID en plus. Marque ECN retirée.
- **Décès** : veille INSEE ou garant, **acte de décès déposé par un bénéficiaire**, vérification par l'équipe (identité et KYC du bénéficiaire), pas de notaire par défaut ; délai d'annulation ; **accès limité dans le temps puis effacement définitif**.
- **Fiche d'urgence** copiée dans la fiche médicale du téléphone ; **export PDF** de ce que la personne a le droit de voir.
- **Vidéos** retirées du lancement : « Où se trouvent mes vidéos » dans Volontés et messages.
- **Crypto-actifs** (rubrique du Coffre) : phrases de récupération de 12 ou 24 mots (saisie masquée, grille numérotée pour le bénéficiaire, jamais exportées), portefeuilles, plateformes, transactions détaillées.
- **Échéances** saisies dans l'Espace avec consentement ; relances « tout est-il à jour ? » tous les 3 mois ; contrôle des cartes des bénéficiaires tous les 6 mois.
- **Lancement en deux temps** : phase découverte payante (tout sauf l'ajout de documents, bloqué aussi en base), puis lancement officiel.
- **Impayé** : relances pendant le délai de grâce, puis effacement.
- Aide après décès personnalisée (premiers jours, semaines, mois) ; conciergerie proposée à la mise en place et au décès ; Alma déplacée dans la barre du haut.
- Pour plus tard : formule famille, mode aidant (enfant avec procuration), notaire partenaire, vidéos dans le Coffre, avatar vidéo.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/app/` | Pages : accueil, inscription, connexion, `espace/*` (accueil, cartes, famille, échéances, aide, services, compte, procédures, démo), `coffre/*` (verrou, rubriques, l'essentiel, qui voit quoi), `beneficiaire`, `admin` |
| `src/lib/config.ts` | **Tous les points « à décider »** : nom, délais, durée d'accès après décès, délai de grâce, phase de lancement, prix, pack bénéficiaire |
| `src/lib/sections.ts` | Rubriques et sous-rubriques du Coffre |
| `src/lib/rules.ts` | Niveaux d'accès, couleurs, procédures (même logique qu'en SQL) |
| `src/lib/crypto.ts`, `cards.ts`, `vault.ts` | Chiffrement de bout en bout (libsodium) ; droits par bénéficiaire, scellés pour chacune de ses cartes |
| `src/lib/aide.ts` | Listes personnalisées, étapes et courriers vierges |
| `src/lib/store.ts` | État de l'app ; en démo dans le navigateur, à remplacer action par action par Supabase |
| `supabase/migrations/` | Schéma, RLS (l'éditeur ne lit jamais le Coffre ; aucun document avant le lancement), buckets, cron |
| `supabase/functions/` | `send-email` (Brevo), `insee-watch`, `procedures-tick` (délais, fin d'accès), `relances` (échéances, à jour, cartes, impayés), `assistant` |

## Ce qui reste à brancher

| Élément | Où | À fournir |
|---|---|---|
| Supabase (UE, offre HDS) | `.env.local`, `supabase link`, `supabase db push`, `supabase functions deploy` | URL, clé anon, clé service ; remplacer les actions de `store.ts`/`vault.ts` (raccourcis marqués `shortcut:`) |
| Brevo | `supabase secrets set BREVO_API_KEY=… MAIL_FROM=… MAIL_FROM_NAME=… APP_URL=…` | Clé API, domaine expéditeur ; SMS : expéditeur validé |
| Webhooks + cron | Database Webhooks (`send-email` sur `profiles`, `guarantors`, `cards`) ; `migrations/0002_cron.sql` | Référence du projet |
| Assistante | `supabase secrets set ANTHROPIC_API_KEY=…` puis `NEXT_PUBLIC_ASSISTANT_URL` | Clé API ; avatar vidéo plus tard |
| Cartes NFC | `src/lib/cards.ts` : remplacer `demoChip` par le SDK Tangem (Capacitor) | Valider avec Tangem la dérivation d'une clé de chiffrement |
| App iPhone / Android | Capacitor (`npx cap add ios android`) | Comptes Apple / Google ; Face ID via un plugin biométrie |
| KYC | Étape d'identité de l'inscription (simulée) | Accès au système KYC du groupe |

## Points encore « à décider »
Nom (Sillage, Védora ou Laréo) · délai du coup dur et délai d'annulation du décès · durée d'accès après décès (4, 6 ou 12 mois) · délai de grâce en cas d'impayé · prix de la formule simple et de la phase découverte · date de lancement officiel · pack bénéficiaire (inclus ou payant, nombre inclus) · prestataire d'Alma · registres de décès en Espagne et en Andorre · conditions de prévente à faire valider par l'avocat.
