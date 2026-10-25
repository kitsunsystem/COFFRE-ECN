// E-mail templates, shared by the app (outbox in demo) and the "send-email" Edge Function (Brevo).
// Never put Coffre content in an e-mail: only what the Espace already knows.

export type TemplateId =
  | "bienvenue"
  | "relance"
  | "echeance"
  | "coup-dur-declare"
  | "deces-delai"
  | "acces-ouvert"
  | "invitation-porteur"
  | "invitation-garant"
  | "cartes-commandees"
  | "a-jour"
  | "controle-cartes"
  | "impaye"
  | "acces-fin"
  | "nouvel-appareil";

export interface Email {
  subject: string;
  title: string;
  body: string[];
  cta?: { label: string; path: string };
}

const brand = "Sillage";

export function render(id: TemplateId, d: Record<string, string> = {}): Email {
  switch (id) {
    case "bienvenue":
      return { subject: `Bienvenue chez ${brand}`, title: `Bienvenue, ${d.firstName}`, body: ["Votre Espace est prêt. Prochaines étapes : vos cartes, vos bénéficiaires, puis l'essentiel de votre Coffre, à votre rythme."], cta: { label: "Ouvrir mon Espace", path: "/espace" } };
    case "relance":
      return { subject: "Deux minutes pour votre famille", title: `Votre famille est protégée à ${d.score} %`, body: [`Une seule chose à faire aujourd'hui : ${d.next}.`, "Cela prend moins de deux minutes."], cta: { label: "Continuer", path: "/coffre" } };
    case "echeance":
      return { subject: `${d.label} : échéance le ${d.date}`, title: "Pensez à le renouveler", body: [`${d.label} arrive à échéance le ${d.date}.`, "Une fois renouvelé, mettez à jour la date dans votre Espace et le document dans votre Coffre."], cta: { label: "Mes échéances", path: "/espace/echeances" } };
    case "a-jour":
      return { subject: "Tout est-il à jour ?", title: "Un petit point sur votre Coffre", body: ["Un changement de banque, un nouveau contrat, un déménagement ? Prenez deux minutes pour vérifier que votre Coffre et vos échéances sont à jour."], cta: { label: "Vérifier", path: "/espace" } };
    case "controle-cartes":
      return { subject: "Vos cartes sont-elles toujours là ?", title: "Vérifiez vos 2 cartes", body: [`${d.ownerName} vous a confié un pack de 2 cartes. Vérifiez qu'elles sont toujours rangées à deux endroits différents.`, "Si l'une manque, dites-le-nous : une nouvelle carte peut être appairée tant que le titulaire est en vie. Après son décès, perdre vos deux cartes ferait perdre votre accès définitivement."] };
    case "impaye":
      return { subject: "Votre abonnement n'est pas réglé", title: "Votre Coffre sera effacé sans régularisation", body: [`Nous n'avons pas reçu votre paiement. Sans régularisation avant le ${d.until}, votre Coffre et tout son contenu seront effacés définitivement.`], cta: { label: "Régulariser", path: "/espace/compte" } };
    case "acces-fin":
      return { subject: `Le Coffre de ${d.ownerName} sera bientôt effacé`, title: "Récupérez ce qui vous a été confié", body: [`Le Coffre de ${d.ownerName} reste ouvert jusqu'au ${d.until}. Ensuite, il sera effacé définitivement.`, "Ouvrez-le avec votre carte et exportez ce qui vous a été confié."], cta: { label: "Ouvrir avec ma carte", path: "/coffre" } };
    case "coup-dur-declare":
      return { subject: "Important : un coup dur a été signalé", title: "Êtes-vous en sécurité ?", body: [`${d.declaredBy} a signalé un coup dur vous concernant.`, `Si tout va bien, annulez avant le ${d.endsAt}. Sinon, vos proches recevront uniquement ce que vous avez prévu pour ce cas.`], cta: { label: "Tout va bien, j'annule", path: "/espace/procedures" } };
    case "deces-delai":
      return { subject: "Important : une procédure vous concerne", title: "Si vous lisez ce message, annulez", body: ["Une procédure de transmission a été ouverte à votre nom.", `Si c'est une erreur, une seule action suffit avant le ${d.endsAt}.`], cta: { label: "Annuler la procédure", path: "/espace/procedures" } };
    case "acces-ouvert":
      return { subject: `${d.ownerName} vous a confié des éléments`, title: "Des éléments vous attendent", body: [`${d.ownerName} avait prévu de vous transmettre certains éléments.`, "Posez votre carte sur votre téléphone pour les ouvrir. Une liste de démarches et des modèles de courriers vous accompagnent.", ...(d.until ? [`L'accès reste ouvert jusqu'au ${d.until}, puis le Coffre sera effacé définitivement : pensez à exporter ce qui vous est utile.`] : [])], cta: { label: "Ouvrir avec ma carte", path: "/coffre" } };
    case "invitation-porteur":
      return { subject: `${d.ownerName} vous confie un pack de 2 cartes`, title: "Vos 2 cartes arrivent", body: [`${d.ownerName} vous a désigné comme bénéficiaire. Vos 2 cartes n'ouvriront que ce qu'il ou elle a choisi de partager avec vous.`, "Rangez-les dans deux endroits différents : après le décès du titulaire, perdre les deux ferait perdre votre accès définitivement."] };
    case "invitation-garant":
      return { subject: `${d.ownerName} compte sur vous`, title: "Vous êtes garant", body: [`${d.ownerName} vous a désigné comme garant. Votre rôle : ${d.role}.`, "Si un coup dur ou un décès survient, vous pourrez le déclarer depuis votre Espace."] };
    case "cartes-commandees":
      return { subject: "Vos cartes sont en fabrication", title: "Vos cartes arrivent", body: [`${d.count} cartes sont en fabrication. Dès réception, posez-les sur votre téléphone pour les activer.`] };
    case "nouvel-appareil":
      return { subject: "Nouvel appareil de confiance", title: "Un ordinateur peut ouvrir votre Coffre", body: [`« ${d.name} » a été approuvé depuis votre téléphone le ${d.date}. Il pourra demander l'ouverture du Coffre, toujours avec votre carte et votre accord sur le téléphone.`, "Ce n'est pas vous ? Retirez-le tout de suite dans Compte › Appareils de confiance, puis changez votre mot de passe."], cta: { label: "Mes appareils", path: "/espace/compte" } };
  }
}

// Names come from users: escape everything that goes into the HTML.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function toHtml(e: Email, baseUrl: string) {
  const p = e.body.map((t) => `<p style="margin:0 0 14px;font:17px/1.6 Arial,sans-serif;color:#2a3a52">${esc(t)}</p>`).join("");
  const cta = e.cta ? `<a href="${baseUrl}${e.cta.path}" style="display:inline-block;margin-top:8px;padding:14px 22px;border-radius:999px;background:#0f1b2d;color:#fff;font:600 16px Arial,sans-serif;text-decoration:none">${esc(e.cta.label)}</a>` : "";
  return `<div style="background:#f7f2e9;padding:32px 16px"><div style="max-width:520px;margin:auto;background:#fffdf9;border-radius:24px;padding:32px"><div style="font:600 13px Arial;letter-spacing:.2em;color:#9c7a34;text-transform:uppercase">${brand}</div><h1 style="font:600 26px Georgia,serif;color:#0f1b2d;margin:12px 0 18px">${esc(e.title)}</h1>${p}${cta}</div></div>`;
}
