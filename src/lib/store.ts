// App state. The "Espace" part is plain data (in production: Supabase tables, readable by the publisher).
// The "Coffre" part only ever holds ciphertext; keys live in `useSession`, in memory, while the Coffre is open.
// shortcut: persisted in localStorage for the demo; swap each action body for a Supabase call when the keys arrive.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { render, type TemplateId } from "../../supabase/functions/_shared/templates";
import type { Sealed } from "./crypto";
import type { Moment, Procedure } from "./rules";

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  email?: string;
  phone?: string;
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
  address: string;
  situation: string;
  isBusinessOwner: boolean;
  kyc: "a_faire" | "en_cours" | "verifie";
  createdAt: number;
}

export type CardStatus = "commandee" | "en_route" | "recue" | "active" | "perdue";
export interface Card {
  id: string;
  holderId: "owner" | string;
  printedName: string;
  status: CardStatus;
  orderedAt: number;
  activatedAt?: number;
  extra: boolean; // beyond the 3 included cards (paid)
  wrappedVmk?: Sealed; // owner cards: vault key wrapped by card + code
  boxPk?: string; // holder cards: public key that envelopes are sealed to
  salt?: string; // holder cards: Argon2id salt for the holder's code
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

export interface Reminder {
  itemId: string;
  date: string; // only the date leaves the Coffre, never what it is about
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

interface State {
  account?: Account;
  people: Person[];
  cards: Card[];
  guarantors: Guarantor[];
  rights: Record<string, Record<string, Moment>>; // cardId → subsectionId → moment (metadata, shown in the Espace)
  vault: Vault;
  procedures: Procedure[];
  reminders: Reminder[];
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
  people: [],
  cards: [],
  guarantors: [],
  rights: {},
  vault: { ssk: {}, items: [], envelopes: [] },
  procedures: [],
  reminders: [],
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
        // shortcut: queued in a local outbox; the "send-email" Edge Function sends it through Brevo once configured.
        const e = render(template, data);
        set((s) => ({ outbox: [{ id: crypto.randomUUID(), to, template, subject: e.subject, title: e.title, body: e.body, at: Date.now() + s.clockOffset }, ...s.outbox] }));
      },
      reset: () => set({ ...initial }),
    }),
    { name: "sillage-demo", skipHydration: true },
  ),
);

export const now = () => Date.now() + useApp.getState().clockOffset;
export const uid = () => crypto.randomUUID();

export const ownerCards = (s: { cards: Card[] }) => s.cards.filter((c) => c.holderId === "owner");
export const holderCards = (s: { cards: Card[] }) => s.cards.filter((c) => c.holderId !== "owner");
export const personName = (people: Person[], id: string) => {
  if (id === "owner") return "Vous";
  const p = people.find((x) => x.id === id);
  return p ? `${p.firstName} ${p.lastName}` : "—";
};

// Coffre session: keys in memory only, gone on reload or lock.
type Session =
  | { mode: "locked" }
  | { mode: "owner"; cardId: string; vmk: Uint8Array }
  | { mode: "holder"; cardId: string; publicKey: Uint8Array; privateKey: Uint8Array };

export const useSession = create<{ session: Session; setSession: (s: Session) => void }>()((set) => ({
  session: { mode: "locked" },
  setSession: (session) => set({ session }),
}));
