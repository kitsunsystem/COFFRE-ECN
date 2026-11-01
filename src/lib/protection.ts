// « Mes démarches de protection » (developer sheet v2, §9): what has to be done in real life, while alive, so that
// relatives can act in a coup dur. The Espace only keeps the ticked box (checklist "protection:<id>" or
// "protection-na:<id>"); the scanned proof goes into the Coffre. Written for France: other countries are covered by Alma.
// The ids are also in supabase/functions/_shared/protection.ts (monthly reminders).

export interface Demarche {
  id: string;
  title: string;
  why: string;
  where: string;
  docs: string[];
  proof: string; // the Coffre sub-section where the scanned proof goes
  business?: boolean; // only for business owners
}

export const PROTECTION: Demarche[] = [
  {
    id: "procuration",
    title: "Procuration bancaire",
    why: "Sans procuration, personne ne peut payer vos factures ni gérer vos comptes si vous êtes hospitalisé : les comptes à votre seul nom restent bloqués.",
    where: "Dans chacune de vos banques, en agence ou dans votre espace en ligne, avec la personne choisie (votre conjoint ou un proche).",
    docs: ["Votre pièce d'identité", "La pièce d'identité de la personne choisie", "Ses coordonnées"],
    proof: "procurations",
  },
  {
    id: "compte-joint",
    title: "Compte joint, si c'est adapté",
    why: "Un compte joint reste utilisable par l'autre titulaire en cas de coup dur : loyer, courses et factures continuent d'être payés.",
    where: "Dans votre banque, avec votre conjoint ou la personne concernée.",
    docs: ["Vos deux pièces d'identité", "Un justificatif de domicile"],
    proof: "banques",
  },
  {
    id: "mandat",
    title: "Mandat de protection future",
    why: "Il désigne à l'avance qui s'occupera de vous et de vos biens si vous ne pouvez plus le faire. Sans lui, c'est un juge qui décide, après des mois de procédure.",
    where: "Avec le formulaire officiel (Cerfa n° 13592), signé par vous et par la personne choisie, ou par acte authentique pour des pouvoirs plus larges.",
    docs: ["Votre pièce d'identité", "La pièce d'identité de la personne choisie", "La liste de ce qu'elle pourra faire pour vous"],
    proof: "procurations",
  },
  {
    id: "confiance",
    title: "Personne de confiance et directives anticipées",
    why: "À l'hôpital, c'est la première question posée aux proches : qui parle pour vous, et ce que vous voulez en cas de coma ou de fin de vie.",
    where: "Par écrit, daté et signé, chez vous. Remettez une copie à votre médecin traitant et à la personne choisie.",
    docs: ["La désignation de la personne de confiance, signée par elle aussi", "Vos directives anticipées écrites"],
    proof: "volontes-medicales",
  },
  {
    id: "assurance-vie",
    title: "Bénéficiaires de vos assurances-vie",
    why: "Une clause oubliée (« mon conjoint » après un divorce, un enfant né depuis) peut envoyer l'argent à la mauvaise personne.",
    where: "Auprès de chaque assureur ou de chaque banque, dans votre espace client ou en agence.",
    docs: ["Le numéro de chaque contrat", "Les nom, prénom et date de naissance de chaque bénéficiaire"],
    proof: "assurances",
  },
  {
    id: "testament",
    title: "Testament et lieu de l'original",
    why: "Sans testament, la loi décide qui hérite. Et un testament introuvable, c'est comme s'il n'existait pas.",
    where: "Chez vous, écrit entièrement à la main, daté et signé (testament olographe), ou par acte authentique. Notez ensuite dans le Coffre où se trouve l'original.",
    docs: ["Une feuille et un stylo : le texte doit être entièrement manuscrit", "Pour un acte authentique : votre pièce d'identité"],
    proof: "juridique",
  },
  {
    id: "delegation",
    title: "Délégation de pouvoirs dans l'entreprise",
    why: "Si vous êtes indisponible, quelqu'un doit pouvoir signer, payer les salaires et les fournisseurs. Sans délégation, l'entreprise s'arrête.",
    where: "Par écrit, dans l'entreprise. Prévenez ensuite votre banque professionnelle pour ajouter les pouvoirs sur les comptes.",
    docs: ["Les statuts de la société", "La pièce d'identité de la personne choisie", "La liste des pouvoirs délégués"],
    proof: "banques-pro",
    business: true,
  },
  {
    id: "tuteur",
    title: "Tuteur pour vos enfants mineurs",
    why: "Si les deux parents disparaissent, vous pouvez désigner à l'avance qui élèvera vos enfants. Sinon, c'est le conseil de famille, sous le contrôle du juge, qui choisit.",
    where: "Par testament, écrit entièrement à la main, daté et signé, ou par une déclaration spéciale par acte authentique.",
    docs: ["Les nom et coordonnées de la personne choisie, et d'un remplaçant"],
    proof: "juridique",
  },
];

export const applicable = (business: boolean) => PROTECTION.filter((d) => !d.business || business);
export type ProtectionState = "fait" | "na" | null;
export const protectionState = (checklist: Record<string, boolean>, id: string): ProtectionState => (checklist[`protection:${id}`] ? "fait" : checklist[`protection-na:${id}`] ? "na" : null);
// Done or "pas concerné": both count in the percentage.
export const protectionDone = (checklist: Record<string, boolean>, business: boolean) => applicable(business).filter((d) => protectionState(checklist, d.id)).length;
