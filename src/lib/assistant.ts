// Alma, the assistant (brief §10). It only knows WHERE the user is (the page), never what they type in the Coffre.
// shortcut: answers from a local knowledge base until the AI/avatar provider is chosen; then set NEXT_PUBLIC_ASSISTANT_URL.
import { ASSISTANT_NAME } from "./config";

const KB: { keys: string[]; answer: string }[] = [
  { keys: ["commencer", "debut", "par ou", "quoi faire"], answer: "Commencez par vos cartes et vos bénéficiaires, puis par l'essentiel : dix éléments, à votre rythme. Ouvrez votre Coffre avec votre carte, puis touchez « Commencer par l'essentiel »." },
  { keys: ["carte", "nfc", "poser", "activer"], answer: "Votre carte s'utilise comme une carte sans contact : posez-la au dos de votre téléphone, puis tapez votre code ou utilisez Face ID. La carte est toujours nécessaire. Vous avez trois cartes : si l'une est perdue, les deux autres ouvrent toujours votre Coffre." },
  { keys: ["beneficiaire", "pack", "deux cartes", "2 cartes"], answer: "Chaque bénéficiaire reçoit obligatoirement un pack de 2 cartes à son nom, à ranger dans deux endroits différents. Tant que vous êtes en vie, une carte perdue se remplace. Après votre décès, un bénéficiaire qui perdrait ses deux cartes perdrait son accès." },
  { keys: ["perdu", "perte", "vol"], answer: "Pas d'inquiétude : vos autres cartes ouvrent votre Coffre. Déclarez la carte perdue dans « Mes cartes » : elle ne pourra plus rien ouvrir, et une carte de remplacement pourra être appairée." },
  { keys: ["code", "oublie", "pin"], answer: "Le code se choisit à l'activation des cartes. Personne d'autre que vous ne le connaît, pas même nous : c'est ce qui protège votre Coffre si une carte est volée." },
  { keys: ["garant"], answer: "Les garants sont les personnes qui préviennent si un coup dur ou un décès survient. Vous en choisissez autant que vous voulez et vous écrivez vous-même leur rôle." },
  { keys: ["droit", "qui voit", "acces", "partager", "conjoint", "niveau"], answer: "Pour chaque bénéficiaire, vous choisissez, rubrique par rubrique, le niveau : urgence (tout de suite, à tout moment), coup dur, décès, ou jamais. Chacun ne voit que ce que vous lui avez attribué." },
  { keys: ["coup dur", "accident", "hospital"], answer: "En cas de coup dur, un garant le signale. Vous êtes alerté partout et vous avez un court délai pour annuler. Ensuite, seules les rubriques prévues pour ce cas s'ouvrent, jamais tout le Coffre." },
  { keys: ["deces", "mort", "insee", "acte"], answer: "Chaque mois, une veille compare les membres au fichier public des décès. Un bénéficiaire dépose l'acte de décès, et notre équipe vérifie tout : registre, acte et identité du bénéficiaire. Un délai d'annulation s'écoule, puis chacun ouvre sa part avec sa carte, pendant une durée limitée. Ensuite, le Coffre est effacé définitivement." },
  { keys: ["paiement", "impaye", "payer", "efface"], answer: "Si l'abonnement n'est plus réglé, nous vous relançons pendant un délai de grâce. À la fin de ce délai, tout le Coffre est effacé définitivement." },
  { keys: ["sensible", "categorie", "personnalis", "creer une rubrique"], answer: "La Partie sensible est votre espace libre : créez vos propres catégories, choisissez ce que chacune peut contenir (PDF, images, notes ou tout fichier) et rangez-y ce que vous voulez. Même les noms des catégories sont chiffrés, et chaque catégorie se règle dans « Qui voit quoi »." },
  { keys: ["video", "film"], answer: "Les vidéos ne sont pas stockées dans le Coffre pour l'instant. Gardez-les sur un disque dur ou une clé, chez vous ou chez votre notaire, et indiquez où elles se trouvent dans « Volontés et messages »." },
  { keys: ["decouverte", "lancement", "prevente"], answer: "Pendant la phase découverte, tout est ouvert : inscription, identité, famille, garants, réglages et cartes. Seul l'ajout de documents dans le Coffre attend le lancement officiel : rien n'est stocké avant." },
  { keys: ["effacer", "prive", "secret"], answer: "La rubrique « À effacer » n'est remise à personne. Le moment venu, son contenu est détruit sans avoir été lu." },
  { keys: ["securite", "chiffre", "lire", "confidentiel", "piratage"], answer: "Tout ce que vous mettez dans le Coffre est chiffré sur votre téléphone avant de partir. Ni nous, ni moi, ni la conciergerie ne pouvons le lire." },
  { keys: ["concierge", "aide", "demarche", "faire pour moi"], answer: "La conciergerie peut faire les démarches à votre place. C'est un service optionnel et payant. Elle ne voit que les documents que vous lui partagez, avec un mandat signé." },
  { keys: ["parent", "procuration", "gerer pour"], answer: "La gestion du Coffre d'un parent par son enfant, avec une procuration signée, arrivera dans un second temps. Un modèle de procuration se trouve déjà dans la rubrique « Perte d'autonomie »." },
  { keys: ["urgence", "fiche", "sante", "allergie", "pompier"], answer: "La rubrique « Urgence et santé » rassemble groupe sanguin, allergies, traitements, médecins et personnes à prévenir. Donnez-lui le niveau « Urgence » : vos bénéficiaires l'ouvrent à tout moment. Et touchez « Copier dans la fiche médicale de mon téléphone » : un pompier pourra la lire depuis l'écran verrouillé." },
  { keys: ["echeance", "passeport", "expire", "rappel", "a jour"], answer: "Dans « Mes échéances », indiquez le type de document et sa date de fin : nous vous prévenons 30 puis 7 jours avant. Ces deux informations restent dans l'Espace, jamais le contenu du Coffre. Et tous les 3 mois, nous vous demandons si tout est à jour." },
  { keys: ["notaire", "avocat", "testament"], answer: "Le Coffre ne remplace ni un notaire ni un avocat, et il n'est pas un testament. Indiquez simplement où se trouve l'original de votre testament dans « Documents » : vos proches le retrouveront." },
  { keys: ["envoyer", "deposer", "telecharger", "fichier", "document"], answer: "Tout ce qui est personnel va dans le Coffre : c'est le seul endroit où l'on dépose des documents. Dans l'Espace, on télécharge seulement des modèles vierges." },
  { keys: ["mail", "proton", "adresse"], answer: "Pour votre adresse e-mail, nous recommandons Proton, un service de messagerie chiffrée. Ce n'est pas obligatoire." },
  { keys: ["prix", "tarif", "abonnement", "combien", "formule"], answer: "La formule simple comprend votre Coffre et vos trois cartes, et un pack de 2 cartes pour chaque bénéficiaire. Les tarifs seront communiqués au lancement." },
  { keys: ["identite", "kyc", "verification"], answer: "La vérification d'identité se fait avec le système de votre conseiller. Ces informations restent dans votre Espace : c'est ce qui permet la veille des décès." },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const DISCLAIMER = `${ASSISTANT_NAME} donne des informations générales et ne remplace ni un notaire ni un avocat. ${ASSISTANT_NAME} ne voit jamais le contenu de votre Coffre.`;

export const SUGGESTIONS: Record<string, string[]> = {
  default: ["Par où commencer ?", "Comment marche ma carte ?", "Qui verra mes documents ?"],
  coffre: ["Que mettre dans l'essentiel ?", "Qui voit quoi ?", "C'est vraiment confidentiel ?"],
  aide: ["Que faire après un décès ?", "Comment déclarer un accident ?", "Gérer le Coffre de mon parent"],
  cartes: ["J'ai perdu une carte", "J'ai oublié mon code", "Les 2 cartes d'un bénéficiaire"],
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
