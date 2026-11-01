// Help rubrics of the Espace (brief §3): check-lists, step-by-step, blank letters to download and print.
// General information only — not legal advice; letters are templates to adapt.
import { tr } from "./i18n";

export interface Letter {
  id: string;
  title: string;
  to: string;
  body: string; // [CROCHETS] = à compléter
}
export interface Rubric {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  tone: "coral" | "gold" | "sage" | "ink";
  intro: string;
  profile?: { id: string; label: string }[]; // answers that personalise the check-list
  checklist: { id: string; label: string; when: string; if?: string }[];
  steps: { title: string; body: string }[];
  letters: Letter[];
}

const sign = "\n\nJe vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\n[PRÉNOM NOM]\n[ADRESSE]\n[TÉLÉPHONE]";

export const RUBRICS: Rubric[] = [
  {
    id: "hospitalisation",
    title: "Hospitalisation",
    tagline: "Organiser les premiers jours, sereinement",
    icon: "BedDouble",
    tone: "coral",
    intro: "Une hospitalisation, prévue ou non, laisse peu de temps. Voici l'essentiel à faire, dans l'ordre, pour la personne hospitalisée et pour ceux qui l'entourent.",
    checklist: [
      { id: "h1", label: "Prévenir les personnes à contacter", when: "Le jour même" },
      { id: "h2", label: "Apporter carte d'identité, carte vitale, carte de mutuelle", when: "Le jour même" },
      { id: "h3", label: "Transmettre la liste des traitements en cours", when: "Le jour même" },
      { id: "h4", label: "Prévenir l'employeur et envoyer l'arrêt de travail", when: "Sous 48 heures" },
      { id: "h5", label: "Organiser la garde des enfants et des animaux", when: "Sous 48 heures" },
      { id: "h6", label: "Vérifier les factures et prélèvements à venir", when: "La première semaine" },
      { id: "h7", label: "Contacter la mutuelle pour la prise en charge", when: "La première semaine" },
      { id: "h8", label: "Si un proche doit agir : sa demande d'ouverture « coup dur », avec le bulletin d'hospitalisation", when: "Dès que nécessaire" },
    ],
    steps: [
      { title: "Rassembler les papiers", body: "Pièce d'identité, carte vitale, carte de mutuelle, ordonnances. Si la personne a un Coffre, ses proches autorisés y trouvent l'essentiel dans « Urgence et santé »." },
      { title: "Informer l'employeur", body: "L'arrêt de travail doit être transmis rapidement. Le modèle de courrier ci-dessous vous aide à le faire." },
      { title: "Penser au quotidien", body: "Enfants, animaux, courrier, factures : désignez une personne pour chaque sujet." },
      { title: "Préparer la sortie", body: "Renseignez-vous sur les aides au retour à domicile auprès du service social de l'hôpital. Le guide « Retour à domicile ou prise en charge longue » vous accompagne." },
    ],
    letters: [
      { id: "employeur-arret", title: "Information de l'employeur", to: "Employeur", body: "Objet : arrêt de travail\n\nMadame, Monsieur,\n\nJe vous informe que [PRÉNOM NOM] est hospitalisé(e) depuis le [DATE] et se trouve en arrêt de travail. L'avis d'arrêt vous sera transmis dans les délais.\n\nPour toute question, vous pouvez me joindre au [TÉLÉPHONE]." + sign },
      { id: "mutuelle-prise-en-charge", title: "Demande de prise en charge", to: "Mutuelle", body: "Objet : demande de prise en charge hospitalière\n\nMadame, Monsieur,\n\nAdhérent(e) n° [NUMÉRO], je vous informe de mon hospitalisation à [ÉTABLISSEMENT] depuis le [DATE] et vous remercie de bien vouloir adresser une prise en charge à l'établissement." + sign },
    ],
  },
  {
    id: "accident",
    title: "Accident",
    tagline: "Les bons réflexes, étape par étape",
    icon: "Siren",
    tone: "coral",
    intro: "Après un accident, l'urgence passe d'abord. Ensuite viennent les déclarations et les démarches : ne restez pas seul pour les faire.",
    checklist: [
      { id: "a1", label: "Appeler les secours et prévenir un proche", when: "Immédiatement" },
      { id: "a2", label: "Rassembler les témoignages et photos si possible", when: "Le jour même" },
      { id: "a3", label: "Déclarer le sinistre à l'assureur", when: "Sous 5 jours ouvrés" },
      { id: "a4", label: "Conserver les justificatifs de frais", when: "En continu" },
      { id: "a5", label: "Prévenir l'employeur", when: "Sous 48 heures" },
      { id: "a6", label: "Si un proche doit agir pour vous : sa demande d'ouverture « coup dur », avec un justificatif", when: "Dès que possible" },
    ],
    steps: [
      { title: "Sécuriser", body: "Mettez-vous en sécurité, appelez le 112. Les personnes à prévenir figurent dans votre fiche d'urgence." },
      { title: "Déclarer", body: "La plupart des contrats exigent une déclaration rapide. Utilisez le modèle ci-dessous." },
      { title: "Se faire aider", body: "Si vous ne pouvez pas gérer vos affaires, un proche autorisé fait une demande d'ouverture avec un justificatif : après vérification par notre équipe, il accède seulement à ce que vous avez prévu pour ce cas, un temps limité." },
    ],
    letters: [
      { id: "declaration-sinistre", title: "Déclaration de sinistre", to: "Assureur", body: "Objet : déclaration de sinistre — contrat n° [NUMÉRO]\n\nMadame, Monsieur,\n\nJe vous déclare l'accident survenu le [DATE] à [LIEU], dans les circonstances suivantes : [CIRCONSTANCES].\n\nJe tiens à votre disposition les justificatifs et témoignages et vous remercie de m'indiquer la suite de la procédure." + sign },
    ],
  },
  {
    id: "retour-domicile",
    title: "Retour à domicile ou prise en charge longue",
    tagline: "Après l'hôpital, organiser la suite",
    icon: "House",
    tone: "sage",
    intro: "Après une hospitalisation, deux chemins : rentrer chez soi avec de l'aide, ou une prise en charge plus longue (soins de réadaptation, établissement). Voici comment organiser l'un ou l'autre, sans rien oublier.",
    profile: [
      { id: "domicile", label: "Retour à domicile" },
      { id: "etablissement", label: "Prise en charge en établissement" },
    ],
    checklist: [
      { id: "r1", label: "Rencontrer l'assistante sociale de l'hôpital avant la sortie", when: "Avant la sortie" },
      { id: "r2", label: "Demander les ordonnances de sortie : soins, matériel, transport", when: "Avant la sortie" },
      { id: "r3", label: "Organiser les soins à domicile (infirmier, kinésithérapeute)", when: "Avant la sortie", if: "domicile" },
      { id: "r4", label: "Louer le matériel médical prescrit (lit, fauteuil)", when: "Avant la sortie", if: "domicile" },
      { id: "r5", label: "Mettre en place une aide à domicile et le portage des repas", when: "La première semaine", if: "domicile" },
      { id: "r6", label: "Visiter les établissements et comparer les tarifs", when: "Avant la sortie", if: "etablissement" },
      { id: "r7", label: "Remplir le dossier unique d'admission en établissement", when: "Avant la sortie", if: "etablissement" },
      { id: "r8", label: "Demander l'aide sociale à l'hébergement et les aides au logement", when: "Le premier mois", if: "etablissement" },
      { id: "r9", label: "Prévenir la mutuelle et vérifier la prise en charge", when: "La première semaine" },
      { id: "r10", label: "Demander l'allocation personnalisée d'autonomie au département (60 ans et plus)", when: "Le premier mois" },
      { id: "r11", label: "Garder les prélèvements « à maintenir en cas de coup dur » (étiquettes du Coffre)", when: "Le premier mois" },
    ],
    steps: [
      { title: "Préparer la sortie", body: "Le service social de l'hôpital oriente vers les aides et organise souvent les premiers soins à domicile, ou une place en soins médicaux et de réadaptation." },
      { title: "Rentrer chez soi", body: "Soins infirmiers, matériel médical sur ordonnance, aide à domicile, portage des repas : la mairie et le département renseignent sur les aides." },
      { title: "Une prise en charge longue", body: "Résidence autonomie ou établissement médicalisé : un dossier unique d'admission sert pour plusieurs établissements. Comparez les tarifs et les aides possibles." },
      { title: "Garder la main sur les papiers", body: "Si un proche doit agir pour vous, il s'appuie sur une procuration ou un mandat de protection future. Le Coffre indique où les trouver." },
    ],
    letters: [
      { id: "aide-domicile", title: "Demande d'aide à domicile", to: "Mairie ou centre communal d'action sociale", body: "Objet : demande d'aide à domicile\n\nMadame, Monsieur,\n\n[PRÉNOM NOM], né(e) le [DATE], demeurant [ADRESSE], sort d'hospitalisation le [DATE] et a besoin d'une aide à domicile (ménage, courses, repas).\n\nJe vous remercie de m'indiquer les aides possibles et les démarches à suivre." + sign },
      { id: "admission-etablissement", title: "Demande d'admission", to: "Établissement", body: "Objet : demande d'admission\n\nMadame, Monsieur,\n\nJe sollicite une place pour [PRÉNOM NOM], né(e) le [DATE], actuellement hospitalisé(e) à [ÉTABLISSEMENT], à compter du [DATE].\n\nVous trouverez ci-joint le dossier unique d'admission. Je reste à votre disposition pour une visite." + sign },
    ],
  },
  {
    id: "perte-autonomie",
    title: "Perte d'autonomie",
    tagline: "Accompagner un proche, sans s'épuiser",
    icon: "HandHeart",
    tone: "sage",
    intro: "Quand un parent perd en autonomie, les questions s'accumulent : aides, logement, gestion des papiers. Le Coffre ne donne aucun pouvoir légal : pour agir au nom d'un proche, il faut une procuration, un mandat de protection future ou une mesure décidée par le juge. « Mes démarches de protection » dit quoi préparer.",
    checklist: [
      { id: "p1", label: "Faire le point sur les besoins au quotidien", when: "Au début" },
      { id: "p2", label: "Se renseigner sur les aides disponibles", when: "Au début" },
      { id: "p3", label: "Rassembler contrats, comptes et abonnements", when: "Le premier mois" },
      { id: "p4", label: "Préparer une procuration ou un mandat de protection future (« Mes démarches de protection »)", when: "Le premier mois" },
      { id: "p5", label: "Activer les alertes d'échéance de ses documents", when: "Le premier mois" },
    ],
    steps: [
      { title: "Évaluer", body: "Listez ce qui pose problème : courses, papiers, santé, sécurité du logement." },
      { title: "S'informer", body: "Les services sociaux de la commune et le médecin traitant orientent vers les aides." },
      { title: "Organiser", body: "Un enfant peut ouvrir et gérer le Coffre de son parent, sur la base d'une procuration signée. Le Coffre reste celui du parent, avec ses propres cartes." },
      { title: "Protéger", body: "Pour une perte d'autonomie durable, une mesure de protection se met en place : le mandat de protection future, s'il a été signé, ou une demande au juge des contentieux de la protection. Les « démarches de protection » de l'Espace disent quoi préparer de son vivant." },
    ],
    letters: [
      { id: "procuration-coffre", title: "Procuration pour gérer le Coffre", to: "À conserver", body: "PROCURATION\n\nJe soussigné(e) [PRÉNOM NOM DU PARENT], né(e) le [DATE] à [LIEU], demeurant [ADRESSE],\n\ndonne procuration à [PRÉNOM NOM DE L'ENFANT], né(e) le [DATE] à [LIEU], pour ouvrir et gérer en mon nom mon Coffre, compléter et mettre à jour son contenu, et gérer mes cartes.\n\nCette procuration ne vaut ni pour mes comptes bancaires ni pour aucun acte juridique.\n\nFait à [VILLE], le [DATE].\n\nSignature précédée de « Bon pour procuration » :\n\n\nModèle indicatif, à adapter à votre situation." },
    ],
  },
  {
    id: "apres-deces",
    title: "Après un décès",
    tagline: "Les démarches, une par une",
    icon: "Flower2",
    tone: "gold",
    intro: "Perdre un proche est une épreuve. Les démarches sont nombreuses mais toutes ne sont pas urgentes. Répondez à quelques questions : la liste s'adapte à votre situation, dans l'ordre où faire les choses.",
    profile: [
      { id: "salarie", label: "Il ou elle travaillait" },
      { id: "retraite", label: "Retraité(e)" },
      { id: "proprio", label: "Propriétaire" },
      { id: "vehicule", label: "Un véhicule" },
      { id: "entreprise", label: "Chef d'entreprise" },
      { id: "enfants", label: "Des enfants mineurs" },
    ],
    checklist: [
      { id: "d1", label: "Faire constater le décès par un médecin et obtenir le certificat", when: "Les premiers jours" },
      { id: "d2", label: "Déclarer le décès en mairie (souvent fait par les pompes funèbres)", when: "Sous 24 heures" },
      { id: "d3", label: "Contacter les pompes funèbres et consulter ses volontés dans le Coffre", when: "Les premiers jours" },
      { id: "d4", label: "Demander plusieurs actes de décès à la mairie", when: "Les premiers jours" },
      { id: "d5", label: "Prévenir l'employeur", when: "Les premiers jours", if: "salarie" },
      { id: "d6", label: "Prévenir les banques", when: "Les premières semaines" },
      { id: "d7", label: "Prévenir la caisse de retraite et la complémentaire", when: "Les premières semaines", if: "retraite" },
      { id: "d8", label: "Prévenir l'Assurance maladie et la mutuelle", when: "Les premières semaines" },
      { id: "d9", label: "Prévenir les assureurs et les assureurs vie", when: "Les premières semaines" },
      { id: "d10", label: "Prévenir les associés, la banque professionnelle et le greffe", when: "Les premières semaines", if: "entreprise" },
      { id: "d11", label: "Organiser la garde ou la tutelle des enfants mineurs", when: "Les premières semaines", if: "enfants" },
      { id: "d12", label: "Résilier ou transférer les abonnements (téléphone, énergie, internet)", when: "Les premiers mois" },
      { id: "d13", label: "Ouvrir la succession : acte de notoriété, et attestation immobilière s'il y a un bien immobilier", when: "Les premiers mois", if: "proprio" },
      { id: "d14", label: "Changer la carte grise ou vendre le véhicule", when: "Les premiers mois", if: "vehicule" },
      { id: "d15", label: "Déposer la déclaration de succession, si elle est due", when: "Dans les 6 mois" },
      { id: "d16", label: "Déclarer les revenus du défunt, avec la déclaration annuelle de l'année suivante", when: "L'année suivante" },
    ],
    steps: [
      { title: "Les premiers jours", body: "Certificat de décès, déclaration en mairie, organisation des obsèques. Si votre proche avait un Coffre, ses volontés pour les obsèques vous attendent peut-être." },
      { title: "Les premières semaines", body: "Banques, employeur ou caisse de retraite, assurances : chaque organisme a besoin d'un acte de décès. Commandez-en plusieurs exemplaires." },
      { title: "Les premiers mois", body: "Quand la succession comprend un bien immobilier ou un testament, elle se règle par actes authentiques. Les abonnements peuvent être résiliés avec les modèles ci-dessous." },
      { title: "Se faire aider", body: "Alma répond à vos questions sur les démarches et les délais. Si elle ne peut pas, la conciergerie peut les prendre en charge sur ticket, un service payant à part." },
    ],
    letters: [
      { id: "banque-deces", title: "Information d'une banque", to: "Banque", body: "Objet : décès de [PRÉNOM NOM DU DÉFUNT]\n\nMadame, Monsieur,\n\nJ'ai le regret de vous informer du décès de [PRÉNOM NOM], survenu le [DATE], titulaire chez vous du ou des comptes [NUMÉROS].\n\nJe vous remercie de bien vouloir me faire connaître les pièces nécessaires au règlement de la succession. Vous trouverez ci-joint un acte de décès." + sign },
      { id: "assurance-vie-deces", title: "Demande à un assureur vie", to: "Assureur", body: "Objet : contrat d'assurance-vie n° [NUMÉRO] — décès de l'assuré\n\nMadame, Monsieur,\n\nJe vous informe du décès de [PRÉNOM NOM], assuré(e) au titre du contrat n° [NUMÉRO], survenu le [DATE]. En qualité de bénéficiaire, je vous remercie de m'indiquer les pièces à fournir pour le versement des capitaux." + sign },
      { id: "resiliation-deces", title: "Résiliation d'un abonnement", to: "Opérateur ou fournisseur", body: "Objet : résiliation pour cause de décès — client n° [NUMÉRO]\n\nMadame, Monsieur,\n\nSuite au décès de [PRÉNOM NOM], titulaire du contrat n° [NUMÉRO], survenu le [DATE], je vous demande la résiliation de ce contrat à compter de la date du décès et l'arrêt des prélèvements. Vous trouverez ci-joint un acte de décès." + sign },
      { id: "employeur-deces", title: "Information de l'employeur", to: "Employeur ou caisse de retraite", body: "Objet : décès de [PRÉNOM NOM]\n\nMadame, Monsieur,\n\nJe vous informe du décès de [PRÉNOM NOM], [FONCTION / N° DE PENSION], survenu le [DATE]. Je vous remercie de m'indiquer les démarches à accomplir et les sommes éventuellement dues." + sign },
    ],
  },
];

export const rubric = (id: string) => RUBRICS.find((r) => r.id === id);
// Personalised check-list: items tied to a profile answer only show when that answer is ticked.
export const checklistFor = (r: Rubric, checks: Record<string, boolean>) => r.checklist.filter((c) => !c.if || checks[`${r.id}:profil:${c.if}`]);

const rtfEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/[{}]/g, (c) => `\\${c}`).replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0)}?`).replace(/\n/g, "\\par\n");

// Blank letters download as .rtf: opens in Word, LibreOffice, Pages — nothing is uploaded, ever.
export function downloadLetter(l: Letter) {
  const body = l.body.endsWith(sign) ? tr(l.body.slice(0, -sign.length)) + tr(sign) : tr(l.body);
  const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Georgia;}}\\f0\\fs24\\sa200 ${rtfEscape(body)}}`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rtf], { type: "application/rtf" }));
  a.download = `${l.id}.rtf`;
  a.click();
  URL.revokeObjectURL(a.href);
}
