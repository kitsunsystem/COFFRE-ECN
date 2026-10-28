// App state. The "Espace" part is plain data (in production: Supabase tables, readable by the publisher).
// The "Coffre" part only ever holds ciphertext; keys live in `useSession`, in memory, while the Coffre is open.
// shortcut: persisted in localStorage for the demo; swap each action body for a Supabase call when the keys arrive.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { render, type TemplateId } from "../../supabase/functions/_shared/templates";
import { LAUNCH } from "./config";
import { currentLang } from "./i18n";
import type { Sealed } from "./crypto";
import { PROD } from "./env";
import type { Moment, Procedure } from "./rules";

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  email?: string;
  managesMe?: boolean; // child who manages this account under a signed power of attorney
}

export interface Account {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  birthCity: string;
  birthCountry: string;
  address: string; // only until the cards are shipped, then erased
  isBusinessOwner: boolean;
  kyc: "a_faire" | "en_cours" | "verifie";
  createdAt: number;
}

// A beneficiary's pack is "reservee" until the death is confirmed; a relative's phone is "demandee" until the owner agrees.
export type CardStatus = "reservee" | "demandee" | "commandee" | "en_route" | "recue" | "active" | "perdue";
export type CardKind = "demo" | "fido" | "tangem" | "telephone";
export interface Card {
  id: string;
  holderId: "owner" | string;
  printedName: string;
  status: CardStatus;
  orderedAt: number;
  activatedAt?: number;
  extra: boolean; // beyond the 3 included cards (paid)
  kind?: CardKind; // known once activated
  chipId?: string; // FIDO2 credential id or Tangem card key: recognises the card when it is tapped
  wrappedVmk?: Sealed; // owner cards: vault key wrapped by card + code; beneficiary cards: their phone's key, the same way
  boxPk?: string; // relatives' phones: public key that envelopes are sealed to
  salt?: string; // beneficiary cards: Argon2id salt for the code
  phoneId?: string; // beneficiary cards: the phone whose key they keep
  shipTo?: string; // beneficiary cards: delivery address, from the confirmed death until shipping
}

export interface Guarantor {
  personId: string;
  role: string; // written by the owner (brief §8)
}

export interface VaultItem {
  id: string;
  subsectionId: string;
  data: Sealed; // { title, fields, files: [{id,name,size,type}] } encrypted with the sub-section key
  fileIds: string[]; // random ids only, so encrypted files can be deleted without reading anything
  updatedAt: number;
}

export interface Envelope {
  cardId: string;
  subsectionId: string;
  moment: Exclude<Moment, "jamais">;
  sealed: string; // sub-section key sealed to the holder's card
}

// Typed by the user in the Espace, with their consent, so reminders work without ever touching the Coffre.
export interface Reminder {
  id: string;
  label: string; // "Passeport", "Bail", "Contrat d'assurance"…
  date: string;
}

export interface ConciergeCase {
  id: string;
  kind: string;
  createdAt: number;
  partner: string;
  status: "demande" | "mandat_signe" | "en_cours" | "termine";
  mandate?: { name: string; signedAt: number };
  shared: { itemId: string; sealed: string }[];
  message?: string;
}

export interface OutboxEmail {
  id: string;
  to: string;
  template: TemplateId;
  subject: string;
  title: string;
  body: string[];
  at: number;
}

export interface Vault {
  salt?: string; // owner code salt
  ssk: Record<string, Sealed>; // sub-section keys wrapped by the vault key
  items: VaultItem[];
  envelopes: Envelope[];
}

// Production: what the signed-in person is for others (guarantor, beneficiary with a pack of cards and their phone).
export interface Trust {
  ownerId: string;
  ownerName: string;
  personId: string;
  guarantorRole?: string;
  cards: Card[];
  procedures: (Procedure & { acteByMe?: boolean; hasActe?: boolean })[];
}

// Production: someone else's Coffre opened with a beneficiary card (only what is released to that card).
export interface HolderView {
  ownerId: string;
  ownerName: string;
  holderName: string;
  items: VaultItem[];
  envelopes: Envelope[];
  procedures: Procedure[];
}

// A computer allowed to ask for the Coffre (the phone approves each opening, card tapped), for 90 days.
export interface TrustedDevice {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt?: number;
}

// A computer's request, as the phone sees it: three numbers to choose from, never the right one alone.
export interface DeviceRequest {
  id: string;
  kind: "pairing" | "open";
  deviceId?: string;
  name: string;
  pk: string; // the computer's public key: the opened keys are sealed to it
  choices: number[];
  status: "pending" | "approved" | "refused" | "used";
  createdAt: number;
  expiresAt: number;
}

interface State {
  ready: boolean; // demo: local data loaded; production: session restored and data fetched
  me?: { userId: string; email: string }; // production only
  staffRole?: string;
  conciergeKey?: string; // production: the partner's public key, items confided to it are sealed to it
  trusts: Trust[];
  holder?: HolderView;
  toast?: { id: number; text: string; tone: "error" | "ok" };
  account?: Account;
  people: Person[];
  cards: Card[];
  guarantors: Guarantor[];
  rights: Record<string, Record<string, Moment>>; // personId → subsectionId → moment; applies to every card of the person's pack
  vault: Vault;
  procedures: Procedure[];
  reminders: Reminder[];
  reminderConsent: boolean;
  phase: "decouverte" | "lancement"; // discovery: no document can be stored in the Coffre yet
  billing: { status: "a_jour" | "impaye" | "efface"; since?: number };
  checklist: Record<string, boolean>;
  concierge: ConciergeCase[];
  outbox: OutboxEmail[];
  clockOffset: number; // demo only: lets the demo panel fast-forward the cancellation windows
  assistantVoice: boolean;
  tourPending: boolean; // guided tour shown at the next entry in the Espace
}

interface Actions {
  set: (patch: Partial<State> | ((s: State) => Partial<State>)) => void;
  email: (to: string, template: TemplateId, data?: Record<string, string>) => void;
  reset: () => void;
}

const initial: State = {
  ready: false,
  trusts: [],
  people: [],
  cards: [],
  guarantors: [],
  rights: {},
  vault: { ssk: {}, items: [], envelopes: [] },
  procedures: [],
  reminders: [],
  reminderConsent: false,
  phase: LAUNCH.phase,
  billing: { status: "a_jour" },
  checklist: {},
  concierge: [],
  outbox: [],
  clockOffset: 0,
  assistantVoice: true,
  tourPending: false,
};

export const useApp = create<State & Actions>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch as never),
      email: (to, template, data) => {
        // Demo only: a local outbox shows the e-mails. In production the database queues them and "mailer" sends them (Brevo).
        if (PROD) return;
        const e = render(template, data, currentLang());
        set((s) => ({ outbox: [{ id: crypto.randomUUID(), to, template, subject: e.subject, title: e.title, body: e.body, at: Date.now() + s.clockOffset }, ...s.outbox] }));
      },
      reset: () => set({ ...initial, ready: true }),
    }),
    {
      // Bumped whenever the stored shape changes; older demo data is simply ignored.
      name: "sillage-demo-6",
      skipHydration: true,
      // Production keeps nothing on the device (shared phones): the server is the only copy.
      partialize: (s) => {
        if (PROD) return {};
        const { ready: _r, me: _m, staffRole: _s, conciergeKey: _c, trusts: _t, holder: _h, toast: _o, ...kept } = s;
        return kept;
      },
    },
  ),
);

export const now = () => Date.now() + useApp.getState().clockOffset;
export const uid = () => crypto.randomUUID();
export const toast = (text: string, tone: "error" | "ok" = "error") => useApp.getState().set({ toast: { id: Date.now(), text, tone } });

export const ownerCards = (s: { cards: Card[] }) => s.cards.filter((c) => c.holderId === "owner");
// Every key of a person: their pack and their phone. Rights apply to each of them.
export const packOf = (s: { cards: Card[] }, personId: string) => s.cards.filter((c) => c.holderId === personId && c.status !== "perdue");
// A relative's phone is kept as a card without a chip: same envelopes, same moments, same removal.
export const isPhone = (c: Pick<Card, "kind">) => c.kind === "telephone";
export const phoneOf = (s: { cards: Card[] }, personId: string) => s.cards.find((c) => c.holderId === personId && isPhone(c) && c.status !== "perdue");
export const personName = (people: Person[], id: string) => {
  if (id === "owner") return "Vous";
  const p = people.find((x) => x.id === id);
  return p ? `${p.firstName} ${p.lastName}` : "—";
};

// Coffre session: keys in memory only, gone on reload or lock.
// A relative opens as their phone (cardId: the phone's record), with the phone itself or with one of their cards.
export type OpenSession = { mode: "owner"; cardId: string; vmk: Uint8Array } | { mode: "holder"; cardId: string; publicKey: Uint8Array; privateKey: Uint8Array };
export type HolderSession = Extract<OpenSession, { mode: "holder" }>;
type Session = { mode: "locked" } | OpenSession;

export const useSession = create<{ session: Session; setSession: (s: Session) => void }>()((set) => ({
  session: { mode: "locked" },
  setSession: (session) => set({ session }),
}));
