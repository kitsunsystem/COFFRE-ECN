// Coffre structure from the client brief (section 6) and the developer sheet v2 (October 2026): few sections, one level
// of sub-sections. Ids never change (they name the keys, the rights and the stored files): titles and fields can.
import type { Moment } from "./rules";

export type FieldKind = "text" | "long" | "date" | "secret" | "phone" | "choice";
export interface Field {
  key: string;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
  options?: string[]; // kind "choice"
}
export interface Subsection {
  id: string;
  title: string;
  hint: string;
  fields: Field[];
  advised?: Moment; // the access proposed in « Qui voit quoi »: the owner confirms or changes it
  notice?: string; // a warning shown above the entries
}
export interface Section {
  id: string;
  title: string;
  tagline: string;
  icon: string; // lucide icon name, resolved in components/icons.tsx
  tone: "coral" | "gold" | "sage" | "ink" | "mist";
  optional?: boolean;
  subsections: Subsection[];
}

const note: Field = { key: "note", label: "Précisions", kind: "long", placeholder: "Tout ce qui peut aider vos proches" };
const contact = (who: string): Field[] => [
  { key: "name", label: who },
  { key: "phone", label: "Téléphone", kind: "phone" },
  note,
];
// Direct debits: what keeps running during a coup dur, what stops at the death.
const tag: Field = { key: "tag", label: "En cas de coup dur ou de décès", kind: "choice", options: ["À maintenir en cas de coup dur", "À résilier au décès"] };

export const SECTIONS: Section[] = [
  {
    id: "urgence",
    title: "Urgence et santé",
    tagline: "Ce qu'il faut savoir tout de suite si quelque chose arrive",
    icon: "HeartPulse",
    tone: "coral",
    subsections: [
      { id: "groupe-allergies", title: "Groupe sanguin et allergies", hint: "Groupe sanguin, allergies, contre-indications", advised: "now", fields: [{ key: "blood", label: "Groupe sanguin", placeholder: "Ex. A+" }, { key: "allergies", label: "Allergies", kind: "long" }, note] },
      { id: "traitements", title: "Traitements", hint: "Médicaments, posologie, appareillage", advised: "now", fields: [{ key: "drug", label: "Traitement" }, { key: "dose", label: "Posologie" }, note] },
      { id: "medecins", title: "Médecins", hint: "Médecin traitant, spécialistes", advised: "now", fields: contact("Médecin") },
      {
        id: "volontes-medicales",
        title: "Volontés médicales",
        hint: "Directives anticipées, personne de confiance, souhaits en cas de coma ou de fin de vie",
        advised: "now",
        fields: [
          { key: "trusted", label: "Personne de confiance médicale" },
          { key: "phone", label: "Téléphone", kind: "phone" },
          { key: "directives", label: "Mes directives anticipées", placeholder: "Où est l'original ; ajoutez le document scanné plus bas" },
          { key: "wishes", label: "Mes souhaits en cas de coma ou de fin de vie", kind: "long" },
          note,
        ],
      },
      {
        id: "animaux",
        title: "Personnes et animaux à charge",
        hint: "Enfants, parents dépendants, animaux : qui s'en occupe, où, habitudes",
        advised: "now",
        fields: [
          { key: "animal", label: "Personne ou animal", placeholder: "Ex. Ma mère, Lou le chat" },
          { key: "keeper", label: "Qui s'en occupe" },
          { key: "where", label: "Où" },
          { key: "contacts", label: "Contacts", kind: "long", placeholder: "École, aide à domicile, vétérinaire…" },
          { key: "habits", label: "Habitudes et soins", kind: "long" },
          note,
        ],
      },
      {
        id: "a-prevenir",
        title: "Contacts clés",
        hint: "Proches, notaire, comptable, banquier, assureur, avocat, employeur",
        advised: "now",
        fields: [{ key: "name", label: "Nom" }, { key: "role", label: "Qui est-ce", placeholder: "Ex. Conjoint, comptable, employeur" }, { key: "phone", label: "Téléphone", kind: "phone" }, note],
      },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    tagline: "Identité, logement, véhicules, papiers juridiques, procurations, impôts",
    icon: "FileText",
    tone: "ink",
    subsections: [
      { id: "identite-famille", title: "Identité et famille", hint: "Pièce d'identité, passeport, livret de famille", advised: "coup_dur", fields: [{ key: "doc", label: "Document", placeholder: "Ex. Passeport" }, { key: "number", label: "Numéro" }, { key: "expiry", label: "Date d'expiration", kind: "date" }, note] },
      { id: "logement", title: "Logement et baux", hint: "Titre de propriété, bail, assurance habitation", advised: "coup_dur", fields: [{ key: "address", label: "Adresse" }, { key: "status", label: "Propriétaire ou locataire" }, { key: "contact", label: "Bailleur ou syndic" }, note] },
      { id: "vehicules", title: "Véhicules", hint: "Carte grise, assurance, clés", advised: "coup_dur", fields: [{ key: "vehicle", label: "Véhicule" }, { key: "plate", label: "Immatriculation" }, { key: "keys", label: "Où sont les clés" }, note] },
      { id: "juridique", title: "Papiers juridiques", hint: "Lieu de l'original du testament, donations", advised: "deces", fields: [{ key: "doc", label: "Document", placeholder: "Ex. Testament" }, { key: "where", label: "Où se trouve l'original" }, { key: "pro", label: "Qui le conserve" }, note] },
      {
        id: "procurations",
        title: "Procurations et mandats",
        hint: "Procurations bancaires, mandat de protection future, délégations",
        advised: "coup_dur",
        notice: "Le Coffre permet de retrouver le document ; c'est le document lui-même qui donne le droit d'agir. Pour le faire de votre vivant : « Mes démarches de protection », dans l'Espace.",
        fields: [{ key: "doc", label: "Document", placeholder: "Ex. Procuration bancaire" }, { key: "to", label: "Au profit de" }, { key: "date", label: "Date", kind: "date" }, { key: "where", label: "Où se trouve l'original" }, note],
      },
      {
        id: "administratif",
        title: "Administration et impôts",
        hint: "Numéro fiscal, impôts, retraite, sécurité sociale, mutuelle",
        advised: "coup_dur",
        fields: [{ key: "org", label: "Organisme", placeholder: "Ex. Impôts" }, { key: "number", label: "Numéro", placeholder: "Fiscal, sécurité sociale, adhérent…" }, { key: "access", label: "Comment y accéder", kind: "secret" }, note],
      },
    ],
  },
  {
    id: "argent",
    title: "Argent et contrats",
    tagline: "Banques, assurances, placements, crédits, abonnements, patrimoine",
    icon: "Landmark",
    tone: "gold",
    subsections: [
      { id: "banques", title: "Banques", hint: "Établissements, conseillers, comptes", advised: "coup_dur", fields: [{ key: "bank", label: "Banque" }, { key: "advisor", label: "Conseiller" }, { key: "phone", label: "Téléphone", kind: "phone" }, note] },
      {
        id: "assurances",
        title: "Assurances et assurance-vie",
        hint: "Assureur, contrat, garanties, bénéficiaires, comment déclarer",
        advised: "coup_dur",
        fields: [
          { key: "insurer", label: "Assureur" },
          { key: "contract", label: "Numéro de contrat" },
          { key: "guarantee", label: "Garanties", placeholder: "Décès, incapacité, accident, maladie" },
          { key: "beneficiaries", label: "Bénéficiaires" },
          { key: "claim", label: "Contact et procédure de déclaration", kind: "long" },
          { key: "expiry", label: "Échéance", kind: "date" },
          note,
        ],
      },
      { id: "placements", title: "Placements", hint: "Épargne, comptes-titres, retraite, autres comptes", advised: "deces", fields: [{ key: "product", label: "Placement" }, { key: "where", label: "Établissement" }, note] },
      { id: "credits", title: "Crédits", hint: "Prêts en cours, assurance emprunteur", advised: "coup_dur", fields: [{ key: "loan", label: "Crédit" }, { key: "lender", label: "Organisme" }, tag, note] },
      { id: "abonnements", title: "Abonnements", hint: "Téléphone, internet, énergie, presse, plateformes", advised: "coup_dur", fields: [{ key: "service", label: "Service" }, { key: "account", label: "Identifiant client" }, { key: "expiry", label: "Échéance", kind: "date" }, tag, note] },
      {
        id: "patrimoine",
        title: "Inventaire du patrimoine",
        hint: "Vue d'ensemble : comptes, placements, biens, véhicules, objets de valeur, dettes",
        advised: "deces",
        notice: "Accès conseillé : au décès, ou en cas de coup dur pour votre conjoint. Les montants sont facultatifs.",
        fields: [{ key: "asset", label: "Bien ou dette", placeholder: "Ex. Appartement de Lyon" }, { key: "type", label: "Type", placeholder: "Compte, placement, immobilier, véhicule, objet de valeur, dette" }, { key: "amount", label: "Montant (facultatif)" }, note],
      },
    ],
  },
  {
    id: "numerique",
    title: "Vie numérique",
    tagline: "Téléphone, messageries, réseaux, photos, mots de passe, cryptos",
    icon: "Smartphone",
    tone: "mist",
    subsections: [
      { id: "telephone", title: "Téléphone", hint: "Code de déverrouillage, opérateur", advised: "coup_dur", fields: [{ key: "device", label: "Appareil" }, { key: "code", label: "Code de déverrouillage", kind: "secret" }, note] },
      { id: "messageries", title: "Messageries", hint: "Adresses e-mail principales", advised: "deces", fields: [{ key: "address", label: "Adresse" }, { key: "access", label: "Comment y accéder", kind: "secret" }, note] },
      { id: "reseaux", title: "Réseaux sociaux", hint: "Supprimer, commémorer ou transmettre", advised: "deces", fields: [{ key: "network", label: "Réseau" }, { key: "wish", label: "Mon souhait" }, note] },
      { id: "photos", title: "Photos et cloud", hint: "Où sont les souvenirs", advised: "deces", fields: [{ key: "service", label: "Service" }, { key: "access", label: "Accès", kind: "secret" }, note] },
      { id: "mots-de-passe", title: "Mots de passe", hint: "Gestionnaire, comptes importants", advised: "deces", fields: [{ key: "account", label: "Compte" }, { key: "login", label: "Identifiant" }, { key: "password", label: "Mot de passe", kind: "secret" }, note] },
      {
        id: "cryptos",
        title: "Cryptos et actifs numériques",
        hint: "Wallets, où ils se trouvent, comment y accéder, où est rangée la phrase de récupération",
        advised: "deces",
        notice: "Indiquez où est rangée la phrase de récupération, plutôt que de la recopier ici.",
        fields: [{ key: "wallet", label: "Wallet ou plateforme" }, { key: "where", label: "Où il se trouve" }, { key: "how", label: "Procédure d'accès", kind: "long" }, { key: "seed", label: "Où est rangée la phrase de récupération" }, note],
      },
    ],
  },
  {
    id: "volontes",
    title: "Volontés et messages",
    tagline: "Obsèques, lettres, où sont mes vidéos et souvenirs",
    icon: "Feather",
    tone: "sage",
    subsections: [
      { id: "obseques", title: "Obsèques", hint: "Contrat obsèques, souhaits", advised: "deces", fields: [{ key: "contract", label: "Contrat obsèques" }, { key: "wishes", label: "Mes souhaits", kind: "long" }, note] },
      { id: "lettres", title: "Lettres", hint: "Un mot pour chacun", advised: "deces", fields: [{ key: "to", label: "Pour" }, { key: "text", label: "Ma lettre", kind: "long" }] },
      // Filmed messages are not stored at launch: the Coffre only says where they are kept.
      {
        id: "ou-videos",
        title: "Où se trouvent mes vidéos et souvenirs",
        hint: "Support externe, lieu, personne qui le garde",
        advised: "deces",
        fields: [{ key: "support", label: "Support", placeholder: "Ex. Disque dur externe" }, { key: "where", label: "Où il se trouve", placeholder: "Ex. Dans le bureau, tiroir du haut" }, { key: "keeper", label: "Qui le garde" }, { key: "to", label: "Pour qui" }, note],
      },
    ],
  },
  {
    id: "effacer",
    title: "À effacer",
    tagline: "Jamais remis à personne, détruit sans être lu",
    icon: "EyeOff",
    tone: "ink",
    subsections: [{ id: "prive", title: "Privé", hint: "Ce qui doit disparaître avec vous", fields: [{ key: "title", label: "Élément" }, note] }],
  },
  {
    id: "entreprise",
    title: "Entreprise",
    tagline: "Pour les chefs d'entreprise",
    icon: "Building",
    tone: "ink",
    optional: true,
    subsections: [
      { id: "societe", title: "Société", hint: "Immatriculation, statuts, associés", advised: "coup_dur", fields: [{ key: "company", label: "Société" }, { key: "id", label: "Numéro d'immatriculation" }, note] },
      { id: "banques-pro", title: "Banques professionnelles", hint: "Comptes, pouvoirs", advised: "coup_dur", fields: [{ key: "bank", label: "Banque" }, { key: "powers", label: "Qui a les pouvoirs" }, note] },
      { id: "baux-commerciaux", title: "Baux commerciaux", hint: "Locaux, échéances", advised: "coup_dur", fields: [{ key: "place", label: "Local" }, { key: "expiry", label: "Échéance", kind: "date" }, note] },
      { id: "clients", title: "Clients", hint: "Principaux clients et contrats", advised: "coup_dur", fields: [{ key: "client", label: "Client" }, note] },
      { id: "equipe", title: "Équipe", hint: "Personnes clés, délégations", advised: "coup_dur", fields: [{ key: "person", label: "Personne" }, { key: "role", label: "Rôle" }, note] },
      { id: "acces-procedures", title: "Accès et procédures", hint: "Outils, comptes administrateur, pas-à-pas", advised: "coup_dur", fields: [{ key: "tool", label: "Outil" }, { key: "access", label: "Accès", kind: "secret" }, note] },
    ],
  },
];

export const ALL_SUBSECTIONS = SECTIONS.flatMap((s) => s.subsections.map((sub) => ({ ...sub, sectionId: s.id })));
export const sectionOf = (subsectionId: string) => SECTIONS.find((s) => s.subsections.some((x) => x.id === subsectionId))!;
export const subsection = (id: string) => ALL_SUBSECTIONS.find((s) => s.id === id)!;

// Guided start: "commencer par l'essentiel".
export const ESSENTIALS: { subsectionId: string; title: string; why: string }[] = [
  { subsectionId: "a-prevenir", title: "Un contact clé", why: "Le premier réflexe en cas d'accident" },
  { subsectionId: "groupe-allergies", title: "Groupe sanguin et allergies", why: "Utile aux secours" },
  { subsectionId: "identite-famille", title: "Votre pièce d'identité", why: "Demandée dans presque toutes les démarches" },
  { subsectionId: "banques", title: "Votre banque principale", why: "La première démarche de vos proches" },
  { subsectionId: "assurances", title: "Votre assurance-vie", why: "Pour que vos bénéficiaires soient trouvés" },
  { subsectionId: "telephone", title: "Le code de votre téléphone", why: "Tout passe par lui aujourd'hui" },
  { subsectionId: "messageries", title: "Votre messagerie", why: "Contrats et factures y arrivent" },
  { subsectionId: "juridique", title: "Le lieu de votre testament", why: "Pour que l'original soit retrouvé" },
  { subsectionId: "obseques", title: "Vos souhaits pour les obsèques", why: "Épargner des choix difficiles" },
  { subsectionId: "lettres", title: "Un mot pour vos proches", why: "Ce qui compte le plus" },
];
