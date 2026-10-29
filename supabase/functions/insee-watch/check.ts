// Second opinion on a doubtful INSEE match (spelling, compound names). Advisory only: a person always decides.
// Sends the minimum: names, birth date and birth city of both sides. Nothing from the Coffre.
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";
import type { Match, Member } from "../_shared/insee.ts";

const Verdict = z.object({
  same_person_likely: z.boolean(),
  reasons: z.array(z.string()),
});

export async function checkDoubtful(member: Member, m: Match): Promise<string[]> {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return ["avis IA non configuré"];
  const client = new Anthropic();
  try {
    const r = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(Verdict) },
      system:
        "Tu compares un membre d'un service et une ligne du fichier public des décès de l'INSEE. La date de naissance est identique. " +
        "Dis si l'écart sur les noms et le lieu ressemble à une variante d'écriture de la même personne (accents, nom composé, nom d'usage, faute de saisie) ou à un homonyme. " +
        "Donne au plus trois raisons courtes, en français. Tu ne décides pas : une personne vérifie ensuite auprès de l'état civil.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            membre: { nom: member.lastName, prenoms: member.firstNames, naissance: member.birthDate, commune: member.birthCity },
            ecarts_detectes: m.reasons,
            insee: { nom: m.record.lastName, prenoms: m.record.firstNames.join(" "), naissance: m.record.birthDate, commune: m.record.birthCity },
          }),
        },
      ],
    });
    const v = r.stop_reason === "refusal" ? null : r.parsed_output;
    if (!v) return ["avis IA indisponible"];
    return [`IA : ${v.same_person_likely ? "probablement la même personne" : "probablement un homonyme"}`, ...v.reasons.slice(0, 3)];
  } catch (e) {
    console.error("checkDoubtful", e);
    return ["avis IA indisponible"];
  }
}
