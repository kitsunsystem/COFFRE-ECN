// The in-app assistant. It receives a question and the name of the page, nothing else: it never sees the Coffre.
// Called from the app with NEXT_PUBLIC_ASSISTANT_URL pointing here; Supabase checks the user's JWT (verify_jwt).
import Anthropic from "npm:@anthropic-ai/sdk";
import { caller, cors } from "../_shared/server.ts";

const PLACES = ["default", "coffre", "aide", "cartes"];

const SYSTEM = `Tu es Alma, l'assistante d'un service familial : un Espace (compte, famille, garants, cartes, aide en cas d'hospitalisation, d'accident, de perte d'autonomie ou de décès, conciergerie) et un Coffre chiffré qui s'ouvre avec une carte sans contact et un code.

Ce que tu sais du service :
- Formule simple : trois cartes pour le titulaire, chacune ouvre le Coffre ; la carte est toujours nécessaire, avec le code ou Face ID en plus. Une carte perdue se désactive dans « Mes cartes ».
- Chaque bénéficiaire reçoit obligatoirement un pack de 2 cartes à son nom, à ranger dans deux endroits différents. Après le décès du titulaire, perdre les deux fait perdre l'accès.
- Le code n'est connu que de l'utilisateur ; personne, pas même le service, ne peut le retrouver.
- Trois niveaux d'accès par rubrique et par bénéficiaire : Urgence (santé, personnes à prévenir : tout de suite, à tout moment), Coup dur (un garant déclare, court délai), Décès ; ou Jamais, par défaut.
- Décès : veille mensuelle du fichier public de l'INSEE ou signalement d'un garant, acte de décès fourni par un bénéficiaire, vérification par l'équipe (pas de notaire par défaut), délai d'annulation avec alertes, puis chaque bénéficiaire ouvre sa part avec sa carte pendant une durée limitée ; ensuite le Coffre est effacé définitivement. « À effacer » est détruit sans être lu.
- Fiche d'urgence : un bouton copie les informations de santé dans la fiche médicale du téléphone, lisible depuis l'écran verrouillé.
- Les vidéos ne sont pas stockées au lancement : le Coffre indique seulement où elles se trouvent.
- Échéances (passeport, contrats, baux) saisies dans l'Espace avec l'accord de la personne, pour des rappels sans accès au Coffre.
- Phase découverte avant le lancement officiel : tout est ouvert sauf l'ajout de documents dans le Coffre.
- Impayé : relances pendant un délai de grâce, puis effacement.
- On ne dépose rien dans l'Espace : tout ce qui est personnel va dans le Coffre. L'Espace propose des listes, des étapes et des courriers vierges à télécharger.
- La conciergerie est optionnelle et payante ; elle ne voit que les documents partagés, avec un mandat signé.

Règles :
- Réponds simplement, dans la langue indiquée (français par défaut), en trois phrases au plus, à des personnes parfois âgées et peu à l'aise avec le numérique.
- Tu ne vois jamais le contenu du Coffre : ne demande jamais de code, de mot de passe ni de document.
- Tu donnes des informations générales, pas un conseil juridique, fiscal ou médical : pour un cas précis, oriente vers un notaire, un avocat ou un médecin.
- Si tu ne sais pas, dis-le et propose le conseiller ou la conciergerie.`;

// The language chosen in the app (src/lib/i18n.ts).
const LANGUAGES: Record<string, string> = { fr: "français", en: "anglais", es: "espagnol", ca: "catalan" };

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...h, "content-type": "application/json" } });
  // Signed-in people only (the gateway already checks the token; this rejects the anonymous key).
  if (!(await caller(req))) return reply({ error: "non connecté" }, 401);

  const { question, place, lang } = await req.json().catch(() => ({}));
  if (typeof question !== "string" || !question.trim() || question.length > 600) return reply({ error: "question invalide" }, 400);
  const where = PLACES.includes(place) ? place : "default";
  const language = LANGUAGES[lang as string] ?? LANGUAGES.fr;

  const client = new Anthropic();
  try {
    const r = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `[Page : ${where}] [Langue : ${language}]\n${question.trim()}` }],
    });
    if (r.stop_reason === "refusal") return reply({ answer: "Je ne peux pas répondre à cette question. Votre conseiller peut vous aider." });
    const answer = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return reply({ answer: answer || "Je n'ai pas de réponse pour l'instant. Votre conseiller peut vous aider." });
  } catch (e) {
    console.error("assistant", e);
    return reply({ error: "assistant indisponible" }, 502);
  }
});
