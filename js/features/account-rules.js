// Règles des comptes : types de compte, devise de référence par type, types d'actifs autorisés. Fonctions PURES (aucun accès à S ni au DOM).
// Les clés des tables sont les libellés EXACTS de ACCOUNT_TYPES : une faute de frappe désactiverait une règle sans rien dire,
// accountRulesProblems() la détecte (vérifié par les tests ET signalé dans la console au démarrage, voir js/modals/account.js).
// Un type absent des tables (données anciennes) n'a ni devise présélectionnée ni restriction.

// Types proposés à la création ET à la modification, regroupés par grande catégorie (listes déroulantes à sections).
// Un type hors liste (données anciennes : SCPI, compte courant, saisie libre…) reste conservé : il est ajouté à la volée
// dans une section « Type actuel » et garde son comportement.
// tone : couleur de la catégorie dans le choix du type (variables CSS --tp-<tone>, js/modals/type-picker.js).
const ACCOUNT_TYPE_GROUPS = [
  { label: 'Bourse et crypto', tone: 'bourse', types: ["Compte-Titres Ordinaire", "Plan d'Épargne en Actions (PEA)", "PEA-PME", "Crypto / Exchange"] },
  { label: 'Assurance-vie et retraite', tone: 'retraite', types: ["Assurance-Vie", "Plan d'Épargne Retraite (PER)", "Épargne salariale (PEE / PERCO)", "Pilier 3a"] },
  { label: 'Livrets et épargne logement', tone: 'livret', types: ["Livret A", "LDDS", "LEP", "Livret Jeune", "PEL / CEL"] },
];
// Affichage du choix du type : nom court, abréviation de la pastille, précision sous le nom
// (pour les livrets réglementés, la précision est le taux en vigueur : SAVINGS_RATES, js/features/savings.js).
const ACCOUNT_TYPE_INFO = {
  "Compte-Titres Ordinaire": { short: 'CTO', abbr: 'CTO', sub: 'Compte-titres ordinaire' },
  "Plan d'Épargne en Actions (PEA)": { short: 'PEA', abbr: 'PEA', sub: "Plan d'épargne en actions" },
  "PEA-PME": { short: 'PEA-PME', abbr: 'PME', sub: 'PEA dédié aux PME et ETI' },
  "Crypto / Exchange": { short: 'Crypto', abbr: '₿', sub: "Plateforme d'échange" },
  "Assurance-Vie": { short: 'Assurance-vie', abbr: 'AV', sub: 'Contrat multisupport ou fonds euros' },
  "Plan d'Épargne Retraite (PER)": { short: 'PER', abbr: 'PER', sub: "Plan d'épargne retraite" },
  "Épargne salariale (PEE / PERCO)": { short: 'PEE / PERCO', abbr: 'PEE', sub: 'Épargne salariale' },
  "Pilier 3a": { short: 'Pilier 3a', abbr: '3a', sub: 'Prévoyance suisse' },
  "Livret A": { short: 'Livret A', abbr: 'A', sub: 'Livret réglementé' },
  "LDDS": { short: 'LDDS', abbr: 'DD', sub: 'Livret de développement durable et solidaire' },
  "LEP": { short: 'LEP', abbr: 'LEP', sub: "Livret d'épargne populaire" },
  "Livret Jeune": { short: 'Livret Jeune', abbr: 'LJ', sub: '12 à 25 ans' },
  "PEL / CEL": { short: 'PEL / CEL', abbr: 'PEL', sub: 'Épargne logement' },
};
function accTypeTone(type) { const g = ACCOUNT_TYPE_GROUPS.find(g => g.types.includes(type)); return g ? g.tone : ''; }
const ACCOUNT_TYPES = ACCOUNT_TYPE_GROUPS.flatMap(g => g.types);

// Types retirés de la liste le 26/11/2026 (SCPI / Immobilier, Métaux précieux, Compte à terme, Compte courant, saisie libre « Autre… »).
// Migration guidée, jamais automatique : le compte garde son type et sa valeur (accPocket le classe toujours, js/features/wealth.js)
// jusqu'à ce que l'utilisateur choisisse un nouveau type ou décide de garder l'ancien (acc.keepType = le type gardé).
// En cas de changement, l'ancien type est conservé dans acc.formerType.
const ACC_RETIRED_HINTS = [
  [/courant|à terme|a terme/i, "Pour des liquidités, choisis le livret qui correspond. Tu peux aussi garder ce type : sa valeur reste comptée dans les Liquidités."],
  [/scpi|immo/i, "Des parts de SCPI se suivent dans un compte-titres ou une assurance-vie ; un bien détenu en direct va dans le module Immobilier."],
  [/métaux|metaux/i, "Des ETF ou ETC sur métaux se suivent dans un compte-titres. Tu peux aussi garder ce type : sa valeur reste comptée dans « Autres »."],
];
// Type absent de la liste proposée (donnée ancienne ou saisie libre)
function accTypeRetired(type) { return !!type && !ACCOUNT_TYPES.includes(type); }
function accRetiredHint(type) { const h = ACC_RETIRED_HINTS.find(([re]) => re.test(type || '')); return h ? h[1] : 'Choisis le type le plus proche dans la liste, ou garde celui-ci.'; }
// Comptes à reclasser : type retiré, et l'utilisateur n'a pas choisi de le garder
function accToReclassify(accounts) { return (accounts || []).filter(a => a && accTypeRetired(a.type) && a.keepType !== a.type); }
// Applique un changement de type : retient l'ancien s'il était retiré, oublie le choix « garder »
function accApplyTypeChange(acc, newType) {
  if (!acc || newType === acc.type) return acc;
  if (accTypeRetired(acc.type)) acc.formerType = acc.type;
  delete acc.keepType;
  acc.type = newType;
  return acc;
}

// Détention à plusieurs (compte joint / co-adhésion) : seuls le compte-titres et l'assurance-vie (co-adhésion, selon l'assureur)
// le permettent. PEA, PEA-PME, livrets réglementés, PEL / CEL, PER, épargne salariale, Pilier 3a : un seul titulaire
// (economie.gouv.fr « compte individuel, joint ou indivis » ; BOFiP : « le PEA ne peut avoir qu'un titulaire »), vérifié le 26/11/2026.
// Un type hors liste (données anciennes) garde la possibilité.
const ACC_JOINT_TYPES = ["Compte-Titres Ordinaire", "Assurance-Vie"];
function accJointAllowed(type) { return !ACCOUNT_TYPES.includes(type) || ACC_JOINT_TYPES.includes(type); }

// Nombre maximal de comptes d'un type par personne (comptes observés exclus : ils suivent le compte de quelqu'un d'autre).
// « PEL / CEL » : un PEL et un CEL, d'où 2.
const ACC_MAX_PER_PERSON = {
  "Plan d'Épargne en Actions (PEA)": 1, "PEA-PME": 1, "Livret A": 1, "LDDS": 1, "LEP": 1, "Livret Jeune": 1, "PEL / CEL": 2,
};
// Message si ajouter (ou passer) un compte au type `type` dépasse le maximum ; exceptId : le compte modifié lui-même
function accTypeLimitError(accounts, type, exceptId, observer) {
  const max = ACC_MAX_PER_PERSON[type];
  if (!max || observer) return '';
  const n = (accounts || []).filter(a => a && a.id !== exceptId && !a.observer && a.type === type).length;
  if (n < max) return '';
  return max === 1 ? `Un seul compte « ${type} » par personne : tu en as déjà un` : `Au plus ${max} comptes « ${type} » par personne (un PEL et un CEL)`;
}
// Types en surnombre parmi les comptes existants → [{ type, count, max }]
function accTypeLimitProblems(accounts) {
  return Object.entries(ACC_MAX_PER_PERSON).map(([type, max]) => ({ type, max, count: (accounts || []).filter(a => a && !a.observer && a.type === type).length }))
    .filter(x => x.count > x.max);
}

// Nom proposé quand on n'en saisit pas : nom court du type, suivi de la banque, numéroté s'il existe déjà (« Compte-titres 2 »)
const ACC_DEFAULT_NAMES = {
  "Compte-Titres Ordinaire": 'Compte-titres', "Plan d'Épargne en Actions (PEA)": 'PEA', "PEA-PME": 'PEA-PME', "Crypto / Exchange": 'Crypto',
  "Assurance-Vie": 'Assurance-vie', "Plan d'Épargne Retraite (PER)": 'PER', "Épargne salariale (PEE / PERCO)": 'Épargne salariale', "Pilier 3a": '3e pilier',
  "Livret A": 'Livret A', "LDDS": 'LDDS', "LEP": 'LEP', "Livret Jeune": 'Livret Jeune', "PEL / CEL": 'PEL / CEL',
};
function accDefaultName(type, bank, accounts) {
  const base = [ACC_DEFAULT_NAMES[type] || type || 'Compte', String(bank || '').trim()].filter(Boolean).join(' ');
  const taken = new Set((accounts || []).map(a => String(a.name || '').toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

// Devise de référence par type : [devise, imposée].
// Imposée : le produit n'existe que dans cette devise (PEA, Livret A, Pilier 3a…). Sinon, simple valeur par défaut modifiable.
const ACC_TYPE_CCY = {
  "Plan d'Épargne en Actions (PEA)": ['EUR', true],
  "PEA-PME": ['EUR', true],
  "Plan d'Épargne Retraite (PER)": ['EUR', true],
  "Épargne salariale (PEE / PERCO)": ['EUR', true],
  "Livret A": ['EUR', true],
  "LDDS": ['EUR', true],
  "LEP": ['EUR', true],
  "Livret Jeune": ['EUR', true],
  "PEL / CEL": ['EUR', true],
  "Pilier 3a": ['CHF', true],
  "Assurance-Vie": ['EUR', false],
  "Compte-Titres Ordinaire": ['EUR', false],
};

// Types d'actifs acceptés par type de compte. Absent = aucune restriction.
const _ACC_MARKET_ASSETS = ['Action', 'ETF', 'Obligation', 'Cash'];
const ACC_ASSET_TYPES = {
  "Crypto / Exchange": ['Crypto'],
  "Plan d'Épargne en Actions (PEA)": ['Action', 'ETF'],
  "PEA-PME": ['Action', 'ETF'],
  "Compte-Titres Ordinaire": _ACC_MARKET_ASSETS,
  "Assurance-Vie": _ACC_MARKET_ASSETS,
  "Plan d'Épargne Retraite (PER)": _ACC_MARKET_ASSETS,
  "Épargne salariale (PEE / PERCO)": _ACC_MARKET_ASSETS,
  "Pilier 3a": _ACC_MARKET_ASSETS,
  // Livrets et comptes d'épargne : un solde et un taux, aucun titre (voir js/features/savings.js)
  "Livret A": [], "LDDS": [], "LEP": [], "Livret Jeune": [], "PEL / CEL": [],
};
// Comptes dont les actions doivent appartenir à l'Espace économique européen
const ACC_PEA_TYPES = ["Plan d'Épargne en Actions (PEA)", "PEA-PME"];
// Pays éligibles (minuscules ; « europe » = libellé générique des fonds). L'éligibilité d'un ETF au PEA n'est PAS contrôlée :
// la donnée n'existe pas dans l'application, seul le type d'actif l'est.
const PEA_COUNTRIES = ['france', 'allemagne', 'germany', 'pays-bas', 'netherlands', 'belgique', 'belgium', 'italie', 'italy', 'espagne', 'spain',
  'portugal', 'irlande', 'ireland', 'luxembourg', 'finlande', 'finland', 'autriche', 'austria', 'grèce', 'greece', 'danemark', 'denmark',
  'suède', 'sweden', 'norvège', 'norway', 'islande', 'iceland', 'liechtenstein', 'pologne', 'poland', 'tchéquie', 'hongrie', 'hungary', 'europe'];

// Libellés des tables qui ne figurent pas dans ACCOUNT_TYPES (faute de frappe, type renommé) : liste vide = tout est cohérent
function accountRulesProblems() {
  const known = new Set(ACCOUNT_TYPES);
  return [
    ...Object.keys(ACC_TYPE_CCY).map(k => ['ACC_TYPE_CCY', k]),
    ...Object.keys(ACC_ASSET_TYPES).map(k => ['ACC_ASSET_TYPES', k]),
    ...ACC_PEA_TYPES.map(k => ['ACC_PEA_TYPES', k]),
    ...ACC_JOINT_TYPES.map(k => ['ACC_JOINT_TYPES', k]),
    ...Object.keys(ACC_MAX_PER_PERSON).map(k => ['ACC_MAX_PER_PERSON', k]),
    ...Object.keys(ACC_DEFAULT_NAMES).map(k => ['ACC_DEFAULT_NAMES', k]),
    ...Object.keys(ACCOUNT_TYPE_INFO).map(k => ['ACCOUNT_TYPE_INFO', k]),
  ].filter(([, label]) => !known.has(label)).map(([table, label]) => `${table} : « ${label} » n'est pas un type de compte connu`)
    .concat(ACCOUNT_TYPES.filter(t => !ACCOUNT_TYPE_INFO[t]).map(t => `ACCOUNT_TYPE_INFO : « ${t} » sans nom court ni pastille`));
}

function allowedAssetTypes(accType) { return ACC_ASSET_TYPES[accType] || null; }

// Message d'erreur (court : il tient dans une bulle d'une ligne) si `type` — et, pour une action de PEA, `country` — n'est pas
// autorisé sur ce compte, sinon chaîne vide.
function assetTypeError(acc, type, country) {
  const accType = acc && acc.type;
  const ok = allowedAssetTypes(accType);
  if (ok && !ok.length) return 'Pas de titres sur ce type de compte : saisis les versements, retraits et intérêts';
  if (ok && !ok.includes(type)) return type === 'Crypto' ? 'Crypto interdite sur ce type de compte' : type + ' interdit sur ce type de compte';
  if (type === 'Action' && ACC_PEA_TYPES.includes(accType)) {
    const c = (country || '').trim().toLowerCase();
    if (!c || c === 'inconnu') return 'PEA : indique le pays (France ou UE)';
    if (!PEA_COUNTRIES.includes(c)) return 'PEA : actions européennes uniquement';
  }
  return '';
}
// Positions d'un compte qui deviendraient interdites si le compte passait à `newType`
function accTypeViolations(acc, newType) {
  return (acc.holdings || []).filter(h => assetTypeError({ type: newType }, h.type, h.country));
}
// Raison pour laquelle `acc` (compte existant, ou brouillon { holdings: [] } à la création) ne peut pas prendre le type `type`,
// '' s'il le peut : positions non autorisées sur ce type (ex. des actions sur un Livret A), puis nombre maximal par personne.
// Utilisée par le choix du type (type grisé avec sa raison courte : short = true) ET à l'enregistrement (message complet).
function accTypeBlockReason(acc, type, accounts, short = false) {
  if (!acc || !type || type === acc.type) return '';
  const bad = accTypeViolations(acc, type);
  if (bad.length) {
    const n = bad.length, ex = bad.slice(0, 3).map(h => h.ticker).join(', ') + (n > 3 ? '…' : '');
    if (short) return `${n} position${n > 1 ? 's' : ''} non autorisée${n > 1 ? 's' : ''}`;
    return `${n} position${n > 1 ? 's' : ''} non autorisée${n > 1 ? 's' : ''} sur ce type (${ex}) : à vendre ou supprimer d'abord`;
  }
  const lim = accTypeLimitError(accounts, type, acc.id, acc.observer);
  return lim && short ? 'Nombre maximal atteint' : lim;
}

// Import CSV : titres que les règles du compte refusent → [{ ticker, reason }] (dans l'ordre du fichier, un par titre).
// Seuls les NOUVEAUX titres du compte sont contrôlés (un titre déjà présent peut recevoir des mouvements, même s'il n'est plus conforme).
// Type et pays viennent de la base de titres ; un titre inconnu est traité comme « Action », pays « Inconnu » (comme à l'import).
function csvRejectedTickers(acc, rows, securities) {
  const held = new Set((acc.holdings || []).map(h => h.ticker));
  const seen = new Set(), out = [];
  for (const r of rows) {
    if (!r.ticker || seen.has(r.ticker)) continue;
    seen.add(r.ticker);
    if (held.has(r.ticker)) continue;
    const sec = securities[r.ticker] || {};
    const reason = assetTypeError(acc, sec.type || 'Action', sec.country || 'Inconnu');
    if (reason) out.push({ ticker: r.ticker, reason });
  }
  return out;
}

// Devise à afficher dans le formulaire pour un type de compte → { value, locked, reason }.
// apply = true (création) : la devise suit le type (si elle est proposée), puis le sélecteur est verrouillé si elle est imposée.
// apply = false (compte existant) : ne change jamais la devise ; le sélecteur n'est verrouillé que si elle est déjà celle que le type impose.
// available : devises proposées par le sélecteur.
function accCurrencyForType(type, current, available, apply) {
  const rule = ACC_TYPE_CCY[type];
  let value = current;
  if (apply && rule && available.includes(rule[0])) value = rule[0];
  const locked = !!(rule && rule[1] && value === rule[0]);
  return { value, locked, reason: locked ? 'Devise imposée par le type de compte' : '' };
}

// Types d'actifs à griser dans une liste pour ce compte, et valeur à sélectionner.
// keepValue = true : la valeur courante n'est jamais changée (titre déjà présent, qui peut ne plus être conforme).
function assetTypeOptions(accType, values, current, keepValue) {
  const ok = allowedAssetTypes(accType);
  const disabled = values.filter(v => !!ok && !ok.includes(v));
  const value = !keepValue && ok && ok.length && !ok.includes(current) ? ok[0] : current;
  return { disabled, value };
}
