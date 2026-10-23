// Alma, the assistant (brief §10). It only knows WHERE the user is (the page), never what they type in the Coffre.
// shortcut: answers from a local knowledge base until the AI/avatar provider is chosen; then set NEXT_PUBLIC_ASSISTANT_URL.
import { ASSISTANT_NAME } from "./config";

const KB: { keys: string[]; answer: string }[] = [
  { keys: ["commencer", "debut", "par ou", "quoi faire"], answer: "Commencez par l'essentiel : dix éléments, environ quinze minutes. Ouvrez votre Coffre avec votre carte, puis touchez « Remplir l'essentiel ». Vous pourrez compléter le reste plus tard, à votre rythme." },
  { keys: ["carte", "nfc", "poser", "activer"], answer: "Votre carte s'utilise comme une carte sans contact : posez-la au dos de votre téléphone, puis tapez votre code. Vous avez trois cartes : si l'une est perdue, les deux autres ouvrent toujours votre Coffre." },
  { keys: ["perdu", "perte", "vol"], answer: "Pas d'inquiétude : vos deux autres cartes ouvrent votre Coffre. Déclarez la carte perdue dans « Mes cartes » : elle ne pourra plus rien ouvrir, et vous pourrez en commander une nouvelle." },
  { keys: ["code", "oublie", "pin"], answer: "Le code se choisit à l'activation des cartes. Personne d'autre que vous ne le connaît, pas même nous : c'est ce qui protège votre Coffre si une carte est volée." },
  { keys: ["garant"], answer: "Les garants sont les personnes qui préviennent si un coup dur ou un décès survient. Vous en choisissez autant que vous voulez et vous écrivez vous-même leur rôle." },
  { keys: ["droit", "qui voit", "acces", "partager", "conjoint"], answer: "Pour chaque proche qui a une carte, vous choisissez, rubrique par rubrique, quand il pourra voir : tout de suite, en cas de coup dur, au décès, ou jamais. Chacun ne voit que ce que vous lui avez attribué." },
  { keys: ["coup dur", "accident", "hospital"], answer: "En cas de coup dur, un garant le signale. Vous êtes alerté partout et vous avez un court délai pour annuler. Ensuite, seules les rubriques prévues pour ce cas s'ouvrent, jamais tout le Coffre." },
  { keys: ["deces", "mort", "insee"], answer: "Chaque mois, une veille compare les membres au fichier public des décès. Une personne vérifie toujours avant de lancer la procédure. Un délai d'annulation s'écoule, puis chacun reçoit sa part et les éléments « À effacer » sont détruits." },
  { keys: ["effacer", "prive", "secret"], answer: "La rubrique « À effacer » n'est remise à personne. Le moment venu, son contenu est détruit sans avoir été lu." },
  { keys: ["securite", "chiffre", "lire", "confidentiel", "piratage"], answer: "Tout ce que vous mettez dans le Coffre est chiffré sur votre téléphone avant de partir. Ni nous, ni moi, ni la conciergerie ne pouvons le lire." },
  { keys: ["concierge", "aide", "demarche", "faire pour moi"], answer: "La conciergerie peut faire les démarches à votre place. C'est un service optionnel et payant. Elle ne voit que les documents que vous lui partagez, avec un mandat signé." },
  { keys: ["parent", "procuration", "gerer pour"], answer: "Un enfant peut ouvrir et gérer le Coffre de son parent peu à l'aise avec le numérique. Le Coffre reste celui du parent, avec ses propres cartes, sur la base d'une procuration. Un modèle se trouve dans la rubrique « Perte d'autonomie »." },
  { keys: ["urgence", "fiche", "sante", "allergie"], answer: "La rubrique « Urgence et santé » rassemble groupe sanguin, allergies, traitements, médecins et personnes à prévenir. Donnez-y l'accès « tout de suite » à votre conjoint : il l'aura toujours sous la main." },
  { keys: ["echeance", "passeport", "expire", "rappel"], answer: "Quand vous indiquez une date d'expiration, nous vous prévenons avant l'échéance. Seule la date nous est transmise, jamais le document." },
  { keys: ["notaire", "avocat", "testament"], answer: "Le Coffre ne remplace ni un notaire ni un avocat, et il n'est pas un testament. Indiquez simplement où se trouve l'original de votre testament dans « Documents » : vos proches le retrouveront." },
  { keys: ["envoyer", "deposer", "telecharger", "fichier", "document"], answer: "Tout ce qui est personnel va dans le Coffre : c'est le seul endroit où l'on dépose des documents. Dans l'Espace, on télécharge seulement des modèles vierges." },
  { keys: ["mail", "proton", "adresse"], answer: "Pour votre adresse e-mail, nous recommandons Proton, un service de messagerie chiffrée. Ce n'est pas obligatoire." },
  { keys: ["prix", "tarif", "abonnement", "combien"], answer: "Une seule formule couvre toute la famille : le couple et, si vous le souhaitez, vos parents. Trois cartes sont incluses ; les cartes supplémentaires sont payantes." },
  { keys: ["identite", "kyc", "verification"], answer: "La vérification d'identité se fait avec le système de votre conseiller. Ces informations restent dans votre Espace : c'est ce qui permet la veille des décès." },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const DISCLAIMER = `${ASSISTANT_NAME} donne des informations générales et ne remplace ni un notaire ni un avocat. ${ASSISTANT_NAME} ne voit jamais le contenu de votre Coffre.`;

export const SUGGESTIONS: Record<string, string[]> = {
  default: ["Par où commencer ?", "Comment marche ma carte ?", "Qui verra mes documents ?"],
  coffre: ["Que mettre dans l'essentiel ?", "Qui voit quoi ?", "C'est vraiment confidentiel ?"],
  aide: ["Que faire après un décès ?", "Comment déclarer un accident ?", "Gérer le Coffre de mon parent"],
  cartes: ["J'ai perdu une carte", "J'ai oublié mon code", "Donner une carte à mon conjoint"],
};

export async function ask(question: string, place: string): Promise<string> {
  const remote = process.env.NEXT_PUBLIC_ASSISTANT_URL;
  if (remote) {
    // Only the question and the page name leave the device: never Coffre content.
    // shortcut: anon key for now; send the signed-in user's access token once Supabase Auth is wired.
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const r = await fetch(remote, { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}`, apikey: key } : {}) }, body: JSON.stringify({ question, place }) }).catch(() => null);
    if (r?.ok) return (await r.json()).answer as string;
  }
  const q = norm(question);
  const best = KB.map((e) => ({ e, hits: e.keys.filter((k) => q.includes(k)).length })).sort((a, b) => b.hits - a.hits)[0];
  return best.hits
    ? best.e.answer
    : "Je n'ai pas encore la réponse à cette question. Votre conseiller peut vous aider, et la conciergerie peut prendre les démarches en charge si vous le souhaitez.";
}
