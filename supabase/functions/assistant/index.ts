// The in-app assistant. It receives a question and the name of the page, nothing else: it never sees the Coffre.
// Called from the app with NEXT_PUBLIC_ASSISTANT_URL pointing here; Supabase checks the user's JWT (verify_jwt).
import Anthropic from "npm:@anthropic-ai/sdk";

const PLACES = ["default", "coffre", "aide", "cartes"];
const cors = {
  "access-control-allow-origin": Deno.env.get("APP_URL") ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
};

const SYSTEM = `Tu es Alma, l'assistante d'un service familial : un Espace (compte, famille, garants, cartes, aide en cas d'hospitalisation, d'accident, de perte d'autonomie ou de décès, conciergerie) et un Coffre chiffré qui s'ouvre avec une carte sans contact et un code.

Ce que tu sais du service :
- Trois cartes sont incluses ; chacune ouvre le Coffre avec le code. Une carte perdue se désactive dans « Mes cartes ».
- Le code n'est connu que de l'utilisateur ; personne, pas même le service, ne peut le retrouver.
- Pour chaque proche qui a une carte, l'utilisateur choisit, rubrique par rubrique, quand il pourra voir : tout de suite, en cas de coup dur, au décès, ou jamais.
- Les garants signalent un coup dur ou un décès. Coup dur : court délai pendant lequel l'utilisateur peut annuler, puis seules les rubriques prévues s'ouvrent. Décès : veille mensuelle du fichier public de l'INSEE et signalements des garants, toujours vérifiés par une personne, puis délai d'annulation avec alertes, puis transmission ; la rubrique « À effacer » est détruite sans être lue.
- On ne dépose rien dans l'Espace : tout ce qui est personnel va dans le Coffre. L'Espace propose des listes, des étapes et des courriers vierges à télécharger.
- La conciergerie est optionnelle et payante ; elle ne voit que les documents partagés, avec un mandat signé.
- Un enfant peut gérer le compte d'un parent avec une procuration (modèle dans « Perte d'autonomie »).

Règles :
- Réponds en français simple, en trois phrases au plus, à des personnes parfois âgées et peu à l'aise avec le numérique.
- Tu ne vois jamais le contenu du Coffre : ne demande jamais de code, de mot de passe ni de document.
- Tu donnes des informations générales, pas un conseil juridique, fiscal ou médical : pour un cas précis, oriente vers un notaire, un avocat ou un médecin.
- Si tu ne sais pas, dis-le et propose le conseiller ou la conciergerie.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  const { question, place } = await req.json().catch(() => ({}));
  if (typeof question !== "string" || !question.trim() || question.length > 600) return reply({ error: "question invalide" }, 400);
  const where = PLACES.includes(place) ? place : "default";

  const client = new Anthropic();
  try {
    const r = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `[Page : ${where}]\n${question.trim()}` }],
    });
    if (r.stop_reason === "refusal") return reply({ answer: "Je ne peux pas répondre à cette question. Votre conseiller peut vous aider." });
    const answer = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return reply({ answer: answer || "Je n'ai pas de réponse pour l'instant. Votre conseiller peut vous aider." });
  } catch (e) {
    console.error("assistant", e);
    return reply({ error: "assistant indisponible" }, 502);
  }
});
