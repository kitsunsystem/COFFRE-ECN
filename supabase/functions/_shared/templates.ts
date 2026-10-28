// E-mail templates, shared by the app (outbox in demo) and the "mailer" Edge Function (Brevo).
// Never put Coffre content in an e-mail: only what the Espace already knows.
// Written in French; each text is looked up whole in the reader's language (MAIL_I18N, generated from src/i18n/*.tsv).
import { MAIL_I18N } from "./i18n.ts";

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
      return { subject: t`Important : un coup dur a été signalé`, title: t`Êtes-vous en sécurité ?`, body: [t`${d.declaredBy} a signalé un coup dur vous concernant.`, t`Si tout va bien, annulez avant le ${when(d.endsAt, true)}. Sinon, vos proches recevront uniquement ce que vous avez prévu pour ce cas.`], cta: { label: t`Tout va bien, j'annule`, path: "/espace/procedures" } };
    case "deces-delai":
      return { subject: t`Important : une procédure vous concerne`, title: t`Si vous lisez ce message, annulez`, body: [t`Une procédure de transmission a été ouverte à votre nom.`, t`Si c'est une erreur, une seule action suffit avant le ${when(d.endsAt, true)}.`], cta: { label: t`Annuler la procédure`, path: "/espace/procedures" } };
    case "acces-ouvert":
      return { subject: t`${d.ownerName} vous a confié des éléments`, title: t`Des éléments vous attendent`, body: [t`${d.ownerName} avait prévu de vous transmettre certains éléments.`, t`Ouvrez-les dans l'application, avec Face ID et votre code, ou avec votre carte. Une liste de démarches et des modèles de courriers vous accompagnent.`, ...(d.until ? [t`L'accès reste ouvert jusqu'au ${when(d.until)}, puis le Coffre sera effacé définitivement : pensez à exporter ce qui vous est utile.`] : [])], cta: { label: t`Ouvrir le Coffre`, path: "/coffre" } };
    case "invitation-porteur":
      return { subject: t`${d.ownerName} vous désigne comme bénéficiaire`, title: t`Validez votre accès`, body: [t`${d.ownerName} vous a désigné comme bénéficiaire. Vous n'ouvrirez que ce qu'il ou elle a choisi de partager avec vous, au moment prévu.`, t`Installez l'application, connectez-vous avec cette adresse et demandez votre accès depuis votre téléphone : Face ID et un code à 6 chiffres. ${d.ownerName} le validera.`, t`Deux cartes sont aussi réservées à votre nom : elles vous seront envoyées le moment venu.`], cta: { label: t`Valider mon accès`, path: "/proche" } };
    case "demande-acces":
      return { subject: t`${d.name} demande l'accès à votre Coffre`, title: t`Une demande d'accès vous attend`, body: [t`${d.name} demande, depuis son téléphone, à pouvoir ouvrir ce que vous lui confiez. Demande faite le ${when(d.date, true)}.`, t`Si c'est bien lui ou elle, acceptez depuis votre Coffre, dans « Qui voit quoi ». Sinon, refusez : rien ne s'ouvre sans votre accord.`], cta: { label: t`Répondre`, path: "/coffre" } };
    case "acces-valide":
      return { subject: t`${d.ownerName} a validé votre accès`, title: t`Votre accès est prêt`, body: [t`${d.ownerName} a accepté votre demande. Dans l'application, avec Face ID et votre code, vous ouvrez ce qu'il ou elle vous confie, au moment prévu.`], cta: { label: t`Ouvrir l'application`, path: "/proche" } };
    case "cartes-beneficiaire":
      return { subject: t`Vos cartes pour le Coffre de ${d.ownerName}`, title: t`Où vous envoyer vos 2 cartes ?`, body: [t`Toutes nos condoléances. ${d.ownerName} vous avait réservé 2 cartes à votre nom.`, t`Indiquez dans l'application l'adresse où les recevoir : elles partent aussitôt et arrivent pendant le délai de vérification. Cette adresse est effacée dès leur envoi.`], cta: { label: t`Indiquer mon adresse`, path: "/proche" } };
    case "invitation-garant":
      return { subject: t`${d.ownerName} compte sur vous`, title: t`Vous êtes garant`, body: [t`${d.ownerName} vous a désigné comme garant. Votre rôle : ${d.role}.`, t`Si un coup dur ou un décès survient, vous pourrez le déclarer depuis votre Espace.`] };
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
