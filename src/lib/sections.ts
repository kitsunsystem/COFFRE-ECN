// Coffre structure from the client brief (section 6): few sections, one level of sub-sections.
// The final list of sub-sections is still "à décider": edit it here only.

export type FieldKind = "text" | "long" | "date" | "secret" | "phone";
export interface Field {
  key: string;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
}
export interface Subsection {
  id: string;
  title: string;
  hint: string;
  fields: Field[];
}
export interface Section {
  id: string;
  title: string;
  tagline: string;
  icon: string; // lucide icon name, resolved in components/icons.tsx
  tone: "coral" | "gold" | "sage" | "ink" | "mist";
  optional?: boolean;
  custom?: boolean; // sub-sections are categories created by the owner, not listed here
  subsections: Subsection[];
}

// What a custom category can hold.
export type Accept = "pdf" | "image" | "note" | "any";
export const ACCEPTS: { id: Accept; label: string; mime: string }[] = [
  { id: "pdf", label: "PDF", mime: "application/pdf" },
  { id: "image", label: "Images", mime: "image/*" },
  { id: "note", label: "Notes", mime: "" },
  { id: "any", label: "Tous fichiers", mime: "*/*" },
];
export const CUSTOM_PREFIX = "custom-";

const note: Field = { key: "note", label: "Précisions", kind: "long", placeholder: "Tout ce qui peut aider vos proches" };
const contact = (who: string): Field[] => [
  { key: "name", label: who },
  { key: "phone", label: "Téléphone", kind: "phone" },
  note,
];

export const SECTIONS: Section[] = [
  {
    id: "urgence",
    title: "Urgence et santé",
    tagline: "Ce qu'il faut savoir tout de suite si quelque chose arrive",
    icon: "HeartPulse",
    tone: "coral",
    subsections: [
      { id: "groupe-allergies", title: "Groupe sanguin et allergies", hint: "Groupe sanguin, allergies, contre-indications", fields: [{ key: "blood", label: "Groupe sanguin", placeholder: "Ex. A+" }, { key: "allergies", label: "Allergies", kind: "long" }, note] },
      { id: "traitements", title: "Traitements", hint: "Médicaments, posologie, appareillage", fields: [{ key: "drug", label: "Traitement" }, { key: "dose", label: "Posologie" }, note] },
      { id: "medecins", title: "Médecins", hint: "Médecin traitant, spécialistes", fields: contact("Médecin") },
      { id: "a-prevenir", title: "Personnes à prévenir", hint: "Qui appeler en premier", fields: contact("Personne à prévenir") },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    tagline: "Papiers d'identité, logement, véhicules, papiers juridiques",
    icon: "FileText",
    tone: "ink",
    subsections: [
      { id: "identite-famille", title: "Identité et famille", hint: "Pièce d'identité, passeport, livret de famille", fields: [{ key: "doc", label: "Document", placeholder: "Ex. Passeport" }, { key: "number", label: "Numéro" }, { key: "expiry", label: "Date d'expiration", kind: "date" }, note] },
      { id: "logement", title: "Logement et baux", hint: "Titre de propriété, bail, assurance habitation", fields: [{ key: "address", label: "Adresse" }, { key: "status", label: "Propriétaire ou locataire" }, { key: "contact", label: "Bailleur ou syndic" }, note] },
      { id: "vehicules", title: "Véhicules", hint: "Carte grise, assurance, clés", fields: [{ key: "vehicle", label: "Véhicule" }, { key: "plate", label: "Immatriculation" }, { key: "keys", label: "Où sont les clés" }, note] },
      { id: "juridique", title: "Papiers juridiques", hint: "Lieu de l'original du testament, donations, procurations", fields: [{ key: "doc", label: "Document", placeholder: "Ex. Testament" }, { key: "where", label: "Où se trouve l'original" }, { key: "pro", label: "Notaire ou avocat" }, note] },
    ],
  },
  {
    id: "argent",
    title: "Argent et contrats",
    tagline: "Banques, assurances, placements, crédits, abonnements",
    icon: "Landmark",
    tone: "gold",
    subsections: [
      { id: "banques", title: "Banques", hint: "Établissements, conseillers, comptes", fields: [{ key: "bank", label: "Banque" }, { key: "advisor", label: "Conseiller" }, { key: "phone", label: "Téléphone", kind: "phone" }, note] },
      { id: "assurances", title: "Assurances et assurance-vie", hint: "Assureur, numéro de contrat, bénéficiaires", fields: [{ key: "insurer", label: "Assureur" }, { key: "contract", label: "Numéro de contrat" }, { key: "beneficiaries", label: "Bénéficiaires" }, { key: "expiry", label: "Échéance", kind: "date" }, note] },
      { id: "placements", title: "Placements", hint: "Épargne, comptes-titres, retraite", fields: [{ key: "product", label: "Placement" }, { key: "where", label: "Établissement" }, note] },
      { id: "credits", title: "Crédits", hint: "Prêts en cours, assurance emprunteur", fields: [{ key: "loan", label: "Crédit" }, { key: "lender", label: "Organisme" }, note] },
      { id: "abonnements", title: "Abonnements", hint: "Téléphone, internet, énergie, presse, plateformes", fields: [{ key: "service", label: "Service" }, { key: "account", label: "Identifiant client" }, { key: "expiry", label: "Échéance", kind: "date" }, note] },
    ],
  },
  {
    // A sandbox: the owner creates the categories (their names are encrypted too), see vault.ts createCategory.
    id: "sensible",
    title: "Partie sensible",
    tagline: "Vos propres catégories, vos documents, comme vous voulez",
    icon: "LockKeyhole",
    tone: "coral",
    custom: true,
    subsections: [],
  },
  {
    id: "numerique",
    title: "Vie numérique",
    tagline: "Téléphone, messageries, réseaux, photos, mots de passe",
    icon: "Smartphone",
    tone: "mist",
    subsections: [
      { id: "telephone", title: "Téléphone", hint: "Code de déverrouillage, opérateur", fields: [{ key: "device", label: "Appareil" }, { key: "code", label: "Code de déverrouillage", kind: "secret" }, note] },
      { id: "messageries", title: "Messageries", hint: "Adresses e-mail principales", fields: [{ key: "address", label: "Adresse" }, { key: "access", label: "Comment y accéder", kind: "secret" }, note] },
      { id: "reseaux", title: "Réseaux sociaux", hint: "Supprimer, commémorer ou transmettre", fields: [{ key: "network", label: "Réseau" }, { key: "wish", label: "Mon souhait" }, note] },
      { id: "photos", title: "Photos et cloud", hint: "Où sont les souvenirs", fields: [{ key: "service", label: "Service" }, { key: "access", label: "Accès", kind: "secret" }, note] },
      { id: "mots-de-passe", title: "Mots de passe", hint: "Gestionnaire, comptes importants", fields: [{ key: "account", label: "Compte" }, { key: "login", label: "Identifiant" }, { key: "password", label: "Mot de passe", kind: "secret" }, note] },
    ],
  },
  {
    id: "volontes",
    title: "Volontés et messages",
    tagline: "Obsèques, lettres, où sont mes vidéos, animaux",
    icon: "Feather",
    tone: "sage",
    subsections: [
      { id: "obseques", title: "Obsèques", hint: "Contrat obsèques, souhaits", fields: [{ key: "contract", label: "Contrat obsèques" }, { key: "wishes", label: "Mes souhaits", kind: "long" }, note] },
      { id: "lettres", title: "Lettres", hint: "Un mot pour chacun", fields: [{ key: "to", label: "Pour" }, { key: "text", label: "Ma lettre", kind: "long" }] },
      // Filmed messages are not stored at launch: the Coffre only says where they are kept.
      { id: "ou-videos", title: "Où se trouvent mes vidéos", hint: "Disque dur, clé USB, chez le notaire…", fields: [{ key: "support", label: "Support", placeholder: "Ex. Disque dur externe" }, { key: "where", label: "Où il se trouve", placeholder: "Ex. Chez Maître Roux" }, { key: "to", label: "Pour qui" }, note] },
      { id: "animaux", title: "Animaux", hint: "Qui les recueille, vétérinaire", fields: [{ key: "animal", label: "Animal" }, { key: "keeper", label: "Qui le recueille" }, note] },
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
      { id: "societe", title: "Société", hint: "Immatriculation, statuts, associés", fields: [{ key: "company", label: "Société" }, { key: "id", label: "Numéro d'immatriculation" }, note] },
      { id: "banques-pro", title: "Banques professionnelles", hint: "Comptes, pouvoirs", fields: [{ key: "bank", label: "Banque" }, { key: "powers", label: "Qui a les pouvoirs" }, note] },
      { id: "baux-commerciaux", title: "Baux commerciaux", hint: "Locaux, échéances", fields: [{ key: "place", label: "Local" }, { key: "expiry", label: "Échéance", kind: "date" }, note] },
      { id: "clients", title: "Clients", hint: "Principaux clients et contrats", fields: [{ key: "client", label: "Client" }, note] },
      { id: "equipe", title: "Équipe", hint: "Personnes clés, délégations", fields: [{ key: "person", label: "Personne" }, { key: "role", label: "Rôle" }, note] },
      { id: "acces-procedures", title: "Accès et procédures", hint: "Outils, comptes administrateur, pas-à-pas", fields: [{ key: "tool", label: "Outil" }, { key: "access", label: "Accès", kind: "secret" }, note] },
    ],
  },
];

export const ALL_SUBSECTIONS = SECTIONS.flatMap((s) => s.subsections.map((sub) => ({ ...sub, sectionId: s.id })));
export const sectionOf = (subsectionId: string) => SECTIONS.find((s) => s.subsections.some((x) => x.id === subsectionId))!;
// Custom categories all share one simple form: a title, free notes, and the files the category accepts.
const CUSTOM_FIELDS: Field[] = [{ key: "note", label: "Informations", kind: "long", placeholder: "Tout ce que vous voulez garder ici" }];
export const subsection = (id: string) =>
  ALL_SUBSECTIONS.find((s) => s.id === id) ?? { id, title: "Catégorie", hint: "", fields: CUSTOM_FIELDS, sectionId: "sensible" };

// Guided start: "commencer par l'essentiel".
export const ESSENTIALS: { subsectionId: string; title: string; why: string }[] = [
  { subsectionId: "a-prevenir", title: "Une personne à prévenir", why: "Le premier réflexe en cas d'accident" },
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
