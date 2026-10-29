// Everything the client still has to decide ("À décider" in the brief and the project follow-up) lives here, in one place.
export const APP_NAME = "Sillage"; // nom de travail : Sillage, Védora ou Laréo (après vérification INPI / EUIPO et domaines)
export const ASSISTANT_NAME = "Alma"; // avatar fictif de l'assistant ; réponses par le bot Botpress (deploy/alma/), vidéo : à décider

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DELAYS = {
  coupDur: 48 * HOUR, // délai après la déclaration d'un coup dur (à décider)
  deces: 15 * DAY, // délai d'annulation après la vérification d'un décès (à décider)
};

// After a confirmed death the Coffre stays open for a limited time, then it is erased for good (4, 6 or 12 months: à décider).
export const POST_DEATH_ACCESS_DAYS = 6 * 30;
// Unpaid subscription: reminders during a grace period, then everything is erased (à décider).
export const GRACE_DAYS = 30;

// Two-step launch: a paid discovery phase (everything works except adding documents to the Coffre), then the official launch.
// shortcut: global constant for the demo (switchable in Mode démonstration); in production it is the app_settings.launched flag.
export const LAUNCH = {
  phase: "decouverte" as "decouverte" | "lancement",
  plannedDate: null as string | null, // date de lancement officiel annoncée (à décider)
  discoveryPrice: null as number | null, // prix de la phase découverte (à décider)
};

// Simple plan (the family plan comes later).
export const OFFER = {
  ownerCards: 3,
  packCards: 2, // every beneficiary gets a pack of 2 cards, kept in two different places
  price: null as number | null, // prix de la formule simple (à décider)
  packPrice: null as number | null, // pack bénéficiaire : inclus ou payant (à décider)
  packsIncluded: null as number | null, // nombre de bénéficiaires inclus (à décider)
};

export const CONCIERGE = {
  partner: "Conciergerie partenaire", // nom du partenaire (à décider)
  price: null as string | null, // tarif ou « sur devis » (à décider)
};

export const SUPPORT_EMAIL = "bonjour@sillage.app";
