// E-mail templates, shared by the app (outbox in demo) and the "mailer" Edge Function (Brevo).
// Never put Coffre content in an e-mail: only what the Espace already knows.
// Written in French; each text is looked up whole in the reader's language (MAIL_I18N, generated from src/i18n/*.tsv).
import { MAIL_I18N } from "./i18n.ts";

export type TemplateId =
  | "bienvenue"
  | "relance"
  | "echeance"
  | "coup-dur-declare"
  | "coup-dur-ouvert"
  | "coup-dur-acces"
  | "coup-dur-ferme"
  | "deces-delai"
  | "acces-ouvert"
  | "proches-sans-compte"
  | "verifier-infos"
  | "protection"
  | "partenaire-valide"
  | "partenaire-refuse"
  | "retrait-reussi"
  | "retrait-refuse"
  | "cartes-commandees"
  | "a-jour"
  | "impaye"
  | "acces-fin"
  | "nouvel-appareil"
  | "demande-acces"
  | "acces-valide"
  | "cartes-beneficiaire";

export type MailLang = "fr" | "en" | "es" | "ca";

export interface Email {
  subject: string;
  title: string;
  body: string[];
  cta?: { label: string; path: string };
}

const brand = "Sillage";
const LOCALES: Record<MailLang, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES", ca: "ca-ES" };

let dict: Record<string, string> = {};
let locale = LOCALES.fr;

// t`Bienvenue, ${name}` → the "Bienvenue, {0}" line of the dictionary, with the name put back.
const t = (s: TemplateStringsArray, ...v: unknown[]) => {
  const key = s.reduce((a, part, i) => a + `{${i - 1}}` + part);
  return (dict[key] ?? key).replace(/\{(\d+)\}/g, (_, i) => String(v[+i] ?? ""));
};

// Dates travel as ISO strings and are written in the reader's language; any other text is kept as it is.
const when = (v: string | undefined, time = false) => {
  const d = v && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v) : null;
  return d && !isNaN(+d) ? d.toLocaleString(locale, { dateStyle: "long", ...(time ? { timeStyle: "short" } : {}), timeZone: "Europe/Paris" }) : (v ?? "");
};

function use(lang: string) {
  dict = MAIL_I18N[lang] ?? {};
  locale = LOCALES[lang as MailLang] ?? LOCALES.fr;
}

export function render(id: TemplateId, d: Record<string, string> = {}, lang = "fr"): Email {
  use(lang);
  const motif = ({ hospitalisation: t`Hospitalisation`, coma: t`Coma`, incapacite: t`Incapacité` } as Record<string, string>)[d.motif] ?? d.motif;
  switch (id) {
    case "bienvenue":
      return { subject: t`Bienvenue chez ${brand}`, title: t`Bienvenue, ${d.firstName}`, body: [t`Votre Espace est prêt. Prochaines étapes : vos cartes, vos bénéficiaires, puis l'essentiel de votre Coffre, à votre rythme.`], cta: { label: t`Ouvrir mon Espace`, path: "/espace" } };
    case "relance":
      return { subject: t`Deux minutes pour votre famille`, title: t`Votre famille est protégée à ${d.score} %`, body: [t`Une seule chose à faire aujourd'hui : ${d.next}.`, t`Cela prend moins de deux minutes.`], cta: { label: t`Continuer`, path: "/coffre" } };
    case "echeance":
      return { subject: t`${d.label} : échéance le ${when(d.date)}`, title: t`Pensez à le renouveler`, body: [t`${d.label} arrive à échéance le ${when(d.date)}.`, t`Une fois renouvelé, mettez à jour la date dans votre Espace et le document dans votre Coffre.`], cta: { label: t`Mes échéances`, path: "/espace/echeances" } };
    case "a-jour":
      return { subject: t`Tout est-il à jour ?`, title: t`Un petit point sur votre Coffre`, body: [t`Un changement de banque, un nouveau contrat, un déménagement ? Prenez deux minutes pour vérifier que votre Coffre et vos échéances sont à jour.`], cta: { label: t`Vérifier`, path: "/espace" } };
    case "impaye":
      return { subject: t`Votre abonnement n'est pas réglé`, title: t`Votre Coffre sera effacé sans régularisation`, body: [t`Nous n'avons pas reçu votre paiement. Sans régularisation avant le ${when(d.until)}, votre Coffre et tout son contenu seront effacés définitivement.`], cta: { label: t`Régulariser`, path: "/espace/compte" } };
    case "acces-fin":
      return { subject: t`Le Coffre de ${d.ownerName} sera bientôt effacé`, title: t`Récupérez ce qui vous a été confié`, body: [t`Le Coffre de ${d.ownerName} reste ouvert jusqu'au ${when(d.until)}. Ensuite, il sera effacé définitivement.`, t`Ouvrez-le dans l'application, avec votre téléphone ou votre carte, et exportez ce qui vous a été confié.`], cta: { label: t`Ouvrir le Coffre`, path: "/coffre" } };
    case "coup-dur-declare":
      return { subject: t`Important : un proche demande l'ouverture pour un coup dur`, title: t`Êtes-vous en sécurité ?`, body: [t`${d.declaredBy} demande l'ouverture de ce que vous avez prévu pour lui ou elle en cas de coup dur. Motif : ${motif}.`, t`Notre équipe vérifie son justificatif et son identité avant toute ouverture.`, t`Si tout va bien, refusez la demande dès maintenant : rien ne s'ouvrira.`], cta: { label: t`Tout va bien, je refuse`, path: "/espace/procedures" } };
    case "coup-dur-ouvert":
      return { subject: t`Un accès coup dur a été ouvert`, title: t`${d.declaredBy} peut ouvrir sa part`, body: [t`Notre équipe a vérifié la demande de ${d.declaredBy} : justificatif, pièce d'identité et visage.`, t`${d.declaredBy} peut ouvrir ce que vous avez prévu pour lui ou elle en cas de coup dur, jusqu'au ${when(d.until)}, et personne d'autre.`, t`Si vous allez mieux, fermez l'accès à tout moment.`], cta: { label: t`Fermer l'accès`, path: "/espace/procedures" } };
    case "coup-dur-acces":
      return { subject: t`Votre accès au Coffre de ${d.ownerName} est ouvert`, title: t`Votre demande est validée`, body: [t`Notre équipe a validé votre demande. Vous pouvez ouvrir ce que ${d.ownerName} a prévu pour vous en cas de coup dur, jusqu'au ${when(d.until)}.`, t`Ouvrez-le dans l'application, avec Face ID et votre code.`], cta: { label: t`Ouvrir l'application`, path: "/proche" } };
    case "coup-dur-ferme":
      return { subject: t`Accès coup dur fermé : Coffre de ${d.ownerName}`, title: t`L'accès est fermé`, body: [t`Votre accès coup dur au Coffre de ${d.ownerName} est fermé, ou votre demande n'a pas été validée.`, t`Si la situation l'exige encore, vous pouvez faire une nouvelle demande depuis l'application.`], cta: { label: t`Ouvrir l'application`, path: "/proche" } };
    case "proches-sans-compte":
      return { subject: t`Vos proches n'ont pas encore leur compte`, title: t`Relancez-les en un geste`, body: [t`Ces proches n'ont pas encore créé leur compte : ${d.names}.`, t`Sans compte, ils ne pourront rien ouvrir, même le moment venu. Renvoyez-leur l'invitation depuis votre Espace, dans « Famille ».`], cta: { label: t`Ma famille`, path: "/espace/famille" } };
    case "verifier-infos":
      return { subject: t`${d.ownerName} compte sur vous : tout est-il à jour ?`, title: t`Un petit point sur votre accès`, body: [t`${d.ownerName} vous a désigné parmi ses proches. Vérifiez que votre adresse e-mail est toujours la bonne et que l'application est installée sur votre téléphone actuel.`, t`Changé de téléphone ? Demandez de nouveau votre accès depuis l'application : ${d.ownerName} le validera.`], cta: { label: t`Vérifier`, path: "/proche" } };
    case "protection":
      return { subject: t`Vos démarches de protection`, title: t`Il reste des démarches à faire`, body: [t`Démarches restant à faire de votre vivant : ${d.count} sur ${d.total}.`, t`C'est ce qui permet à vos proches d'agir en cas de coup dur. Chaque démarche indique pourquoi elle compte, où aller et quoi apporter. Cochez « C'est fait » ou « Pas concerné ».`], cta: { label: t`Mes démarches`, path: "/espace/protection" } };
    case "deces-delai":
      return { subject: t`Important : une procédure vous concerne`, title: t`Si vous lisez ce message, annulez`, body: [t`Une procédure de transmission a été ouverte à votre nom.`, t`Si c'est une erreur, une seule action suffit avant le ${when(d.endsAt, true)}.`], cta: { label: t`Annuler la procédure`, path: "/espace/procedures" } };
    case "acces-ouvert":
      return { subject: t`${d.ownerName} vous a confié des éléments`, title: t`Des éléments vous attendent`, body: [t`${d.ownerName} avait prévu de vous transmettre certains éléments.`, t`Ouvrez-les dans l'application, avec Face ID et votre code, ou avec votre carte. Une liste de démarches et des modèles de courriers vous accompagnent.`, ...(d.until ? [t`L'accès reste ouvert jusqu'au ${when(d.until)}, puis le Coffre sera effacé définitivement : pensez à exporter ce qui vous est utile.`] : [])], cta: { label: t`Ouvrir le Coffre`, path: "/coffre" } };
    case "demande-acces":
      return { subject: t`${d.name} demande l'accès à votre Coffre`, title: t`Une demande d'accès vous attend`, body: [t`${d.name} demande, depuis son téléphone, à pouvoir ouvrir ce que vous lui confiez. Demande faite le ${when(d.date, true)}.`, t`Si c'est bien lui ou elle, acceptez depuis votre Coffre, dans « Qui voit quoi ». Sinon, refusez : rien ne s'ouvre sans votre accord.`], cta: { label: t`Répondre`, path: "/coffre" } };
    case "acces-valide":
      return { subject: t`${d.ownerName} a validé votre accès`, title: t`Votre accès est prêt`, body: [t`${d.ownerName} a accepté votre demande. Dans l'application, avec Face ID et votre code, vous ouvrez ce qu'il ou elle vous confie, au moment prévu.`], cta: { label: t`Ouvrir l'application`, path: "/proche" } };
    case "cartes-beneficiaire":
      return { subject: t`Vos cartes pour le Coffre de ${d.ownerName}`, title: t`Où vous envoyer vos 2 cartes ?`, body: [t`Toutes nos condoléances. ${d.ownerName} vous avait réservé 2 cartes à votre nom.`, t`Indiquez dans l'application l'adresse où les recevoir : elles partent aussitôt et arrivent pendant le délai de vérification. Cette adresse est effacée dès leur envoi.`], cta: { label: t`Indiquer mon adresse`, path: "/proche" } };
    case "partenaire-valide":
      return { subject: t`Vous êtes partenaire`, title: t`Bienvenue dans le programme partenaires`, body: [t`Votre candidature est acceptée. Votre code de parrainage : ${d.code}.`, t`Dans votre espace partenaire : votre lien à partager, la répartition de vos 25 % entre vos ventes directes et celles de vos filleuls, vos commissions et vos retraits.`], cta: { label: t`Mon espace partenaire`, path: "/espace/partenaire" } };
    case "partenaire-refuse":
      return { subject: t`Votre candidature partenaire`, title: t`Candidature non retenue`, body: [t`Votre candidature au programme partenaires n'a pas été retenue pour le moment. Vous pourrez candidater de nouveau depuis votre Espace.`], cta: { label: t`Mon espace partenaire`, path: "/espace/partenaire" } };
    case "retrait-reussi":
      return { subject: t`Votre retrait de ${d.amount} ${d.currency} est effectué`, title: t`Retrait effectué`, body: [t`Votre retrait de ${d.amount} ${d.currency} a été envoyé. Selon le moyen choisi, il peut mettre quelques jours à arriver.`], cta: { label: t`Mon espace partenaire`, path: "/espace/partenaire" } };
    case "retrait-refuse":
      return { subject: t`Votre demande de retrait`, title: t`Retrait non effectué`, body: [t`Votre demande de retrait de ${d.amount} ${d.currency} n'a pas pu être traitée : le montant reste sur votre solde. Vérifiez vos coordonnées et refaites la demande, ou écrivez au support.`], cta: { label: t`Mon espace partenaire`, path: "/espace/partenaire" } };
    case "cartes-commandees":
      return { subject: t`Vos cartes sont en fabrication`, title: t`Vos cartes arrivent`, body: [t`${d.count} cartes sont en fabrication. Dès réception, posez-les sur votre téléphone pour les activer.`] };
    case "nouvel-appareil":
      return { subject: t`Nouvel appareil de confiance`, title: t`Un ordinateur peut ouvrir votre Coffre`, body: [t`« ${d.name} » a été approuvé depuis votre téléphone le ${when(d.date, true)}. Il pourra demander l'ouverture du Coffre, toujours avec votre carte et votre accord sur le téléphone.`, t`Ce n'est pas vous ? Retirez-le tout de suite dans Compte › Appareils de confiance, puis changez votre mot de passe.`], cta: { label: t`Mes appareils`, path: "/espace/compte" } };
  }
}

// Notification on the phone when a trusted computer asks for the Coffre (same languages as the e-mails).
export function pushMessage(deviceName: string, lang = "fr") {
  use(lang);
  return { title: t`Ouverture du Coffre demandée`, body: t`${deviceName} attend votre accord. Touchez pour répondre.` };
}

// Names come from users: escape everything that goes into the HTML.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function toHtml(e: Email, baseUrl: string) {
  const p = e.body.map((t) => `<p style="margin:0 0 14px;font:17px/1.6 Arial,sans-serif;color:#2a3a52">${esc(t)}</p>`).join("");
  const cta = e.cta ? `<a href="${baseUrl}${e.cta.path}" style="display:inline-block;margin-top:8px;padding:14px 22px;border-radius:999px;background:#0f1b2d;color:#fff;font:600 16px Arial,sans-serif;text-decoration:none">${esc(e.cta.label)}</a>` : "";
  return `<div style="background:#f7f2e9;padding:32px 16px"><div style="max-width:520px;margin:auto;background:#fffdf9;border-radius:24px;padding:32px"><div style="font:600 13px Arial;letter-spacing:.2em;color:#9c7a34;text-transform:uppercase">${brand}</div><h1 style="font:600 26px Georgia,serif;color:#0f1b2d;margin:12px 0 18px">${esc(e.title)}</h1>${p}${cta}</div></div>`;
}
