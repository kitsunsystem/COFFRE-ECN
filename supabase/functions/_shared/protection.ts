// The démarches de protection, for the monthly reminders (content and texts: src/lib/protection.ts, same ids).
export const PROTECTION_IDS: { id: string; business?: boolean }[] = [
  { id: "procuration" },
  { id: "compte-joint" },
  { id: "mandat" },
  { id: "confiance" },
  { id: "assurance-vie" },
  { id: "testament" },
  { id: "delegation", business: true },
  { id: "tuteur" },
];
