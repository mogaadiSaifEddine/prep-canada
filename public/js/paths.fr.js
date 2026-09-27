// Parcours d’immigration au Canada, présentés comme des cartes d’étapes (version française).
// Vérifié auprès des pages officielles d’IRCC et du Québec et des données récentes des rondes le 27 septembre 2026.
// Les règles changent souvent : chaque étape renvoie à la page officielle, et l’application affiche la date de vérification.

export const CHECKED = '27 septembre 2026';

const L = {
  ee: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html',
  eeApply: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence.html',
  fsw: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html',
  cec: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/canadian-experience-class.html',
  cats: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html',
  crs: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html',
  crsTool: 'https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp',
  rounds: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html',
  funds: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html',
  eca: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/education-assessed.html',
  lang: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-requirements.html',
  police: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/police-certificates.html',
  medical: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/medical-police/medical-exams/requirements-permanent-residents.html',
  panel: 'https://secure.cic.gc.ca/pp-md/pp-list.aspx',
  bio: 'https://www.canada.ca/en/immigration-refugees-citizenship/campaigns/biometrics.html',
  fees: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices/permanent-residence-fees-increasing.html',
  times: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html',
  landing: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/prepare-life-canada/prepare-travel.html',
  pnp: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html',
  pstq: 'https://www.quebec.ca/en/immigration/permanent/skilled-workers/skilled-worker-selection-program',
  pstqReq: 'https://www.quebec.ca/en/immigration/permanent/skilled-workers/skilled-worker-selection-program/requirements',
  pstqInv: 'https://www.quebec.ca/en/immigration/permanent/skilled-workers/skilled-worker-selection-program/invitation/2026',
  peq: 'https://www.quebec.ca/immigration/permanente/travailleurs-qualifies/programme-experience-quebecoise',
  qcFed: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/quebec-skilled-workers.html',
  c16: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/hire-temporary-foreign/international-mobility-program/work-permit-exemptions/francophone-mobility.html',
  fcip: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/franco-immigration.html',
  rcip: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/rural-immigration.html',
  aip: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/atlantic-immigration.html',
  study: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
  pgwp: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation.html',
  fmcsp: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/public-policies/pr-francophone-minority-communities-student-pilot-2025.html',
  spouse: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner-children.html',
  suv: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/start-visa.html',
  care: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices/pausing-home-care-worker-immigration-pilots-application-intake.html',
  cicc: 'https://register.college-ic.ca/Public-Register-EN/Licensee/Lookup.aspx',
  vfs: 'https://visa.vfsglobal.com/tun/fr/can/',
  wes: 'https://www.wes.org/ca/'
};

/* ---------- étapes communes (adaptées à chaque parcours par surcharge) ---------- */
const S = {
  eca: (o = {}) => ({
    id: 'eca', title: 'Faire évaluer votre diplôme (EDE)', time: '4 à 10 semaines', cost: '≈ CAD 240–300 + frais d’envoi',
    why: 'Des études faites à l’étranger ne comptent au Canada qu’une fois qu’un organisme désigné a confirmé leur équivalent canadien.',
    steps: [
      'Choisissez un organisme désigné : WES est le plus utilisé pour les diplômes tunisiens (autres : ICES, CES, IQAS, ICAS ; les médecins passent par le MCC, les pharmaciens par le PEBC).',
      'Créez un compte et payez en ligne, puis demandez à votre université d’envoyer directement vos relevés de notes sous pli scellé (WES décrit la procédure exacte pour les établissements tunisiens).',
      'Envoyez une copie de votre diplôme selon les instructions.',
      'Conservez le rapport : il est valide 5 ans et vous indiquez son numéro de référence dans votre profil.'
    ],
    docs: ['Diplôme (copie)', 'Relevés de notes officiels envoyés par l’université', 'Passeport'],
    tunisia: 'Les diplômes de l’ENIT, de l’ENSI, de l’INSAT, de la FST et des autres établissements publics obtiennent en général une bonne équivalence. Commencez tôt : les services de scolarité peuvent mettre des semaines à envoyer les relevés sous pli scellé.',
    link: L.eca, ...o
  }),
  french: (level, o = {}) => ({
    id: 'french', title: 'Passer le TEF Canada ou le TCF Canada', time: '1 à 3 mois de préparation, résultats en 2 à 4 semaines environ', cost: '≈ CAD 200–350 par test (payé en TND au centre)',
    why: 'Votre score linguistique est le facteur le plus important sur lequel vous avez prise.',
    steps: [
      'Objectif : ' + level + '.',
      'Préparez les quatre compétences : compréhension orale et écrite, expression orale et écrite.',
      'Inscrivez-vous au TEF Canada complet (4 épreuves) ou au TCF Canada à Tunis. Les places partent plusieurs semaines à l’avance.',
      'Les résultats sont valides 2 ans. Ils doivent encore être valides le jour où vous soumettez votre demande de RP.'
    ],
    docs: ['Passeport (le même que celui de votre demande)'],
    tunisia: 'Le TEF Canada et le TCF Canada sont tous deux proposés à Tunis. Réservez tôt, avant la haute saison des examens.',
    app: { go: '#/tef', label: 'S’entraîner au TEF dans l’application', exam: 'tef', min: o.min || 7 },
    link: L.lang, ...o
  }),
  english: (level, o = {}) => ({
    id: 'english', title: 'Passer l’IELTS General Training (ou le CELPIP / PTE Core)', time: '1 à 3 mois de préparation, résultats en 2 semaines environ', cost: '≈ CAD 200–400 (payé en TND au centre)',
    why: 'Les résultats en anglais vous rapportent des points, ou suffisent à eux seuls à ouvrir le programme.',
    steps: [
      'Objectif : ' + level + '.',
      'Seul l’IELTS General Training compte, pas l’Academic. Le CELPIP-General et le PTE Core sont aussi acceptés là où ils sont proposés.',
      'Les résultats sont valides 2 ans.'
    ],
    docs: ['Passeport'],
    tunisia: 'L’IELTS est proposé à Tunis, Sousse et Sfax. Consultez les pages du British Council ou d’IDP Tunisie pour les dates et le tarif en vigueur.',
    app: { go: '#/ielts', label: 'S’entraîner à l’IELTS dans l’application', exam: 'ielts', min: o.min || 7 },
    link: L.lang, ...o
  }),
  police: (o = {}) => ({
    id: 'police', title: 'Certificats de police', time: '1 à 4 semaines chacun', cost: 'Faible en Tunisie ; variable à l’étranger',
    why: 'Chaque adulte de votre demande doit en fournir un pour chaque pays où il a vécu 6 mois ou plus depuis l’âge de 18 ans.',
    steps: [
      'Tunisie : demandez le bulletin n°3 (extrait du casier judiciaire). Vérifiez la procédure en vigueur sur la page d’IRCC consacrée aux certificats de police.',
      'Obtenez-en un pour chaque autre pays où vous avez vécu 6 mois ou plus depuis vos 18 ans : France, pays du Golfe, etc.',
      'Faites traduire par un traducteur agréé les documents qui ne sont ni en anglais ni en français, puis téléversez l’original et la traduction.'
    ],
    docs: ['Bulletin n°3 (récent)', 'Certificats des autres pays', 'Traductions certifiées'],
    tunisia: 'Le bulletin n°3 est délivré en arabe : prévoyez une traduction certifiée en français ou en anglais.',
    link: L.police, ...o
  }),
  medical: (o = {}) => ({
    id: 'medical', title: 'Examen médical aux fins de l’immigration', time: '1 à 2 semaines', cost: 'Fixé par la clinique (demandez lors de la prise de rendez-vous)',
    why: 'Toutes les personnes de la demande, y compris les membres de la famille qui ne vous accompagnent pas, doivent passer un examen auprès d’un médecin désigné par IRCC.',
    steps: [
      'Prenez rendez-vous avec un médecin désigné à Tunis figurant sur la liste officielle d’IRCC. Les autres médecins ne sont pas acceptés.',
      'Apportez votre passeport, des photos et vos éventuels rapports médicaux. La clinique transmet les résultats à IRCC.',
      'Joignez à votre demande la fiche d’information IMM 1017 ou le reçu eMedical.',
      'Les résultats sont valides 12 mois.'
    ],
    docs: ['Passeport', 'Photos', 'Fiche / reçu eMedical'],
    tunisia: 'Les médecins désignés à Tunis sont indiqués sur le site d’IRCC des médecins désignés.',
    link: L.panel, ...o
  }),
  biometrics: (o = {}) => ({
    id: 'bio', title: 'Données biométriques (empreintes digitales et photo)', time: 'Dans les 30 jours suivant la lettre', cost: 'CAD 85 par personne (max. CAD 170 par famille)',
    why: 'Exigées après la soumission de votre demande, sauf si vous les avez fournies au cours des 10 dernières années.',
    steps: ['Attendez la lettre d’instructions relative aux données biométriques dans votre compte IRCC.', 'Prenez rendez-vous au centre VFS Global de Tunis et apportez la lettre et votre passeport.'],
    docs: ['Lettre d’instructions relative aux données biométriques', 'Passeport'],
    tunisia: 'Le centre de réception des demandes de visa VFS Global pour le Canada se trouve à Tunis. Réservez en ligne dès réception de la lettre.',
    link: L.vfs, ...o
  }),
  landing: (o = {}) => ({
    id: 'landing', title: 'Confirmation de la RP et arrivée au Canada', time: 'Avant l’expiration de votre CRP / visa', cost: 'Billets d’avion + installation',
    why: 'Vous devenez résident permanent à votre arrivée, lorsqu’un agent confirme votre statut.',
    steps: [
      'Vous recevez une demande de passeport (portail ou VFS), puis votre Confirmation de résidence permanente (CRP) avec le visa de RP.',
      'Voyagez avant la date d’expiration de la CRP. Elle dépend généralement de la date de votre examen médical.',
      'À la frontière, déclarez toute somme supérieure à CAD 10 000 et ayez sous la main votre CRP, votre passeport et votre preuve de fonds.',
      'Après l’arrivée : obtenez votre NAS, ouvrez un compte bancaire, demandez l’assurance maladie provinciale et attendez votre carte de RP par la poste.'
    ],
    docs: ['CRP', 'Passeport avec visa de RP', 'Preuve de fonds'],
    link: L.landing, ...o
  })
};
const prFees = 'CAD 990 de frais de traitement + CAD 600 de frais relatifs au droit de RP par adulte (à partir du 30 avril 2026), moins pour les enfants, + CAD 85 de biométrie par personne';

/* ---------- parcours ---------- */
export const PATHS = [
  {
    id: 'ee-french', name: 'Entrée express : rondes pour francophones', color: '#1F4FA8', tag: 'Meilleures chances pour les francophones',
    summary: 'Résidence permanente fédérale pour les travailleurs qualifiés qui atteignent le NCLC 7 en français. En 2026, ces rondes ont été importantes (5 000 invitations chacune), avec des seuils de score CRS (SCG) descendus jusqu’à 382.',
    who: ['Au moins 1 an d’expérience de travail qualifié (TEER 0–3) au cours des 10 dernières années', 'Français NCLC 7 ou plus dans les quatre compétences', 'Études postsecondaires (évaluées)', 'Installation hors du Québec'],
    time: '9 à 15 mois entre le premier test et l’arrivée', cost: 'Environ CAD 3 500–5 000 pour une personne seule, hors preuve de fonds',
    lang: { exam: 'tef', min: 7, label: 'NCLC 7 dans les quatre compétences en français' },
    facts: ['Rondes pour francophones en juillet–août 2026 : 5 000 invitations chacune, seuils de 382 à 420.', 'Le NCLC 7 en français ajoute aussi 25 ou 50 points CRS supplémentaires (50 si votre anglais est aussi de niveau CLB 5 ou plus).', 'Il n’y a plus eu de rondes générales « tous programmes » depuis avril 2024 : ce sont les catégories qui reçoivent les invitations.'],
    stops: [
      { id: 'check', title: 'Vérifier que vous êtes admissible à un programme', time: '1 jour', cost: 'Gratuit',
        why: 'La catégorie francophone invite des personnes déjà admissibles au PTQF, à la CEC ou au PTMSF. La plupart des candidats à l’étranger passent par le PTQF.',
        steps: ['PTQF : 1 an de travail rémunéré continu à temps plein (1 560 heures) dans une même profession TEER 0–3 au cours des 10 dernières années.', 'Obtenir au moins 67/100 sur la grille du PTQF : langue, études, expérience, âge, offre d’emploi, capacité d’adaptation.', 'Trouvez le code de votre profession (CNP 2021) et vérifiez que vos tâches correspondent à sa description.', 'Estimez votre score CRS avec l’outil officiel.'],
        link: L.fsw },
      S.french('NCLC 7 minimum dans les quatre compétences. Un NCLC 9 ou plus rapporte beaucoup plus de points CRS', { min: 7 }),
      S.english('CLB 5 ou plus dans les quatre compétences pour obtenir les 50 points bonus complets liés au français ; CLB 7 ou plus pour gagner aussi des points de langue seconde', { min: 5, optional: true }),
      S.eca(),
      { id: 'funds', title: 'Constituer votre preuve de fonds', time: 'Commencez tôt', cost: 'CAD 15 263 pour 1 personne, 19 001 pour 2, 23 360 pour 3, 28 362 pour 4',
        why: 'Les candidats au PTQF doivent prouver qu’ils peuvent subvenir à leurs besoins, sauf s’ils travaillent déjà au Canada avec une offre d’emploi valide.',
        steps: ['Gardez l’argent à votre nom (un compte joint avec votre conjoint convient), disponible et libre de toute dette.', 'Les lettres officielles de la banque doivent indiquer le solde actuel, le solde moyen des 6 derniers mois, la date d’ouverture du compte et les éventuelles dettes.', 'Évitez les gros dépôts inexpliqués juste avant la demande : justifiez tout don par des documents.', 'Les montants sont mis à jour chaque année (tableau actuel d’IRCC).'],
        docs: ['Lettres de la banque sur papier à en-tête', 'Relevés des 6 derniers mois'],
        tunisia: 'Les fonds sur des comptes en dinars tunisiens sont acceptés s’ils sont documentés. L’agent les convertit au taux du moment : prévoyez une marge.',
        link: L.funds },
      { id: 'profile', title: 'Créer votre profil Entrée express', time: '1 à 2 soirées', cost: 'Gratuit',
        why: 'Votre profil entre dans le bassin et reçoit un score CRS. La catégorie francophone s’applique automatiquement si vous atteignez le NCLC 7.',
        steps: ['Créez un compte sécurisé IRCC et remplissez le profil. Saisissez les résultats de tests, l’EDE et votre parcours professionnel exactement comme sur vos documents.', 'Indiquez chaque emploi avec son code CNP, ses heures par semaine et ses dates, sans trou (expliquez les périodes de chômage ou d’études).', 'Le profil est valide 12 mois. Mettez-le à jour quand vos scores s’améliorent.', 'Ne devinez jamais : une fausse déclaration entraîne un refus et une interdiction de 5 ans.'],
        link: L.ee },
      { id: 'ita', title: 'Attendre une invitation à présenter une demande (IPD)', time: 'Quelques semaines à quelques mois', cost: 'Gratuit',
        why: 'IRCC invite les profils les mieux classés à chaque ronde.',
        steps: ['Suivez les rondes pour francophones sur la page officielle des rondes. En 2026, elles sont fréquentes et importantes.', 'Améliorez votre score en attendant : un NCLC plus élevé (9–10), un test d’anglais, les tests et l’EDE de votre conjoint, ou une nomination provinciale (+600).', 'Préparez dès maintenant tous vos documents : une fois invité, vous n’avez que 60 jours.'],
        link: L.rounds },
      { id: 'docs', title: 'Rassembler les documents (avant l’IPD ou juste après)', time: '4 à 8 semaines', cost: 'Traductions ≈ 30–60 TND par page',
        why: 'Le délai de 60 jours est court. Les lettres de référence sont ce qui prend le plus de temps.',
        steps: ['Lettres de référence des employeurs sur papier à en-tête : poste, tâches selon la CNP, heures par semaine, salaire, dates, signature et coordonnées.', 'Documents d’état civil : passeport, acte de naissance, acte de mariage (le cas échéant), documents des enfants.', 'Traductions certifiées de tout document en arabe.', 'Photos numériques conformes aux spécifications d’IRCC.'],
        docs: ['Lettres de référence', 'Pages du passeport', 'Actes de naissance / de mariage', 'Traductions'],
        tunisia: 'Demandez à vos employeurs des lettres qui détaillent vos tâches. Les « attestations de travail » standard ne mentionnent souvent ni les tâches ni les heures exigées par IRCC.',
        link: L.eeApply },
      S.police(),
      S.medical(),
      { id: 'apply', title: 'Soumettre votre demande de RP', time: 'Dans les 60 jours suivant l’IPD', cost: prFees,
        why: 'La demande doit correspondre à votre profil et contenir tous les documents demandés.',
        steps: ['Remplissez la demande de RP en ligne (DRPe) et téléversez chaque document de la liste de contrôle personnalisée.', 'Payez les frais. Payer dès maintenant les frais relatifs au droit de RP évite un retard plus tard.', 'Soumettez avant la date limite de 60 jours, puis conservez la confirmation de soumission.', 'Vous recevez un accusé de réception (AR).'],
        link: L.eeApply },
      S.biometrics(),
      { id: 'processing', title: 'Traitement et décision', time: 'Environ 6 mois (norme)', cost: 'Gratuit',
        why: 'IRCC vérifie l’admissibilité, les antécédents et les résultats médicaux.',
        steps: ['Surveillez votre compte : demandes de documents supplémentaires, examen médical à refaire.', 'Signalez à IRCC tout changement : mariage, naissance, nouvel emploi, nouvelle adresse.', 'En cas d’approbation, vous recevez une demande de passeport et votre CRP.'],
        link: L.times },
      S.landing()
    ]
  },
  {
    id: 'ee-fsw', name: 'Entrée express : travailleurs qualifiés (fédéral), en anglais', color: '#B4263A', tag: 'Travailleurs qualifiés à l’étranger',
    summary: 'Le principal programme fédéral pour les travailleurs qualifiés hors du Canada. En 2026, les invitations vont surtout aux catégories (français, santé, STIM, métiers, éducation, transport) et aux candidats des provinces : prévoyez d’entrer dans l’une d’elles.',
    who: ['1 an de travail qualifié continu (TEER 0–3) au cours des 10 dernières années', 'CLB 7 dans les quatre compétences en anglais', 'Études postsecondaires (évaluées)', '67/100 sur la grille du PTQF'],
    time: '10 à 18 mois', cost: 'Environ CAD 3 500–5 000 pour une personne seule, hors preuve de fonds',
    lang: { exam: 'ielts', min: 7, label: 'CLB 7 minimum ; CLB 9 ou plus recommandé' },
    facts: ['Aucune ronde générale « tous programmes » depuis avril 2024 : sans français, sans profession d’une catégorie ou sans nomination, les seuils de score CRS (SCG) sont hors de portée pour la plupart des candidats à l’étranger.', 'Catégories en 2026 : français, santé et services sociaux, STIM, métiers, éducation, transport, ainsi que de nouvelles catégories pour les médecins, les chercheurs et les cadres supérieurs ayant une expérience canadienne. La plupart exigent 12 mois d’expérience dans une profession admissible.', 'Les points pour offre d’emploi ont été supprimés en mars 2025.'],
    stops: [
      { id: 'check', title: 'Vérifier la grille du PTQF et votre catégorie', time: '1 jour', cost: 'Gratuit',
        why: 'L’admissibilité vous fait entrer dans le bassin ; une catégorie ou une nomination vous permet d’être invité.',
        steps: ['Calculez votre score sur 67 points : langue (28), études (25), expérience (15), âge (12), offre d’emploi (10), capacité d’adaptation (10).', 'Vérifiez si votre CNP fait partie d’une catégorie 2026, avec 12 mois d’expérience dans cette profession.', 'Estimez votre score CRS avec l’outil officiel. Sous 470 sans catégorie, misez sur le français ou une province.'],
        link: L.cats },
      S.english('CLB 7 minimum dans les quatre compétences ; le CLB 9 (IELTS L8 R7 W7 S7) rapporte beaucoup plus de points CRS', { min: 9 }),
      S.french('Le NCLC 7 en français ajoute jusqu’à 50 points bonus et ouvre l’accès aux rondes pour francophones', { optional: true, min: 7 }),
      S.eca(),
      { id: 'funds', title: 'Preuve de fonds', time: 'Commencez tôt', cost: 'CAD 15 263 pour une personne seule → 28 362 pour une famille de 4', why: 'Exigée pour le PTQF, sauf si vous travaillez déjà au Canada avec une offre d’emploi.', steps: ['Gardez l’argent à votre nom, disponible, avec 6 mois d’historique.', 'Obtenez des lettres officielles de la banque indiquant le solde actuel et le solde moyen.'], link: L.funds },
      { id: 'profile', title: 'Créer votre profil Entrée express', time: '1 à 2 soirées', cost: 'Gratuit', why: 'Vous entrez dans le bassin avec votre score CRS.', steps: ['Saisissez exactement vos résultats de tests, votre EDE et vos emplois avec leurs codes CNP.', 'Mettez à jour le profil chaque fois qu’un score s’améliore.', 'Le profil est valide 12 mois.'], link: L.ee },
      { id: 'boost', title: 'Augmenter votre score pendant que vous êtes dans le bassin', time: 'En continu', cost: 'Variable',
        why: 'La plupart des invitations vont aux catégories et aux candidats des provinces.',
        steps: ['Repassez l’IELTS pour atteindre le CLB 9–10 dans chaque compétence.', 'Ajoutez le français (TEF/TCF) pour le bonus et les rondes pour francophones.', 'Ajoutez le test de langue et l’EDE de votre conjoint.', 'Postulez aux volets provinciaux qui sélectionnent dans Entrée express (+600 points CRS).'],
        link: L.crs },
      { id: 'ita', title: 'Invitation à présenter une demande (IPD)', time: 'Selon les rondes', cost: 'Gratuit', why: '60 jours pour soumettre votre demande après une IPD.', steps: ['Suivez les rondes par catégorie sur la page officielle des rondes.', 'Ayez vos documents prêts avant d’être invité.'], link: L.rounds },
      S.police(), S.medical(),
      { id: 'apply', title: 'Soumettre votre demande de RP', time: 'Dans les 60 jours', cost: prFees, why: 'Complète et cohérente avec votre profil.', steps: ['Téléversez les lettres de référence, les documents d’état civil, la preuve de fonds, les certificats de police et la preuve d’examen médical.', 'Payez les frais et soumettez avant la date limite.'], link: L.eeApply },
      S.biometrics(),
      { id: 'processing', title: 'Traitement', time: 'Environ 6 mois', cost: 'Gratuit', why: '', steps: ['Répondez vite aux demandes et signalez tout changement.'], link: L.times },
      S.landing()
    ]
  },
  {
    id: 'ee-cec', name: 'Entrée express : Catégorie de l’expérience canadienne', color: '#1D7650', tag: 'Après avoir travaillé au Canada',
    summary: 'Pour les personnes qui ont déjà un an de travail qualifié au Canada : après un permis de travail (par exemple Mobilité francophone) ou après des études au Canada.',
    who: ['1 an de travail qualifié au Canada (TEER 0–3) au cours des 3 dernières années, avec autorisation de travail', 'CLB/NCLC 7 pour les emplois TEER 0–1, 5 pour les TEER 2–3', 'Aucune exigence d’études (elles rapportent tout de même des points)', 'Installation hors du Québec'],
    time: '6 à 9 mois après être devenu admissible', cost: 'Frais de RP seulement ; pas de preuve de fonds',
    lang: { exam: 'ielts', min: 7, label: 'CLB 7 (TEER 0–1) ou CLB 5 (TEER 2–3)' },
    facts: ['Les rondes de la CEC d’août–septembre 2026 ont invité de 1 000 à 3 000 personnes, avec des seuils de score CRS (SCG) de 516 à 523.', 'Avec le NCLC 7 en français, vous pouvez aussi être invité lors des rondes pour francophones, à des scores bien plus bas.', 'Le travail effectué pendant les études et le travail autonome ne comptent pas.'],
    stops: [
      { id: 'permit', title: 'Obtenir une autorisation de travail au Canada', time: 'Variable', cost: 'Frais de permis de travail', why: 'La CEC ne compte que l’expérience canadienne acquise avec un permis valide.', steps: ['Voies courantes : Mobilité francophone (C16), permis de travail postdiplôme, permis lié à un employeur avec EIMT.', 'Conservez dès le premier jour vos talons de paie, contrats, relevés d’emploi et feuillets T4.'], link: L.c16 },
      { id: 'year', title: 'Travailler 12 mois dans un emploi TEER 0–3', time: '1 an (1 560 heures)', cost: '—', why: 'À temps plein ou l’équivalent à temps partiel, au cours des 3 dernières années.', steps: ['Vérifiez que vos tâches réelles correspondent à la CNP que vous indiquerez.', 'Évitez toute interruption de permis : le statut maintenu compte si vous avez demandé la prolongation à temps.'], link: L.cec },
      S.french('Le NCLC 7 ouvre les rondes pour francophones et ajoute jusqu’à 50 points', { min: 7, optional: true }),
      S.english('CLB 7 ou plus (TEER 0–1) ou CLB 5 ou plus (TEER 2–3) ; le CLB 9 rapporte beaucoup plus de points', { min: 7 }),
      { id: 'profile', title: 'Profil Entrée express', time: '1 à 2 soirées', cost: 'Gratuit', why: '', steps: ['Indiquez votre emploi au Canada avec la CNP, les heures et les dates.', 'Ajoutez votre expérience à l’étranger et votre EDE : elles rapportent des points de transférabilité des compétences.'], link: L.ee },
      { id: 'ita', title: 'Invitation CEC, par catégorie ou pour francophones', time: 'Quelques semaines à quelques mois', cost: 'Gratuit', why: '', steps: ['Les rondes de la CEC sont régulières. Les francophones peuvent être invités plus tôt lors des rondes pour francophones.', 'Une nomination provinciale (+600) est aussi fréquente pour les personnes qui travaillent dans une province.'], link: L.rounds },
      S.police({ steps: ['Certificats de police de la Tunisie et de chaque pays où vous avez vécu 6 mois ou plus depuis vos 18 ans. Pas besoin pour le Canada.', 'Faites traduire les documents qui ne sont ni en anglais ni en français.'] }),
      S.medical({ steps: ['Prenez rendez-vous avec un médecin désigné au Canada figurant sur la liste d’IRCC.', 'Les résultats sont valides 12 mois.'] }),
      { id: 'apply', title: 'Soumettre la demande de RP', time: 'Dans les 60 jours', cost: prFees, why: 'Pas de preuve de fonds pour la CEC.', steps: ['Téléversez les lettres d’employeurs, talons de paie, feuillets T4 et permis.', 'Demandez un permis de travail ouvert transitoire si votre permis arrive à échéance.'], link: L.eeApply },
      { id: 'landing', title: 'Devenir résident permanent', time: 'Environ 6 mois', cost: '—', why: 'Vous confirmez votre RP en ligne ou dans un bureau d’IRCC, sans avoir à voyager.', steps: ['Confirmez votre adresse et téléversez une photo sur le portail de confirmation de la RP.', 'Votre carte de RP arrive par la poste.'], link: L.landing }
    ]
  },
  {
    id: 'pnp', name: 'Programme des candidats des provinces (PCP)', color: '#8A5A00', tag: '+600 points CRS',
    summary: 'Les provinces désignent les personnes dont elles ont besoin. Une nomination « Entrée express » ajoute 600 points au score CRS (SCG) et garantit presque une invitation d’Entrée express. En 2026, la plupart des volets favorisent les personnes qui travaillent déjà dans la province ou qui y ont une offre d’emploi.',
    who: ['Selon le volet : souvent une offre d’emploi ou un emploi dans la province', 'Certains volets sélectionnent directement dans le bassin d’Entrée express', 'Langue souvent CLB 4–7 selon le volet'],
    time: '12 à 24 mois', cost: 'Frais provinciaux (≈ CAD 0–1 500) + frais de RP',
    lang: { exam: 'ielts', min: 5, label: 'Selon le volet (souvent CLB 5–7)' },
    facts: ['Objectif 2026 du PCP : 91 500 admissions à l’échelle nationale.', 'Rondes du PCP dans Entrée express en 2026 : seuils de 697 à 805 (600 points compris).', 'La Saskatchewan accepte certains candidats de secteurs prioritaires hors du Canada ; l’Ontario et l’Alberta exigent désormais surtout une offre d’emploi ou un emploi sur place.'],
    stops: [
      { id: 'target', title: 'Choisir les provinces qui correspondent à votre profil', time: '1 semaine', cost: 'Gratuit', why: 'Chaque province a ses propres volets et règles, et ils changent souvent.', steps: ['Dressez la liste des volets ouverts aux candidats à l’étranger (par exemple les secteurs prioritaires de la Saskatchewan) et des volets francophones (Nouveau-Brunswick, Ontario, Manitoba, Nouvelle-Écosse).', 'Vérifiez si un volet est lié à Entrée express (« amélioré ») ou s’il s’agit d’un volet de base (demande hors Entrée express).', 'Lisez les exigences du volet en matière de langue, d’expérience et d’offre d’emploi sur le site de la province.'], link: L.pnp },
      S.english('La plupart des volets : CLB 4–7 selon l’emploi', { min: 5 }),
      S.french('Les volets francophones demandent généralement le NCLC 5–7', { optional: true, min: 5 }),
      S.eca(),
      { id: 'eoi', title: 'Soumettre une déclaration d’intérêt à la province', time: 'Quelques heures', cost: 'Généralement gratuit', why: 'La plupart des provinces classent et invitent les candidats à partir de leur propre bassin.', steps: ['Créez une déclaration d’intérêt dans le système provincial avec les mêmes données que votre profil Entrée express.', 'Pour les volets liés à Entrée express, gardez un profil Entrée express actif.'], link: L.pnp },
      { id: 'nomination', title: 'Demande provinciale et nomination', time: '2 à 6 mois', cost: 'Frais provinciaux', why: 'La province vérifie vos documents et votre offre d’emploi.', steps: ['Soumettez la demande provinciale complète lorsque vous êtes invité.', 'Volet lié à Entrée express : acceptez la nomination dans votre profil Entrée express (+600 points).', 'Volet de base : vous recevez un certificat de nomination pour présenter votre demande à IRCC (papier ou en ligne).'], link: L.pnp },
      { id: 'ita', title: 'Invitation d’Entrée express (volet lié) ou demande fédérale (volet de base)', time: 'Prochaine ronde / immédiat', cost: 'Gratuit', why: '', steps: ['Les candidats désignés par un volet lié à Entrée express sont invités lors de la ronde PCP suivante.', 'Les candidats d’un volet de base présentent directement leur demande à IRCC avec la nomination.'], link: L.rounds },
      S.police(), S.medical(),
      { id: 'apply', title: 'Demande fédérale de RP', time: '60 jours (volet lié à Entrée express)', cost: prFees, why: '', steps: ['Mêmes documents qu’Entrée express, plus la nomination.', 'Les volets de base sont plus longs à traiter.'], link: L.pnp },
      S.biometrics(), S.landing({ steps: ['Arrivez dans la province qui vous a désigné et prévoyez d’y vivre.', 'Après l’arrivée : NAS, banque, carte d’assurance maladie, carte de RP.'] })
    ]
  },
  {
    id: 'quebec', name: 'Québec : PSTQ et PEQ', color: '#2F6FD1', tag: 'Pour les très bons francophones',
    summary: 'Le Québec sélectionne ses propres immigrants. Le PSTQ (via Arrima) est le programme principal ; le PEQ a été rouvert temporairement le 2 juillet 2026 pour deux ans, pour les personnes déjà au Québec.',
    who: ['PSTQ volet 1 (haute qualification) : français oral 7 + écrit 5, 1 an d’expérience au cours des 5 dernières années', 'Volet 2 (TEER 3–5) : français oral 5, 2 ans d’expérience dont 1 au Québec', 'Volet 3 (professions réglementées) et volet 4 (talents d’exception)', 'Conjoint : français oral 4'],
    time: '18 à 36 mois', cost: 'Frais du Québec + frais fédéraux de RP',
    lang: { exam: 'tef', min: 7, label: 'Volet 1 : NCLC 7 à l’oral, 5 à l’écrit' },
    facts: ['En 2026, les invitations du PSTQ ont surtout visé des personnes déjà au Québec ou dans des secteurs prioritaires ; scores minimaux élevés (environ 630–780) pour les groupes généraux.', 'La première vague du PEQ (2 juillet – 31 octobre 2026) s’adresse aux personnes au Québec qui remplissaient les critères le 19 novembre 2025.', 'Le Québec vise environ 29 000 immigrants économiques par an, répartis entre le PSTQ et le PEQ.'],
    stops: [
      { id: 'stream', title: 'Choisir votre volet et vérifier les points', time: '1 semaine', cost: 'Gratuit', why: 'Chaque volet a ses propres minimums de français et d’expérience.', steps: ['Lisez les exigences du PSTQ pour votre volet.', 'Vérifiez si les invitations ciblent votre profession (TEER), votre région ou votre secteur.', 'Vivre et travailler au Québec améliore nettement vos chances lors des invitations de 2026.'], link: L.pstqReq },
      S.french('Volet 1 : niveau 7 à l’oral (compréhension + expression) et 5 à l’écrit (compréhension + expression). Un niveau plus élevé rapporte plus de points', { min: 7 }),
      { id: 'eval', title: 'Faire reconnaître votre diplôme par le Québec', time: '1 à 3 mois', cost: 'Frais du MIFI (voir le site)', why: 'Le Québec utilise sa propre Évaluation comparative des études (MIFI), pas WES.', steps: ['Faites une demande en ligne au MIFI pour une Évaluation comparative des études effectuées hors du Québec.', 'Les professions réglementées (ingénieurs, infirmières…) exigent aussi la reconnaissance de l’ordre professionnel.'], link: L.pstq },
      { id: 'arrima', title: 'Déclarer votre intérêt dans Arrima', time: '1 à 2 soirées', cost: 'Gratuit', why: 'La déclaration d’intérêt dans Arrima est la porte d’entrée du bassin du PSTQ.', steps: ['Créez un compte Arrima et remplissez votre déclaration : expérience, études, résultats en français, conjoint.', 'Tenez-la à jour pendant 12 mois ; renouvelez-la au besoin.'], link: L.pstq },
      { id: 'invite', title: 'Invitation et demande de sélection permanente', time: 'Quelques semaines à quelques mois', cost: 'Frais du Québec (voir le site)', why: 'Seules les personnes invitées peuvent présenter une demande.', steps: ['Après une invitation, soumettez la demande complète avec les documents dans le délai fixé.', 'Signez la déclaration sur les valeurs démocratiques et les valeurs québécoises, et prouvez votre autonomie financière pour 3 mois (contrat).'], link: L.pstqInv },
      { id: 'csq', title: 'Recevoir le Certificat de sélection du Québec (CSQ)', time: 'Plusieurs mois', cost: '—', why: 'Le CSQ est la décision de sélection du Québec.', steps: ['Répondez rapidement à toute demande.', 'Le CSQ est nécessaire pour la demande fédérale.'], link: L.pstq },
      S.police(), S.medical(),
      { id: 'federal', title: 'Demande fédérale de RP (travailleur qualifié sélectionné par le Québec)', time: 'Plusieurs mois', cost: prFees, why: 'Le Canada vérifie la santé, la sécurité et l’admissibilité.', steps: ['Présentez votre demande en ligne à IRCC avec votre CSQ.', 'Fournissez vos données biométriques lorsqu’on vous le demande.'], link: L.qcFed },
      S.landing({ steps: ['Installez-vous au Québec.', 'Inscrivez-vous à la RAMQ pour l’assurance maladie.'] })
    ]
  },
  {
    id: 'c16', name: 'Permis de travail Mobilité francophone → RP', color: '#6A4BC4', tag: 'Le moyen le plus rapide de travailler au Canada',
    summary: 'Un employeur canadien hors du Québec peut embaucher une personne francophone sans EIMT. Après un an de travail, vous demandez la RP par la CEC, les rondes pour francophones ou une province.',
    who: ['Français NCLC 5 en expression orale et en compréhension orale', 'Offre d’emploi dans n’importe quelle profession TEER 0–5 hors du Québec (sauf agriculture primaire TEER 4–5)', 'Un employeur prêt à utiliser le code C16'],
    time: '2 à 4 mois pour obtenir le permis de travail ; 12 mois de travail ou plus ; puis la RP', cost: 'CAD 155 pour le permis + CAD 85 de biométrie ; l’employeur paie CAD 230',
    lang: { exam: 'tef', min: 5, label: 'NCLC 5 en expression orale et en compréhension orale' },
    facts: ['L’exigence est le NCLC 5 (et non 7) depuis juin 2023.', 'Après 12 mois dans un emploi TEER 0–3, vous pouvez être admissible à la CEC ; avec le NCLC 7, vous accédez aux rondes pour francophones.', 'Destination Canada Mobilité et les sites d’emploi francophones présentent des employeurs habitués au C16.'],
    stops: [
      S.french('NCLC 5 en expression orale et en compréhension orale pour le permis ; visez le NCLC 7 dans les quatre compétences pour la RP ensuite', { min: 5 }),
      { id: 'job', title: 'Trouver un employeur hors du Québec', time: '1 à 6 mois', cost: 'Gratuit', why: 'Le permis est lié à cet employeur.', steps: ['Ciblez les communautés francophones du Nouveau-Brunswick, de l’Ontario, du Manitoba, de la Nouvelle-Écosse, de l’Alberta et de la Colombie-Britannique.', 'Participez aux événements Destination Canada Mobilité et utilisez les sites d’emploi francophones.', 'Expliquez la voie C16 à l’employeur : pas d’EIMT, procédure rapide.'], link: L.c16 },
      { id: 'offer', title: 'L’employeur soumet l’offre (C16)', time: 'Quelques jours', cost: 'Employeur : CAD 230', why: 'Le numéro de l’offre est nécessaire pour votre demande de permis.', steps: ['L’employeur soumet l’offre dans le Portail des employeurs d’IRCC et paie les frais liés à la conformité de l’employeur.', 'Il vous transmet le numéro de l’offre (numéro A).'], link: L.c16 },
      { id: 'permit', title: 'Demander le permis de travail', time: 'Quelques semaines à quelques mois', cost: 'CAD 155 + 85 de biométrie', why: '', steps: ['Présentez votre demande en ligne avec le numéro de l’offre, vos résultats TEF/TCF, votre diplôme, votre CV et votre passeport.', 'Fournissez vos données biométriques chez VFS Tunis, puis recevez la lettre d’introduction au point d’entrée.', 'Votre conjoint peut être admissible à un permis de travail ouvert selon le niveau TEER de votre emploi (règles resserrées en 2025).'], link: L.c16 },
      { id: 'arrive', title: 'Arriver et commencer à travailler', time: '—', cost: 'Billets d’avion + premiers mois', why: '', steps: ['Obtenez votre permis à la frontière.', 'Rassemblez dès le premier jour les preuves de travail : contrat, talons de paie, T4.'], link: L.landing },
      { id: 'year', title: 'Travailler 12 mois', time: '1 an', cost: '—', why: 'Vous devenez admissible à la CEC et gagnez des points CRS (SCG).', steps: ['Restez dans un emploi TEER 0–3 si vous visez la CEC.', 'En parallèle, montez en français jusqu’au NCLC 7 ou plus et passez l’IELTS.'], link: L.cec },
      { id: 'pr', title: 'Demander la RP (CEC / ronde pour francophones / province)', time: '6 à 9 mois', cost: prFees, why: 'Continuez sur la carte de la CEC.', steps: ['Créez votre profil Entrée express après 12 mois.', 'Envisagez en parallèle un volet provincial francophone.'], link: L.ee }
    ]
  },
  {
    id: 'fcip', name: 'Programmes pilotes d’immigration dans les communautés francophones et rurales (PPICF / PPICR)', color: '#0F7B83', tag: 'Offre d’emploi dans une petite communauté',
    summary: 'RP directe pour les personnes ayant une offre d’emploi d’un employeur désigné dans une communauté participante. Le PPICF exige le français ; le PPICR accepte l’anglais ou le français.',
    who: ['Offre d’emploi d’un employeur désigné de la communauté', '1 an (1 560 h) de travail lié au cours des 3 dernières années', 'PPICF : français NCLC 5 dans les quatre compétences ; PPICR : CLB 6 (TEER 0–1), 5 (TEER 2–3), 4 (TEER 4–5)', 'Équivalent d’un diplôme d’études secondaires + fonds d’établissement'],
    time: '12 à 24 mois', cost: 'Frais de RP + permis de travail facultatif',
    lang: { exam: 'tef', min: 5, label: 'PPICF : NCLC 5 dans les quatre compétences' },
    facts: ['Communautés du PPICF : Péninsule acadienne (N.-B.), Sudbury, Timmins, Supérieur-Est (Ont.), St. Pierre Jolys (Man.), Kelowna (C.-B.).', 'Les communautés du PPICR comprennent North Bay, Sudbury, Timmins, Sault Ste. Marie, Thunder Bay, Steinbach, Altona/Rhineland, Brandon, Moose Jaw, Claresholm, West Kootenay, North Okanagan-Shuswap, Peace Liard et le comté de Pictou.', 'Certaines professions atteignent des plafonds annuels dans certaines communautés : consultez le site de chaque communauté.'],
    stops: [
      { id: 'community', title: 'Choisir une communauté et lire ses règles', time: '1 à 2 semaines', cost: 'Gratuit', why: 'Chaque communauté publie ses professions prioritaires et ses employeurs désignés.', steps: ['Consultez le site de la communauté : emplois prioritaires, plafonds, calendrier des demandes.', 'Vérifiez que votre profession figure sur la liste.'], link: L.fcip },
      S.french('PPICF : NCLC 5 minimum dans les quatre compétences', { min: 5 }),
      S.eca({ why: 'Nécessaire pour un diplôme d’études secondaires ou postsecondaires obtenu à l’étranger.' }),
      { id: 'job', title: 'Offre d’emploi d’un employeur désigné', time: '1 à 6 mois', cost: 'Gratuit', why: 'Seuls les employeurs désignés peuvent faire des offres valides.', steps: ['Postulez auprès des employeurs désignés de la communauté.', 'L’offre doit être à temps plein, non saisonnière et à un salaire égal ou supérieur à celui fixé par les règles du programme.'], link: L.fcip },
      { id: 'reco', title: 'Recommandation de la communauté', time: 'Quelques semaines à quelques mois', cost: 'Gratuit', why: 'L’organisme de la communauté vous recommande à IRCC.', steps: ['Soumettez votre demande de recommandation à la communauté avec votre offre d’emploi.', 'Conservez le certificat de recommandation : sa validité est limitée dans le temps.'], link: L.fcip },
      S.police(), S.medical(),
      { id: 'apply', title: 'Demander la RP (et, si vous le souhaitez, un permis de travail)', time: '—', cost: prFees, why: '', steps: ['Présentez votre demande en ligne à IRCC avec la recommandation, l’offre d’emploi et les documents.', 'Avec une lettre d’appui, vous pouvez aussi demander un permis de travail pour commencer l’emploi plus tôt.'], link: L.fcip },
      S.biometrics(), S.landing()
    ]
  },
  {
    id: 'aip', name: 'Programme d’immigration au Canada atlantique (PICA)', color: '#155E75', tag: 'Offre d’emploi au N.-B., en N.-É., à l’Î.-P.-É. ou à T.-N.-L.',
    summary: 'RP axée sur l’employeur pour les quatre provinces de l’Atlantique. Un employeur désigné offre l’emploi, la province vous accorde son approbation, puis vous présentez votre demande à IRCC.',
    who: ['Offre d’emploi à temps plein d’un employeur désigné de l’Atlantique', '1 an d’expérience au cours des 5 dernières années (pour la plupart des emplois)', 'Langue CLB/NCLC 5 (TEER 0–3) ou 4 (TEER 4)', 'Équivalent d’un diplôme d’études secondaires + fonds d’établissement'],
    time: '2 ans ou plus (traitement d’environ 26 mois à la mi-2026)', cost: 'Frais de RP + permis de travail facultatif',
    lang: { exam: 'ielts', min: 5, label: 'CLB/NCLC 5 (TEER 0–3)' },
    facts: ['Objectif 2026 : 4 000 admissions.', 'Depuis juillet 2026, les candidats qui changent d’employeur ou de détails d’emploi ont 90 jours pour envoyer des documents d’approbation à jour, faute de quoi la demande est refusée.', 'Un permis de travail de 2 ans lié à l’employeur permet de commencer à travailler avant la RP.'],
    stops: [
      S.english('CLB 5 pour les emplois TEER 0–3, CLB 4 pour les TEER 4 (le NCLC en français est aussi accepté)', { min: 5 }),
      S.eca(),
      { id: 'job', title: 'Offre d’emploi d’un employeur désigné', time: '1 à 6 mois', cost: 'Gratuit', why: '', steps: ['Consultez les listes d’employeurs désignés des provinces et les sites d’emploi.', 'L’offre doit être à temps plein et, pour les TEER 0–3, d’au moins 1 an ; pour les TEER 4, permanente.'], link: L.aip },
      { id: 'settle', title: 'Plan d’établissement et approbation', time: '1 à 3 mois', cost: 'Gratuit', why: 'La province approuve l’offre après l’établissement d’un plan d’établissement.', steps: ['Obtenez un plan d’établissement auprès d’un fournisseur de services désigné.', 'L’employeur demande l’approbation provinciale.'], link: L.aip },
      S.police(), S.medical(),
      { id: 'apply', title: 'Demander la RP et un permis de travail', time: '—', cost: prFees, why: '', steps: ['Présentez votre demande en ligne à IRCC avec le certificat d’approbation (IMM 0157).', 'Demandez le permis de travail lié à l’employeur pour commencer à travailler plus tôt.'], link: L.aip },
      S.biometrics(), S.landing()
    ]
  },
  {
    id: 'fmcsp', name: 'Étudier en français hors du Québec → RP directe', color: '#9D174D', tag: 'Ouvert aux Tunisiens jusqu’en août 2027',
    summary: 'Le Programme pilote pour étudiants dans les communautés francophones en situation minoritaire permet aux étudiants francophones de pays admissibles (dont la Tunisie) d’étudier en français hors du Québec, puis de demander directement la RP.',
    who: ['Citoyen d’un pays admissible (la Tunisie est admissible)', 'Français NCLC 5', 'Admission à un programme à temps plein de 2 ans ou plus, donné au moins à 50 % en français, dans un établissement participant hors du Québec'],
    time: '2 à 3 ans d’études, puis la RP', cost: 'Droits de scolarité + CAD 22 895 par an pour les frais de subsistance (24 617 au Québec) + frais',
    lang: { exam: 'tef', min: 5, label: 'NCLC 5' },
    facts: ['La réception des demandes a ouvert le 26 août 2026 et se poursuit jusqu’au 25 août 2027 ou jusqu’à 2 970 demandes de permis d’études.', '17 établissements participants, surtout en Ontario, ainsi qu’au N.-B., en Sask., en Alb., en C.-B., au Man., en N.-É. et à l’Î.-P.-É.', 'Les étudiants à la maîtrise et au doctorat dans des établissements publics sont exemptés du plafond des permis d’études et de la lettre d’attestation.'],
    stops: [
      S.french('NCLC 5 minimum', { min: 5 }),
      { id: 'admission', title: 'Être admis dans un programme participant', time: '2 à 6 mois', cost: 'Frais de demande d’admission', why: 'Seuls les programmes des 17 établissements participants comptent.', steps: ['Choisissez un programme de 2 ans ou plus, donné au moins à 50 % en français.', 'Demandez à l’établissement de confirmer qu’il participe au programme pilote.'], link: L.fmcsp },
      { id: 'funds', title: 'Prouver vos fonds', time: '—', cost: 'Droits de scolarité de la 1re année + CAD 22 895 (personne seule)', why: '', steps: ['Relevés bancaires, lettres de bourse ou documents du garant.'], link: L.study },
      { id: 'permit', title: 'Demander le permis d’études dans le cadre du programme pilote', time: 'Quelques semaines à quelques mois', cost: 'CAD 150 + 85 de biométrie', why: '', steps: ['Présentez votre demande en ligne en mentionnant le programme pilote, avec votre lettre d’acceptation.', 'Fournissez vos données biométriques chez VFS Tunis ; examen médical si demandé.'], link: L.fmcsp },
      { id: 'study', title: 'Étudier et obtenir votre diplôme', time: '2 ans ou plus', cost: '—', why: '', steps: ['Conservez un statut d’étudiant à temps plein et une situation scolaire satisfaisante.', 'Le travail à temps partiel est autorisé dans les limites de votre permis.'], link: L.study },
      { id: 'pr', title: 'Demander directement la RP', time: 'Après l’obtention du diplôme', cost: prFees, why: 'Le programme pilote offre une voie directe vers la RP après le diplôme.', steps: ['Présentez votre demande en résidant hors du Québec, avec un statut valide.'], link: L.fmcsp },
      S.landing({ title: 'Devenir résident permanent', steps: ['Confirmez votre RP sur le portail en ligne ; votre carte de RP arrive par la poste.'] })
    ]
  },
  {
    id: 'study', name: 'Étudier au Canada → travailler → RP', color: '#4D7C0F', tag: 'Voie longue, la plus souple',
    summary: 'Étudiez, obtenez un permis de travail postdiplôme (PTPD), acquérez un an d’expérience canadienne, puis présentez une demande par la CEC, une province ou le Québec.',
    who: ['Admission dans un établissement d’enseignement désigné', 'Fonds pour les droits de scolarité + CAD 22 895 par an (personne seule)', 'Une lettre d’attestation provinciale (LAP), sauf pour la maîtrise ou le doctorat dans un établissement public'],
    time: '3 à 5 ans', cost: 'Droits de scolarité CAD 15 000–40 000 par an + frais de subsistance',
    lang: { exam: 'ielts', min: 7, label: 'PTPD : CLB 7 (université) ou CLB 5 (collège)' },
    facts: ['Plafond des permis d’études pour 2026 : 408 000, soit 7 % de moins qu’en 2025.', 'Les diplômés du baccalauréat, de la maîtrise et du doctorat sont exemptés de la liste des domaines d’études du PTPD ; les programmes collégiaux doivent relever des domaines de la liste.', 'Les permis de travail ouverts pour conjoints sont limités à la maîtrise de 16 mois ou plus, au doctorat et à certains programmes professionnels.'],
    stops: [
      { id: 'program', title: 'Choisir un programme admissible au PTPD', time: '1 à 2 mois', cost: 'Gratuit', why: 'Un mauvais choix de programme peut signifier aucun permis de travail après le diplôme.', steps: ['Vérifiez que l’établissement est un EED et que le programme est admissible au PTPD.', 'Pour les programmes collégiaux, consultez la liste des domaines d’études.'], link: L.pgwp },
      S.english('Université : une moyenne IELTS de 6.0 est souvent exigée ; le PTPD demande le CLB 7 (université) ou le CLB 5 (collège)', { min: 7 }),
      { id: 'admission', title: 'Lettre d’acceptation + LAP', time: '2 à 6 mois', cost: 'Frais de demande d’admission', why: '', steps: ['Obtenez la lettre d’acceptation.', 'Demandez à l’établissement la lettre d’attestation provinciale (LAP), sauf si vous en êtes exempté.'], link: L.study },
      { id: 'permit', title: 'Permis d’études', time: 'Quelques semaines à quelques mois', cost: 'CAD 150 + 85 de biométrie', why: '', steps: ['Fonds, acceptation, LAP, plan d’études, attaches avec la Tunisie.', 'Données biométriques chez VFS Tunis.'], link: L.study },
      { id: 'grad', title: 'Obtenir votre diplôme et demander un PTPD', time: 'Dans les 180 jours suivant la fin du programme', cost: 'Environ CAD 255 (vérifiez le tarif en vigueur)', why: '', steps: ['Présentez votre demande avec votre relevé de notes final et votre lettre de fin d’études.', 'Respectez l’exigence linguistique.'], link: L.pgwp },
      { id: 'work', title: 'Travailler 12 mois dans un emploi TEER 0–3', time: '1 an', cost: '—', why: '', steps: ['Devenez admissible à la CEC ; explorez les volets provinciaux pour diplômés.'], link: L.cec },
      { id: 'pr', title: 'RP par la CEC, une province ou le Québec', time: '6 à 12 mois', cost: prFees, why: '', steps: ['Continuez sur la carte de la CEC ou du PCP.'], link: L.ee }
    ]
  },
  {
    id: 'spouse', name: 'Parrainage d’un époux ou d’un conjoint', color: '#7C2D12', tag: 'Votre conjoint est Canadien ou RP',
    summary: 'Un citoyen canadien ou un résident permanent peut parrainer son époux, son conjoint de fait ou son partenaire conjugal, ainsi que ses enfants à charge.',
    who: ['Répondant : 18 ans ou plus, citoyen canadien ou RP vivant au Canada (un citoyen peut aussi être à l’étranger s’il prévoit de revenir)', 'Une relation authentique', 'Le répondant signe un engagement de 3 ans'],
    time: 'Environ 12 à 18 mois', cost: 'Environ CAD 1 255 (parrainage + traitement + frais relatifs au droit de RP) + biométrie',
    lang: null,
    facts: ['Objectif 2026 : 69 000 époux, conjoints et enfants.', 'Au Canada, le conjoint peut souvent obtenir un permis de travail ouvert pendant l’attente.'],
    stops: [
      { id: 'eligible', title: 'Vérifier l’admissibilité du répondant et de la relation', time: '1 jour', cost: 'Gratuit', why: '', steps: ['Lisez qui peut parrainer et qui peut être parrainé.', 'Choisissez le traitement de l’extérieur du Canada ou au Canada.'], link: L.spouse },
      { id: 'proof', title: 'Rassembler les preuves de la relation', time: '2 à 4 semaines', cost: 'Traductions', why: 'Les agents évaluent si la relation est authentique.', steps: ['Acte de mariage, photos prises au fil du temps, messages, voyages, documents communs, connaissance des familles.', 'Traductions certifiées des documents en arabe.'], link: L.spouse },
      S.police(), S.medical(),
      { id: 'apply', title: 'Soumettre ensemble la demande de parrainage et la demande de RP', time: '—', cost: 'Environ CAD 1 255 + biométrie', why: '', steps: ['Présentez votre demande en ligne par le portail de RP, avec les deux demandes.', 'Fournissez vos données biométriques lorsqu’on vous le demande.'], link: L.spouse },
      { id: 'decision', title: 'Traitement, entrevue au besoin, décision', time: 'Environ 12 mois', cost: '—', why: '', steps: ['Répondez aux demandes ; une entrevue peut être prévue à l’ambassade.'], link: L.times },
      S.landing()
    ]
  }
];

export const PAUSED = [
  { name: 'Programme de visa pour démarrage d’entreprise', note: 'Fermé aux nouvelles lettres d’engagement depuis le 1er janvier 2026. Un programme pilote plus restreint pour entrepreneurs a été annoncé pour 2026, axé sur les personnes déjà au Canada.', link: L.suv },
  { name: 'Programme des travailleurs autonomes', note: 'Suspendu jusqu’à nouvel ordre.', link: L.suv },
  { name: 'Programmes pilotes pour travailleurs de soins à domicile (aides familiaux)', note: 'Réception des demandes suspendue depuis le 19 décembre 2025 ; elle ne rouvrira pas en mars 2026.', link: L.care }
];

export const LINKS = L;
