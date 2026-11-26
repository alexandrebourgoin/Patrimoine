// Historique des versions affiché dans le popup « Nouveautés ».
// La clé doit correspondre à APP_VERSION (mon-patrimoine.js). Sans entrée pour la version courante, aucun popup.

const CHANGELOG = {
  '1.11.115': [
    { type:'fix', text:"Changer le type d'un compte : la liste des types s'ouvrait derrière la fiche « Modifier » et bloquait l'écran. Elle la remplace maintenant le temps du choix, défile au doigt jusqu'au dernier type, puis la fiche revient avec le type choisi." },
    { type:'fix', text:"Un type impossible pour ce compte est grisé avec sa raison (ex. un compte-titres avec des actions ne peut pas devenir un Livret A ; un seul Livret A par personne) ; les autres types restent accessibles. Un compte vide peut prendre n'importe quel type." },
  ],
  '1.11.114': [
    { type:'new', text:"Sauvegarde complète (Réglages) : tous les modules, dans le dossier de votre choix, restauration d'un fichier et rappel si la dernière sauvegarde a plus de 10 jours. Date de la dernière sauvegarde dans le menu ☰." },
    { type:'new', text:"Accueil : camembert des grandes classes d'actifs (dont « Fonds euros », distincte de la Bourse), lignes cliquables (Comptes, Immobilier, Crédits) et bloc « À surveiller » : alertes, ordres, échéances, sauvegarde, positions non synchronisées, jalons fiscaux." },
    { type:'new', text:"Crédits : plusieurs crédits par bien immobilier (assurance en €/mois), module « Crédits » pour les autres crédits, simulation de remboursement anticipé et comparaison « rembourser ou placer »." },
    { type:'new', text:"Quotes-parts : part d'un compte joint (compte-titres, assurance-vie) et part d'un bien (propriété et dette séparées) ; les totaux comptent votre part." },
    { type:'new', text:"Enveloppes fiscales dans le compte : 5 ans du PEA, 8 ans de l'assurance-vie, plafonds des PEA et livrets." },
    { type:'new', text:"Livrets et épargne logement simplifiés : solde, taux, intérêts estimés, versements, retraits et intérêts ; plafond respecté à la date du versement." },
    { type:'new', text:"Types de comptes en trois catégories colorées ; chaque compte est représenté par la pastille de son type. Un seul PEA, Livret A… par personne. Nom proposé si vide." },
    { type:'new', text:"Comptes dont le type n'est plus proposé (SCPI, métaux précieux, compte à terme, compte courant, type libre) : rien ne change tout seul ; un bandeau et « À surveiller » proposent de choisir un nouveau type ou de garder l'ancien." },
    { type:'new', text:"Analyse : projection du patrimoine (1 à 20 ans). Thèmes Sable, Émeraude & or et Graphite. Non synchro : positions au cours trop ancien et cours saisi à la main." },
    { type:'fix', text:"Modules titrés par leur nom avec la barre du bas partout ; écrans Compte, Ordres, positions et liste des comptes allégés ; plus de « -0,00 % » ; YTD « — » sans cours au 31/12 ; noms longs entiers ; messages longs sur plusieurs lignes ; Analyse affichée même si le patrimoine net est négatif." },
  ],
  '1.11.113': [
    { type:'new', text:"Ordres et alertes (menu ☰ ou barre du bas) : ordres limites en cours avec confirmation d'exécution (ajoute le mouvement au compte) et alertes de prix, séparés entre mode démo et réel, avec pastille de compteur." },
    { type:'new', text:"Immobilier : biens (résidence principale, secondaire, locatif), valeur estimée, crédit, tableau d'amortissement. Le patrimoine net de l'Accueil et de l'Analyse intègre l'immobilier ; la carte « Comptes financiers » ne montre plus le patrimoine net." },
    { type:'new', text:"Comptes : liquidités par devise, apports et retraits dans leur devise, régularisation des liquidités, performance YTD / historique pondérée des flux et comparaison à un indice. Date d'ouverture du compte." },
    { type:'new', text:"DCA : saisie de la répartition en % ou en montants, résolution des ISIN et projection du patrimoine à 1 à 20 ans." },
    { type:'new', text:"Règles par type de compte : devise imposée (PEA, Livret A, Pilier 3a…) et types d'actifs autorisés (PEA : actions européennes et ETF, pas de crypto…)." },
    { type:'fix', text:"Fiche titre : bouton « Ajouter un mouvement » et contrôle des ventes (aucune vente ne peut dépasser la quantité détenue à sa date, à l'ajout, la modification et la suppression)." },
  ],
  '1.11.105': [
    { type:'fix', text:"Barre du bas qui disparaissait ou ne répondait plus après une mise à jour : l'appli supporte maintenant un mélange ancien/nouveau fichiers servi par le cache (barre par défaut dans la page, éléments du menu recréés si absents, reconstruction de la barre au retour dans l'appli)." },
  ],
  '1.11.104': [
    { type:'fix', text:"Un écran ajouté en raccourci dans la barre du bas (DCA, Assistant, Réglages) garde maintenant la barre visible et utilisable quand on est dessus ; avant, elle disparaissait." },
  ],
  '1.11.103': [
    { type:'fix', text:"Détail d'un compte en devise étrangère : le solde s'affiche dans la devise du compte, avec la contre-valeur en devise de référence en dessous (et la ligne titres / liquidités dans la devise du compte)." },
  ],
  '1.11.101': [
    { type:'fix', text:"« Rechercher une mise à jour » ne recharge plus l'appli quand elle est déjà à jour : il affiche « Déjà à jour » et ne recharge que si une version plus récente existe." },
  ],
  '1.11.100': [
    { type:'new', text:"Réglages → À propos → « Rechercher une mise à jour » : compare avec la dernière version en ligne, vide le cache de l'appli et la recharge en une fois, sans avoir à la redémarrer plusieurs fois. Les données (comptes, réglages, DCA) sont conservées." },
  ],
  '1.11.99': [
    { type:'fix', text:"DCA : le dernier plan peut maintenant être supprimé (✕ dans l'historique des stratégies, avec confirmation). Les objectifs sont conservés." },
  ],
  '1.11.98': [
    { type:'fix', text:"Le DCA & objectifs est maintenant séparé entre mode démo et mode réel (comme les comptes) : la bascule dans Réglages charge le DCA du bon mode. Un DCA déjà saisi est conservé dans le mode actif. L'export JSON inclut le DCA du mode réel." },
  ],
  '1.11.97': [
    { type:'new', text:"DCA & objectifs (menu ☰ → Écrans) : plan d'investissement programmé (budget mensuel, jour d'échéance, répartition en % entre titres), cumul théorique, prochaine répartition avec nombre de parts estimé, projection sur 12 échéances et historique des changements de stratégie. Objectifs de capital (cible, date, rendement hypothétique) avec projection et versement mensuel nécessaire. Tout est théorique et stocké sur l'appareil." },
  ],
  '1.11.96': [
    { type:'new', text:"Menu ☰ en haut à droite : confidentialité, actualisation des cours, assistant IA, réglages et accès à tous les écrans. La barre du haut ne garde que ☰ (et la confidentialité sur l'accueil), le badge d'alertes de l'assistant est repris sur ☰." },
    { type:'new', text:"Barre du bas personnalisable : menu ☰ → « Personnaliser la barre du bas » pour choisir 3 à 5 raccourcis (écrans ou actions comme Actualiser / Masquer) et les réordonner." },
  ],
  '1.11.95': [
    { type:'fix', text:"Le bouton retour Android depuis un compte revient désormais toujours à la liste des comptes, même si la pile de navigation est incomplète." },
  ],
  '1.11.94': [
    { type:'fix',     text:"Tirer pour actualiser sur l'écran d'un compte titres appliquait une simulation de cours aléatoire (biaisée à la hausse) au lieu de récupérer les vrais cours — le solde augmentait à chaque tirage jusqu'à un rafraîchissement depuis l'accueil. Le geste récupère désormais les cours réels, comme le bouton ↻ de l'accueil." },
  ],
  '1.11.93': [
    { type:'fix',     text:"Modifier un titre : le ticker n'était pas modifiable (champ verrouillé) — impossible de corriger une erreur de saisie sans supprimer puis recréer la ligne. Il est désormais éditable, avec vérification qu'il n'existe pas déjà dans le compte." },
  ],
  '1.11.89': [
    { type:'fix',     text:"Graphiques de répartition (Analyse) : une part minuscule ou nulle (ex. compte sans titres) pouvait faire passer tout le donut d'une seule couleur au lieu d'afficher les vraies proportions." },
    { type:'improve', text:"Vue grille des comptes : cartes réalignées sur le style de la liste (même icône, même infos — nombre de valeurs et barre de répartition inclus), juste réparties sur 2 colonnes." },
  ],
  '1.11.88': [
    { type:'fix',     text:"Drapeaux de compte : Windows n'a pas de police couleur pour les émoji drapeau et affichait 2 lettres (« FR ») au lieu du drapeau. Ils s'affichent désormais comme une vraie image, partout où l'icône d'un compte apparaît." },
  ],
  '1.11.87': [
    { type:'new',     text:"Établissement bancaire (optionnel) sur un compte, renseignable à la création comme dans « Modifier » — affiché sous le nom du compte et sur l'écran du compte." },
    { type:'new',     text:"Vue en grille pour l'écran Comptes : bouton en haut pour basculer entre liste et grille à 2 colonnes. Le glisser-déposer pour réorganiser reste disponible en vue liste." },
    { type:'new',     text:"Icônes de compte : 12 nouveaux drapeaux de pays dans le sélecteur (Suisse, Royaume-Uni, Allemagne, Espagne, Italie, Portugal, Luxembourg, Belgique, Pays-Bas, Canada, Japon, Chine)." },
    { type:'new',     text:"Analyse : nouvelle répartition par type de compte (PEA, Assurance-Vie, PER…), en plus des répartitions par type d'actif, géographie et secteur." },
    { type:'new',     text:"Type de compte « Pilier 3a » (prévoyance retraite suisse) ajouté à la liste." },
    { type:'fix',     text:"Ajouter/Modifier un compte : le champ « Préciser le type » restait visible même pour un type de la liste (pas seulement pour « Autre… »)." },
  ],
  '1.10.86': [
    { type:'new',     text:"Choix de l'icône d'un compte dans une grille d'emojis (48 propositions) à la création comme dans « Modifier » — plus besoin d'aller chercher le clavier emoji. La saisie libre reste possible pour coller n'importe quel autre emoji." },
    { type:'new',     text:"Réorganisation des comptes : maintenez un compte appuyé, la carte se décolle et suit votre doigt ; relâchez à la bonne place et l'ordre est enregistré. Il s'applique aussi au tableau de bord." },
    { type:'new',     text:"Confidentialité : l'écran se masque quand l'application passe en arrière-plan, pour que les montants n'apparaissent pas dans l'aperçu du sélecteur d'applications. Réglages → Sécurité → « Masquer en arrière-plan ». Selon l'appareil, Android peut photographier la fenêtre avant le masquage : le journal de diagnostic (Réglages → Débogage) indique ce qui s'est réellement passé." },
    { type:'fix',     text:"Déplacer un compte ne déclenche plus le « tirer pour actualiser » : un geste qui démarre sur une carte n'arme plus le rafraîchissement." },
    { type:'new',     text:"Masquer après inactivité (Réglages → Sécurité) : au bout du délai choisi, l'écran se voile de lui-même pendant que l'application est encore ouverte — un toucher le retire. C'est le seul masquage qu'Android ne peut pas prendre de vitesse, l'aperçu du sélecteur d'applications montrant alors le voile et non les montants." },
    { type:'improve', text:"Le numéro de version reprend celui du cache de l'application (1.10.86 = cache v86) et Réglages → À propos indique le cache réellement utilisé : on voit d'un coup d'œil si une ancienne version est encore servie." },
  ],
  '1.9.0': [
    { type:'new',     text:"Code oublié : Réglages → Sécurité propose « Réinitialiser le code ». Après vérification de votre empreinte ou de votre visage, un nouveau code est tiré au hasard et affiché une seule fois — notez-le. Disponible uniquement application déverrouillée et biométrie activée." },
    { type:'fix',     text:'Apports et retraits pris en compte dans le solde : un compte vaut désormais ses titres PLUS ses liquidités non investies (apports − retraits − achats + ventes + dividendes). Le détail « titres / liquidités » s\'affiche sur l\'écran du compte.' },
    { type:'new',     text:"Relevé des mouvements sur l'écran d'un compte : achats, ventes, dividendes et apports/retraits réunis par ordre chronologique, sous le portefeuille. On ne voyait jusqu'ici que les positions." },
    { type:'new',     text:'Liste des apports/retraits enregistrés, avec suppression, directement dans la fenêtre « Apports / Retraits ».' },
    { type:'new',     text:'Type de compte : choix dans une liste (PEA, CTO, assurance-vie, PER, livrets, SCPI, crypto…) ou saisie libre, et surtout modifiable après coup via « Modifier ».' },
    { type:'improve', text:'« Modifier le compte » permet aussi de changer l\'icône. Le type du compte est rappelé sous son nom.' },
    { type:'improve', text:'La performance d\'un compte est calculée sur les titres seuls : les liquidités ne la diluent plus.' },
  ],
  '1.8.0': [
    { type:'new',     text:'Verrouillage de l\'application : un code à 6 chiffres peut désormais être exigé à l\'ouverture. Activation dans Réglages → Sécurité.' },
    { type:'new',     text:'Déverrouillage par empreinte ou reconnaissance faciale (biométrie du téléphone), avec le code en secours.' },
    { type:'new',     text:'Re-verrouillage automatique au retour depuis l\'arrière-plan : immédiat, après 1 min ou après 5 min, au choix.' },
    { type:'improve', text:'Sécurité : le code n\'est jamais enregistré tel quel, et les essais répétés sont temporairement bloqués après 5 erreurs.' },
  ],
  '1.7.1': [
    { type:'fix',     text:'Apports/retraits : un cashflow ajouté n\'était pas sauvegardé et disparaissait au rechargement.' },
    { type:'fix',     text:'Import CSV en mode démo : l\'import basculait silencieusement en mode réel et pouvait écraser vos vraies données. L\'import reste désormais dans le mode courant.' },
    { type:'fix',     text:'Ajouter un ordre : le patrimoine total restait faux jusqu\'à la prochaine actualisation (valeur convertie non recalculée).' },
    { type:'fix',     text:'Écran Analyse : le total et les répartitions mélangeaient les devises (USD comptés comme EUR) ; poids des lignes corrigé de la même façon.' },
    { type:'fix',     text:'Cours toujours frais : le service worker servait les prix du refresh précédent (cache supprimé pour les appels externes).' },
    { type:'fix',     text:'Devises : taux JPY hors-ligne corrigé (était inversé) ; les devises inhabituelles (CAD, AUD…) sont désormais récupérées automatiquement au lieu d\'être comptées à parité avec l\'euro.' },
    { type:'fix',     text:'Historique : les clôtures étaient enregistrées à la veille (décalage de fuseau horaire) — graphiques, marqueurs d\'achats/ventes et backfill du patrimoine réalignés.' },
    { type:'fix',     text:'Mode confidentialité : les montants restaient visibles sur la carte Évolution, l\'écran Analyse, les mouvements d\'un titre et la recherche.' },
    { type:'fix',     text:'Bascule démo → réel : la watchlist et les objectifs du mode démo ne fuient plus dans le mode réel.' },
    { type:'fix',     text:'Cryptos en liste de suivi (sans position) : leurs cours sont désormais actualisés.' },
    { type:'improve', text:'Écran titre : la tuile "Effet change" (valeur non calculable, toujours trompeuse) est remplacée par le P&L latent converti dans la devise de l\'appli.' },
    { type:'improve', text:'Robustesse : pull-to-refresh ne se déclenche plus en double, spinners ne restent plus bloqués après une erreur, protections contre les % infinis/NaN, noms et recherches avec caractères spéciaux affichés sans casser la page.' },
  ],
  '1.7.0': [
    { type:'new',     text:'Évolution du patrimoine : la courbe du dashboard est désormais réelle — reconstituée à partir de vos cours historiques et de vos transactions, puis enregistrée chaque jour. Indicateur "● réel / ○ estimé" comme sur les graphiques de titres.' },
    { type:'improve', text:'Assistant IA : une pastille rouge sur l\'icône ✨ indique le nombre de points importants détectés, recalculée après chaque actualisation des cours.' },
  ],
  '1.6.0': [
    { type:'new',     text:'Titres hors base reconnus automatiquement (ex: HOOD, AMD…) : saisissez un ticker absent de la liste et l\'appli récupère en ligne son nom, sa devise et son prix. Les cours et l\'historique de ces titres se mettent désormais à jour comme les autres.' },
  ],
  '1.5.0': [
    { type:'new',     text:'Assistant IA : nouveau menu (icône ✨ en haut) qui analyse automatiquement vos comptes et titres et propose des recommandations — concentration, diversification, exposition devise, performances, allocation vs objectifs, liquidités, watchlist. Analyse 100 % locale, aucune donnée envoyée. Activable/masquable dans Réglages.' },
  ],
  '1.4.1': [
    { type:'new',     text:'Bouton plein écran en bas à droite de chaque graphique (évolution du patrimoine, titre détenu, titre suivi) : affichage agrandi avec passage en paysage sur Android' },
  ],
  '1.4.0': [
    { type:'new',     text:'Reprise d\'historique réel : bouton sur l\'écran d\'un titre détenu ET d\'un titre suivi pour récupérer les vrais cours passés (Yahoo Finance / CoinGecko) au lieu de la courbe estimée' },
    { type:'improve', text:'Titres suivis : les performances (YTD, 1M, 3M, 6M, 52 sem.) deviennent réelles une fois l\'historique repris' },
    { type:'improve', text:'Graphiques titre & suivi : indicateur "● réel / ○ estimé" selon la source des données' },
  ],
  '1.3.0': [
    { type:'fix',     text:'Renommage de compte : le bouton Enregistrer ne fonctionnait pas (id transmis après nullification)' },
    { type:'fix',     text:'Crypto : prix affichés dans la bonne devise (USD) et non en EUR' },
    { type:'fix',     text:'Graphique crypto : dates correctes, plus de projections dans le futur' },
    { type:'fix',     text:'Performance portefeuille : NaN corrigé pour les comptes sans historique de P&L' },
    { type:'fix',     text:'Mode démo : modifications et créations sauvegardées correctement' },
    { type:'new',     text:'Devise du compte : choisir à la création et modifier via "Modifier le compte"' },
    { type:'new',     text:'Modifier un titre existant : nom, type, devise, pays, secteur et cours actuel' },
    { type:'new',     text:'Sélecteur de période sur le graphique titre : 1M / 3M / 6M / 1A / MAX' },
    { type:'new',     text:'Saisie d\'un code ISIN pour rechercher et ajouter un titre' },
    { type:'new',     text:'20+ nouveaux tickers : BABA, TSM, SHOP, PLTR, ARM, COIN, UBER, SPOT, DOGE, ADA, AVAX…' },
    { type:'new',     text:'Mode démo ↔ réel : deux fichiers de sauvegarde indépendants, bascule sans perte de données' },
    { type:'new',     text:'Bouton "Réinitialiser les données démo" dans les Réglages' },
    { type:'improve', text:'Synthèse des comptes : performance all-time (P&L / investi) au lieu du daily' },
    { type:'improve', text:'Synthèse des comptes : montant affiché dans la devise du compte' },
    { type:'improve', text:'Tooltips des graphiques masqués en mode confidentialité' },
    { type:'improve', text:'Autocomplete ticker disponible également dans la watchlist' },
  ],
  '1.2.0': [
    { type:'fix',     text:'Devise correcte pour les titres en USD affichés dans un compte EUR' },
    { type:'fix',     text:'P&L total juste pour les comptes avec plusieurs devises' },
    { type:'fix',     text:'Bouton Retour Android ne ferme plus accidentellement l\'appli' },
    { type:'new',     text:'Taux de change en direct via Yahoo Finance' },
    { type:'new',     text:'Cours de change consultables depuis les Réglages' },
    { type:'new',     text:'Compatibilité PC : survol, touche Échap, fenêtre centrée' },
    { type:'improve', text:'Taux de change mémorisés entre les sessions' },
    { type:'improve', text:'Modal des cours adapté à la devise principale de l\'appli' },
  ]
};
