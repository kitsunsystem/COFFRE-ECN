// Opinion on a coup dur proof (e.g. a hospital admission slip): right kind of document, right name, recent date.
// Advisory only: a person of the team always decides. Sends the document, the owner's name and the motif; nothing
// from the Coffre. The answer never repeats medical details.
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";

const Verdict = z.object({
  consistent: z.boolean(),
  score: z.number(),
  reasons: z.array(z.string()),
});

export type Opinion = { score: number; doubtful: boolean; reasons: string[] };
const IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const human = (reason: string): Opinion => ({ score: 0, doubtful: true, reasons: [reason] });

const b64 = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

export async function checkProof(file: Blob, ownerName: string, motif: string, requestedAt: string): Promise<Opinion> {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return human("avis IA non configuré : à examiner à l'œil");
  const pdf = file.type === "application/pdf";
  if (!pdf && !IMAGES.includes(file.type)) return human("format non lu par l'IA : à examiner à l'œil");
  if (!pdf && file.size > 5 * 1024 * 1024) return human("photo trop lourde pour l'IA : à examiner à l'œil");
  const data = b64(new Uint8Array(await file.arrayBuffer()));
  const doc = pdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/jpeg", data } };
  try {
    const r = await new Anthropic().messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(Verdict) },
      system:
        "Tu aides une équipe de vérification. Un proche demande l'ouverture d'une partie du coffre d'une personne, pour un coup dur. " +
        "Il fournit ce justificatif. Dis s'il semble cohérent : un document qui correspond au motif, au nom de la personne concernée (variantes d'écriture admises), " +
        "daté de peu avant la demande, sans signe évident de retouche. Score de 0 (incohérent) à 1 (cohérent). Au plus trois raisons courtes, en français, " +
        "sans recopier aucun détail médical. Tu ne décides pas : une personne vérifie ensuite.",
      messages: [{ role: "user", content: [doc, { type: "text", text: JSON.stringify({ personne_concernee: ownerName, motif, date_demande: requestedAt.slice(0, 10) }) }] }],
    });
    const v = r.stop_reason === "refusal" ? null : r.parsed_output;
    if (!v) return human("avis IA indisponible : à examiner à l'œil");
    const score = Math.min(1, Math.max(0, v.score));
    return { score, doubtful: !v.consistent || score < 0.7, reasons: v.reasons.slice(0, 3) };
  } catch (e) {
    console.error("checkProof", e);
    return human("avis IA indisponible : à examiner à l'œil");
  }
}
