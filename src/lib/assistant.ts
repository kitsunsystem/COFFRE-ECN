// Alma, the assistant (brief §10). It only knows WHERE the user is (the page), never what they type in the Coffre.
// Answers from the Botpress bot (its instructions and knowledge base: deploy/alma/), reached through Botpress's webchat
// API from Alma's own window, so no Botpress widget is shown. Offline, or without an answer: the local knowledge base below.
import { ASSISTANT_NAME } from "./config";
import { BOTPRESS_CLIENT_ID } from "./env";
import { currentLang } from "./i18n";

const KB: { keys: string[]; answer: string }[] = [
  { keys: ["commencer", "debut", "par ou", "quoi faire"], answer: "Commencez par vos proches (chacun crée son compte sur votre invitation), vos démarches de protection et « Qui voit quoi », puis l'essentiel du Coffre : dix éléments, à votre rythme, une fois vos cartes reçues." },
  { keys: ["carte", "nfc", "poser", "activer"], answer: "Votre carte s'utilise comme une carte sans contact : posez-la au dos de votre téléphone, puis tapez votre code ou utilisez Face ID. La carte est toujours nécessaire. Vous avez trois cartes : si l'une est perdue, les deux autres ouvrent toujours votre Coffre." },
  { keys: ["beneficiaire", "pack", "deux cartes", "2 cartes", "solde"], answer: "Chaque bénéficiaire a un pack de 2 cartes à son nom, prépayé et gardé en solde : il n'est envoyé qu'à votre décès. D'ici là, vos proches n'ont pas de carte : chacun a son compte, demande son accès depuis son téléphone (son visage et un code) et vous l'acceptez dans « Qui voit quoi »." },
  { keys: ["invit", "compte", "inscri"], answer: "Chaque proche a obligatoirement son propre compte. Quand vous l'ajoutez, un message prêt à envoyer vous est proposé : envoyez-le depuis votre messagerie, ou copiez-le. Rien ne part à votre place. Tant qu'un proche n'a pas créé son compte, nous vous le rappelons chaque mois." },
  { keys: ["perdu", "perte", "vol"], answer: "Pas d'inquiétude : vos autres cartes ouvrent votre Coffre. Déclarez la carte perdue dans « Mes cartes » : elle ne pourra plus rien ouvrir, et une carte de remplacement pourra être appairée." },
  { keys: ["code", "oublie", "pin"], answer: "Le code se choisit à l'activation des cartes. Personne d'autre que vous ne le connaît, pas même nous : c'est ce qui protège votre Coffre si une carte est volée." },
  { keys: ["garant"], answer: "Les garants sont les personnes qui signalent un décès. Vous en choisissez autant que vous voulez et vous écrivez vous-même leur rôle. Un coup dur, lui, se demande par le proche concerné, avec un justificatif." },
  { keys: ["droit", "qui voit", "acces", "partager", "conjoint", "niveau", "conseille"], answer: "Pour chaque proche, vous choisissez, sous-rubrique par sous-rubrique, le niveau : maintenant, coup dur, décès, ou jamais (par défaut). L'accès conseillé vous est proposé : vous le confirmez ou le changez. Chacun ne voit que ce que vous lui avez attribué." },
  { keys: ["coup dur", "accident", "hospital", "coma", "incapacite", "justificatif"], answer: "En cas de coup dur, le proche fait une demande d'ouverture depuis son compte : motif (hospitalisation, coma, incapacité) et justificatif, avec sa pièce d'identité et une photo de son visage. L'IA donne un premier avis, puis notre équipe vérifie tout. La partie prévue pour lui s'ouvre alors, pour lui seul, un temps limité. Vous êtes alerté partout et pouvez refuser ou fermer l'accès à tout moment." },
  { keys: ["deces", "mort", "insee", "acte"], answer: "Un bénéficiaire dépose l'acte de décès depuis son compte, avec sa pièce d'identité et une photo de son visage. Notre équipe vérifie tout, avec les registres officiels là où c'est possible (en France, le fichier des décès de l'INSEE). Un délai d'annulation s'écoule, pendant lequel chaque bénéficiaire reçoit ses cartes, puis chacun ouvre sa part pendant une durée limitée. Ensuite, le Coffre est effacé définitivement." },
  { keys: ["protection", "mandat", "procuration bancaire", "tuteur", "directives"], answer: "« Mes démarches de protection », dans l'Espace, liste ce qui se fait de votre vivant : procuration bancaire, compte joint, mandat de protection future, personne de confiance et directives anticipées, bénéficiaires d'assurance-vie, testament, délégation de pouvoirs, tuteur pour vos enfants. Chacune dit pourquoi, où aller et quoi apporter. Cochez « C'est fait » ou « Pas concerné »." },
  { keys: ["crypto", "wallet", "bitcoin", "phrase de recuperation"], answer: "Dans « Vie numérique », « Cryptos et actifs numériques », indiquez vos portefeuilles, où ils se trouvent et comment y accéder. Pour la phrase de récupération, notez où elle est rangée plutôt que de la recopier." },
  { keys: ["paiement", "impaye", "payer", "efface"], answer: "Si l'abonnement n'est plus réglé, nous vous relançons pendant un délai de grâce. À la fin de ce délai, tout le Coffre est effacé définitivement." },
  { keys: ["video", "film"], answer: "Les vidéos ne sont pas stockées dans le Coffre pour l'instant. Gardez-les sur un disque dur ou une clé, chez vous ou chez un proche, et indiquez où elles se trouvent dans « Volontés et messages », « Où se trouvent mes vidéos et souvenirs »." },
  { keys: ["decouverte", "lancement", "prevente", "pre-lancement"], answer: "Pendant le pré-lancement, tout est ouvert sauf le Coffre : votre Espace, l'identité, vos proches, vos garants, « Qui voit quoi » et vos démarches de protection. Le Coffre s'active à la réception de vos cartes, au lancement. Si la date est repoussée, vous choisissez : reporter, ou être remboursé." },
  { keys: ["effacer", "prive", "secret"], answer: "La rubrique « À effacer » n'est remise à personne. Le moment venu, son contenu est détruit sans avoir été lu." },
  { keys: ["securite", "chiffre", "lire", "confidentiel", "piratage"], answer: "Tout ce que vous mettez dans le Coffre est chiffré sur votre téléphone avant de partir. Ni nous, ni moi, ni la conciergerie ne pouvons le lire." },
  { keys: ["concierge", "aide", "demarche", "faire pour moi", "ticket"], answer: "Je réponds d'abord à toutes vos questions. Si je ne peux pas, ouvrez un ticket auprès de la conciergerie, dans l'Espace : c'est un service avec un coût à part, annoncé avant tout engagement. Elle ne voit que les documents que vous lui confiez, avec un mandat signé." },
  { keys: ["parent", "procuration", "gerer pour"], answer: "La gestion du Coffre d'un parent par son enfant, avec une procuration signée, arrivera dans un second temps. Un modèle de procuration se trouve déjà dans la rubrique « Perte d'autonomie »." },
  { keys: ["urgence", "fiche", "sante", "allergie", "pompier"], answer: "La rubrique « Urgence et santé » rassemble groupe sanguin, allergies, traitements, médecins, volontés médicales, personnes et animaux à charge, et contacts clés. Le niveau conseillé est « Maintenant » : vos proches autorisés l'ouvrent à tout moment. Et touchez « Copier dans la fiche médicale de mon téléphone » : un pompier pourra la lire depuis l'écran verrouillé." },
  { keys: ["echeance", "passeport", "expire", "rappel", "a jour"], answer: "Dans « Mes échéances », indiquez le type de document et sa date de fin : nous vous prévenons 30 puis 7 jours avant. Ces deux informations restent dans l'Espace, jamais le contenu du Coffre. Et tous les 3 mois, nous vous demandons si tout est à jour." },
  { keys: ["notaire", "avocat", "testament"], answer: "Le Coffre n'est pas un testament. Indiquez où se trouve l'original dans « Documents », « Papiers juridiques » : vos proches le retrouveront. Pour le rédiger, « Mes démarches de protection » dit comment faire et quoi préparer." },
  { keys: ["envoyer", "deposer", "telecharger", "fichier", "document"], answer: "Tout ce qui est personnel va dans le Coffre : c'est le seul endroit où l'on dépose des documents. Dans l'Espace, on télécharge seulement des modèles vierges." },
  { keys: ["mail", "proton", "adresse"], answer: "Pour votre adresse e-mail, nous recommandons Proton, un service de messagerie chiffrée. Ce n'est pas obligatoire." },
  { keys: ["prix", "tarif", "abonnement", "combien", "formule"], answer: "La formule simple comprend votre Coffre et vos trois cartes, vos démarches de protection, et un pack de 2 cartes prépayées pour chaque bénéficiaire. Les tarifs sont communiqués au lancement, ou par votre conseiller." },
  { keys: ["identite", "kyc", "verification"], answer: "La vérification d'identité se fait avec le système de votre conseiller. Ces informations restent dans votre Espace : c'est ce qui permet la veille des décès." },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const DISCLAIMER = `${ASSISTANT_NAME} répond à vos questions ; si elle ne peut pas, vous pouvez ouvrir un ticket auprès de la conciergerie, un service payant à part. ${ASSISTANT_NAME} ne voit jamais le contenu de votre Coffre : n'écrivez ici aucun code ni mot de passe.`;

export const SUGGESTIONS: Record<string, string[]> = {
  default: ["Par où commencer ?", "Comment marche ma carte ?", "Qui verra mes documents ?"],
  coffre: ["Que mettre dans l'essentiel ?", "Qui voit quoi ?", "C'est vraiment confidentiel ?"],
  aide: ["Que faire après un décès ?", "Comment déclarer un accident ?", "Gérer le Coffre de mon parent"],
  cartes: ["J'ai perdu une carte", "J'ai oublié mon code", "Les 2 cartes d'un bénéficiaire"],
};

/* ---------- Botpress ---------- */

type Payload = { text?: string; markdown?: string; items?: { payload?: { text?: string; markdown?: string } }[] };
type Chat = { key: string; userId: string; conversationId: string };

const API = `https://webchat.botpress.cloud/${BOTPRESS_CLIENT_ID}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, key?: string, body?: unknown): Promise<T> {
  const r = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(key ? { "x-user-key": key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

// One anonymous Botpress user and conversation per visit, made at the first question, so the bot keeps the thread.
let chat: Promise<Chat> | undefined;
const session = () =>
  (chat ??= (async () => {
    const { user, key } = await api<{ user: { id: string }; key: string }>("/users", undefined, {});
    const { conversation } = await api<{ conversation: { id: string } }>("/conversations", key, {});
    return { key, userId: user.id, conversationId: conversation.id };
  })().catch((e) => {
    chat = undefined;
    throw e;
  }));

async function messages(c: Chat) {
  const all: { userId: string; createdAt: string; payload: Payload }[] = [];
  let next: string | undefined;
  do {
    const r = await api<{ messages: typeof all; meta: { nextToken?: string } }>(`/conversations/${c.conversationId}/messages${next ? `?nextToken=${encodeURIComponent(next)}` : ""}`, c.key);
    all.push(...r.messages);
    next = r.meta.nextToken;
  } while (next);
  return all;
}

// Alma's bubbles show plain text: the bot's markdown signs go.
const textOf = (p: Payload) => [p.text, p.markdown, ...(p.items ?? []).map((i) => i.payload?.text ?? i.payload?.markdown)].filter(Boolean).join("\n");
const plain = (t: string) => t.replace(/\*\*|__|^#+\s*/gm, "").trim();

async function botpress(question: string, place: string) {
  const c = await session();
  const { message } = await api<{ message: { createdAt: string } }>("/messages", c.key, { conversationId: c.conversationId, payload: { type: "text", text: question }, metadata: { page: place, lang: currentLang() } });
  // The answer comes a few seconds later, sometimes in several messages: taken once it has stopped changing.
  let last = "";
  for (let i = 0; i < 45; i++) {
    await sleep(1000);
    const replies = (await messages(c)).filter((m) => m.userId !== c.userId && m.createdAt > message.createdAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const text = replies.map((m) => textOf(m.payload)).filter(Boolean).join("\n\n");
    if (text && text === last) return plain(text);
    last = text;
  }
  if (last) return plain(last);
  throw new Error("timeout");
}

export async function ask(question: string, place: string): Promise<string> {
  if (BOTPRESS_CLIENT_ID) {
    try {
      return await botpress(question, place);
    } catch (e) {
      console.error(e);
    }
  }
  const q = norm(question);
  const best = KB.map((e) => ({ e, hits: e.keys.filter((k) => q.includes(k)).length })).sort((a, b) => b.hits - a.hits)[0];
  return best.hits
    ? best.e.answer
    : "Je n'ai pas la réponse à cette question. Vous pouvez ouvrir un ticket auprès de la conciergerie, dans l'Espace : c'est un service avec un coût à part, annoncé avant tout engagement.";
}
