// Help rubrics of the Espace (brief §3): check-lists, step-by-step, blank letters to download and print.
// General information only — not legal advice; letters are templates to adapt.

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
    ],
    steps: [
      { title: "Rassembler les papiers", body: "Pièce d'identité, carte vitale, carte de mutuelle, ordonnances. Si la personne a un Coffre, ses proches autorisés y trouvent l'essentiel dans « Urgence et santé »." },
      { title: "Informer l'employeur", body: "L'arrêt de travail doit être transmis rapidement. Le modèle de courrier ci-dessous vous aide à le faire." },
      { title: "Penser au quotidien", body: "Enfants, animaux, courrier, factures : désignez une personne pour chaque sujet." },
      { title: "Préparer la sortie", body: "Renseignez-vous sur les aides au retour à domicile auprès du service social de l'hôpital." },
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
      { id: "a6", label: "Signaler le coup dur à vos garants", when: "Dès que possible" },
    ],
    steps: [
      { title: "Sécuriser", body: "Mettez-vous en sécurité, appelez le 112. Les personnes à prévenir figurent dans votre fiche d'urgence." },
      { title: "Déclarer", body: "La plupart des contrats exigent une déclaration rapide. Utilisez le modèle ci-dessous." },
      { title: "Se faire aider", body: "Si vous ne pouvez pas gérer vos affaires, un garant peut déclarer un coup dur : vos proches autorisés accèdent alors seulement à ce que vous avez prévu pour ce cas." },
    ],
    letters: [
      { id: "declaration-sinistre", title: "Déclaration de sinistre", to: "Assureur", body: "Objet : déclaration de sinistre — contrat n° [NUMÉRO]\n\nMadame, Monsieur,\n\nJe vous déclare l'accident survenu le [DATE] à [LIEU], dans les circonstances suivantes : [CIRCONSTANCES].\n\nJe tiens à votre disposition les justificatifs et témoignages et vous remercie de m'indiquer la suite de la procédure." + sign },
    ],
  },
  {
    id: "perte-autonomie",
    title: "Perte d'autonomie",
    tagline: "Accompagner un proche, sans s'épuiser",
    icon: "HandHeart",
    tone: "sage",
    intro: "Quand un parent perd en autonomie, les questions s'accumulent : aides, logement, gestion des papiers. Le Coffre ne donne aucun pouvoir légal : pour agir au nom d'un proche, une mesure adaptée se met en place avec un professionnel.",
    checklist: [
      { id: "p1", label: "Faire le point sur les besoins au quotidien", when: "Au début" },
      { id: "p2", label: "Se renseigner sur les aides disponibles", when: "Au début" },
      { id: "p3", label: "Rassembler contrats, comptes et abonnements", when: "Le premier mois" },
      { id: "p4", label: "Parler d'une procuration ou d'une mesure de protection avec un professionnel", when: "Le premier mois" },
      { id: "p5", label: "Activer les alertes d'échéance de ses documents", when: "Le premier mois" },
    ],
    steps: [
      { title: "Évaluer", body: "Listez ce qui pose problème : courses, papiers, santé, sécurité du logement." },
      { title: "S'informer", body: "Les services sociaux de la commune et le médecin traitant orientent vers les aides." },
      { title: "Organiser", body: "Un enfant peut ouvrir et gérer le Coffre de son parent, sur la base d'une procuration signée. Le Coffre reste celui du parent, avec ses propres cartes." },
      { title: "Protéger", body: "Pour une perte d'autonomie durable, une mesure de protection juridique se met en place avec un notaire ou un avocat." },
    ],
    letters: [
      { id: "procuration-coffre", title: "Procuration pour gérer le Coffre", to: "À conserver", body: "PROCURATION\n\nJe soussigné(e) [PRÉNOM NOM DU PARENT], né(e) le [DATE] à [LIEU], demeurant [ADRESSE],\n\ndonne procuration à [PRÉNOM NOM DE L'ENFANT], né(e) le [DATE] à [LIEU], pour ouvrir et gérer en mon nom mon Coffre, compléter et mettre à jour son contenu, et gérer mes cartes.\n\nCette procuration ne vaut ni pour mes comptes bancaires ni pour aucun acte juridique.\n\nFait à [VILLE], le [DATE].\n\nSignature précédée de « Bon pour procuration » :\n\n\nModèle à faire valider par un avocat avant usage." },
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
      { id: "d2", label: "Déclarer le décès en mairie (souvent fait par les pompes funèbres)", when: "Les premiers jours" },
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
      { id: "d13", label: "Ouvrir la succession chez un notaire (obligatoire pour un bien immobilier)", when: "Les premiers mois", if: "proprio" },
      { id: "d14", label: "Changer la carte grise ou vendre le véhicule", when: "Les premiers mois", if: "vehicule" },
      { id: "d15", label: "Déclarer les revenus du défunt (dans les 6 mois)", when: "Les premiers mois" },
    ],
    steps: [
      { title: "Les premiers jours", body: "Certificat de décès, déclaration en mairie, organisation des obsèques. Si votre proche avait un Coffre, ses volontés pour les obsèques vous attendent peut-être." },
      { title: "Les premières semaines", body: "Banques, employeur ou caisse de retraite, assurances : chaque organisme a besoin d'un acte de décès. Commandez-en plusieurs exemplaires." },
      { title: "Les premiers mois", body: "Le notaire règle la succession quand elle comprend un bien immobilier ou un testament. Les abonnements peuvent être résiliés avec les modèles ci-dessous." },
      { title: "Se faire aider", body: "La conciergerie peut prendre en charge ces démarches pour vous, sur mandat." },
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
  const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Georgia;}}\\f0\\fs24\\sa200 ${rtfEscape(l.body)}}`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rtf], { type: "application/rtf" }));
  a.download = `${l.id}.rtf`;
  a.click();
  URL.revokeObjectURL(a.href);
}
