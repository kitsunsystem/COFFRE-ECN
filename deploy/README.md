# Mise en production — les actions à faire, dans l'ordre

L'application est prête : il ne reste que les comptes à créer et les clés à renseigner. Rien de tout cela
n'est à mettre dans le code : les clés vont dans les réglages des services ou dans les secrets GitHub.

Ordre conseillé : 1 → 2 → 3 → 4 → 5 → 6 → 7, puis les applications mobiles (8).
Pour la **phase de test** (Supabase de test, Brevo, applis en test, sans domaine ni paiement), suivre d'abord la section 0.

---

## 0. Phase de test : ce qu'il faut faire maintenant

1. **Supabase (projet de test)** — GitHub › Settings › Secrets and variables › Actions :
   - variables `SUPABASE_URL` et `SUPABASE_ANON_KEY` (Supabase › Project Settings › API), `SUPABASE_PROJECT_REF`
     (la référence du projet, dans son adresse) ;
   - secrets `SUPABASE_ACCESS_TOKEN` (Supabase › Account › Access Tokens) et `SUPABASE_DB_PASSWORD` ;
   - puis Actions › **Deploy** › Run workflow : la base (migrations) et les fonctions sont installées ;
   - dans Supabase, éditeur SQL : les deux secrets des tâches planifiées (section 2) ;
   - Authentication : modèles d'e-mails et réglages (section 2), SMTP de Brevo (étape suivante).
2. **Brevo** — sans domaine pour l'instant : Senders › ajouter et vérifier votre adresse d'expéditeur.
   - SMTP & API › SMTP : identifiant et clé SMTP → Supabase › Authentication › Emails › SMTP Settings
     (hôte `smtp-relay.brevo.com`, port 587). Sans cela, Supabase n'envoie les codes qu'aux membres de l'équipe.
   - SMTP & API › API Keys : une clé → Supabase › Edge Functions › Secrets : `BREVO_API_KEY`, plus `MAIL_FROM`
     (l'adresse vérifiée), `MAIL_FROM_NAME`, `APP_URL` et `APP_ORIGINS` (l'adresse du site quand il existera).
3. **Apple** (compte Organisation : demander le numéro D-U-N-S, gratuit, plusieurs jours) puis :
   - Certificates, Identifiers & Profiles › Identifiers › + App ID `app.sillage.famille`, cocher **NFC Tag Reading**
     et **Push Notifications** ;
   - App Store Connect › Apps › + Nouvelle app avec cet identifiant ;
   - Users and Access › Integrations › App Store Connect API › clé d'équipe (rôle **Admin**) : secrets
     `APP_STORE_CONNECT_KEY` (contenu du fichier .p8), `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
     variable `APPLE_TEAM_ID`.
4. **Google Play** (compte Organisation, D-U-N-S aussi) :
   - sur votre PC : `node scripts/android-upload-key.mjs` → secrets `ANDROID_KEYSTORE_BASE64` et
     `ANDROID_KEYSTORE_PASSWORD` (contenu des deux fichiers créés), puis ranger le dossier `coffre-cles` en lieu sûr ;
   - Play Console › Créer l'application, identifiant `app.sillage.famille` ;
   - lancer Actions › **Release** une première fois, télécharger le fichier `.aab` produit et le déposer à la main
     dans Tests internes (Google l'exige pour la toute première version) ;
   - Google Cloud › compte de service (clé JSON) invité dans Play Console › Utilisateurs et autorisations avec le
     droit de publier → secret `PLAY_SERVICE_ACCOUNT_JSON`. Ensuite chaque Release part toute seule.
5. **Une mise à jour partout** : Actions › **Release** › Run workflow, avec le numéro de version. La base, les
   fonctions, le site (quand Cloudflare sera là), Google Play (tests internes) et TestFlight sont mis à jour
   ensemble. Les mises à jour « à chaud » sans passer par les stores ne sont volontairement pas utilisées : le code
   qui chiffre le Coffre ne doit pouvoir changer qu'après la validation d'Apple et de Google.
6. **Dépôt privé** : sur GitHub, renommer `COFFRE-ECN` en `coffre-app` et le passer en privé, puis créer un dépôt
   **public vide** nommé `COFFRE-ECN` : `npm run deploy` y publie la démo compilée (Settings › Pages › branche
   `gh-pages`), à la même adresse qu'aujourd'hui. Sur un dépôt privé, les minutes macOS comptent 10 fois : la
   vérification iOS se lance donc à la demande (Actions › Mobile).

---

## 1. Domaine (Cloudflare)

1. Acheter le domaine (après vérification du nom à l'INPI / EUIPO).
2. Le gérer dans Cloudflare (DNS). Prévoir :
   - `app.<domaine>` : le site (Cloudflare Pages, étape 6) ;
   - `api.<domaine>` : Supabase (si auto-hébergé, étape 2) ;
   - les enregistrements Brevo (étape 4).

## 2. Base de données et serveur (Supabase)

Deux possibilités :

**A. Hébergement certifié HDS (obligatoire au lancement officiel, à cause des données de santé)**
Supabase auto-hébergé sur une infrastructure HDS (par exemple OVHcloud, offre « Hosted Private Cloud » certifiée HDS) :
1. Suivre le guide officiel d'auto-hébergement de Supabase (Docker Compose) sur la machine HDS.
2. Exposer l'API derrière `api.<domaine>` en HTTPS.
3. Appliquer le schéma : chaque fichier de `supabase/migrations/` dans l'ordre (`psql "$DATABASE_URL" -f …`).
4. Déployer les fonctions (`supabase/functions/*`) dans le service Edge Runtime de l'installation.

**B. Supabase Cloud, région UE (possible pendant la phase découverte)**
Pendant la phase découverte, aucun document n'est déposé dans les Coffres : un projet Supabase Cloud en région
Europe peut suffire, avant de passer sur l'hébergement HDS pour le lancement officiel.
1. Créer le projet (région Frankfurt ou Paris si disponible).
2. Dans GitHub, renseigner les variables et secrets (étape 7) puis lancer le workflow **Deploy** : il applique
   les migrations et déploie les fonctions.

Dans les deux cas, ensuite :

- **Secrets des tâches planifiées** (dans l'éditeur SQL) :
  ```sql
  select vault.create_secret('https://api.<domaine>', 'project_url');
  select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
  ```
- **Secrets des fonctions** : `supabase secrets set NOM=valeur` (liste dans `.env.example`).
- **Authentification** (Authentication › Settings) :
  - Site URL : `https://app.<domaine>` ; Redirect URLs : `https://app.<domaine>`, `capacitor://localhost`, `https://localhost` ;
  - fournisseur e-mail activé, inscriptions activées, confirmation obligatoire ; mot de passe : 10 caractères au
    moins, minuscules, majuscules et chiffres (déjà dans `supabase/config.toml`) ;
  - SMTP personnalisé : celui de Brevo (étape 4) ;
  - modèles d'e-mail (ils affichent le code à 6 chiffres) : `supabase/templates/code.html` pour « Confirm signup »,
    `recovery.html` pour « Reset Password », et `email-change.html` pour « Change Email Address ».
- **Comptes de l'équipe** : chaque membre crée son compte normalement, puis :
  ```sql
  insert into public.staff (user_id, role) select id, 'admin' from auth.users where email = 'prenom@<domaine>';
  ```
  Rôles : `admin` (tout), `verification` (décès, identités), `logistique` (cartes), `conciergerie`.
- **Lancement officiel** : dans l'application, Administration › Réglages › « Lancement officiel ».

## 3. Conciergerie

Générer la paire de clés du partenaire (une fois, sur son poste) et donner la clé **publique** à l'application :
```sql
update public.app_settings set concierge_public_key = '<clé publique base64>';
```
La clé privée reste chez le partenaire : il la colle dans Administration › Conciergerie le temps de lire les éléments confiés.
Pour générer la paire, sur le poste du partenaire : `node scripts/concierge-keys.mjs`.

## 4. E-mails (Brevo)

1. Créer le compte, authentifier le domaine (SPF, DKIM, DMARC dans Cloudflare).
2. Créer une clé API → secret `BREVO_API_KEY` ; `MAIL_FROM` (ex. `bonjour@<domaine>`), `MAIL_FROM_NAME`.
3. SMTP Brevo → réglages SMTP de Supabase Auth (codes de connexion).
Sans clé Brevo, la fonction `mailer` marque les e-mails comme envoyés sans les envoyer (utile en test).

## 5. Paiement (Stripe)

1. Créer le produit « Formule simple » et son prix annuel → secret `STRIPE_PRICE_ID`.
2. Clé secrète → `STRIPE_SECRET_KEY`.
3. Webhook vers `https://api.<domaine>/functions/v1/stripe-webhook`, événements : `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed` → secret `STRIPE_WEBHOOK_SECRET`.
4. Activer le portail client Stripe (factures, moyen de paiement).
5. Renseigner le prix dans `src/lib/config.ts` (`OFFER.price`) : le bouton « Souscrire » apparaît.

## 6. Site web (Cloudflare Pages)

1. Créer un projet Pages (déploiement direct, sans connexion Git) → variable GitHub `CF_PAGES_PROJECT`.
2. Créer un jeton API Cloudflare (droit « Pages: Edit ») → secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. Domaine personnalisé `app.<domaine>` sur le projet.
4. Le workflow **Deploy** construit le site avec les en-têtes de sécurité (`scripts/headers.mjs` : CSP limitée à
   votre API, HSTS, anti-iframe…) et le publie.

## 7. GitHub (variables et secrets)

Settings › Secrets and variables › Actions :

| Type | Nom | Valeur |
|---|---|---|
| Variable | `SUPABASE_URL` | `https://api.<domaine>` (ou l'adresse du projet Supabase) |
| Variable | `SUPABASE_ANON_KEY` | clé publique « anon » |
| Variable | `SUPABASE_PROJECT_REF` | référence du projet (Supabase Cloud seulement) |
| Variable | `CF_PAGES_PROJECT` | nom du projet Pages |
| Variable | `FIDO_RP_ID` | `app.<domaine>` (les cartes FIDO2 sont liées à ce domaine : ne plus le changer ensuite) |
| Secret | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Supabase Cloud seulement |
| Secret | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | étape 6 (sans eux, le site n'est simplement pas déployé) |
| Variable | `APP_URL` | adresse publique du site (liens des e-mails et de l'application) |
| Variable | `PUSH` | `1` une fois les notifications prêtes (étape 8) |
| Variable | `STORE_IOS`, `STORE_ANDROID` | liens des fiches App Store et Google Play, une fois publiées |
| Variable | `APPLE_TEAM_ID` | section 0 |
| Secret | `APP_STORE_CONNECT_KEY`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID` | section 0 |
| Secret | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD` | section 0 (`node scripts/android-upload-key.mjs`) |
| Secret | `PLAY_SERVICE_ACCOUNT_JSON` | section 0 |
| Secret | `GOOGLE_SERVICES_JSON` | fichier `google-services.json` de Firebase (notifications Android) |
| Variable | `PLAY_TRACK`, `PLAY_RELEASE_STATUS` | facultatif : `internal` / `draft` par défaut, `production` / `completed` au lancement |

Puis Actions › **Deploy** › Run workflow.

## 8. Applications iOS et Android

Le workflow **Mobile** construit à chaque mise à jour un APK Android et une version simulateur iOS (artefacts de
l'exécution), avec la production si les variables `SUPABASE_URL` / `SUPABASE_ANON_KEY` sont renseignées.

Pour les stores :
- **Apple** : compte Apple Developer (99 $/an), identifiant `app.sillage.famille` (à changer avec le nom final dans
  `capacitor.config.json`), certificats de distribution, puis Xcode › Archive. Capability NFC si cartes Tangem.
- **Google** : compte Google Play Console (25 $), clé de signature (keystore), `./gradlew bundleRelease`.
- Icônes et écrans de lancement : `npx @capacitor/assets generate` à partir d'un logo 1024×1024.
- Cartes : Tangem, lues par l'application (module `native/tangem`, à valider avec de vraies cartes : écran
  « Tester une carte » sur la page de connexion de l'application).
- Une fois publiées : variables `NEXT_PUBLIC_STORE_IOS` et `NEXT_PUBLIC_STORE_ANDROID` (liens des fiches) ; sur le
  navigateur d'un téléphone, le Coffre renvoie vers l'application.

**Ordinateurs de confiance (notifications).** Sur ordinateur, le Coffre s'ouvre avec l'accord du téléphone (code QR la
première fois, puis notification). Sans les clés ci-dessous tout fonctionne, la demande attend simplement dans
l'application ; avec elles, le téléphone sonne :
- **Android** : projet Firebase (gratuit), application `app.sillage.famille` ; le contenu de `google-services.json`
  va dans le secret GitHub `GOOGLE_SERVICES_JSON` ; compte de service Firebase (JSON) →
  `supabase secrets set FCM_SERVICE_ACCOUNT='<json sur une ligne>'`.
- **iOS** : Apple Developer › Keys › clé APNs (.p8) → secrets Supabase `APNS_KEY` (contenu du .p8), `APNS_KEY_ID`,
  `APNS_TEAM_ID`, `APNS_TOPIC` (identifiant de l'app). Le droit « notifications » est déjà déclaré dans l'application.
- Puis la variable GitHub `PUSH` = `1`.
- Face ID (ou l'empreinte, ou le code du téléphone) est exigé à chaque ouverture dans l'application ; rien à configurer.

## 9. Avant l'audit d'intrusion

- `npm test` : tests unitaires + règles d'accès de la base (46 scénarios, dont les tentatives d'un inconnu et les
  ordinateurs de confiance).
- CI : le parcours complet sur un vrai Supabase à chaque push.
- Actions › **Security scan** : OWASP ZAP (analyse passive) sur l'adresse de pré-production.
- Dependabot ouvre une demande à chaque dépendance à mettre à jour.
- Journal des actions sensibles : table `audit_log` (déclarations, vérifications, cartes, équipe).
- Sauvegardes chiffrées de la base et du stockage, chez l'hébergeur HDS, avec test de restauration.

## 10. Points juridiques à traiter (hors code)

- Déclaration du moyen de cryptologie auprès de l'ANSSI (fourniture d'un service de chiffrement en France).
- Contrat de sous-traitance RGPD avec chaque prestataire (hébergeur HDS, Brevo, Stripe, Cloudflare).
- Export de chiffrement pour l'App Store (questionnaire d'export à remplir dans App Store Connect).
- Éviter le terme « coffre-fort numérique » (encadré) dans les textes publics.
