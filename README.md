# Sillage — application (nom de travail)

Application complète conforme au *Brief développeurs — coffre familial* et au *Suivi du projet* (formule simple) : un **Espace** (compte, famille, garants, cartes, échéances, aide, services, assistante) et un **Coffre** chiffré qui s'ouvre avec une **carte, plus le code**. Le même code donne le site web, l'application iPhone et l'application Android.

**Démo en ligne : https://kitsunsystem.github.io/COFFRE-ECN/** · en noir et or : https://kitsunsystem.github.io/COFFRE-ECN/?theme=noir · en anglais : https://kitsunsystem.github.io/COFFRE-ECN/?lang=en

Deux thèmes de couleurs, au choix dans Compte › Couleurs de l'application (ou en bas de la page d'accueil) : **Sillage** (crème, encre et or) et **Noir et or** (noir profond, bleu nuit, or métallique, titres en Cinzel). Toutes les couleurs sont des variables de `src/app/globals.css` ; `?theme=noir` ou `?theme=sillage` dans un lien choisit le thème (mémorisé sur l'appareil).

Quatre langues : **français, anglais, espagnol, catalan** (Espagne, Andorre), au choix en haut de l'accueil et de la connexion, ou dans Compte › Langue ; `?lang=en`, `?lang=es` ou `?lang=ca` dans un lien. Les écrans sont écrits en français ; les traductions sont dans `src/i18n/*.tsv` (une ligne par texte : français, anglais, espagnol, catalan ; `{0}` = une valeur insérée). `npm run i18n` reconstruit les fichiers utilisés par l'application et liste les textes ajoutés au code sans traduction (la CI échoue s'il en manque). Les dates, le PDF, les courriers téléchargés et la voix de l'assistante suivent la langue choisie. Ajouter une langue : une colonne de plus dans les `.tsv` et une ligne dans `src/lib/i18n.ts`.

Les rubriques du Coffre sont dessinées comme de petits coffres-forts (porte, charnières, pênes, volant, nom gravé) dont la porte pivote quand on les ouvre : `src/components/safe-door.tsx`.

## Deux modes, un seul code

| | Démonstration | Production |
|---|---|---|
| Quand | aucune variable `NEXT_PUBLIC_SUPABASE_*` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` renseignées |
| Données | sur l'appareil (famille Durand fictive) | Supabase : comptes, base avec règles d'accès, fichiers chiffrés |
| Connexion | bouton « Découvrir la démonstration » | code à 6 chiffres reçu par e-mail |
| Cartes | simulées (code `123456`) | FIDO2 sur le site, Tangem dans l'application (`native/tangem/README.md`) |
| E-mails | boîte d'envoi visible dans Compte | file d'attente en base, envoyés par Brevo |
| Délais, effacements | calculés dans le navigateur (horloge accélérable) | tâches planifiées sur le serveur |

Mise en production pas à pas : **[deploy/README.md](deploy/README.md)**.

## Lancer

```bash
npm install
npm run dev          # http://localhost:3000 (démo, ou production si .env.local est rempli)
npm test             # tests unitaires + règles d'accès de la base (PGlite, sans Docker)
npm run build        # export statique dans out/ (site + applications)
npm run build:prod   # idem + en-têtes de sécurité (CSP, HSTS…) pour Cloudflare Pages
npm run test:e2e     # parcours complet sur un vrai Supabase (supabase start), lancé aussi par la CI
npm run i18n         # reconstruit les traductions depuis src/i18n/*.tsv et liste les textes manquants
npm run deploy       # met à jour la démo en ligne (toujours en mode démonstration)
npx cap sync         # copie le site dans les projets iOS (ios/) et Android (android/)
```

**Démonstration** : page *Connexion* → « Découvrir la démonstration ». Code de toutes les cartes : `123456`. Le *Mode démonstration* (Compte) avance le temps, simule la veille INSEE, bascule entre phase découverte et lancement officiel, simule un impayé, et ouvre l'Espace bénéficiaire et l'administration.

Parcours à montrer :
1. Coffre avec une carte de Claire → « Urgence et santé » → « Copier dans la fiche médicale de mon téléphone » → « Qui voit quoi ». Pour revenir à l'Espace, il faut **fermer le Coffre**.
2. Coffre avec une carte de Marc : il ne voit que l'urgence ; chaque information se copie, et le PDF ne contient que sa part.
3. Compte → Coup dur et décès → signaler un coup dur comme garant → Démo : « Aller à la fin du délai » → Marc voit Banques et Téléphone, pas l'assurance-vie.
4. Démo : correspondance INSEE → Espace bénéficiaire : Léa dépose l'acte de décès → Administration : vérifier son identité, puis « Décès confirmé ».
5. Démo : fin du délai → Léa ouvre le Coffre et télécharge son PDF → Démo : « Aller à la fin de l'accès » → le Coffre est effacé.

## Décisions intégrées (suivi du projet)
- **Trois niveaux d'accès**, un seul code couleur partout : Urgence (vert), Coup dur (rouge, garant + délai), Décès (doré). « Jamais » par défaut.
- **Cartes** : 3 pour le titulaire ; **un pack de 2 cartes obligatoire par bénéficiaire** ; la carte est toujours nécessaire, le code en plus. Marque ECN retirée.
- **Coffre séparé de l'Espace** : on ne revient à l'Espace qu'en fermant le Coffre (et ouvrir l'Espace le ferme).
- **Décès** : veille INSEE ou garant, **acte de décès déposé par un bénéficiaire**, vérification par l'équipe (identité du bénéficiaire), pas de notaire par défaut ; délai d'annulation ; **accès limité dans le temps puis effacement définitif**.
- **Fiche d'urgence** copiée dans la fiche médicale du téléphone ; **PDF téléchargeable** contenant uniquement ce que la personne a le droit de voir (sans codes ni mots de passe).
- **Vidéos** retirées du lancement : « Où se trouvent mes vidéos » dans Volontés et messages.
- **Échéances** saisies dans l'Espace avec consentement ; relances « tout est-il à jour ? » tous les 3 mois ; contrôle des cartes des bénéficiaires tous les 6 mois.
- **Lancement en deux temps** : phase découverte (tout sauf l'ajout de documents, bloqué aussi par la base), puis lancement officiel (Administration › Réglages).
- **Impayé** : relances pendant le délai de grâce, puis effacement.
- Pour plus tard : formule famille, mode aidant (procuration), notaire partenaire, vidéos dans le Coffre, avatar vidéo.

## Sécurité
- Chiffrement de bout en bout sur l'appareil (libsodium : XChaCha20-Poly1305, Argon2id, boîtes scellées X25519). Une clé par sous-rubrique, une clé par fichier ; le serveur ne reçoit que du chiffré.
- Base : tout est fermé par défaut, ouvert colonne par colonne ; RLS sur chaque table ; tout ce qui a une conséquence (cartes, procédures, mandat, KYC, lancement) passe par une fonction qui vérifie les droits et écrit le **journal d'audit**.
- L'équipe ne lit jamais le Coffre ; elle ne voit les actes de décès et pièces d'identité que par des liens valables 5 minutes.
- Site : CSP limitée à l'API, HSTS, anti-iframe ; rien n'est conservé sur l'appareil en production (téléphones partagés).
- Tests : 32 scénarios d'accès à la base (dont les tentatives d'un inconnu), le Coffre côté application, et le parcours complet sur un vrai Supabase en CI ; analyse OWASP ZAP à la demande ; Dependabot.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/app/` | Pages : accueil, inscription, connexion, `espace/*`, `coffre/*` (verrou, rubriques, l'essentiel, qui voit quoi), `beneficiaire`, `proche` (garants et bénéficiaires connectés), `admin` (équipe) |
| `src/lib/config.ts` | **Tous les points « à décider »** : nom, délais, durées, phase de lancement, prix, pack bénéficiaire |
| `src/lib/api.ts` | Toutes les actions de l'application : démo (appareil) ou production (Supabase) |
| `src/lib/crypto.ts`, `cards.ts`, `vault.ts` | Chiffrement, cartes (FIDO2, Tangem, démo), Coffre |
| `src/lib/rules.ts` | Niveaux d'accès et procédures (même logique qu'en SQL) |
| `supabase/migrations/` | Schéma, droits, RLS, fonctions métier, fichiers, tâches planifiées |
| `supabase/functions/` | `mailer` (Brevo), `procedures-tick`, `relances`, `insee-watch`, `assistant`, `billing` + `stripe-webhook` (Stripe), `account-delete` (RGPD), `kyc-webhook` |
| `supabase/tests/`, `tests/e2e/` | Tests des règles d'accès et parcours de bout en bout |
| `android/`, `ios/` | Applications natives (Capacitor) |
| `.github/workflows/` | CI, applications mobiles, déploiement, analyse de sécurité |
| `deploy/README.md` | Les actions à faire pour la mise en production |

## Points encore « à décider »
Nom (Sillage, Védora ou Laréo) · délai du coup dur et délai d'annulation du décès · durée d'accès après décès (4, 6 ou 12 mois) · délai de grâce · prix de la formule simple et de la phase découverte · date de lancement officiel · pack bénéficiaire (inclus ou payant) · cartes FIDO2 ou Tangem · prestataire d'Alma · système KYC du groupe · registres de décès en Espagne et en Andorre.
