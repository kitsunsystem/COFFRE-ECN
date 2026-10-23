// Everything the client still has to decide ("À décider" in the brief) lives here, in one place.
export const APP_NAME = "Sillage"; // nom de travail, à remplacer par le nom définitif
export const ASSISTANT_NAME = "Alma"; // avatar fictif de l'assistant (pas Jimy)

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DELAYS = {
  coupDur: 48 * HOUR, // délai d'annulation après un coup dur (à décider)
  deces: 15 * DAY, // délai d'annulation après un décès (à décider)
};

export const OFFER = {
  includedCards: 3,
  familyPrice: null as number | null, // prix de la formule famille (à décider)
  extraCardPrice: null as number | null, // prix d'une carte supplémentaire (à décider)
};

export const CONCIERGE = {
  partner: "Conciergerie partenaire", // nom du partenaire (à décider)
  price: null as string | null, // tarif ou « sur devis » (à décider)
};

export const SUPPORT_EMAIL = "bonjour@sillage.app";
