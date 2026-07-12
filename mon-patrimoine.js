
// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const S = {
  screen: 'dashboard',
  stack: ['dashboard'],
  accountId: null,
  holdingId: null,
  theme: 'auto',
  currency: 'EUR',
  privacy: false,
  user: { name: 'Alexandre Martin' },
  accounts: [],
  sort: 'value',
  sortDir: -1,
  search: '',
  histPeriod: '1M',
  targets: { Action: 60, ETF: 25, Obligation: 10, Cash: 5 },
  _histCache: {},
  srchQuery: '',
  srchMode: 'titres',   // 'titres' | 'mouvements'
  watchlist: genDemoWatchlist(),
  lastPriceUpdate: null,
  isDemo: true,   // true = données démo (jamais sauvegardées)
  watchTicker: null,
  watchPeriod: '3M',
  watchSort: 'default',  // 'default' | 'perf_desc' | 'perf_asc'
  stockPeriod: 'MAX',   // '1M' | '3M' | '6M' | '1A' | 'MAX'
  debug: false,
  autoRefresh: false, // auto-refresh au démarrage (désactivé par défaut)
  assistantEnabled: true, // affiche le menu Assistant IA (recos locales)
  priceApiKey: '',    // clé Twelve Data (US stocks)
  fmpApiKey:   '',    // clé Financial Modeling Prep (actions EU + US)
  _debugLog: [],      // non persisté
  _tdOffset:  0,      // rotation Twelve Data (non persisté)
};

// ═══════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════
const STORE_ACCOUNTS      = 'patrimoine-accounts';      // slot actif (toujours chargé au démarrage)
const STORE_ACCOUNTS_DEMO = 'patrimoine-accounts-demo'; // slot backup mode démo
const STORE_ACCOUNTS_REAL = 'patrimoine-accounts-real'; // slot backup mode réel
const STORE_SETTINGS = 'patrimoine-settings'; // thème, devise, clé API, préférences
const STORE_PRICES   = 'patrimoine-prices';   // cache cours (inchangé)
const STORE_HISTORY  = 'patrimoine-history';  // séries historiques réelles par ticker
const STORE_WEALTH   = 'patrimoine-wealth';   // snapshots quotidiens de la valeur totale du patrimoine
const STORE_LEGACY   = 'patrimoine-data';     // ancien format → migration automatique
const STORE_VERSION  = 'patrimoine-version';  // dernière version vue (popup changelog)

const APP_VERSION = '1.7.1';
const CHANGELOG = {
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

// ═══════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════
function mkH(id, ticker, name, qty, buy, cur, type, country, sector, txs, currency='EUR') {
  const value = qty * cur;
  const pnl = (cur - buy) * qty;
  const pnlPct = ((cur - buy) / buy) * 100;
  const valueRef = +toRefCcy(value, currency).toFixed(2);
  const pnlRef   = +toRefCcy(pnl,   currency).toFixed(2);
  return { id, ticker, name, quantity: qty, avgBuyPrice: buy, currentPrice: cur, type, country, sector, transactions: txs, value, pnl, pnlPct, currency, valueRef, pnlRef };
}
// ── Délégations vers utils.js (namespace PU, chargé avant ce fichier) ──
// Une seule implémentation, partagée avec les tests vitest ; les wrappers injectent S/FX_RATES.
function mkTx(date, type, qty, price) { return PU.mkTx(date, type, qty, price); }

// Watchlist d'exemple (mode démo) — déclaration hoistée, utilisée aussi par l'init de S
function genDemoWatchlist() {
  return [
    { ticker: 'OR',   name: "L'Oréal",       price: 412.35, change1d:  0.68 },
    { ticker: 'AI',   name: 'Air Liquide',    price: 168.50, change1d: -0.32 },
    { ticker: 'MSFT', name: 'Microsoft',      price: 378.50, change1d:  1.15 },
    { ticker: 'TSLA', name: 'Tesla',          price: 248.20, change1d: -2.45 },
  ];
}

function genDemo() {
  const pea = [
    mkH('MC','MC','LVMH',12,682.5,734.2,'Action','France','Luxe',[mkTx('2023-03-15','BUY',5,720),mkTx('2023-08-22','BUY',7,652.1)]),
    mkH('TTE','TTE','TotalEnergies',45,54.2,61.8,'Action','France','Énergie',[mkTx('2022-11-10','BUY',30,51.3),mkTx('2023-06-05','BUY',20,58.4),mkTx('2024-01-18','SELL',5,60.1),mkTx('2023-03-27','DIV',45,0.79),mkTx('2023-06-26','DIV',45,0.79),mkTx('2023-09-25','DIV',45,0.82),mkTx('2023-12-18','DIV',45,0.79)]),
    mkH('BNP','BNP','BNP Paribas',60,52.3,58.9,'Action','France','Finance',[mkTx('2022-09-20','BUY',40,50.8),mkTx('2023-02-14','BUY',20,55.2),mkTx('2023-05-30','DIV',60,4.60)]),
    mkH('AIR','AIR','Airbus',8,128.4,152.6,'Action','France','Aéronautique',[mkTx('2023-01-09','BUY',8,128.4)]),
    mkH('CW8','CW8','Amundi MSCI World',25,312,368.5,'ETF','Monde','Diversifié',[mkTx('2022-06-15','BUY',10,290),mkTx('2023-01-20','BUY',10,318.5),mkTx('2023-09-10','BUY',5,341)]),
  ];
  const ct = [
    mkH('AAPL','AAPL','Apple Inc.',20,148.5,189.3,'Action','USA','Technologie',[mkTx('2022-05-20','BUY',15,142.3),mkTx('2023-03-08','BUY',5,165.5),mkTx('2023-02-16','DIV',20,0.23),mkTx('2023-05-11','DIV',20,0.24),mkTx('2023-08-10','DIV',20,0.24),mkTx('2023-11-09','DIV',20,0.24)],'USD'),
    mkH('MSFT','MSFT','Microsoft',15,285.2,378.5,'Action','USA','Technologie',[mkTx('2022-07-14','BUY',10,268.4),mkTx('2023-05-22','BUY',5,319.5)],'USD'),
    mkH('NVDA','NVDA','NVIDIA',10,312.4,495.8,'Action','USA','Technologie',[mkTx('2022-10-12','BUY',10,312.4)],'USD'),
    mkH('ASML','ASML','ASML Holding',5,610,742.8,'Action','Europe','Technologie',[mkTx('2023-04-18','BUY',5,610)]),
    mkH('IWDA','IWDA','iShares Core MSCI World',30,78.4,91.2,'ETF','Monde','Diversifié',[mkTx('2022-08-10','BUY',20,74.2),mkTx('2023-02-28','BUY',10,86.8)]),
    mkH('NOVO','NOVO','Novo Nordisk',18,92.3,108.6,'Action','Europe','Santé',[mkTx('2023-06-30','BUY',18,92.3)]),
  ];
  const av = [
    mkH('EURO','FR0013309002','Fonds Euros',1,42000,44730,'Obligation','France','Fonds euros',[mkTx('2021-12-01','BUY',1,42000)]),
    mkH('PAEEM','PAEEM','Amundi EM ESG',40,42.1,45.8,'ETF','Émergents','Diversifié',[mkTx('2022-03-15','BUY',25,40.2),mkTx('2023-07-20','BUY',15,45.1)]),
    mkH('SAN','SAN','Sanofi',25,88.5,94.2,'Action','France','Santé',[mkTx('2023-09-05','BUY',25,88.5)]),
  ];
  function val(hs){ return hs.reduce((s,h)=>s+(h.valueRef ?? h.value),0); }
  return [
    { id:'pea', name:'PEA', type:"Plan d'Épargne en Actions", icon:'🇫🇷', iconBg:'rgba(79,142,247,.13)', value:val(pea), change1d:1.24, holdings:pea, cashflows:[{id:'cf1',date:'2022-01-10',type:'DEP',amount:15000,note:'Ouverture PEA'},{id:'cf2',date:'2023-03-01',type:'DEP',amount:5000,note:'Versement annuel'}] },
    { id:'ct',  name:'Compte-Titres', type:'Compte-Titres Ordinaire', icon:'🌍', iconBg:'rgba(0,194,203,.13)', value:val(ct),  change1d:2.18, holdings:ct,  cashflows:[{id:'cf3',date:'2022-05-15',type:'DEP',amount:20000,note:'Apport initial'},{id:'cf4',date:'2023-06-01',type:'DEP',amount:8000,note:'Renforcement'}] },
    { id:'av',  name:'Assurance-Vie', type:'Assurance-Vie Multisupport', icon:'🛡️', iconBg:'rgba(0,214,143,.13)', value:val(av),  change1d:0.42, holdings:av,  cashflows:[{id:'cf5',date:'2021-12-01',type:'DEP',amount:42000,note:'Versement initial'}] },
  ];
}

// ═══════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════
function fmtCur(v) {
  return PU.fmtCur(v, S.currency);
}
function fmtPct(v) { return PU.fmtPct(v); }
function fmtDate(s) { return PU.fmtDate(s); }
function initials(n) { return PU.initials(n); }
// Observer accounts excluded from total wealth
function totalWealth() { return S.accounts.filter(a=>!a.observer).reduce((s,a)=>s+a.value,0); }

// Approximate FX rates for P/L produit display only
const FX_RATES = { EUR:1, USD:1.08, GBP:1.16, CHF:1.05, JPY:163 };

function fmtNative(v, cur) { return PU.fmtNative(v, cur); }

// Convert amount from native currency to app currency using FX_RATES
// FX_RATES[X] = "units of X per EUR", so to convert X→EUR: amount / FX_RATES[X]
function toRefCcy(amount, fromCcy) { return PU.toRefCcy(amount, fromCcy, FX_RATES, S.currency); }
// Sum holdings values converted to app currency
function accSum(holdings) { return PU.accSum(holdings); }

function computeRealizedPnL(h) { return PU.computeRealizedPnL(h); }

function recalcHolding(h) { return PU.recalcHolding(h, FX_RATES, S.currency); }

function masked(v) { return S.privacy?'<span class="prv">● ● ●</span>':fmtCur(v); }
function maskedNative(v,cur) { return S.privacy?'<span class="prv">● ● ●</span>':fmtNative(v,cur); }
// Échappement innerHTML — implémentation dans utils.js
function esc(s) { return PU.esc(s); }

// ─── Securities database for autocomplete ───
const SECURITIES_DB = {
  'MC':    {name:'LVMH',                  sector:'Luxe',           country:'France',   currency:'EUR',type:'Action'},
  'TTE':   {name:'TotalEnergies',          sector:'Énergie',        country:'France',   currency:'EUR',type:'Action'},
  'BNP':   {name:'BNP Paribas',            sector:'Finance',        country:'France',   currency:'EUR',type:'Action'},
  'OR':    {name:"L'Oréal",               sector:'Cosmétiques',    country:'France',   currency:'EUR',type:'Action'},
  'SAN':   {name:'Sanofi',                 sector:'Santé',          country:'France',   currency:'EUR',type:'Action'},
  'AIR':   {name:'Airbus',                 sector:'Aéronautique',   country:'France',   currency:'EUR',type:'Action'},
  'BN':    {name:'Danone',                 sector:'Agroalimentaire',country:'France',   currency:'EUR',type:'Action'},
  'KER':   {name:'Kering',                 sector:'Luxe',           country:'France',   currency:'EUR',type:'Action'},
  'AI':    {name:'Air Liquide',            sector:'Chimie',         country:'France',   currency:'EUR',type:'Action'},
  'ORA':   {name:'Orange',                 sector:'Télécoms',       country:'France',   currency:'EUR',type:'Action'},
  'SGO':   {name:'Saint-Gobain',           sector:'Matériaux',      country:'France',   currency:'EUR',type:'Action'},
  'DSY':   {name:'Dassault Systèmes',      sector:'Technologie',    country:'France',   currency:'EUR',type:'Action'},
  'RNO':   {name:'Renault',                sector:'Automobile',     country:'France',   currency:'EUR',type:'Action'},
  'STLAM': {name:'Stellantis',             sector:'Automobile',     country:'Europe',   currency:'EUR',type:'Action'},
  'ASML':  {name:'ASML Holding',           sector:'Technologie',    country:'Europe',   currency:'EUR',type:'Action'},
  'NOVO':  {name:'Novo Nordisk',           sector:'Santé',          country:'Europe',   currency:'EUR',type:'Action'},
  'SAP':   {name:'SAP',                    sector:'Technologie',    country:'Europe',   currency:'EUR',type:'Action'},
  'ALV':   {name:'Allianz',                sector:'Finance',        country:'Europe',   currency:'EUR',type:'Action'},
  'AAPL':  {name:'Apple',                  sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'MSFT':  {name:'Microsoft',              sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'NVDA':  {name:'NVIDIA',                 sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'GOOGL': {name:'Alphabet',               sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'AMZN':  {name:'Amazon',                 sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'META':  {name:'Meta Platforms',         sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'TSLA':  {name:'Tesla',                  sector:'Automobile',     country:'USA',      currency:'USD',type:'Action'},
  'NFLX':  {name:'Netflix',                sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'V':     {name:'Visa',                   sector:'Finance',        country:'USA',      currency:'USD',type:'Action'},
  'JPM':   {name:'JPMorgan Chase',         sector:'Finance',        country:'USA',      currency:'USD',type:'Action'},
  'JNJ':   {name:'Johnson & Johnson',      sector:'Santé',          country:'USA',      currency:'USD',type:'Action'},
  'WMT':   {name:'Walmart',                sector:'Consommation',   country:'USA',      currency:'USD',type:'Action'},
  'UNH':   {name:'UnitedHealth',           sector:'Santé',          country:'USA',      currency:'USD',type:'Action'},
  'CW8':   {name:'Amundi MSCI World',      sector:'Diversifié',     country:'Monde',    currency:'EUR',type:'ETF'},
  'IWDA':  {name:'iShares MSCI World',     sector:'Diversifié',     country:'Monde',    currency:'USD',type:'ETF'},
  'SP5':   {name:'Amundi S&P 500',         sector:'Diversifié',     country:'USA',      currency:'EUR',type:'ETF'},
  'PAEEM': {name:'Amundi EM ESG',          sector:'Diversifié',     country:'Émergents',currency:'EUR',type:'ETF'},
  'EWLD':  {name:'iShares MSCI World ESG', sector:'Diversifié',     country:'Monde',    currency:'EUR',type:'ETF'},
  'QQQ':   {name:'Invesco QQQ (Nasdaq)',   sector:'Technologie',    country:'USA',      currency:'USD',type:'ETF'},
  'MWRD':  {name:'Lyxor MSCI World',       sector:'Diversifié',     country:'Monde',    currency:'EUR',type:'ETF'},
  'BTC':   {name:'Bitcoin',                sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'ETH':   {name:'Ethereum',               sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'SOL':   {name:'Solana',                 sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'BNB':   {name:'BNB',                    sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'XRP':   {name:'Ripple',                 sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  // Asia & others
  'BABA':  {name:'Alibaba',                sector:'Technologie',    country:'Chine',    currency:'USD',type:'Action'},
  'TSM':   {name:'Taiwan Semiconductor',   sector:'Technologie',    country:'Asie',     currency:'USD',type:'Action'},
  'SHOP':  {name:'Shopify',               sector:'Technologie',    country:'Canada',   currency:'USD',type:'Action'},
  'PLTR':  {name:'Palantir',              sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'ARM':   {name:'ARM Holdings',           sector:'Technologie',    country:'UK',       currency:'USD',type:'Action'},
  'COIN':  {name:'Coinbase',              sector:'Finance',        country:'USA',      currency:'USD',type:'Action'},
  'UBER':  {name:'Uber',                  sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'SPOT':  {name:'Spotify',               sector:'Technologie',    country:'Europe',   currency:'USD',type:'Action'},
  'SIE':   {name:'Siemens',              sector:'Industrie',      country:'Europe',   currency:'EUR',type:'Action'},
  'BAS':   {name:'BASF',                 sector:'Chimie',         country:'Europe',   currency:'EUR',type:'Action'},
  'SU':    {name:'Schneider Electric',   sector:'Industrie',      country:'France',   currency:'EUR',type:'Action'},
  'CS':    {name:'AXA',                  sector:'Finance',        country:'France',   currency:'EUR',type:'Action'},
  'CAP':   {name:'Capgemini',            sector:'Technologie',    country:'France',   currency:'EUR',type:'Action'},
  'HO':    {name:'Thales',               sector:'Aéronautique',   country:'France',   currency:'EUR',type:'Action'},
  // Crypto
  'DOGE':  {name:'Dogecoin',              sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'ADA':   {name:'Cardano',               sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'AVAX':  {name:'Avalanche',             sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'DOT':   {name:'Polkadot',              sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'LINK':  {name:'Chainlink',             sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
};

// ─── Yahoo Finance symbol mapping ───
// Ticker app → symbole Yahoo Finance
const YAHOO_MAP = {
  // France – Euronext Paris
  'MC':'MC.PA','TTE':'TTE.PA','BNP':'BNP.PA','OR':'OR.PA','SAN':'SAN.PA',
  'AIR':'AIR.PA','BN':'BN.PA','KER':'KER.PA','AI':'AI.PA','ORA':'ORA.PA',
  'SGO':'SGO.PA','DSY':'DSY.PA','RNO':'RNO.PA','STLAM':'STLAM.MI',
  // Europe
  'ASML':'ASML.AS','NOVO':'NOVO-B.CO','SAP':'SAP.DE','ALV':'ALV.DE',
  // USA (identiques)
  'AAPL':'AAPL','MSFT':'MSFT','NVDA':'NVDA','GOOGL':'GOOGL','AMZN':'AMZN',
  'META':'META','TSLA':'TSLA','NFLX':'NFLX','V':'V','JPM':'JPM',
  'JNJ':'JNJ','WMT':'WMT','UNH':'UNH',
  // ETFs
  'CW8':'CW8.PA','IWDA':'IWDA.AS','SP5':'SP5.PA','PAEEM':'PAEEM.PA',
  'EWLD':'EWLD.PA','QQQ':'QQQ','MWRD':'MWRD.PA',
  // Asia & others
  'BABA':'BABA','TSM':'TSM','SHOP':'SHOP','PLTR':'PLTR','ARM':'ARM',
  'COIN':'COIN','UBER':'UBER','SPOT':'SPOT',
  'SIE':'SIE.DE','BAS':'BAS.DE',
  'SU':'SU.PA','CS':'CS.PA','CAP':'CAP.PA','HO':'HO.PA',
};

// Symbole Yahoo pour un titre : table explicite, sinon le ticker brut.
// Vrai pour la plupart des actions/ETF US cotés sans suffixe (ex: HOOD, AMD…).
function yahooSymbolFor(ticker){ return YAHOO_MAP[ticker] || ticker; }

// ─── CoinGecko IDs (crypto uniquement) ───
const CG_IDS = {
  'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','BNB':'binancecoin','XRP':'ripple',
  'DOGE':'dogecoin','ADA':'cardano','AVAX':'avalanche-2','DOT':'polkadot','LINK':'chainlink',
};

// (Twelve Data cascade supprimée — proxy Cloudflare utilisé directement)

// ─── ISIN → ticker (pour import Degiro) ───
const ISIN_MAP = {
  'US0378331005':{ ticker:'AAPL', name:'Apple' },
  'US5949181045':{ ticker:'MSFT', name:'Microsoft' },
  'US02079K3059':{ ticker:'GOOGL',name:'Alphabet' },
  'US0231351067':{ ticker:'AMZN', name:'Amazon' },
  'US67066G1040':{ ticker:'NVDA', name:'NVIDIA' },
  'US30303M1027':{ ticker:'META', name:'Meta' },
  'US88160R1014':{ ticker:'TSLA', name:'Tesla' },
  'US5128071082':{ ticker:'NFLX', name:'Netflix' },
  'US92826C8394':{ ticker:'V',    name:'Visa' },
  'US46625H1005':{ ticker:'JPM',  name:'JPMorgan' },
  'US4581401001':{ ticker:'INTC', name:'Intel' },
  'US17275R1023':{ ticker:'CSCO', name:'Cisco' },
  'US4592001014':{ ticker:'IBM',  name:'IBM' },
  'US79466L3024':{ ticker:'SPGI', name:'S&P Global' },
  'FR0000131104':{ ticker:'BNP',  name:'BNP Paribas' },
  'FR0000121014':{ ticker:'MC',   name:'LVMH' },
  'FR0000120271':{ ticker:'TTE',  name:'TotalEnergies' },
  'FR0000120321':{ ticker:'OR',   name:"L'Oréal" },
  'FR0000073135':{ ticker:'AI',   name:'Air Liquide' },
  'FR0000120628':{ ticker:'AXA',  name:'AXA' },
  'FR0000131228':{ ticker:'BN',   name:'Danone' },
  'FR0000045072':{ ticker:'GLE',  name:'Société Générale' },
  'FR0000131906':{ ticker:'SGO',  name:'Saint-Gobain' },
  'FR0000120073':{ ticker:'AIR',  name:'Airbus' },
  'FR0000125338':{ ticker:'DSY',  name:'Dassault Systèmes' },
  'FR0000133308':{ ticker:'ORA',  name:'Orange' },
  'FR0000120503':{ ticker:'RNO',  name:'Renault' },
  'FR0000121667':{ ticker:'SAN',  name:'Sanofi' },
  'FR0000121972':{ ticker:'KER',  name:'Kering' },
  'NL0010273215':{ ticker:'ASML', name:'ASML' },
  'DE0007164600':{ ticker:'SAP',  name:'SAP' },
  'DE0008404005':{ ticker:'ALV',  name:'Allianz' },
  'IE00B4L5Y983':{ ticker:'IWDA', name:'iShares Core MSCI World' },
  'LU1681043599':{ ticker:'CW8',  name:'Amundi MSCI World' },
  'FR0010315770':{ ticker:'SP5',  name:'Amundi S&P 500' },
  'FR0013412285':{ ticker:'EWLD', name:'Lyxor MSCI World' },
  'FR0010429068':{ ticker:'PAEEM',name:'Amundi MSCI Emerging' },
};


// ═══════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════
function sparkData(base, n=22, vol=0.025) {
  const d=[base];
  for(let i=1;i<n;i++) d.push(d[i-1]+d[i-1]*vol*(Math.random()*2-.85));
  d[d.length-1]=base;
  return d;
}

function sparkSvg(data, w, h, color='#4F8EF7', fill=true) {
  if(!data||data.length<2) return '';
  const mn=Math.min(...data), mx=Math.max(...data), rng=mx-mn||1;
  const pts=data.map((v,i)=>`${((i/(data.length-1))*w).toFixed(1)},${(h-((v-mn)/rng)*h*.9-h*.05).toFixed(1)}`);
  const line='M'+pts.join('L');
  const area=line+`L${w},${h}L0,${h}Z`;
  const gid='g'+Math.random().toString(36).slice(2,6);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">
    ${fill?`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".28"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs><path d="${area}" fill="url(#${gid})"/>`:``}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function donutSvg(segs, size=108, sw=16) {
  const cx=size/2, cy=size/2, r=(size-sw)/2;
  const C=2*Math.PI*r;
  const tot=segs.reduce((s,sg)=>s+sg.value,0);
  let acc=0;
  const circles=segs.map(sg=>{
    const dash=(sg.value/tot)*C-1.5;
    const gap=C-dash;
    const off=-acc;
    acc+=(sg.value/tot)*C;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${sg.color}"
      stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${off.toFixed(2)}" stroke-linecap="butt"
      transform="rotate(-90 ${cx} ${cy})"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}"/>
    ${circles.join('')}
  </svg>`;
}

// ═══════════════════════════════════════════════
// HISTORY CHART
// ═══════════════════════════════════════════════
function genHistData(period) {
  const w = totalWealth();
  const n = { '1S': 7, '1M': 30, '3M': 90, '1A': 365 }[period] || 30;
  const today = new Date(); today.setHours(0,0,0,0);

  // ── Série réelle si des snapshots existent → forward-fill jour par jour (mode réel uniquement) ──
  const wl = S.isDemo ? [] : loadWealth();
  if (wl.length >= 2) {
    const byDay = {};
    wl.forEach(p => { byDay[p.d] = p.v; });
    const startKey = _dayKey(today.getTime() - (n-1)*86400000);
    let last = null;
    for (const p of wl) { if (p.d < startKey) last = p.v; else break; } // dernière valeur avant la fenêtre
    const pts = new Array(n);
    let anyReal = false;
    for (let i = 0; i < n; i++) {
      const key = _dayKey(today.getTime() - (n-1-i)*86400000);
      if (byDay[key] != null) { last = byDay[key]; anyReal = true; }
      pts[i] = last;
    }
    if (w > 0) pts[n-1] = w; // ancrer le dernier point sur la valeur live courante
    if (pts[0] == null) {    // combler le début si aucune donnée avant la fenêtre
      const firstKnown = pts.find(v => v != null) ?? w;
      for (let i = 0; i < n && pts[i] == null; i++) pts[i] = firstKnown;
    }
    if (anyReal && pts.every(v => v != null)) { pts.real = true; return pts; }
  }

  // ── Fallback synthétique déterministe (marche aléatoire) ──
  const key = period + '_' + Math.round(w / 100);
  if (S._histCache[key]) return S._histCache[key];
  const pts = new Array(n);
  pts[n - 1] = w;
  for (let i = n - 2; i >= 0; i--) {
    const drift = period === '1A' ? 0.0008 : 0.0003;
    pts[i] = pts[i + 1] / (1 + drift + (Math.random() * 0.032 - 0.015));
  }
  S._histCache[key] = pts;
  return pts;
}

function histSvg(pts, w, h) {
  if (!pts || pts.length < 2) return '';
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const pad = 2;
  const last = pts[pts.length - 1], first = pts[0];
  const color = last >= first ? 'var(--gain)' : 'var(--loss)';
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (w - pad * 2));
  const ys = pts.map(v => pad + (1 - (v - mn) / rng) * (h - pad * 2));
  const line = 'M' + xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join('L');
  const area = line + `L${xs[xs.length-1].toFixed(1)},${h}L${xs[0].toFixed(1)},${h}Z`;
  const gid = 'hg' + Math.random().toString(36).slice(2, 7);
  return `<svg id="hist-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:hidden;cursor:crosshair">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".2"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line id="hist-xhair" x1="0" y1="0" x2="0" y2="${h}" stroke="var(--text3)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>
    <circle id="hist-dot" cx="0" cy="0" r="4" fill="${color}" stroke="var(--bg)" stroke-width="2" opacity="0"/>
  </svg>`;
}

function initHistChart(container, pts) {
  const svg = container.querySelector('#hist-svg');
  const tip = container.querySelector('.hist-tip');
  if (!svg || !pts || pts.length < 2) return;
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const pad = 2;
  const xhair = svg.querySelector('#hist-xhair');
  const dot = svg.querySelector('#hist-dot');

  function update(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const idx = Math.round((relX - pad) / (rect.width - pad * 2) * (pts.length - 1));
    const i = Math.max(0, Math.min(pts.length - 1, idx));
    const x = pad + (i / (pts.length - 1)) * (rect.width - pad * 2);
    const y = pad + (1 - (pts[i] - mn) / rng) * (rect.height - pad * 2);
    xhair.setAttribute('x1', x.toFixed(1)); xhair.setAttribute('x2', x.toFixed(1));
    xhair.setAttribute('opacity', '1');
    dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
    dot.setAttribute('opacity', '1');
    let tipX = relX + 10;
    if (tipX + 115 > rect.width) tipX = relX - 125;
    tip.style.left = Math.max(0, tipX) + 'px';
    tip.style.top = Math.max(0, y - 22) + 'px';
    if(S.privacy){tip.style.opacity='0';return;}
    tip.style.opacity = '1';
    tip.textContent = fmtCur(pts[i]);
  }
  function hide() {
    xhair.setAttribute('opacity', '0');
    dot.setAttribute('opacity', '0');
    tip.style.opacity = '0';
  }
  svg.addEventListener('touchstart', e => { e.stopPropagation(); update(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchmove', e => { e.stopPropagation(); update(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchend', hide, { passive: true });
  svg.addEventListener('mousemove', e => update(e.clientX));
  svg.addEventListener('mouseleave', hide);
}

// Construit pts[] (un point par jour calendaire) depuis une série réelle :
// forward-fill weekends/fériés, backfill avant la 1ère clôture, dernier point ancré sur anchorPrice.
function _ptsFromRealSeries(hist, startDate, days, anchorPrice) {
  const byDay = {};
  hist.series.forEach(p => { byDay[p.d] = p.c; });
  let last = null;
  const startKey = _dayKey(startDate);
  for (const p of hist.series) { if (p.d < startKey) last = p.c; else break; }
  const pts = new Array(days);
  for (let i = 0; i < days; i++) {
    const key = _dayKey(startDate.getTime() + i*86400000);
    if (byDay[key] != null) last = byDay[key];
    pts[i] = last;
  }
  if (pts[0] == null) {
    const firstKnown = pts.find(v => v != null) ?? anchorPrice;
    for (let i = 0; i < days && pts[i] == null; i++) pts[i] = firstKnown;
  }
  pts[days-1] = anchorPrice; // cours live, plus frais que la dernière clôture
  return pts;
}

// ── SECURITY CHART (90-day price history) ──
function genSecurityHistory(h, period) {
  period = period || 'MAX';
  const today = new Date(); today.setHours(0,0,0,0);
  const txDates = h.transactions.map(t => new Date(t.date+'T00:00:00'));
  const firstTxDate = txDates.length > 0 ? new Date(Math.min(...txDates)) : new Date(today.getTime() - 90*86400000);
  const periodDaysMap = {'1M':30,'3M':90,'6M':182,'1A':365};
  const periodDays = periodDaysMap[period];
  const days = periodDays || Math.max(90, Math.round((today - firstTxDate) / 86400000) + 1);
  const startDate = new Date(today.getTime() - (days - 1) * 86400000);

  // ── Série réelle si récupérée → forward-fill jour par jour (weekends/fériés = dernière clôture) ──
  const hist = getHistorySeries(h.ticker);
  if (hist) {
    return { pts: _ptsFromRealSeries(hist, startDate, days, h.currentPrice), startDate, days, real: true };
  }

  // ── Fallback synthétique déterministe (marche aléatoire seedée sur le ticker) ──
  let seed = 0;
  for(let i=0;i<h.ticker.length;i++) seed = (Math.imul(31, seed) + h.ticker.charCodeAt(i)) | 0;
  seed = Math.abs(seed) || 42;
  const lcg = () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const pts = new Array(days);
  pts[days-1] = h.currentPrice;
  for(let i=days-2;i>=0;i--) pts[i] = pts[i+1] / (1 + 0.0003 + (lcg()*0.038 - 0.018));
  return { pts, startDate, days, real: false };
}

function stockChartSvg(h, w, ch, period) {
  const {pts, startDate, days} = genSecurityHistory(h, period);
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const padT=8, padB=8;
  const xs = pts.map((_,i) => (i/(pts.length-1))*w);
  const ys = pts.map(v => padT + (1-(v-mn)/rng)*(ch-padT-padB));
  const isUp = pts[pts.length-1] >= pts[0];
  const color = isUp ? 'var(--gain)' : 'var(--loss)';
  const line = 'M'+xs.map((x,i)=>`${x.toFixed(1)},${ys[i].toFixed(1)}`).join('L');
  const area = line+`L${xs[xs.length-1].toFixed(1)},${ch}L0,${ch}Z`;
  const gid = 'sc'+Math.random().toString(36).slice(2,7);
  // PRU line with value label
  const pruClamp = Math.max(mn, Math.min(mx, h.avgBuyPrice));
  const pruY = (padT+(1-(pruClamp-mn)/rng)*(ch-padT-padB)).toFixed(1);
  const pruLabel = `PRU ${h.avgBuyPrice.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const pruLine = `<line x1="0" x2="${w}" y1="${pruY}" y2="${pruY}" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.8"/>
    <text x="${w-4}" y="${(parseFloat(pruY)-3).toFixed(1)}" text-anchor="end" font-size="9" fill="#2563eb" font-weight="700" opacity="0.9">${pruLabel}</text>`;
  // Current price annotation at the right edge
  const lastY = ys[ys.length - 1];
  const txtY = Math.max(padT + 10, Math.min(ch - padB - 2, lastY - 4));
  const curLabel = fmtNative(pts[pts.length - 1], h.currency || 'EUR');
  const curPriceAnnot = `<text x="${w - 4}" y="${txtY.toFixed(1)}" text-anchor="end" font-size="9" fill="${color}" font-weight="700">${curLabel}</text>`;
  // BUY / SELL markers mapped to extended history window
  const markers = h.transactions.filter(t=>t.type!=='DIV').map(tx=>{
    const idx = Math.max(0, Math.min(days-1, Math.round((new Date(tx.date+'T00:00:00') - startDate) / 86400000)));
    const x = xs[idx].toFixed(1);
    const yy = ys[idx].toFixed(1);
    const mc = tx.type==='BUY'?'var(--gain)':'var(--loss)';
    return `<line x1="${x}" x2="${x}" y1="${padT}" y2="${ch-padB}" stroke="${mc}" stroke-width="1.5" opacity="0.55"/>
      <circle cx="${x}" cy="${yy}" r="3.5" fill="${mc}" stroke="var(--surface)" stroke-width="1.5"/>`;
  }).join('');
  // Period label
  const periodLabel = days>=365 ? Math.round(days/365)+'a' : days>=30 ? Math.round(days/30)+'m' : days+'j';
  return `<svg id="stock-svg" width="${w}" height="${ch}" viewBox="0 0 ${w} ${ch}" style="display:block;overflow:hidden;cursor:crosshair" data-startdate="${startDate.toISOString().slice(0,10)}" data-days="${days}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".15"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    ${pruLine}
    ${curPriceAnnot}
    ${markers}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line id="stock-xhair" x1="0" y1="${padT}" x2="0" y2="${ch-padB}" stroke="var(--text3)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>
    <circle id="stock-dot" cx="0" cy="0" r="4" fill="${color}" stroke="var(--bg)" stroke-width="2" opacity="0"/>
    <text id="stock-period-lbl" x="${w/2}" y="${ch-2}" text-anchor="middle" font-size="9" fill="var(--text3)" font-weight="600">${periodLabel}</text>
  </svg>`;
}

function initStockChart(container, h) {
  const {pts, startDate} = genSecurityHistory(h, S.stockPeriod||'MAX');
  const svg = container.querySelector('#stock-svg');
  const tip = container.querySelector('.stock-chart-tip');
  if(!svg||!pts||pts.length<2) return;
  const mn=Math.min(...pts), mx=Math.max(...pts), rng=mx-mn||1;
  const padT=8, padB=8;
  const xhair=svg.querySelector('#stock-xhair');
  const dot=svg.querySelector('#stock-dot');
  let locked=false;
  function update(clientX) {
    const rect=svg.getBoundingClientRect();
    const relX=Math.max(0,Math.min(rect.width,clientX-rect.left));
    const idx=Math.round(relX/rect.width*(pts.length-1));
    const i=Math.max(0,Math.min(pts.length-1,idx));
    const x=(i/(pts.length-1))*rect.width;
    const y=padT+(1-(pts[i]-mn)/rng)*(rect.height-padT-padB);
    xhair.setAttribute('x1',x.toFixed(1)); xhair.setAttribute('x2',x.toFixed(1));
    xhair.setAttribute('opacity','1');
    dot.setAttribute('cx',x.toFixed(1)); dot.setAttribute('cy',y.toFixed(1));
    dot.setAttribute('opacity','1');
    let tipX=relX+8;
    if(tipX+130>rect.width) tipX=relX-138;
    tip.style.left=Math.max(0,tipX)+'px';
    tip.style.top=Math.max(0,y-22)+'px';
    tip.style.opacity='1';
    const d=new Date(startDate.getTime()+i*86400000);
    if(S.privacy){tip.style.opacity='0';return;}
    tip.textContent=fmtNative(pts[i], h.currency||'EUR')+'  '+d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
  }
  function hide(){if(locked) return; xhair.setAttribute('opacity','0');dot.setAttribute('opacity','0');tip.style.opacity='0';}
  // Touch: drag to scrub, tap to lock/unlock tooltip
  let touchMoved=false;
  svg.addEventListener('touchstart',e=>{e.stopPropagation();touchMoved=false;update(e.touches[0].clientX);},{passive:true});
  svg.addEventListener('touchmove',e=>{e.stopPropagation();touchMoved=true;update(e.touches[0].clientX);},{passive:true});
  svg.addEventListener('touchend',e=>{
    if(!touchMoved){locked=!locked;if(!locked)hide();}
    else{if(!locked)hide();}
  },{passive:true});
  // Mouse
  svg.addEventListener('mousemove',e=>{if(!locked)update(e.clientX);});
  svg.addEventListener('click',e=>{locked=!locked;if(locked)update(e.clientX);else hide();});
  svg.addEventListener('mouseleave',hide);
}

// ── WATCHSTOCK CHART ──
function genWatchHistory(ticker, price, period) {
  const today = new Date(); today.setHours(0,0,0,0);
  let days;
  if (period === 'YTD') {
    days = Math.max(2, Math.round((today - new Date(today.getFullYear(), 0, 1)) / 86400000) + 1);
  } else {
    const map = {'1S':7,'1M':30,'3M':90,'6M':182,'1A':365};
    days = map[period] || 90;
  }
  const startDate = new Date(today.getTime() - (days - 1) * 86400000);

  // ── Série réelle si récupérée (partagée avec les titres détenus via le ticker) ──
  const hist = getHistorySeries(ticker);
  if (hist) {
    return { pts: _ptsFromRealSeries(hist, startDate, days, price), startDate, days, real: true };
  }

  // ── Fallback synthétique déterministe ──
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed = (Math.imul(31, seed) + ticker.charCodeAt(i)) | 0;
  seed = Math.abs(seed) || 42;
  const lcg = () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const pts = new Array(days);
  pts[days - 1] = price;
  for (let i = days - 2; i >= 0; i--) pts[i] = pts[i + 1] / (1 + 0.0002 + (lcg() * 0.032 - 0.015));
  return { pts, startDate, days, real: false };
}

function watchChartSvg(pts, w, h, wCur = 'EUR') {
  if (!pts || pts.length < 2) return '';
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const pad = 2;
  const color = pts[pts.length - 1] >= pts[0] ? 'var(--gain)' : 'var(--loss)';
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (w - pad * 2));
  const ys = pts.map(v => pad + (1 - (v - mn) / rng) * (h - pad * 2));
  const line = 'M' + xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join('L');
  const area = line + `L${xs[xs.length-1].toFixed(1)},${h}L${xs[0].toFixed(1)},${h}Z`;
  const gid = 'wg' + Math.random().toString(36).slice(2, 7);
  const lastY = ys[ys.length - 1];
  const curTxtY = Math.max(14, Math.min(h - 4, lastY - 4));
  const curAnnot = `<text x="${(w - pad - 2).toFixed(1)}" y="${curTxtY.toFixed(1)}" text-anchor="end" font-size="10" fill="${color}" font-weight="700">${fmtNative(pts[pts.length - 1], wCur)}</text>`;
  return `<svg id="watch-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:hidden;cursor:crosshair">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".22"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${curAnnot}
    <line id="watch-xhair" x1="0" y1="0" x2="0" y2="${h}" stroke="var(--text3)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>
    <circle id="watch-dot" cx="0" cy="0" r="4" fill="${color}" stroke="var(--bg)" stroke-width="2" opacity="0"/>
  </svg>`;
}

function initWatchChart(container, pts, startDate, wCur = 'EUR') {
  const svg = container.querySelector('#watch-svg');
  const tip = container.querySelector('#watch-chart-tip');
  if (!svg || !pts || pts.length < 2) return;
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const pad = 2;
  const xhair = svg.querySelector('#watch-xhair');
  const dot = svg.querySelector('#watch-dot');
  function update(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const idx = Math.round((relX - pad) / (rect.width - pad * 2) * (pts.length - 1));
    const i = Math.max(0, Math.min(pts.length - 1, idx));
    const x = pad + (i / (pts.length - 1)) * (rect.width - pad * 2);
    const y = pad + (1 - (pts[i] - mn) / rng) * (rect.height - pad * 2);
    xhair.setAttribute('x1', x.toFixed(1)); xhair.setAttribute('x2', x.toFixed(1));
    xhair.setAttribute('opacity', '1');
    dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
    dot.setAttribute('opacity', '1');
    let tipX = relX + 10;
    if (tipX + 145 > rect.width) tipX = relX - 153;
    if (tip) {
      tip.style.left = Math.max(0, tipX) + 'px';
      tip.style.top = Math.max(0, y - 22) + 'px';
      if(S.privacy){tip.style.opacity='0';return;}
      tip.style.opacity = '1';
      const d = new Date(startDate.getTime() + i * 86400000);
      tip.textContent = fmtNative(pts[i], wCur) + '  ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
  }
  function hide() {
    xhair.setAttribute('opacity', '0');
    dot.setAttribute('opacity', '0');
    if (tip) tip.style.opacity = '0';
  }
  svg.addEventListener('touchstart', e => { e.stopPropagation(); update(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchmove',  e => { e.stopPropagation(); update(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchend', hide, { passive: true });
  svg.addEventListener('mousemove', e => update(e.clientX));
  svg.addEventListener('mouseleave', hide);
}

// ── FULLSCREEN CHART ──
// Configs par type : recalculent les données depuis l'état S (jamais de closure stale).
// render(w,h) -> markup SVG + tooltip dimensionné en pixels (viewBox == pixels => interactivité OK).
// init(container) -> réattache l'interactivité sur le SVG du conteneur.
function _chartFsConfig(type) {
  if (type === 'hist') {
    return {
      title: 'Évolution du patrimoine',
      render: (w, h) => histSvg(genHistData(S.histPeriod), w, h) + '<div class="hist-tip"></div>',
      init: (c) => initHistChart(c, genHistData(S.histPeriod)),
    };
  }
  if (type === 'stock') {
    const acc = S.accounts.find(a => a.id === S.accountId);
    const h = acc?.holdings.find(x => x.id === S.holdingId);
    if (!h) return null;
    const period = S.stockPeriod || 'MAX';
    return {
      title: `${h.ticker} · ${h.name}`,
      render: (w, ch) => stockChartSvg(h, w, ch, period) + '<div class="stock-chart-tip"></div>',
      init: (c) => initStockChart(c, h),
    };
  }
  if (type === 'watch') {
    const watch = S.watchlist.find(w => w.ticker === S.watchTicker);
    if (!watch) return null;
    const wCur = watch.currency || SECURITIES_DB[watch.ticker]?.currency || 'EUR';
    const period = S.watchPeriod || '3M';
    return {
      title: `${watch.ticker} · ${watch.name}`,
      render: (w, h) => {
        const { pts } = genWatchHistory(watch.ticker, watch.price, period);
        return watchChartSvg(pts, w, h, wCur) + '<div id="watch-chart-tip" class="stock-chart-tip"></div>';
      },
      init: (c) => {
        const { pts, startDate } = genWatchHistory(watch.ticker, watch.price, period);
        initWatchChart(c, pts, startDate, wCur);
      },
    };
  }
  return null;
}

function openChartFullscreen(type) {
  const cfg = _chartFsConfig(type);
  if (!cfg) return;
  let ov = document.getElementById('chart-fs-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'chart-fs-overlay';
    ov.className = 'chart-fs-overlay';
    ov.innerHTML = `<div class="chart-fs-bar">
        <span class="chart-fs-title" id="chart-fs-title"></span>
        <button class="chart-fs-close" id="chart-fs-close" aria-label="Fermer">✕</button>
      </div>
      <div class="chart-fs-body" id="chart-fs-body"></div>`;
    document.body.appendChild(ov);
  }
  const body = ov.querySelector('#chart-fs-body');
  ov.querySelector('#chart-fs-title').textContent = cfg.title;

  function paint() {
    // viewBox == pixels affichés => les fonctions init() existantes mappent correctement le curseur.
    const w = Math.max(220, body.clientWidth - 16);
    const isLandscape = body.clientWidth > body.clientHeight;
    const h = isLandscape
      ? Math.max(160, body.clientHeight - 16)
      : Math.max(180, Math.min(body.clientHeight - 16, Math.round(w * 0.72)));
    body.innerHTML = cfg.render(w, h);
    cfg.init(body);
  }
  let rt;
  function onResize() { clearTimeout(rt); rt = setTimeout(paint, 120); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() {
    ov.classList.remove('show');
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    body.innerHTML = '';
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }

  ov.querySelector('#chart-fs-close').onclick = close;
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);
  ov.classList.add('show');
  paint(); // rendu synchrone : la lecture de clientWidth force le layout (pas de dépendance à rAF)

  // Plein écran réel + paysage : best-effort (Android). Sans effet sur iOS, l'overlay CSS suffit.
  // Le redimensionnement déclenché re-render le graphique aux bonnes dimensions via onResize.
  try {
    const rfs = ov.requestFullscreen || ov.webkitRequestFullscreen;
    if (rfs) {
      Promise.resolve(rfs.call(ov)).then(() => {
        try { const p = screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      }).catch(() => {});
    }
  } catch (e) {}
}

// Ajoute (ou rafraîchit) le bouton plein écran en bas à droite d'un conteneur de graphique.
function attachChartFs(wrap, type) {
  if (!wrap) return;
  let btn = wrap.querySelector('.chart-fs-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'chart-fs-btn';
    btn.title = 'Plein écran';
    btn.setAttribute('aria-label', 'Plein écran');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
    wrap.appendChild(btn);
  }
  btn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    try { haptic(4); } catch (err) {}
    openChartFullscreen(type);
  };
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
const EASE='cubic-bezier(.4,0,.2,1)';
const NAV_SCREENS=['dashboard','comptes','recherche','analysis'];

// dir: 'back' | 'forward' | null (null = auto-detect from stack for hierarchical nav)
function go(target, dir=null) {
  if(target===S.screen) return;
  const prevEl=document.getElementById('s-'+S.screen);
  const nextEl=document.getElementById('s-'+target);

  // Direction: explicit for tab nav, auto-detect from stack for back()
  const isBack = dir!=null ? dir==='back'
    : (S.stack.length>1 && S.stack[S.stack.length-2]===target);

  // Always re-render for tab nav and forward; skip re-render on hierarchical back (preserves scroll)
  if(dir!=null || !isBack) { renderScreen(target); nextEl.scrollTop=0; }

  // Bring both transitioning screens above inactive ones
  prevEl.style.zIndex='1';
  nextEl.style.zIndex='2';

  nextEl.style.transition='none';
  nextEl.style.transform=isBack?'translateX(-22%)':'translateX(100%)';
  nextEl.offsetHeight; // force reflow
  nextEl.style.transition=`transform .32s ${EASE}`;
  prevEl.style.transition=`transform .32s ${EASE}`;
  nextEl.style.transform='translateX(0)';
  prevEl.style.transform=isBack?'translateX(100%)':'translateX(-22%)';

  // Stack management
  if(dir!=null) S.stack=[target];        // tab nav: flat stack
  else if(isBack) S.stack.pop();          // back(): unwind
  else S.stack.push(target);              // forward: push

  S.screen=target;
  setTimeout(()=>{
    prevEl.style.zIndex='';
    prevEl.style.transition='';
    prevEl.style.transform='';
    nextEl.style.zIndex='';
    nextEl.style.transition='';
  }, 350);

  const showNav=NAV_SCREENS.includes(target);
  document.getElementById('nav').classList.toggle('hidden',!showNav);
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('on',b.dataset.nav===target));
}

function back() {
  if (S.stack.length > 1) {
    go(S.stack[S.stack.length - 2]);
  } else {
    // Fallback défensif : si le stack est corrompu, on sait quand même
    // où on doit revenir selon l'écran courant
    const fallbacks = {
      account: 'comptes', stock: 'account',
      watchstock: 'dashboard', settings: 'dashboard', assistant: 'dashboard',
    };
    const fb = fallbacks[S.screen];
    if (fb) go(fb);
  }
}

// ═══════════════════════════════════════════════
// RENDERERS
// ═══════════════════════════════════════════════
function renderScreen(id) {
  const el=document.getElementById('s-'+id);
  const map={dashboard:renderDash,comptes:renderComptes,recherche:renderRecherche,account:renderAccount,stock:renderStock,analysis:renderAnalysis,settings:renderSettings,watchstock:renderWatchStock,assistant:renderAssistant};
  if(map[id]) { el.innerHTML=map[id](); bindEvents(id,el); }
}

// ── TOP BAR commun (tous les écrans principaux) ──
const _SVG_SETTINGS = `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35c-.59.24-1.13.56-1.62.94L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`;
const _SVG_ASSISTANT = `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15.5l-2.6.95L18 19l-.9-2.55L14.5 15.5l2.6-1L18 12zM6 14l.75 2.05L8.8 16.8l-2.05.75L6 19.6l-.75-2.05L3.2 16.8l2.05-.75L6 14z"/></svg>`;

function renderTopBar(extraBtns='') {
  return `<div class="top-bar">
    <div class="top-bar-title">Mon patrimoine</div>
    <div class="row gap8">
      ${extraBtns}
      ${S.assistantEnabled ? (() => { const _n = assistantAlertCount(); return `<div id="js-assistant-btn" class="top-btn tap" title="Assistant IA${_n?` — ${_n} point${_n>1?'s':''} important${_n>1?'s':''}`:''}" style="color:var(--accent);position:relative">${_SVG_ASSISTANT}${_n?`<span class="assistant-badge">${_n>9?'9+':_n}</span>`:''}</div>`; })() : ''}
      <div id="js-settings-btn" class="top-btn tap" title="Réglages">${_SVG_SETTINGS}</div>
    </div>
  </div>`;
}

// ── DASHBOARD ──
function renderDash() {
  const w=totalWealth();
  const wChg=(S.accounts.length&&w>0)?S.accounts.filter(a=>!a.observer).reduce((s,a)=>s+(a.change1d??0)*(a.value/w),0):0;
  const allH=S.accounts.filter(a=>!a.observer).flatMap(a=>a.holdings); // cohérent avec totalWealth()
  const totPnl=allH.reduce((s,h)=>s+(h.pnlRef??h.pnl??0),0);
  const totInv=allH.reduce((s,h)=>s+toRefCcy((h.avgBuyPrice||0)*(h.quantity||0),h.currency||'EUR'),0);
  const totPnlPct=totInv>0?(totPnl/totInv)*100:0;
  const spark=sparkData(w*.86,28,.022); spark[spark.length-1]=w;

  const wealthDisplay = S.privacy
    ? '<span style="font-size:28px;letter-spacing:4px;color:rgba(255,255,255,.6)">● ● ●</span>'
    : `<div class="wealth-amount t-num">${fmtCur(w)}</div>`;
  return `<div class="dash-top">
    ${renderTopBar(`
      <div id="js-privacy-btn" class="top-btn tap" title="Masquer les montants" style="color:${S.privacy?'var(--accent)':'var(--text2)'}">
        ${S.privacy
          ? `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`
          : `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`
        }
      </div>
      <div id="js-refresh-btn" class="top-btn tap" title="Actualiser les cours" style="position:relative">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        <div class="fresh-dot" id="js-fresh-dot"></div>
      </div>
    `)}
  </div>
    <div class="wealth-card anim">
    <div class="wealth-label">Fortune totale</div>
    ${wealthDisplay}
    <div class="row gap8" style="margin:8px 0 0">
      <div class="badge ${wChg>=0?'up':'dn'}">${wChg>=0?'▲':'▼'} ${Math.abs(wChg).toFixed(2)}%</div>
      <span style="font-size:12px;color:rgba(255,255,255,.38)">Aujourd'hui · ${S.accounts.length} compte${S.accounts.length>1?'s':''}</span>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:6px">
      P&amp;L total&nbsp;·&nbsp;<span style="font-weight:700;color:${totPnl>=0?'rgba(110,255,200,1)':'rgba(255,150,150,1)'}">${S.privacy?'● ● ●':(totPnl>=0?'+':'')+fmtCur(totPnl)+'&nbsp;('+fmtPct(totPnlPct)+')'}</span>
    </div>
    ${S.lastPriceUpdate?`<div style="font-size:10px;color:rgba(255,255,255,.28);margin-top:5px">Cours · ${timeSince(S.lastPriceUpdate)}</div>`:''}
  </div>
  ${renderHistCard()}
  ${renderWatchlistCard()}`;
}

// ── COMPTES ──
function renderComptes() {
  const w=totalWealth();
  const accs=S.accounts.map(a=>{
    const pct=w>0?(a.value/w*100).toFixed(1):'0';
    const totPnl=a.holdings.reduce((s,h)=>s+(h.pnlRef??h.pnl??0),0);
    const totInv=a.holdings.reduce((s,h)=>s+toRefCcy((h.avgBuyPrice||0)*(h.quantity||0),h.currency||'EUR'),0);
    const allTimePct=totInv>0?(totPnl/totInv)*100:0;
    const up=allTimePct>=0;
    const accCcy=a.currency||S.currency;
    const fxAcc=(FX_RATES[accCcy]||1)/(FX_RATES[S.currency]||1);
    const displayVal=accCcy===S.currency?masked(a.value):maskedNative(a.value*fxAcc,accCcy);
    const obsTag=a.observer?`<div class="obs-tag" style="margin-left:6px">Observateur</div>`:'';
    return `<div class="acc-card anim" data-acc="${a.id}" style="${a.observer?'opacity:.72':''}">
      <div class="row gap12">
        <div class="acc-icon tap" data-acc="${a.id}" style="background:${a.iconBg};cursor:pointer">${a.icon}</div>
        <div class="flex1 col gap4 tap" data-acc="${a.id}" style="min-width:0;cursor:pointer">
          <div class="row" style="flex-wrap:wrap;gap:4px;align-items:center">
            <div style="font-size:15px;font-weight:700">${esc(a.name)}</div>${obsTag}
          </div>
          <div class="t-sm">${a.type} · ${a.holdings.length} valeur${a.holdings.length!==1?'s':''}</div>
        </div>
        <div class="col right gap4 tap" data-acc="${a.id}" style="cursor:pointer">
          <div style="font-size:15px;font-weight:800" class="t-num">${displayVal}</div>
          <div style="font-size:12px;font-weight:700" class="${up?'t-gain':'t-loss'}">${a.holdings.length?fmtPct(allTimePct):'—'}</div>
        </div>
        <div class="acc-menu-btn tap" data-menu="${a.id}" title="Actions">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
        </div>
      </div>
      ${!a.observer?`<div class="acc-bar tap" data-acc="${a.id}" style="cursor:pointer"><div class="acc-bar-fill" style="width:${pct}%"></div></div>`:''}
    </div>`;
  }).join('');
  const empty=!S.accounts.length?`<div style="text-align:center;padding:40px 20px;color:var(--text2)">
    <div style="font-size:40px;margin-bottom:12px">🏦</div>
    <div style="font-size:15px;font-weight:600;margin-bottom:6px">Aucun compte</div>
    <div style="font-size:13px">Ajoutez un compte pour commencer</div>
  </div>`:'';
  return `${renderTopBar(`
    <div style="font-size:12px;font-weight:600;color:var(--text2);background:var(--card);border:1px solid var(--border);padding:2px 10px;border-radius:20px;margin-right:2px">${S.accounts.length}</div>
    <div class="top-btn tap" id="js-acc-add" title="Ajouter un compte">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
    </div>
  `)}
  <div class="col gap12 px">${accs}${empty}</div>`;
}

// ── RECHERCHE ──
function renderRecherche() {
  const mode = S.srchMode || 'titres';
  const ph = mode === 'mouvements' ? 'Ticker, date, compte…' : 'Nom, ticker, secteur…';
  return `${renderTopBar()}
  <div style="padding:0 20px 10px">
    <div style="position:relative">
    <div class="search-box" id="js-srch-box">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      <input type="text" id="js-srch-inp" placeholder="${ph}" autocomplete="off" spellcheck="false" value="${esc(S.srchQuery||'')}">
      ${S.srchQuery?`<div class="search-clear" id="js-srch-clr">✕</div>`:''}
    </div>
    <div id="js-srch-ac" style="display:none;position:absolute;top:44px;left:0;right:0;background:var(--card);border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;z-index:20;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.15)"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <div class="hperiod${mode==='titres'?' on':''}" data-srchmode="titres">Titres</div>
      <div class="hperiod${mode==='mouvements'?' on':''}" data-srchmode="mouvements">Mouvements</div>
    </div>
  </div>
  <div id="js-srch-results">${srchResults(S.srchQuery||'', mode)}</div>`;
}

function srchResults(q, mode) {
  mode = mode || S.srchMode || 'titres';
  if (mode === 'mouvements') return srchTxResults(q);
  if(!q.trim()) {
    // No query — show all holdings grouped by account
    if(!S.accounts.length) return `<div style="text-align:center;padding:40px 20px;color:var(--text2);font-size:13px">Aucun compte</div>`;
    return S.accounts.map(acc=>{
      if(!acc.holdings.length) return '';
      const rows=acc.holdings.map(h=>srchRow(h,acc)).join('');
      return `<div style="margin-bottom:6px">
        <div style="padding:6px 20px 4px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3)">${acc.icon} ${esc(acc.name)}</div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">${rows}</div>
      </div>`;
    }).join('');
  }
  const ql=q.toLowerCase();
  const results=S.accounts.flatMap(acc=>
    acc.holdings
      .filter(h=>h.name.toLowerCase().includes(ql)||h.ticker.toLowerCase().includes(ql)||h.sector.toLowerCase().includes(ql)||h.type.toLowerCase().includes(ql))
      .map(h=>({h,acc}))
  );
  if(!results.length) return `<div style="text-align:center;padding:40px 20px;color:var(--text2)">
    <div style="font-size:32px;margin-bottom:10px">🔍</div>
    <div style="font-size:14px">Aucun résultat pour <strong>${esc(q)}</strong></div>
  </div>`;
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">
    ${results.map(({h,acc})=>srchRow(h,acc)).join('')}
  </div>`;
}

function srchRow(h, acc) {
  return `<div class="hold-item" data-hid="${h.id}" data-accid="${acc.id}">
    <div class="ticker" style="margin-top:2px">${h.ticker.slice(0,4)}</div>
    <div class="hold-item-body">
      <div class="hold-item-top">
        <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(h.name)}</div>
        <div style="font-size:14px;font-weight:800;flex-shrink:0" class="t-num">${masked(h.valueRef??h.value)}</div>
      </div>
      <div class="hold-item-bot">
        <div class="t-sm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(acc.name)} · ${h.type}</div>
        <div style="font-size:12px;font-weight:700;flex-shrink:0" class="${h.pnl>=0?'t-gain':'t-loss'}">${fmtPct(h.pnlPct)}</div>
      </div>
    </div>
  </div>`;
}

// ── RECHERCHE MOUVEMENTS ──
function srchTxResults(q) {
  const ql = q.trim().toLowerCase();
  const allTx = S.accounts.flatMap(acc =>
    acc.holdings.flatMap(h =>
      h.transactions.map(tx => ({ tx, h, acc }))
    )
  ).sort((a, b) => b.tx.date.localeCompare(a.tx.date));

  const filtered = ql
    ? allTx.filter(({ tx, h, acc }) =>
        h.ticker.toLowerCase().includes(ql) ||
        h.name.toLowerCase().includes(ql) ||
        tx.date.includes(ql) ||
        acc.name.toLowerCase().includes(ql) ||
        (tx.type==='BUY'  && ('achat'.includes(ql)||'ach'.includes(ql))) ||
        (tx.type==='SELL' && ('vente'.includes(ql)||'vte'.includes(ql))) ||
        (tx.type==='DIV'  && 'dividende'.includes(ql))
      )
    : allTx.slice(0, 30);

  if (!filtered.length) {
    if (!ql) return `<div style="text-align:center;padding:40px 20px;color:var(--text2);font-size:13px">Aucun mouvement enregistré</div>`;
    return `<div style="text-align:center;padding:40px 20px;color:var(--text2)">
      <div style="font-size:32px;margin-bottom:10px">🔍</div>
      <div style="font-size:14px">Aucun résultat pour <strong>${esc(q)}</strong></div>
    </div>`;
  }

  const rows = filtered.map(({ tx, h, acc }) => {
    const isDiv = tx.type === 'DIV', isBuy = tx.type === 'BUY';
    const dot = isDiv ? 'DIV' : isBuy ? 'ACH' : 'VTE';
    const cls = isDiv ? 'div' : isBuy ? 'buy' : 'sell';
    const total = tx.qty * tx.price;
    const hCur = h.currency || 'EUR';
    return `<div class="hold-item" data-hid="${h.id}" data-accid="${acc.id}">
      <div class="tx-dot ${cls}" style="flex-shrink:0">${dot}</div>
      <div class="hold-item-body">
        <div class="hold-item-top">
          <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(h.ticker)} · ${esc(h.name)}</div>
          <div style="font-size:13px;font-weight:800;flex-shrink:0" class="t-num ${isBuy?'t-loss':'t-gain'}">${isBuy?'-':'+'}${maskedNative(total,hCur)}</div>
        </div>
        <div class="hold-item-bot">
          <div class="t-sm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(acc.name)} · ${fmtDate(tx.date)}</div>
          <div class="t-sm" style="flex-shrink:0">${tx.qty} × ${fmtNative(tx.price,hCur)}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const header = !ql
    ? `<div style="padding:4px 20px 6px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3)">30 derniers mouvements</div>`
    : `<div style="padding:4px 20px 6px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3)">${filtered.length} résultat${filtered.length>1?'s':''}</div>`;

  return header + `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">${rows}</div>`;
}

// ── WATCHLIST CARD ──
function renderWatchlistCard() {
  if (!S.watchlist.length) return '';

  // Tri
  const sortMode = S.watchSort || 'default';
  const sorted = [...S.watchlist].sort((a, b) => {
    if (sortMode === 'perf_desc') return b.change1d - a.change1d;
    if (sortMode === 'perf_asc')  return a.change1d - b.change1d;
    return 0;
  });
  const sortLabel = {default:'—', perf_desc:'▲ Perf', perf_asc:'▼ Perf'}[sortMode];

  const rows = sorted.map(w => {
    const cur   = w.currency || SECURITIES_DB[w.ticker]?.currency || 'EUR';
    const delta = w.price * w.change1d / 100;
    const up    = w.change1d >= 0;
    return `<div class="watch-item tap" data-watch="${w.ticker}">
      <div class="watch-tick">${w.ticker.slice(0,4)}</div>
      <div class="flex1 col gap4" style="min-width:0">
        <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(w.name)}</div>
        <div class="t-sm">${fmtNative(w.price, cur)}</div>
      </div>
      <div class="col right gap4" style="align-items:flex-end">
        <div class="badge ${up?'up':'dn'}">${up?'▲':'▼'} ${Math.abs(w.change1d).toFixed(2)}%</div>
        <div style="font-size:11px;font-weight:600;color:${up?'var(--gain)':'var(--loss)'}">${up?'+':''}${fmtNative(Math.abs(delta), cur)}</div>
      </div>
      <div class="hold-del-btn tap" data-wdel="${w.ticker}" style="width:28px;height:28px;border-radius:8px;margin-left:6px;flex-shrink:0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </div>
    </div>`;
  }).join('');

  return `<div class="watch-card anim">
    <div class="watch-head">
      <div style="font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--text2)">Titres suivis</div>
      <div class="row gap8" style="align-items:center">
        <div id="js-watch-sort" class="tap" style="font-size:11px;font-weight:700;color:var(--accent);background:var(--accent-dim);border:1px solid var(--accent);padding:1px 8px;border-radius:6px;cursor:pointer" title="Trier">${sortLabel}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text2);background:var(--card2);border:1px solid var(--border);padding:1px 9px;border-radius:20px">${S.watchlist.length}</div>
        <div class="hold-add-btn" id="js-watch-add" style="width:28px;height:28px;border-radius:8px">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
      </div>
    </div>
    ${rows}
  </div>`;
}

// ── HISTORY CARD ──
function renderHistCard() {
  if (!S.accounts.length) return '';
  const periods = ['1S','1M','3M','1A'];
  const pills = periods.map(p => `<div class="hperiod${p===S.histPeriod?' on':''}" data-period="${p}">${p}</div>`).join('');
  const pts = genHistData(S.histPeriod);
  const chartW = Math.min(window.innerWidth, 480) - 72;
  const pct = ((pts[pts.length-1] - pts[0]) / pts[0] * 100);
  const color = pct >= 0 ? 'var(--gain)' : 'var(--loss)';
  const _real = !!pts.real;
  const _chip = `<span style="font-size:10px;font-weight:600;white-space:nowrap;color:${_real?'var(--gain)':'var(--text3)'}" title="${_real?'Historique réel — reconstitué à partir de vos cours et transactions, affiné chaque jour':'Courbe estimée — récupérez l’historique de vos titres pour la fiabiliser'}">${_real?'● réel':'○ estimé'}</span>`;
  return `<div class="hist-card anim">
    <div class="hist-head">
      <div class="row gap8" style="align-items:center"><div style="font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--text2)">Évolution du patrimoine</div>${_chip}</div>
      <div class="hist-periods">${pills}</div>
    </div>
    <div class="hist-wrap" id="js-hist-wrap">
      ${histSvg(pts, chartW, 80)}
      <div class="hist-tip" id="js-hist-tip"></div>
    </div>
    <div class="hist-range">
      <span>${masked(pts[0])}</span>
      <span style="font-weight:700;color:${color}">${pct>=0?'+':''}${pct.toFixed(2)}%</span>
      <span>${masked(pts[pts.length-1])}</span>
    </div>
  </div>`;
}

// ── ACCOUNT ──
const SORT_OPTS=[{key:'value',label:'Valeur'},{key:'pnl',label:'P&L €'},{key:'pnlPct',label:'P&L %'},{key:'name',label:'Nom'},{key:'type',label:'Type'}];
const SORT_DEFAULTS={value:-1,pnl:-1,pnlPct:-1,name:1,type:1};

function renderAccount() {
  const acc=S.accounts.find(a=>a.id===S.accountId); if(!acc) return '';
  const totPnl=acc.holdings.reduce((s,h)=>s+(h.pnlRef??h.pnl??0),0);
  const costBase=acc.value-totPnl;
  const totPnlPct=costBase>0?(totPnl/costBase)*100:0;
  const pills=SORT_OPTS.map(o=>{
    const on=S.sort===o.key;
    const arrow=on?(S.sortDir===-1?' ↓':' ↑'):'';
    return `<div class="sort-pill${on?' on':''}" data-sort="${o.key}" data-label="${o.label}">${o.label}${arrow}</div>`;
  }).join('');
  // Cashflow total
  const cfs=acc.cashflows||[];
  const totalDep=cfs.filter(c=>c.type==='DEP').reduce((s,c)=>s+c.amount,0);
  const totalWit=cfs.filter(c=>c.type==='WIT').reduce((s,c)=>s+c.amount,0);
  const netCf=totalDep-totalWit;
  return `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Retour
  </div>
  <div class="acc-hero">
    <div class="row gap10" style="margin-bottom:6px;align-items:center">
      <div style="font-size:26px">${acc.icon}</div>
      <div style="font-size:20px;font-weight:800;letter-spacing:-.5px;flex:1">${esc(acc.name)}${acc.observer?` <span class="obs-tag" style="font-size:10px;vertical-align:middle">Obs.</span>`:''}</div>
    </div>
    <div class="acc-hero-val t-num" id="js-acc-val">${masked(acc.value)}</div>
    <div class="stat-row">
      <div class="stat-box"><div class="t-label">P&amp;L Total</div>
        <div style="font-size:15px;font-weight:800" class="${totPnl>=0?'t-gain':'t-loss'} t-num">${totPnl>=0?'+':''}${masked(totPnl)}</div></div>
      <div class="stat-box"><div class="t-label">Performance</div>
        <div style="font-size:15px;font-weight:800" class="${totPnlPct>=0?'t-gain':'t-loss'} t-num">${fmtPct(totPnlPct)}</div></div>
      <div class="stat-box"><div class="t-label">Variation J</div>
        <div style="font-size:15px;font-weight:800" class="${acc.change1d>=0?'t-gain':'t-loss'} t-num">${fmtPct(acc.change1d)}</div></div>
    </div>
    ${cfs.length>0?`<div class="row gap8" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);align-items:center">
      <div style="flex:1">
        <div class="t-label">Apport net</div>
        <div style="font-size:14px;font-weight:800" class="${netCf>=0?'t-gain':'t-loss'} t-num">${netCf>=0?'+':''}${masked(netCf)}</div>
      </div>
      <div id="js-cf-btn" class="tap" style="padding:6px 14px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">Apports / Retraits</div>
    </div>`:'<div id="js-cf-btn" class="tap" style="display:inline-block;margin-top:10px;padding:6px 14px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">+ Apport / Retrait</div>'}
  </div>
  <div class="search-wrap">
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      <input type="text" id="js-search" placeholder="Rechercher une valeur…" value="${esc(S.search)}" autocomplete="off" spellcheck="false">
      ${S.search?`<div class="search-clear" id="js-clr">✕</div>`:''}
    </div>
  </div>
  <div class="sort-row">${pills}</div>
  <div class="ptr-bar" id="js-ptr">↓ Tirez pour actualiser</div>
  <div class="row" style="padding:12px 20px 6px;justify-content:space-between;align-items:center">
    <div class="t-section">Portefeuille</div>
    <div class="row gap8" style="align-items:center">
      <div id="js-hcnt" style="font-size:12px;font-weight:600;color:var(--text2)"></div>
      <div class="hold-add-btn" id="js-add-hold" title="Ajouter une position">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </div>
    </div>
  </div>
  <div id="js-holds"></div>`;
}

// ── HOLDS HELPERS ──
function getFilteredHoldings(acc) {
  let hs=[...acc.holdings];
  if(S.search){const q=S.search.toLowerCase();hs=hs.filter(h=>h.name.toLowerCase().includes(q)||h.ticker.toLowerCase().includes(q));}
  hs.sort((a,b)=>{
    if(S.sort==='name'||S.sort==='type') return S.sortDir*a[S.sort].localeCompare(b[S.sort]);
    return S.sortDir*(a[S.sort]-b[S.sort]);
  });
  return hs;
}

function renderHoldsHTML(acc) {
  const el=document.getElementById('js-holds'); if(!el) return;
  const cnt=document.getElementById('js-hcnt');
  const hs=getFilteredHoldings(acc);
  if(cnt) cnt.textContent=`${hs.length} valeur${hs.length!==1?'s':''}`;
  if(!hs.length){el.innerHTML=`<div style="text-align:center;padding:30px 20px;color:var(--text2);font-size:14px">Aucun résultat</div>`;return;}
  el.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">`+
    hs.map(h=>{
      const watched = !!S.watchlist.find(w => w.ticker === h.ticker);
      const weight  = acc.value > 0 ? ((h.valueRef ?? h.value) / acc.value * 100).toFixed(1) : '0';
      return `
      <div class="hold-item" data-hid="${h.id}">
        <div class="ticker" style="margin-top:2px">${h.ticker.slice(0,4)}</div>
        <div class="hold-item-body">
          <div class="hold-item-top">
            <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(h.name)}</div>
            <div class="col right" style="gap:1px;flex-shrink:0">
              <div style="font-size:14px;font-weight:800" class="t-num">${masked(h.valueRef??h.value)}</div>
              <div style="font-size:10px;color:var(--text3);text-align:right">${weight}%</div>
            </div>
          </div>
          <div class="hold-item-bot">
            <div class="t-sm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.quantity} × ${fmtNative(h.currentPrice, h.currency||'EUR')} · ${h.type}</div>
            <div style="font-size:12px;font-weight:700;flex-shrink:0" class="${h.pnl>=0?'t-gain':'t-loss'}">${fmtPct(h.pnlPct)}</div>
            <div class="hold-watch-btn" data-watch-hid="${h.id}" style="width:26px;height:26px;border-radius:7px;background:${watched?'rgba(245,158,11,.15)':'var(--card2)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:background .12s">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${watched?'#F59E0B':'none'}" stroke="${watched?'#F59E0B':'var(--text3)'}" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div class="hold-add-btn" data-add="${h.id}" style="width:26px;height:26px;border-radius:7px">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
            <div class="hold-del-btn" data-del="${h.id}" style="width:26px;height:26px;border-radius:7px">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')+
  `</div>`;
  // Navigate on row click (excluding action buttons)
  el.querySelectorAll('.hold-item').forEach(item=>{
    item.addEventListener('click',e=>{
      if(e.target.closest('.hold-del-btn')||e.target.closest('.hold-add-btn')||e.target.closest('.hold-watch-btn')) return;
      S.holdingId=item.dataset.hid; go('stock');
    });
  });
  // Étoile : toggle watchlist
  el.querySelectorAll('.hold-watch-btn').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const h = acc.holdings.find(h => h.id === b.dataset.watchHid);
    if (!h) return;
    const idx = S.watchlist.findIndex(w => w.ticker === h.ticker);
    haptic(idx >= 0 ? 6 : 12);
    if (idx >= 0) {
      S.watchlist.splice(idx, 1);
      toast(`${h.ticker} retiré des favoris`);
    } else {
      S.watchlist.push({ ticker: h.ticker, name: h.name, price: h.currentPrice, change1d: acc.change1d || 0, currency: h.currency || 'EUR' });
      toast(`${h.ticker} ajouté aux favoris ⭐`);
      // Animation pop sur le bouton étoile
      const starBtn = b.closest('.hold-watch-btn') || b;
      starBtn.classList.remove('star-pop');
      void starBtn.offsetWidth;
      starBtn.classList.add('star-pop');
    }
    saveAccounts();
    refreshMain();
    renderHoldsHTML(acc);
  }));
  el.querySelectorAll('.hold-add-btn[data-add]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    openAddOrder(S.accountId, b.dataset.add);
  }));
  el.querySelectorAll('.hold-del-btn').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    deleteHolding(S.accountId,b.dataset.del);
  }));
}


function deleteHolding(accId,holdId) {
  const acc=S.accounts.find(a=>a.id===accId); if(!acc) return;
  const h=acc.holdings.find(h=>h.id===holdId);
  if(!h) return;
  openConfirm(`Supprimer ${h.name} ?`, ()=>{
    acc.holdings=acc.holdings.filter(h=>h.id!==holdId);
    acc.value=accSum(acc.holdings);
    renderHoldsHTML(acc);
    refreshMain();
    toast('Position supprimée');
  });
}

function applyRefresh(accId) {
  S._histCache={};
  // Refresh watchlist prices
  S.watchlist.forEach(w=>{
    const chg=(Math.random()*.03-.01);
    w.price=+(w.price*(1+chg)).toFixed(2);
    w.change1d=+((Math.random()*4-1.5).toFixed(2));
  });
  const accs=accId?[S.accounts.find(a=>a.id===accId)]:S.accounts;
  accs.filter(Boolean).forEach(acc=>{
    acc.holdings.forEach(h=>{
      const chg=(Math.random()*.028-.006);
      h.currentPrice=+(h.currentPrice*(1+chg)).toFixed(2);
      h.value=+(h.quantity*h.currentPrice).toFixed(2);
      h.valueRef=+toRefCcy(h.value,h.currency).toFixed(2);
      h.pnl=(h.currentPrice-h.avgBuyPrice)*h.quantity;
      h.pnlRef=+toRefCcy(h.pnl,h.currency).toFixed(2);
      h.pnlPct=h.avgBuyPrice>0?((h.currentPrice-h.avgBuyPrice)/h.avgBuyPrice)*100:0;
    });
    acc.value=accSum(acc.holdings);
    acc.change1d=+(Math.random()*4-1).toFixed(2);
  });
}

function initPTR(screenEl, onRefresh) {
  // Le callback est rafraîchi à chaque render (closure fraîche), mais les listeners ne sont
  // attachés qu'une fois : l'élément écran persiste et les ré-attacher les empilait (double refresh,
  // rendu des positions de l'ancien compte).
  screenEl._ptrRefresh = onRefresh;
  if (screenEl._ptrBound) return;
  screenEl._ptrBound = true;
  let y0=0,pulling=false,dist=0;
  const bar=()=>screenEl.querySelector('#js-ptr'); // re-query : le bar est recréé à chaque render
  screenEl.addEventListener('touchstart',e=>{
    if(!bar()||e.target.closest('.hold-item')) return;
    if(screenEl.scrollTop===0){y0=e.touches[0].clientY;pulling=false;dist=0;}
  },{passive:true});
  screenEl.addEventListener('touchmove',e=>{
    const b=bar(); if(!b||screenEl.scrollTop>2) return;
    const dy=e.touches[0].clientY-y0;
    if(dy>12){pulling=true;dist=dy;b.classList.add('open');b.textContent=dy>60?'↑ Relâchez pour actualiser':'↓ Tirez pour actualiser';}
  },{passive:true});
  screenEl.addEventListener('touchend',()=>{
    const b=bar(); if(!b||!pulling) return;
    if(dist>60){
      b.innerHTML='<span class="ptr-spin">↻</span> Actualisation…';
      setTimeout(()=>{screenEl._ptrRefresh();b.classList.remove('open');},900);
    } else {b.classList.remove('open');}
    pulling=false; dist=0;
  },{passive:true});
}

// ── STOCK ──
function renderStock() {
  const acc=S.accounts.find(a=>a.id===S.accountId); if(!acc) return '';
  const h=acc.holdings.find(h=>h.id===S.holdingId); if(!h) return '';
  const hCur=h.currency||'EUR';
  const fmt=v=>maskedNative(v,hCur);
  const fmtE=v=>masked(v); // account currency
  const invested=h.avgBuyPrice*h.quantity;
  const pnl=h.value-invested;
  const pnlPct=invested>0?(pnl/invested)*100:0;
  const chartW=Math.min(window.innerWidth,480);

  const divTotal=h.transactions.filter(t=>t.type==='DIV').reduce((s,t)=>s+t.qty*t.price,0);
  const realizedPnL=computeRealizedPnL(h);

  // P/L produit (FX-neutral, in native currency)
  const showProduit=hCur!==S.currency;
  const pnlProduit=(h.currentPrice-h.avgBuyPrice)*h.quantity; // in native currency
  // Note : sans FX historique aux dates d'achat, un « effet change » n'est pas calculable
  // (pnl et pnlProduit sont identiques par construction) — on affiche le P&L converti à la place.
  const pnlRefDisp=h.pnlRef ?? toRefCcy(pnlProduit,hCur);

  const txs=[...h.transactions].map((tx,idx)=>({tx,idx})).reverse().map(({tx,idx})=>{
    const tot=tx.qty*tx.price;
    const isDiv=tx.type==='DIV';
    const isBuy=tx.type==='BUY';
    const dot=isDiv?'DIV':isBuy?'ACH':'VTE';
    const cls=isDiv?'div':isBuy?'buy':'sell';
    const subLabel=`${tx.qty} × ${fmtNative(tx.price,hCur)}`;
    const valCls=isDiv?'t-gain':isBuy?'t-loss':'t-gain';
    const sign=isDiv?'+':isBuy?'-':'+';
    const typeLabel=isDiv?'Dividende':isBuy?'Achat':'Vente';
    return `<div class="tx-item" data-txidx="${idx}">
      <div class="tx-dot ${cls}">${dot}</div>
      <div class="flex1 col gap4">
        <div style="font-size:13px;font-weight:600">${fmtDate(tx.date)}</div>
        <div class="t-sm">${subLabel}</div>
      </div>
      <div class="col right gap4" style="margin-right:8px">
        <div style="font-size:14px;font-weight:800" class="${valCls} t-num">${sign}${maskedNative(tot,hCur)}</div>
        <div class="t-sm">${typeLabel}</div>
      </div>
      <div class="tx-edit-btn tap" data-txidx="${idx}" title="Modifier">✏️</div>
      <div class="tx-del-btn tap" data-txidx="${idx}" title="Supprimer">🗑</div>
    </div>`;
  }).join('');

  const _isWatched = !!S.watchlist.find(w => w.ticker === h.ticker);
  const _hist = getHistorySeries(h.ticker);
  const _histChip = `<span style="font-size:10px;font-weight:600;white-space:nowrap;color:${_hist?'var(--gain)':'var(--text3)'}" title="${_hist?('Historique réel · '+timeSince(_hist.fetchedAt)):'Courbe estimée — touchez l’icône historique pour récupérer les vrais cours'}">${_hist?'● réel':'○ estimé'}</span>`;
  return `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    ${esc(acc.name)}
  </div>
  <div class="stock-hero" style="border-bottom:none;padding-bottom:8px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div>
        <div class="stock-ticker-badge">${esc(h.ticker)}${showProduit?` <span style="font-size:10px;opacity:.7">${hCur}</span>`:''}</div>
        <div style="font-size:19px;font-weight:800;letter-spacing:-.4px">${esc(h.name)}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;margin-top:4px">
        <div id="js-edit-holding" class="tap" style="width:36px;height:36px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2)" title="Modifier ce titre">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </div>
        <div id="js-watch-toggle" class="tap" style="width:36px;height:36px;border-radius:50%;background:${_isWatched?'rgba(245,158,11,.15)':'var(--card2)'};border:1px solid ${_isWatched?'#F59E0B':'var(--border)'};display:flex;align-items:center;justify-content:center" title="${_isWatched?'Retirer des favoris':'Ajouter aux favoris'}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${_isWatched?'#F59E0B':'none'}" stroke="${_isWatched?'#F59E0B':'var(--text2)'}" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
      <div class="stock-price t-num" style="margin:0">${fmtNative(h.currentPrice,hCur)}</div>
      <div id="js-ticker-refresh" class="tap" style="width:34px;height:34px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2);flex-shrink:0" title="Actualiser ce titre">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </div>
      <div id="js-ticker-history" class="tap" style="width:34px;height:34px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2);flex-shrink:0" title="Reprendre l’historique réel des cours">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
      </div>
    </div>
    <div class="row gap8" style="margin-top:4px">
      <div class="badge ${pnl>=0?'up':'dn'}">${pnl>=0?'▲':'▼'} ${Math.abs(pnlPct).toFixed(2)}%</div>
      <span class="t-sm">${h.type} · ${h.country} · ${h.sector}</span>
    </div>
  </div>
  <div class="stock-chart-wrap" id="js-stock-chart-wrap" style="padding:8px 0 0">
    ${stockChartSvg(h,chartW,120,S.stockPeriod||'MAX')}
    <div class="stock-chart-tip" id="js-stock-chart-tip"></div>
  </div>
  <div style="display:flex;align-items:center;padding:6px 16px 2px;gap:6px;overflow-x:auto">
    ${['1M','3M','6M','1A','MAX'].map(p=>`<div class="hperiod${(S.stockPeriod||'MAX')===p?' on':''}" data-speriod="${p}">${p}</div>`).join('')}
  </div>
  <div style="display:flex;align-items:center;padding:5px 16px 10px;gap:10px">
    <div style="width:14px;height:0;border-top:2px dashed #2563eb;opacity:.8"></div><span style="font-size:10px;color:var(--text3)">PRU</span>
    <div style="width:10px;height:2px;background:var(--gain);border-radius:1px;opacity:.8"></div><span style="font-size:10px;color:var(--text3)">Achat</span>
    <div style="width:10px;height:2px;background:var(--loss);border-radius:1px;opacity:.8"></div><span style="font-size:10px;color:var(--text3)">Vente</span>
    ${_histChip}
    <div style="flex:1"></div>
    <span style="font-size:10px;color:var(--text3);font-style:italic">Tap pour verrouiller</span>
  </div>
  <div class="metrics">
    <div class="metric"><div class="t-label">Quantité</div><div class="metric-val">${h.quantity}</div></div>
    <div class="metric"><div class="t-label">PRU (${hCur})</div><div class="metric-val t-num">${fmtNative(h.avgBuyPrice,hCur)}</div></div>
    <div class="metric"><div class="t-label">Investi (${hCur})</div><div class="metric-val t-num">${fmt(invested)}</div></div>
    <div class="metric"><div class="t-label">P&amp;L latent (${hCur})</div><div class="metric-val ${pnlProduit>=0?'t-gain':'t-loss'} t-num">${pnlProduit>=0?'+':''}${fmt(pnlProduit)}</div></div>
    <div class="metric"><div class="t-label">Valeur (${hCur})</div><div class="metric-val t-num">${fmt(h.quantity*h.currentPrice)}</div></div>
    <div class="metric"><div class="t-label">P&amp;L latent %</div><div class="metric-val ${pnlPct>=0?'t-gain':'t-loss'} t-num">${fmtPct(pnlPct)}</div></div>
    ${realizedPnL!==0?`<div class="metric"><div class="t-label">P&amp;L réalisé (${hCur})</div><div class="metric-val ${realizedPnL>=0?'t-gain':'t-loss'} t-num">${realizedPnL>=0?'+':''}${maskedNative(realizedPnL,hCur)}</div></div>`:''}
    ${showProduit?`<div class="metric"><div class="t-label">P&amp;L latent (${S.currency})</div><div class="metric-val ${pnlRefDisp>=0?'t-gain':'t-loss'} t-num">${pnlRefDisp>=0?'+':''}${fmtE(pnlRefDisp)}</div></div>`:''}
    ${divTotal>0?`<div class="metric" style="grid-column:1/-1"><div class="t-label">Dividendes perçus (${hCur})</div><div class="metric-val t-gain t-num">+${maskedNative(divTotal,hCur)}</div></div>`:''}
  </div>
  <div class="row" style="padding:4px 20px 10px;justify-content:space-between;align-items:center">
    <div class="t-section">Mouvements</div>
    <div style="font-size:12px;font-weight:600;color:var(--text2)">${h.transactions.length}</div>
  </div>
  <div id="js-tx-list">${txs}</div>`;
}

// ── TARGETS BLOCK ──
function renderTargetsBlock(byType, tot) {
  const types = ['Action','ETF','Obligation','Cash'];
  const colors = { Action:'#4F8EF7', ETF:'#00C2CB', Obligation:'#00D68F', Cash:'#F59E0B' };
  const rows = types.map(t => {
    const actual = tot > 0 ? (byType[t] || 0) / tot * 100 : 0;
    const target = S.targets[t] || 0;
    const dev = actual - target;
    const devColor = Math.abs(dev) < 2 ? 'var(--text2)' : dev > 0 ? 'var(--gain)' : 'var(--loss)';
    const devStr = (dev >= 0 ? '+' : '') + dev.toFixed(1) + '%';
    const tgtMarkPct = Math.min(100, target);
    return `<div class="tgt-row">
      <div class="tgt-label">${t}</div>
      <div class="tgt-bars">
        <div class="tgt-bar-bg">
          <div class="tgt-bar-actual" style="width:${Math.min(100,actual).toFixed(1)}%;background:${colors[t]}"></div>
          <div class="tgt-mark-line" style="left:${tgtMarkPct.toFixed(1)}%"></div>
        </div>
      </div>
      <input class="tgt-inp" data-type="${t}" type="number" min="0" max="100" value="${target}" title="Objectif %">
      <span style="font-size:10px;color:var(--text3)">%</span>
      <div class="tgt-dev" style="color:${devColor}">${devStr}</div>
    </div>`;
  }).join('');
  const totalTarget = types.reduce((s,t) => s + (S.targets[t]||0), 0);
  const totColor = Math.abs(totalTarget - 100) < 1 ? 'var(--gain)' : 'var(--loss)';
  return `<div class="tgt-block anim">
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Cliquez sur les % pour les modifier · barre bleue = objectif</div>
    ${rows}
    <div style="display:flex;justify-content:flex-end;gap:4px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <span style="font-size:11px;color:var(--text2)">Total objectifs :</span>
      <span style="font-size:11px;font-weight:800;color:${totColor}">${totalTarget}%</span>
    </div>
  </div>`;
}

// ── ANALYSIS ──
const GEO_C=['#4F8EF7','#F59E0B','#00D68F','#A78BFA','#FF5A5A','#F97316'];
const TYPE_C={'Action':'#4F8EF7','ETF':'#00C2CB','Obligation':'#00D68F','Cash':'#F59E0B'};
const SEC_C=['#4F8EF7','#00C2CB','#00D68F','#F59E0B','#A78BFA','#FF5A5A','#F97316','#EC4899'];

function buildSegs(obj, colors) {
  const tot=Object.values(obj).reduce((s,v)=>s+v,0);
  return Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([name,value],i)=>({
    name, value,
    color: colors[name]||colors[i%colors.length],
    pct: tot>0?(value/tot*100).toFixed(1):'0.0'
  }));
}
function donutBlock(title, segs) {
  const legend=segs.map(s=>`<div class="legend-row">
    <div class="leg-dot" style="background:${s.color}"></div>
    <div class="leg-name">${esc(s.name)}</div>
    <div class="leg-pct" style="color:${s.color}">${s.pct}%</div>
  </div>`).join('');
  return `<div class="donut-block anim">
    ${donutSvg(segs,108,16)}
    <div class="legend">${legend}</div>
  </div>`;
}

function renderAnalysis() {
  const all=S.accounts.flatMap(a=>a.holdings);
  const tot=all.reduce((s,h)=>s+(h.valueRef??h.value),0); // devise appli — h.value est en devise native
  if(!all.length) return `<div class="analysis-top"><div class="t-title">Analyse</div></div>
    <div style="text-align:center;padding:60px 20px;color:var(--text2)">
      <div style="font-size:40px;margin-bottom:12px">📈</div>
      <div style="font-size:15px;font-weight:600">Aucune donnée</div>
    </div>`;
  const byType={}, byGeo={}, bySec={};
  all.forEach(h=>{
    const v=h.valueRef??h.value;
    byType[h.type]=(byType[h.type]||0)+v;
    byGeo[h.country]=(byGeo[h.country]||0)+v;
    bySec[h.sector]=(bySec[h.sector]||0)+v;
  });
  return `<div class="analysis-top anim">
    ${renderTopBar(`<span class="t-sm" style="margin-right:4px">Tous comptes · ${masked(tot)}</span>`)}
  </div>
  <div style="height:10px"></div>
  <div class="t-section px" style="padding-bottom:10px">Objectifs d'allocation</div>
  ${renderTargetsBlock(byType, tot)}
  <div class="t-section px" style="padding-bottom:10px">Par type d'actif</div>
  ${donutBlock('',buildSegs(byType,TYPE_C))}
  <div class="t-section px" style="padding-bottom:10px">Répartition géographique</div>
  ${donutBlock('',buildSegs(byGeo,GEO_C))}
  <div class="t-section px" style="padding-bottom:10px">Par secteur</div>
  ${donutBlock('',buildSegs(bySec,SEC_C))}`;
}

// ── ASSISTANT IA (moteur de recommandations local) ──
// Analyse 100% déterministe, hors-ligne, aucune donnée envoyée.
// Renvoie une liste de recos triées par sévérité (3 = important, 2 = à surveiller, 1 = suggestion).
function analyzePortfolio(S) {
  const recos = [];
  const accs = S.accounts.filter(a => !a.observer);
  const all  = accs.flatMap(a => a.holdings.map(h => ({ h, acc: a })));
  const vOf  = h => (h.valueRef ?? h.value ?? 0);
  const tot  = all.reduce((s, x) => s + vOf(x.h), 0);
  if (!all.length || tot <= 0) return recos;
  const appCcy = S.currency || 'EUR';
  const pct = v => (v / tot) * 100;

  // 1. Concentration par titre (agrégé par ticker, tous comptes confondus)
  const byTicker = {};
  all.forEach(({ h, acc }) => {
    const k = h.ticker || h.name || '?';
    if (!byTicker[k]) byTicker[k] = { val: 0, name: h.name || k, accId: acc.id, holdId: h.id, n: 0 };
    byTicker[k].val += vOf(h); byTicker[k].n++;
  });
  Object.values(byTicker).forEach(t => {
    const w = pct(t.val);
    const link = t.n === 1 ? { accId: t.accId, holdId: t.holdId } : {};
    if (w >= 25) recos.push({ sev: 3, icon: '⚠️', title: `Surexposition : ${t.name}`,
      detail: `Ce titre pèse ${w.toFixed(0)} % du portefeuille. Une forte baisse aurait un impact majeur — envisagez d'alléger ou de diversifier.`, ...link });
    else if (w >= 15) recos.push({ sev: 2, icon: '📊', title: `Forte pondération : ${t.name}`,
      detail: `${w.toFixed(0)} % du portefeuille concentré sur une seule ligne. À surveiller.`, ...link });
  });

  // 2. Nombre de lignes
  const nLignes = Object.keys(byTicker).length;
  if (nLignes < 5) recos.push({ sev: 2, icon: '🧩', title: 'Portefeuille peu diversifié',
    detail: `Seulement ${nLignes} ligne${nLignes > 1 ? 's' : ''} en portefeuille. Multiplier les positions réduit le risque spécifique.` });

  // 3. Concentration sectorielle
  const bySec = {};
  all.forEach(({ h }) => { const k = h.sector || 'Autre'; bySec[k] = (bySec[k] || 0) + vOf(h); });
  const topSec = Object.entries(bySec).sort((a, b) => b[1] - a[1])[0];
  if (topSec && pct(topSec[1]) >= 40) recos.push({ sev: 2, icon: '🏭', title: `Concentration sectorielle : ${topSec[0]}`,
    detail: `${pct(topSec[1]).toFixed(0)} % de l'exposition sur un seul secteur. Diversifier les secteurs lisse la performance.` });

  // 4. Diversification géographique
  const byGeo = {};
  all.forEach(({ h }) => { const k = h.country || 'Autre'; byGeo[k] = (byGeo[k] || 0) + vOf(h); });
  const topGeo = Object.entries(byGeo).sort((a, b) => b[1] - a[1])[0];
  if (topGeo && pct(topGeo[1]) >= 60) recos.push({ sev: 1, icon: '🌍', title: `Exposition géographique : ${topGeo[0]}`,
    detail: `${pct(topGeo[1]).toFixed(0)} % concentré sur une zone. Une exposition internationale diversifie le risque pays.` });

  // 5. Exposition au risque de change
  const byCcy = {};
  all.forEach(({ h }) => { const k = h.currency || appCcy; byCcy[k] = (byCcy[k] || 0) + vOf(h); });
  const foreign = Object.entries(byCcy).filter(([k]) => k !== appCcy).reduce((s, [, v]) => s + v, 0);
  if (pct(foreign) >= 40) recos.push({ sev: 2, icon: '💱', title: 'Exposition au risque de change',
    detail: `${pct(foreign).toFixed(0)} % du portefeuille est libellé hors ${appCcy}. Les variations de change affectent directement sa valeur.` });

  // 6. Fortes moins-values vs PRU
  all.filter(({ h }) => (h.pnlPct ?? 0) <= -20).sort((a, b) => (a.h.pnlPct ?? 0) - (b.h.pnlPct ?? 0)).slice(0, 3)
    .forEach(({ h, acc }) => recos.push({ sev: 2, icon: '📉', title: `Forte moins-value : ${h.name || h.ticker}`,
      detail: `${fmtPct(h.pnlPct ?? 0)} vs PRU. Réévaluez la thèse d'investissement ou envisagez un arbitrage.`, accId: acc.id, holdId: h.id }));

  // 7. Fortes plus-values vs PRU
  all.filter(({ h }) => (h.pnlPct ?? 0) >= 50).sort((a, b) => (b.h.pnlPct ?? 0) - (a.h.pnlPct ?? 0)).slice(0, 2)
    .forEach(({ h, acc }) => recos.push({ sev: 1, icon: '🚀', title: `Belle plus-value : ${h.name || h.ticker}`,
      detail: `${fmtPct(h.pnlPct ?? 0)} vs PRU. Vous pourriez sécuriser une partie des gains.`, accId: acc.id, holdId: h.id }));

  // 8. Allocation vs objectifs
  const byType = {};
  all.forEach(({ h }) => { const k = h.type || 'Autre'; byType[k] = (byType[k] || 0) + vOf(h); });
  Object.entries(S.targets || {}).forEach(([type, target]) => {
    const cur = pct(byType[type] || 0);
    const d = cur - target;
    if (Math.abs(d) >= 15) recos.push({ sev: 1, icon: '🎯', title: `Allocation ${type} hors objectif`,
      detail: `Actuel ${cur.toFixed(0)} % vs objectif ${target} % (${d > 0 ? '+' : ''}${d.toFixed(0)} pts) — ${d > 0 ? 'surpondéré' : 'sous-pondéré'}.` });
  });

  // 9. Liquidités dormantes
  const cashW = pct(byType['Cash'] || 0);
  if (cashW >= 15) recos.push({ sev: 1, icon: '💰', title: 'Liquidités importantes',
    detail: `${cashW.toFixed(0)} % en cash. Des liquidités dormantes perdent de la valeur avec l'inflation — envisagez de les investir.` });

  // 10. Watchlist — mouvements notables du jour
  (S.watchlist || []).filter(w => Math.abs(w.change1d ?? 0) >= 3).slice(0, 3).forEach(w => {
    const up = (w.change1d ?? 0) >= 0;
    recos.push({ sev: 1, icon: up ? '📈' : '📉', title: `Suivi : ${w.name || w.ticker} ${fmtPct(w.change1d ?? 0)}`,
      detail: `Mouvement notable aujourd'hui sur un titre de votre liste de suivi.` });
  });

  recos.sort((a, b) => b.sev - a.sev);
  return recos;
}

// Nombre de recommandations « importantes » (sévérité 3) — pour la pastille du bouton ✨.
// Recalculé à chaque rendu de la barre (donc après chaque refreshMain / actualisation des cours).
function assistantAlertCount() {
  if (!S.assistantEnabled) return 0;
  try { return analyzePortfolio(S).filter(r => r.sev === 3).length; }
  catch(e) { return 0; }
}

function renderAssistant() {
  const recos  = analyzePortfolio(S);
  const hasData = S.accounts.some(a => a.holdings.length);
  const SEV = {
    3: { bg: 'var(--loss-dim)',   col: 'var(--loss)' },
    2: { bg: 'rgba(245,158,11,.12)', col: '#F59E0B' },
    1: { bg: 'var(--accent-dim)', col: 'var(--accent)' },
  };
  const header = `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Retour
  </div>
  <div class="settings-top" style="padding-top:4px">
    <div class="t-title">Assistant IA</div>
    <div class="t-sm" style="margin-top:2px">Analyse automatique de vos comptes et titres</div>
  </div>`;

  if (!hasData) return header + `<div style="text-align:center;padding:60px 20px;color:var(--text2)">
    <div style="font-size:40px;margin-bottom:12px">🤖</div>
    <div style="font-size:15px;font-weight:600">Aucune donnée à analyser</div>
    <div class="t-sm" style="margin-top:6px">Ajoutez des comptes et des titres pour obtenir des recommandations.</div>
  </div>`;

  let body;
  if (!recos.length) {
    body = `<div class="s-group"><div class="s-item">
      <div class="s-ico" style="background:var(--gain-dim)"><svg viewBox="0 0 24 24" fill="var(--gain)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>
      <div class="flex1 col gap4"><div class="s-name">Portefeuille équilibré</div><div class="s-sub">Aucun point d'attention détecté selon les règles d'analyse.</div></div>
    </div></div>`;
  } else {
    const cards = recos.map(r => {
      const sv = SEV[r.sev] || SEV[1];
      const clickable = r.holdId && r.accId;
      return `<div class="s-item ${clickable ? 'tap js-reco' : ''}" ${clickable ? `data-acc="${r.accId}" data-hold="${r.holdId}"` : ''}>
        <div class="s-ico" style="background:${sv.bg};font-size:18px">${r.icon}</div>
        <div class="flex1 col gap4">
          <div class="s-name" style="color:${sv.col}">${esc(r.title)}</div>
          <div class="s-sub">${esc(r.detail)}</div>
        </div>
        ${clickable ? `<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>` : ''}
      </div>`;
    }).join('');
    const n = recos.length;
    body = `<div class="s-section">${n} recommandation${n > 1 ? 's' : ''}</div><div class="s-group">${cards}</div>`;
  }

  const disclaimer = `<div class="t-sm" style="padding:14px 16px 30px;color:var(--text3);text-align:center;line-height:1.6">
    ℹ️ Analyse automatique fournie à titre informatif uniquement.<br>Ceci ne constitue pas un conseil en investissement.
  </div>`;

  return header + `<div style="height:8px"></div>` + body + disclaimer;
}

// ── SETTINGS ──
function fxSubText() { return PU.fxSubText(FX_RATES, S.currency || 'EUR', _fxUpdatedAt); }

function renderFxModalRows() {
  const appCcy = S.currency || 'EUR';
  const appFx  = FX_RATES[appCcy] || 1;
  const ALL_CCY = [
    { ccy:'EUR', symbol:'€',  flag:'🇪🇺', label:'Euro' },
    { ccy:'USD', symbol:'$',  flag:'🇺🇸', label:'Dollar US' },
    { ccy:'GBP', symbol:'£',  flag:'🇬🇧', label:'Livre sterling' },
    { ccy:'CHF', symbol:'Fr', flag:'🇨🇭', label:'Franc suisse' },
    { ccy:'JPY', symbol:'¥',  flag:'🇯🇵', label:'Yen japonais' },
  ];
  const pairs = ALL_CCY.filter(p => p.ccy !== appCcy);
  const ageStr = _fxUpdatedAt
    ? 'Mis à jour ' + timeSince(_fxUpdatedAt)
    : 'Valeurs approximatives (non actualisées)';
  const rows = pairs.map((p, i) => {
    const rate = (FX_RATES[p.ccy] || 1) / appFx;
    const rateStr = rate >= 10 ? rate.toFixed(2) : rate.toFixed(4);
    const border = i < pairs.length - 1 ? `border-bottom:1px solid var(--border)` : '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;${border}">
      <div style="font-size:24px;flex-shrink:0;width:32px;text-align:center">${p.flag}</div>
      <div class="flex1 col gap4">
        <div style="font-size:14px;font-weight:700">${appCcy} / ${p.ccy}</div>
        <div class="t-sm">${p.label}</div>
      </div>
      <div class="t-num" style="text-align:right">
        <span style="font-size:18px;font-weight:800">${rateStr}</span>
        <span style="font-size:12px;color:var(--text2);margin-left:3px">${p.symbol}</span>
      </div>
    </div>`;
  }).join('');
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:0 16px;margin-bottom:12px">${rows}</div>
  <div class="t-sm" style="text-align:center;color:var(--text3)">${ageStr}</div>`;
}

function renderSettings() {
  const demo=S.isDemo;
  return `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Retour
  </div>
  <div class="settings-top" style="padding-top:4px">
    <div class="t-title">Réglages</div>
  </div>
  <div class="s-section">Profil</div>
  <div class="s-group">
    <div class="s-item">
      <div class="s-ico" style="background:var(--accent-dim)">
        <svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Nom</div></div>
      <input class="s-input" id="js-name" value="${esc(S.user.name)}" placeholder="Votre nom">
    </div>
  </div>
  <div class="s-section">Données</div>
  <div class="s-group">
    <div class="s-item tap" id="js-demo-row">
      <div class="s-ico" style="background:rgba(0,194,203,.12)">
        <svg viewBox="0 0 24 24" fill="#00C2CB"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Mode démo</div><div class="s-sub">Données d'exemple — modifiables et persistées</div></div>
      <div class="toggle ${demo?'on':''}" id="js-demo-tog"><div class="toggle-thumb"></div></div>
    </div>
    ${demo?`<div class="s-item tap" id="js-demo-reset">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Réinitialiser les données démo</div><div class="s-sub">Recharge les données d'exemple d'origine</div></div>
    </div>`:''}
    <div class="s-item tap" id="js-csv-btn">
      <div class="s-ico" style="background:rgba(0,214,143,.12)">
        <svg viewBox="0 0 24 24" fill="#00D68F"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Importer CSV</div><div class="s-sub">Colonnes : account, ticker, name, date, type, quantity, price</div></div>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </div>
  </div>
  <div class="s-section">Stockage</div>
  <div class="s-group">
    <div class="s-item tap" id="js-export-btn">
      <div class="s-ico" style="background:rgba(99,102,241,.12)">
        <svg viewBox="0 0 24 24" fill="#6366F1"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Exporter les données</div>
        <div class="s-sub">Télécharge comptes &amp; transactions en JSON</div>
      </div>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </div>
    <div class="s-item tap" id="js-clear-prices">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Effacer le cache des prix</div>
        <div class="s-sub" id="js-price-cache-age">${(()=>{const p=loadPrices();return p?'Mis à jour '+timeSince(p.updatedAt):'Aucun cache enregistré';})()}</div>
      </div>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </div>
    <div class="s-item tap" id="js-reset-all">
      <div class="s-ico" style="background:var(--loss-dim)">
        <svg viewBox="0 0 24 24" fill="var(--loss)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name" style="color:var(--loss)">Réinitialiser les données</div>
        <div class="s-sub">Supprime comptes et transactions · réglages conservés</div>
      </div>
    </div>
  </div>

  <div class="s-section">Cours en direct</div>
  <div class="s-group">
    <div class="s-item tap" id="js-autorefresh-tog">
      <div class="s-ico" style="background:rgba(0,194,203,.12)">
        <svg viewBox="0 0 24 24" fill="#00C2CB"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Actualisation auto</div>
        <div class="s-sub">Rafraîchit les cours au démarrage</div>
      </div>
      <div class="toggle ${S.autoRefresh?'on':''}" id="js-autorefresh-inner"><div class="toggle-thumb"></div></div>
    </div>
    <div class="sep"></div>
    <div class="s-item tap" id="js-fx-row">
      <div class="s-ico" style="background:rgba(99,102,241,.12)">
        <svg viewBox="0 0 24 24" fill="#6366F1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.38 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Cours de change</div>
        <div class="s-sub" id="js-fx-sub">${fxSubText()}</div>
      </div>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </div>
  </div>
  <div class="s-section" style="color:var(--text3)">Clés API — fallback si proxy indisponible</div>
  <div class="s-group">
    <div class="s-item">
      <div class="s-ico" style="background:rgba(0,214,143,.08)">
        <svg viewBox="0 0 24 24" fill="#00D68F" opacity=".6"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name" style="color:var(--text2)">Twelve Data <a class="api-link" href="https://twelvedata.com" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a></div>
        <div class="s-sub">Fallback · 800 req/jour · actions US</div>
      </div>
      <input class="s-input" id="js-price-key" value="${S.priceApiKey||''}" placeholder="Clé API" style="max-width:110px;font-size:11px;opacity:.8">
    </div>
    <div class="s-item">
      <div class="s-ico" style="background:rgba(99,102,241,.08)">
        <svg viewBox="0 0 24 24" fill="#6366F1" opacity=".6"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm1 14.5h-2v-4.5H9l3-5.5 3 5.5h-2v4.5z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name" style="color:var(--text2)">Financial Modeling Prep <a class="api-link" href="https://financialmodelingprep.com/developer/docs" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a></div>
        <div class="s-sub">Fallback · 250 req/jour · EU + US</div>
      </div>
      <input class="s-input" id="js-fmp-key" value="${S.fmpApiKey||''}" placeholder="Clé API" style="max-width:110px;font-size:11px;opacity:.8">
    </div>
  </div>

  <div class="s-section">Débogage</div>
  <div class="s-group">
    <div class="s-item tap" id="js-debug-tog">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Mode débogage</div>
        <div class="s-sub">Affiche les erreurs réseau détaillées</div>
      </div>
      <div class="toggle ${S.debug?'on':''}" id="js-debug-tog-inner"><div class="toggle-thumb"></div></div>
    </div>
    ${S.debug && S._debugLog.length ? `
    <div style="padding:12px 16px;border-top:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Dernier log réseau</div>
      <div id="js-debug-log" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:11px;font-family:monospace;line-height:1.7;color:var(--text2);max-height:260px;overflow-y:auto;white-space:pre-wrap;word-break:break-all">${S._debugLog.map(l=>{
        const col=l.startsWith('[OK')  ?'var(--gain)'
                 :l.startsWith('[ERR') ?'var(--loss)'
                 :l.startsWith('[WRN') ?'#F59E0B'
                 :'var(--text2)';
        return `<span style="color:${col}">${l.replace(/</g,'&lt;')}</span>`;
      }).join('\n')}</div>
      <div style="display:flex;justify-content:flex-end;gap:14px;margin-top:8px">
        <div class="tap" id="js-debug-copy" style="font-size:12px;color:var(--accent);font-weight:600">Copier 📋</div>
        <div class="tap" id="js-debug-clear" style="font-size:12px;color:var(--text3)">Effacer ↺</div>
      </div>
    </div>` : ''}
  </div>

  <div class="s-section">Assistant IA</div>
  <div class="s-group">
    <div class="s-item tap" id="js-assistant-tog">
      <div class="s-ico" style="background:var(--accent-dim)">
        <svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15.5l-2.6.95L18 19l-.9-2.55L14.5 15.5l2.6-1L18 12z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Assistant IA</div>
        <div class="s-sub">Recommandations locales sur vos comptes et titres</div>
      </div>
      <div class="toggle ${S.assistantEnabled ? 'on' : ''}" id="js-assistant-inner"><div class="toggle-thumb"></div></div>
    </div>
  </div>

  <div class="s-section">Préférences</div>
  <div class="s-group">
    <div class="s-item">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-4h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Devise</div></div>
      <div class="cur-opts">
        <div class="cur-opt tap ${S.currency==='EUR'?'on':''}" data-cur="EUR">EUR</div>
        <div class="cur-opt tap ${S.currency==='USD'?'on':''}" data-cur="USD">USD</div>
      </div>
    </div>
    <div class="s-item">
      <div class="s-ico" style="background:rgba(167,139,250,.12)">
        <svg viewBox="0 0 24 24" fill="#A78BFA"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Thème</div></div>
      <div class="cur-opts">
        <div class="cur-opt tap ${S.theme==='auto'?'on':''}" data-theme-opt="auto">Auto</div>
        <div class="cur-opt tap ${S.theme==='light'?'on':''}" data-theme-opt="light">☀</div>
        <div class="cur-opt tap ${S.theme==='dark'?'on':''}" data-theme-opt="dark">🌙</div>
      </div>
    </div>
  </div>
  <div class="s-section">À propos</div>
  <div class="s-group">
    <div class="s-item">
      <div class="s-ico" style="background:var(--accent-dim)">
        <svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Mon patrimoine</div><div class="s-sub">Version ${APP_VERSION} — Juillet 2026 · Suivi de patrimoine</div></div>
    </div>
    <div class="s-item tap" id="js-open-changelog" style="cursor:pointer">
      <div class="s-ico" style="background:rgba(255,200,50,.13)">
        <svg viewBox="0 0 24 24" fill="rgba(255,200,50,1)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Quoi de neuf ?</div><div class="s-sub">Voir les dernières nouveautés</div></div>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--t3)"><path d="M9 18l6-6-6-6"/></svg>
    </div>
  </div>
  <div style="height:20px"></div>`;
}

// ═══════════════════════════════════════════════
// EVENT BINDING
// ═══════════════════════════════════════════════
function _bindAccCards(el) {
  el.querySelectorAll('[data-acc]').forEach(c=>c.addEventListener('click',e=>{
    if(e.target.closest('[data-menu]')) return;
    if(S.accountId!==c.dataset.acc){S.search='';S.sort='value';S.sortDir=-1;}
    S.accountId=c.dataset.acc; go('account');
  }));
  el.querySelectorAll('[data-menu]').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation();
    openAccMenu(btn.dataset.menu);
  }));
}

// ── WATCHSTOCK ──
function renderWatchStock() {
  const watch = S.watchlist.find(w => w.ticker === S.watchTicker);
  if (!watch) return `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg> Retour</div>`;

  const period  = S.watchPeriod || '3M';
  const periods = ['1S','1M','3M','6M','1A'];
  const chartW  = Math.min(window.innerWidth, 480);

  // History for selected period (chart display)
  const {pts, startDate} = genWatchHistory(watch.ticker, watch.price, period);

  // Full 1-year history → performance metrics + 52-week range
  const {pts: fullPts} = genWatchHistory(watch.ticker, watch.price, '1A');
  const n = fullPts.length; // 365
  const today = new Date(); today.setHours(0,0,0,0);
  const ytdDays = Math.max(1, Math.round((today - new Date(today.getFullYear(), 0, 1)) / 86400000));
  const perf = (daysBack) => {
    const i = Math.max(0, n - 1 - Math.min(daysBack, n - 1));
    return (fullPts[n-1] - fullPts[i]) / fullPts[i] * 100;
  };
  const perfYTD = perf(ytdDays);
  const perf1M  = perf(30);
  const perf3M  = perf(90);
  const perf6M  = perf(182);
  const high52  = Math.max(...fullPts);
  const low52   = Math.min(...fullPts);

  const up    = watch.change1d >= 0;
  const delta = watch.price * watch.change1d / 100;
  const sec   = SECURITIES_DB[watch.ticker];
  const secInfo = sec ? `${sec.type} · ${sec.country} · ${sec.sector}` : '';
  const wCur  = watch.currency || sec?.currency || 'EUR';

  const _whist = getHistorySeries(watch.ticker);
  const _wChip = `<span style="font-size:11px;font-weight:600;white-space:nowrap;color:${_whist?'var(--gain)':'var(--text3)'}" title="${_whist?('Historique réel · '+timeSince(_whist.fetchedAt)):'Courbe estimée — touchez l’icône historique pour récupérer les vrais cours'}">${_whist?'● réel':'○ estimé'}</span>`;

  const periodPct = (pts[pts.length-1] - pts[0]) / pts[0] * 100;

  const perfBox = (label, val) => {
    const pos = val >= 0;
    return `<div class="metric">
      <div class="t-label">${label}</div>
      <div class="metric-val ${pos?'t-gain':'t-loss'} t-num">${pos?'+':''}${val.toFixed(2)}%</div>
    </div>`;
  };

  return `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Titres suivis
  </div>

  <div class="stock-hero" style="padding-bottom:10px;border-bottom:none">
    <div class="stock-ticker-badge">${esc(watch.ticker)}</div>
    <div style="font-size:19px;font-weight:800;letter-spacing:-.4px">${esc(watch.name)}</div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="stock-price t-num" style="margin:0">${fmtNative(watch.price, wCur)}</div>
      <div id="js-watch-ticker-refresh" class="tap" style="width:34px;height:34px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2);flex-shrink:0" title="Actualiser ce titre">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </div>
      <div id="js-watch-ticker-history" class="tap" style="width:34px;height:34px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text2);flex-shrink:0" title="Reprendre l’historique réel des cours">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
      </div>
    </div>
    <div class="row gap8" style="align-items:center;flex-wrap:wrap">
      <div class="badge ${up?'up':'dn'}">${up?'▲':'▼'} ${Math.abs(watch.change1d).toFixed(2)}%</div>
      <span style="font-size:13px;font-weight:700;color:${up?'var(--gain)':'var(--loss)'}">${up?'+':''}${fmtNative(Math.abs(delta), wCur)}</span>
      ${secInfo?`<span class="t-sm">${secInfo}</span>`:''}
      ${_wChip}
    </div>
  </div>

  <div style="display:flex;gap:6px;padding:10px 20px 8px;overflow-x:auto">
    ${periods.map(p=>`<div class="hperiod${p===period?' on':''}" data-wperiod="${p}">${p}</div>`).join('')}
  </div>

  <div style="position:relative" id="js-watch-chart-wrap">
    ${watchChartSvg(pts, chartW, 140, wCur)}
    <div id="watch-chart-tip" class="stock-chart-tip" style="position:absolute;top:4px;left:0"></div>
  </div>

  <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 20px 14px">
    <span id="js-watch-date-start" style="font-size:11px;color:var(--text3)">${startDate.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</span>
    <span id="js-watch-period-perf" style="font-size:13px;font-weight:800;color:${periodPct>=0?'var(--gain)':'var(--loss)'}">${periodPct>=0?'+':''}${periodPct.toFixed(2)}%</span>
    <span style="font-size:11px;color:var(--text3)">${today.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</span>
  </div>

  <div class="t-section" style="padding:0 20px 8px">Performances</div>
  <div class="metrics">
    ${perfBox('YTD', perfYTD)}
    ${perfBox('1 mois', perf1M)}
    ${perfBox('3 mois', perf3M)}
    ${perfBox('6 mois', perf6M)}
    <div class="metric">
      <div class="t-label">52 sem. haut</div>
      <div class="metric-val t-num">${fmtNative(high52, wCur)}</div>
    </div>
    <div class="metric">
      <div class="t-label">52 sem. bas</div>
      <div class="metric-val t-num">${fmtNative(low52, wCur)}</div>
    </div>
  </div>

  <div style="padding:16px 20px 48px">
    <div class="tap" id="js-watch-remove" style="display:flex;align-items:center;justify-content:center;gap:8px;background:var(--loss-dim);color:var(--loss);border:1px solid var(--loss);border-radius:12px;padding:13px;font-size:14px;font-weight:700">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>
      Retirer de la liste de suivi
    </div>
  </div>`;
}

function bindEvents(id, el) {
  if(id==='dashboard') {
    // History period selector
    el.querySelectorAll('.hperiod').forEach(p=>p.addEventListener('click',()=>{
      S.histPeriod=p.dataset.period;
      const wrap=el.querySelector('#js-hist-wrap');
      if(!wrap) return;
      const pts=genHistData(S.histPeriod);
      const chartW=Math.min(window.innerWidth,480)-72;
      wrap.innerHTML=histSvg(pts,chartW,80)+'<div class="hist-tip" id="js-hist-tip"></div>';
      el.querySelectorAll('.hperiod').forEach(x=>x.classList.toggle('on',x.dataset.period===S.histPeriod));
      const pct=((pts[pts.length-1]-pts[0])/pts[0]*100);
      const color=pct>=0?'var(--gain)':'var(--loss)';
      const rangeEl=el.querySelector('.hist-range');
      if(rangeEl) rangeEl.innerHTML=`<span>${masked(pts[0])}</span><span style="font-weight:700;color:${color}">${pct>=0?'+':''}${pct.toFixed(2)}%</span><span>${masked(pts[pts.length-1])}</span>`;
      initHistChart(el.querySelector('.hist-card'), pts);
      attachChartFs(el.querySelector('#js-hist-wrap'), 'hist');
    }));
    const histCard=el.querySelector('.hist-card');
    if(histCard) initHistChart(histCard, genHistData(S.histPeriod));
    attachChartFs(el.querySelector('#js-hist-wrap'), 'hist');
    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
    el.querySelector('#js-refresh-btn')?.addEventListener('click', fetchLivePrices);
    el.querySelector('#js-watch-add')?.addEventListener('click', openWatchModal);
    el.querySelector('#js-watch-sort')?.addEventListener('click', () => {
      const modes = ['default','perf_desc','perf_asc'];
      S.watchSort = modes[(modes.indexOf(S.watchSort||'default') + 1) % modes.length];
      renderScreen('dashboard');
    });

    // ── Fraîcheur des cours ──
    function updateFreshDot() {
      const dot = document.getElementById('js-fresh-dot');
      if (!dot) return;
      const age = S.lastPriceUpdate ? Date.now() - S.lastPriceUpdate : Infinity;
      dot.style.background = age < 5*60*1000 ? 'var(--gain)'
                           : age < 60*60*1000 ? '#F59E0B'
                           : 'var(--text3)';
    }
    updateFreshDot();
    // Un seul intervalle, remplacé à chaque re-render (l'ancien visibilitychange tuait le timer
    // au premier changement d'onglet et chaque render en empilait un nouveau)
    clearInterval(el._freshTimer);
    el._freshTimer = setInterval(updateFreshDot, 60*1000);

    // ── Supprimer un titre suivi ──
    el.querySelectorAll('[data-wdel]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const ticker = btn.dataset.wdel;
        haptic(10);
        openConfirm(`Retirer ${ticker} de la liste de suivi ?`, () => {
          const name = S.watchlist.find(w => w.ticker === ticker)?.name || ticker;
          S.watchlist = S.watchlist.filter(w => w.ticker !== ticker);
          saveAccounts();
          refreshMain();
          toast(`${name} retiré des favoris`);
        });
      });
    });
    el.querySelectorAll('[data-watch]').forEach(item => {
      item.addEventListener('click', () => {
        S.watchTicker = item.dataset.watch;
        go('watchstock');
      });
    });
    // Privacy toggle

    el.querySelector('#js-privacy-btn')?.addEventListener('click',()=>{
      S.privacy=!S.privacy;
      renderScreen('dashboard');
      renderScreen('comptes');
      renderScreen('account');
      renderScreen('stock');
      renderScreen('analysis');
      renderScreen('recherche');
    });
  }
  if(id==='comptes') {
    _bindAccCards(el);
    el.querySelector('#js-acc-add')?.addEventListener('click', openAccModal);
    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
  }
  if(id==='recherche') {
    const inp=el.querySelector('#js-srch-inp');
    const clrBtn=el.querySelector('#js-srch-clr');
    const results=el.querySelector('#js-srch-results');

    function bindResultClicks() {
      results.querySelectorAll('.hold-item[data-accid]').forEach(item=>{
        item.addEventListener('click',()=>{
          S.accountId=item.dataset.accid;
          S.holdingId=item.dataset.hid;
          go('stock');
        });
      });
    }

    function doSearch(q){
      S.srchQuery=q;
      results.innerHTML=srchResults(q, S.srchMode);
      bindResultClicks();
      // update clear button
      let clr=el.querySelector('#js-srch-clr');
      const box=el.querySelector('#js-srch-box');
      if(q&&!clr){
        clr=document.createElement('div');
        clr.className='search-clear';clr.id='js-srch-clr';clr.textContent='✕';
        clr.addEventListener('click',()=>{inp.value='';doSearch('');inp.focus();});
        box.appendChild(clr);
      } else if(!q&&clr){clr.remove();}
    }

    const acBox = el.querySelector('#js-srch-ac');

    function showAC(q) {
      if (!acBox || !q || q.length < 1) { if(acBox) acBox.style.display='none'; return; }
      const ql = q.toLowerCase();
      const matches = Object.entries(SECURITIES_DB)
        .filter(([t,v]) => t.toLowerCase().startsWith(ql) || v.name.toLowerCase().includes(ql))
        .slice(0, 6);
      if (!matches.length) { acBox.style.display='none'; return; }
      acBox.innerHTML = matches.map(([t,v]) =>
        `<div class="tap" data-ac="${t}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer">
          <div style="width:34px;height:34px;border-radius:8px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--accent);flex-shrink:0">${t.slice(0,4)}</div>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.name}</div>
            <div class="t-sm">${t} · ${v.type} · ${v.country}</div>
          </div>
        </div>`
      ).join('');
      acBox.style.display='block';
      acBox.querySelectorAll('[data-ac]').forEach(item => item.addEventListener('click', () => {
        inp.value = item.dataset.ac;
        acBox.style.display='none';
        doSearch(item.dataset.ac);
        inp.blur();
      }));
    }

    inp?.addEventListener('input',e=>{ doSearch(e.target.value); showAC(e.target.value); });
    inp?.addEventListener('focus', e=>showAC(e.target.value));
    clrBtn?.addEventListener('click',()=>{inp.value='';doSearch('');acBox.style.display='none';inp.focus();});
    bindResultClicks();

    // Mode pills
    el.querySelectorAll('[data-srchmode]').forEach(btn=>btn.addEventListener('click',()=>{
      S.srchMode=btn.dataset.srchmode;
      el.querySelectorAll('[data-srchmode]').forEach(b=>b.classList.toggle('on',b.dataset.srchmode===S.srchMode));
      if(inp) inp.placeholder=S.srchMode==='mouvements'?'Ticker, date, compte…':'Nom, ticker, secteur…';
      results.innerHTML=srchResults(S.srchQuery||'', S.srchMode);
      bindResultClicks();
    }));

    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
    // Ferme le clavier si tap hors de la search-box
    el.addEventListener('touchstart', e => {
      if (!e.target.closest('#js-srch-box')) inp?.blur();
    }, { passive: true });
    // Pas d'auto-focus : évite l'ouverture du clavier mobile à l'arrivée sur l'écran
  }
  if(id==='account') {
    const acc=S.accounts.find(a=>a.id===S.accountId);
    el.querySelector('#js-back')?.addEventListener('click',back);

    if(acc) renderHoldsHTML(acc);

    el.querySelector('#js-add-hold')?.addEventListener('click',()=>openPosModal(S.accountId));

    // Cashflows button
    el.querySelector('#js-cf-btn')?.addEventListener('click',()=>openCfModal(S.accountId));

    // Search
    el.querySelector('#js-search')?.addEventListener('input',e=>{
      S.search=e.target.value;
      const sb=el.querySelector('.search-box');
      let clr=sb.querySelector('.search-clear');
      if(S.search&&!clr){
        clr=document.createElement('div');clr.className='search-clear';clr.id='js-clr';clr.textContent='✕';
        clr.addEventListener('click',()=>{S.search='';el.querySelector('#js-search').value='';clr.remove();if(acc)renderHoldsHTML(acc);});
        sb.appendChild(clr);
      } else if(!S.search&&clr){clr.remove();}
      if(acc) renderHoldsHTML(acc);
    });
    el.querySelector('#js-clr')?.addEventListener('click',()=>{
      S.search='';el.querySelector('#js-search').value='';el.querySelector('.search-clear')?.remove();
      if(acc) renderHoldsHTML(acc);
    });

    el.querySelectorAll('.sort-pill').forEach(pill=>pill.addEventListener('click',()=>{
      const key=pill.dataset.sort;
      if(S.sort===key) S.sortDir*=-1;
      else{S.sort=key;S.sortDir=SORT_DEFAULTS[key]||(-1);}
      el.querySelectorAll('.sort-pill').forEach(p=>{
        const on=p.dataset.sort===S.sort;
        p.classList.toggle('on',on);
        p.textContent=p.dataset.label+(on?(S.sortDir===-1?' ↓':' ↑'):'');
      });
      if(acc) renderHoldsHTML(acc);
    }));

    initPTR(el,()=>{
      if(!acc) return;
      applyRefresh(S.accountId);
      renderHoldsHTML(acc);
      const v=el.querySelector('#js-acc-val');
      if(v) v.textContent=masked(acc.value);
      refreshMain();
      toast('Cours actualisés ↻');
    });
  }
  if(id==='stock') {
    el.querySelector('#js-back')?.addEventListener('click',back);
    el.querySelector('#js-ticker-refresh')?.addEventListener('click', () => {
      const acc = S.accounts.find(a => a.id === S.accountId);
      const h   = acc?.holdings.find(h => h.id === S.holdingId);
      if (h) fetchTickerPrice(h.ticker, S.accountId, S.holdingId);
    });
    el.querySelector('#js-ticker-history')?.addEventListener('click', () => {
      const acc = S.accounts.find(a => a.id === S.accountId);
      const h   = acc?.holdings.find(h => h.id === S.holdingId);
      if (h) fetchTickerHistory(h.ticker, S.accountId, S.holdingId);
    });
    el.querySelector('#js-watch-toggle')?.addEventListener('click', () => {
      const acc = S.accounts.find(a => a.id === S.accountId);
      const h   = acc?.holdings.find(h => h.id === S.holdingId);
      if (!h) return;
      const idx = S.watchlist.findIndex(w => w.ticker === h.ticker);
      haptic(idx >= 0 ? 6 : 12);
      if (idx >= 0) {
        S.watchlist.splice(idx, 1);
        toast(`${h.ticker} retiré des favoris`);
      } else {
        S.watchlist.push({ ticker: h.ticker, name: h.name, price: h.currentPrice, change1d: acc.change1d || 0, currency: h.currency || 'EUR' });
        toast(`${h.ticker} ajouté aux favoris ⭐`);
        const starEl = el.querySelector('#js-watch-toggle');
        if (starEl) { starEl.classList.remove('star-pop'); void starEl.offsetWidth; starEl.classList.add('star-pop'); }
      }
      saveAccounts();
      refreshMain();
      renderScreen('stock');
    });
    // Period selector
    el.querySelectorAll('[data-speriod]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        S.stockPeriod=btn.dataset.speriod;
        const wrap=el.querySelector('#js-stock-chart-wrap');
        const a=S.accounts.find(a=>a.id===S.accountId);
        const hh=a?.holdings.find(h=>h.id===S.holdingId);
        if(!wrap||!hh) return;
        const cw=Math.min(window.innerWidth,480);
        wrap.innerHTML=stockChartSvg(hh,cw,120,S.stockPeriod)+'<div class="stock-chart-tip" id="js-stock-chart-tip"></div>';
        initStockChart(wrap,hh);
        attachChartFs(wrap,'stock');
        el.querySelectorAll('[data-speriod]').forEach(b=>b.classList.toggle('on',b.dataset.speriod===S.stockPeriod));
      });
    });
    // Edit holding button
    el.querySelector('#js-edit-holding')?.addEventListener('click',()=>{
      const a=S.accounts.find(a=>a.id===S.accountId);
      const hh=a?.holdings.find(h=>h.id===S.holdingId);
      if(hh) openEditHolding(S.accountId,S.holdingId);
    });
    // Interactive stock chart with overlays
    const chartWrap=el.querySelector('#js-stock-chart-wrap');
    const acc=S.accounts.find(a=>a.id===S.accountId);
    const h=acc?.holdings.find(h=>h.id===S.holdingId);
    if(chartWrap&&h) { initStockChart(chartWrap,h); attachChartFs(chartWrap,'stock'); }
    // Transaction edit and delete buttons
    el.querySelector('#js-tx-list')?.addEventListener('click',e=>{
      const editBtn=e.target.closest('.tx-edit-btn');
      const delBtn=e.target.closest('.tx-del-btn');
      if(editBtn&&h){
        const idx=parseInt(editBtn.dataset.txidx);
        openEditTx(S.accountId,S.holdingId,idx);
      }
      if(delBtn&&h&&acc){
        const idx=parseInt(delBtn.dataset.txidx);
        const tx=h.transactions[idx];
        const lbl={BUY:'achat',SELL:'vente',DIV:'dividende'}[tx.type]||'mouvement';
        openConfirm(`Supprimer ce ${lbl} du ${fmtDate(tx.date)} ?`,()=>{
          h.transactions.splice(idx,1);
          recalcHolding(h);
          acc.value=accSum(acc.holdings);
          renderScreen('stock');
          refreshMain();
          toast('Mouvement supprimé');
        });
      }
    });
  }
  if(id==='analysis') {
    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
    // Use event delegation so it survives partial DOM replacement
    el.addEventListener('input', e => {
      const inp = e.target.closest('.tgt-inp');
      if (!inp) return;
      S.targets[inp.dataset.type] = Math.max(0, Math.min(100, parseFloat(inp.value) || 0));
      // Refresh bars + totals in-place without losing focus
      const all = S.accounts.flatMap(a => a.holdings);
      const tot = all.reduce((s, h) => s + (h.valueRef ?? h.value), 0);
      const byType = {};
      all.forEach(h => { byType[h.type] = (byType[h.type] || 0) + (h.valueRef ?? h.value); });
      ['Action','ETF','Obligation','Cash'].forEach(t => {
        const actual = tot > 0 ? (byType[t] || 0) / tot * 100 : 0;
        const target = S.targets[t] || 0;
        const dev = actual - target;
        const row = el.querySelector(`.tgt-inp[data-type="${t}"]`)?.closest('.tgt-row');
        if (!row) return;
        const bar = row.querySelector('.tgt-bar-actual');
        if (bar) bar.style.width = Math.min(100, actual).toFixed(1) + '%';
        const mark = row.querySelector('.tgt-mark-line');
        if (mark) mark.style.left = Math.min(100, target).toFixed(1) + '%';
        const devEl = row.querySelector('.tgt-dev');
        if (devEl) {
          devEl.textContent = (dev >= 0 ? '+' : '') + dev.toFixed(1) + '%';
          devEl.style.color = Math.abs(dev) < 2 ? 'var(--text2)' : dev > 0 ? 'var(--gain)' : 'var(--loss)';
        }
      });
      // Update total
      const totalTarget = ['Action','ETF','Obligation','Cash'].reduce((s,t) => s + (S.targets[t]||0), 0);
      const totEl = el.querySelector('.tgt-block > div:last-child span:last-child');
      if (totEl) {
        totEl.textContent = totalTarget + '%';
        totEl.style.color = Math.abs(totalTarget - 100) < 1 ? 'var(--gain)' : 'var(--loss)';
      }
    });
  }
  if(id==='settings') {
    // Retirer le badge de logs sur tous les boutons ⚙
    document.querySelectorAll('.log-badge').forEach(b => b.remove());
    el.querySelector('#js-back')?.addEventListener('click',back);
    el.querySelector('#js-name')?.addEventListener('change',e=>{
      S.user.name=e.target.value||S.user.name;
      renderScreen('dashboard');
      saveData();
      toast('Nom mis à jour');
    });
    el.querySelector('#js-demo-tog')?.addEventListener('click',()=>{
      if(S.isDemo){
        // Démo → réel : sauvegarde le slot démo, charge le slot réel
        localStorage.setItem(STORE_ACCOUNTS_DEMO, localStorage.getItem(STORE_ACCOUNTS)||'{}');
        const rawReal = localStorage.getItem(STORE_ACCOUNTS_REAL);
        // Toujours réaffecter watchlist/targets : sinon les données démo restent dans S
        // et sont sauvegardées comme données réelles au premier passage
        let d=null;
        if(rawReal){ try{ d=JSON.parse(rawReal); }catch(e){} }
        S.accounts  = d?.accounts  || [];
        S.watchlist = d?.watchlist || [];
        S.targets   = d?.targets   || { Action: 60, ETF: 25, Obligation: 10, Cash: 5 };
        if(d?.user) S.user = d.user;
        S.isDemo=false;
        saveAccounts();
        toast('Mode réel chargé');
      } else {
        // Réel → démo : sauvegarde le slot réel, charge le slot démo
        localStorage.setItem(STORE_ACCOUNTS_REAL, localStorage.getItem(STORE_ACCOUNTS)||'{}');
        const rawDemo = localStorage.getItem(STORE_ACCOUNTS_DEMO);
        let d=null;
        if(rawDemo){ try{ d=JSON.parse(rawDemo); }catch(e){} }
        S.accounts  = d?.accounts  || genDemo();
        S.watchlist = d?.watchlist || genDemoWatchlist();
        S.targets   = d?.targets   || { Action: 60, ETF: 25, Obligation: 10, Cash: 5 };
        if(d?.user) S.user = d.user;
        S.isDemo=true;
        saveAccounts();
        toast('Mode démo chargé ✓');
      }
      refreshMain();
      renderScreen('settings');
    });
    el.querySelector('#js-demo-reset')?.addEventListener('click',()=>{
      openConfirm('Réinitialiser les données démo ?',()=>{
        S.accounts=genDemo();
        saveAccounts();
        refreshMain();
        renderScreen('settings');
        toast('Données démo réinitialisées ✓');
      });
    });
    el.querySelector('#js-csv-btn')?.addEventListener('click',()=>document.getElementById('csv-file').click());
    el.querySelectorAll('[data-cur]').forEach(b=>b.addEventListener('click',()=>{
      S.currency=b.dataset.cur;
      el.querySelectorAll('[data-cur]').forEach(x=>x.classList.toggle('on',x.dataset.cur===S.currency));
      refreshMain();
      toast('Devise : '+S.currency);
    }));
    el.querySelectorAll('[data-theme-opt]').forEach(b=>b.addEventListener('click',()=>{
      S.theme=b.dataset.themeOpt;
      applyTheme(S.theme);
      el.querySelectorAll('[data-theme-opt]').forEach(x=>x.classList.toggle('on',x.dataset.themeOpt===S.theme));
      saveData();
      const lbl={auto:'automatique',light:'clair',dark:'sombre'};
      toast('Thème '+(lbl[S.theme]||S.theme));
    }));
    el.querySelector('#js-clear-prices')?.addEventListener('click',()=>{
      localStorage.removeItem(STORE_PRICES);
      S.lastPriceUpdate=null;
      const sub=el.querySelector('#js-price-cache-age');
      if(sub) sub.textContent='Aucun cache enregistré';
      toast('Cache des prix effacé');
    });
    el.querySelector('#js-export-btn')?.addEventListener('click', () => {
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0.2',
        accounts:  S.isDemo ? [] : S.accounts,
        watchlist: S.watchlist,
        targets:   S.targets,
        user:      S.user,
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `patrimoine-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Export téléchargé ✓');
    });
    el.querySelector('#js-reset-all')?.addEventListener('click',()=>{
      openConfirm('Supprimer tous les comptes et transactions ? Les réglages sont conservés.', ()=>{
        localStorage.removeItem(STORE_ACCOUNTS);
        localStorage.removeItem(STORE_ACCOUNTS_DEMO);
        localStorage.removeItem(STORE_ACCOUNTS_REAL);
        localStorage.removeItem(STORE_PRICES);
        localStorage.removeItem(STORE_WEALTH);
        location.reload();
      });
    });
    el.querySelector('#js-autorefresh-tog')?.addEventListener('click', () => {
      S.autoRefresh = !S.autoRefresh;
      el.querySelector('#js-autorefresh-inner')?.classList.toggle('on', S.autoRefresh);
      saveData();
      toast('Actualisation auto ' + (S.autoRefresh ? 'activée' : 'désactivée'));
    });
    el.querySelector('#js-assistant-tog')?.addEventListener('click', () => {
      S.assistantEnabled = !S.assistantEnabled;
      el.querySelector('#js-assistant-inner')?.classList.toggle('on', S.assistantEnabled);
      saveSettings();
      // Re-render des écrans à top-bar pour afficher/masquer le bouton immédiatement
      ['dashboard','comptes','recherche','analysis'].forEach(renderScreen);
      toast('Assistant IA ' + (S.assistantEnabled ? 'activé' : 'masqué'));
    });
    el.querySelector('#js-fx-row')?.addEventListener('click', openFxModal);
    el.querySelector('#js-open-changelog')?.addEventListener('click', openChangelogModal);
    el.querySelector('#js-price-key')?.addEventListener('change', e => {
      S.priceApiKey = e.target.value.trim();
      saveSettings();
      toast(S.priceApiKey ? 'Clé Twelve Data enregistrée ✓' : 'Clé Twelve Data supprimée');
    });
    el.querySelector('#js-fmp-key')?.addEventListener('change', e => {
      S.fmpApiKey = e.target.value.trim();
      saveSettings();
      toast(S.fmpApiKey ? 'Clé FMP enregistrée ✓' : 'Clé FMP supprimée');
    });
    el.querySelector('#js-debug-tog')?.addEventListener('click',()=>{
      S.debug = !S.debug;
      el.querySelector('#js-debug-tog-inner')?.classList.toggle('on', S.debug);
      saveData();
      toast('Mode débogage ' + (S.debug ? 'activé' : 'désactivé'));
      if (S.debug) renderScreen('settings'); // rafraîchit pour afficher le log
    });
    el.querySelector('#js-debug-copy')?.addEventListener('click',()=>{
      const txt = S._debugLog.slice().reverse().join('\n');
      navigator.clipboard?.writeText(txt)
        .then(()=>toast('Log copié ✓'))
        .catch(()=>{
          // Fallback si clipboard API indisponible
          const ta=document.createElement('textarea');
          ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toast('Log copié ✓');
        });
    });
    el.querySelector('#js-debug-clear')?.addEventListener('click',()=>{
      S._debugLog = [];
      renderScreen('settings');
    });
  }
  if (id === 'assistant') {
    el.querySelector('#js-back')?.addEventListener('click', back);
    el.querySelectorAll('.js-reco').forEach(item => {
      item.addEventListener('click', () => {
        S.accountId = item.dataset.acc;
        S.holdingId = item.dataset.hold;
        go('stock');
      });
    });
  }
  if (id === 'watchstock') {
    el.querySelector('#js-back')?.addEventListener('click', back);
    el.querySelector('#js-watch-ticker-refresh')?.addEventListener('click', () => {
      if (S.watchTicker) fetchWatchPrice(S.watchTicker);
    });
    el.querySelector('#js-watch-ticker-history')?.addEventListener('click', () => {
      if (S.watchTicker) fetchWatchHistory(S.watchTicker);
    });

    // Period selector: swap chart + labels in-place
    el.querySelectorAll('[data-wperiod]').forEach(btn => btn.addEventListener('click', () => {
      S.watchPeriod = btn.dataset.wperiod;
      el.querySelectorAll('[data-wperiod]').forEach(b => b.classList.toggle('on', b.dataset.wperiod === S.watchPeriod));
      const watch = S.watchlist.find(w => w.ticker === S.watchTicker);
      if (!watch) return;
      const chartW = Math.min(window.innerWidth, 480);
      const {pts, startDate} = genWatchHistory(watch.ticker, watch.price, S.watchPeriod);
      const wCur = watch.currency || SECURITIES_DB[watch.ticker]?.currency || 'EUR';
      const wrap = el.querySelector('#js-watch-chart-wrap');
      if (wrap) {
        wrap.innerHTML = watchChartSvg(pts, chartW, 140, wCur) +
          '<div id="watch-chart-tip" class="stock-chart-tip" style="position:absolute;top:4px;left:0"></div>';
        initWatchChart(wrap, pts, startDate, wCur);
        attachChartFs(wrap, 'watch');
      }
      const pct = (pts[pts.length-1] - pts[0]) / pts[0] * 100;
      const perfEl = el.querySelector('#js-watch-period-perf');
      if (perfEl) {
        perfEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        perfEl.style.color = pct >= 0 ? 'var(--gain)' : 'var(--loss)';
      }
      const dateStartEl = el.querySelector('#js-watch-date-start');
      if (dateStartEl) dateStartEl.textContent = startDate.toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'});
    }));

    // Init chart on load
    const watch = S.watchlist.find(w => w.ticker === S.watchTicker);
    if (watch) {
      const wrap = el.querySelector('#js-watch-chart-wrap');
      if (wrap) {
        const {pts, startDate} = genWatchHistory(watch.ticker, watch.price, S.watchPeriod || '3M');
        const wCur = watch.currency || SECURITIES_DB[watch.ticker]?.currency || 'EUR';
        initWatchChart(wrap, pts, startDate, wCur);
        attachChartFs(wrap, 'watch');
      }
    }

    // Remove from watchlist
    el.querySelector('#js-watch-remove')?.addEventListener('click', () => {
      openConfirm(`Retirer ${S.watchTicker} de la liste de suivi ?`, () => {
        const name = S.watchlist.find(w => w.ticker === S.watchTicker)?.name || S.watchTicker;
        S.watchlist = S.watchlist.filter(w => w.ticker !== S.watchTicker);
        saveData();
        back();
        refreshMain();
        toast(`${name} retiré de la liste`);
      });
    });
  }
}

// Refresh all top-level screens (dashboard, comptes, analysis)
// + recherche if it's currently visible (search results may change)
function refreshMain() {
  renderScreen('dashboard');
  renderScreen('comptes');
  renderScreen('analysis');
  if(S.screen==='recherche') renderScreen('recherche');
  saveData();
}

// ═══════════════════════════════════════════════
// CSV IMPORT
// ═══════════════════════════════════════════════
document.getElementById('csv-file').addEventListener('change',function(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>parseCSV(ev.target.result);
  r.readAsText(f); this.value='';
});

function parseCSV(text) {
  const allLines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (allLines.length < 2) { toast('CSV vide ou invalide'); return; }

  // ── Détection du délimiteur ──
  const sample = allLines[0];
  const delim = (sample.match(/;/g)||[]).length > (sample.match(/,/g)||[]).length ? ';' : ',';

  // ── Parser robuste (gère les champs entre guillemets) ──
  function parseLine(line) {
    const cells = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === delim && !inQ) { cells.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    cells.push(cur.trim());
    return cells.map(c => c.replace(/^"|"$/g, '').trim());
  }

  // ── Nettoyage nombre (gère "1 234,56" et "1,234.56") ──
  function cleanNum(s) {
    if (!s) return 0;
    s = String(s).replace(/\s/g, '').replace(/"/g, '');
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); // French: 1.234,56
    else if (lc !== -1 && ld > lc) s = s.replace(/,/g, '');  // English: 1,234.56
    else if (lc !== -1) s = s.replace(',', '.');
    return parseFloat(s) || 0;
  }

  // ── Normalisation date → YYYY-MM-DD ──
  function parseDate(s) {
    if (!s) return new Date().toISOString().slice(0, 10);
    const m = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/); // DD-MM-YYYY
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  }

  // ── Normalisation en-têtes ──
  const rawHdrs = parseLine(allLines[0]);
  const hdrs = rawHdrs.map(h =>
    h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  );
  const col = (...names) => hdrs.findIndex(h => names.some(n => h.includes(n)));

  // ── Détection format Degiro ──
  const isDegiro = hdrs.some(h => h.includes('isin')) && hdrs.some(h => h.includes('quantit'));
  const format = isDegiro ? 'Degiro (auto-détecté)' : 'Générique';

  const dataRows = allLines.slice(1).map(l => parseLine(l));
  const parsedRows = [];
  const unknownTickers = new Set();

  if (isDegiro) {
    const iDate  = col('date');
    const iProd  = col('produit', 'product');
    const iISIN  = col('isin');
    const iQty   = col('quantit');
    const iPrice = col('cours', 'price');

    dataRows.forEach(cols => {
      const dateRaw  = cols[iDate]  || '';
      const produit  = cols[iProd]  || '';
      const isin     = (cols[iISIN] || '').trim();
      const qtyRaw   = cleanNum(cols[iQty]);
      const priceRaw = cleanNum(cols[iPrice]);

      if (!priceRaw || qtyRaw === 0) return; // lignes de frais ou dividende cash → skip

      const type = qtyRaw > 0 ? 'BUY' : 'SELL';
      const qty = Math.abs(qtyRaw);

      // Résoudre ticker depuis l'ISIN
      const secFromISIN = ISIN_MAP[isin];
      let ticker = secFromISIN?.ticker || '';
      let name   = secFromISIN?.name   || '';

      if (!ticker) {
        // Extraire un ticker depuis le nom du produit (premier mot, max 6 car.)
        const cleanProd = produit
          .replace(/\s*[-–]\s*(COMMON STOCK|ORD|ADS|ADR|ETF|FUND|INC|SA|NV|SE|PLC|SHARE|ACTION).*$/i, '')
          .trim();
        ticker = cleanProd.split(/\s+/)[0].toUpperCase().slice(0, 6);
        name   = cleanProd;
        unknownTickers.add(ticker);
      }

      parsedRows.push({ date: parseDate(dateRaw), type, ticker, name, qty, price: priceRaw });
    });

  } else {
    // Format générique : account, ticker, name, date, type, quantity/qty, price
    const iAcc   = col('account', 'compte');
    const iTick  = col('ticker', 'code', 'symbole');
    const iName  = col('name', 'nom', 'libelle');
    const iDate  = col('date');
    const iType  = col('type');
    const iQty   = col('quantity', 'quantit', 'qty');
    const iPrice = col('price', 'prix', 'cours');

    dataRows.forEach(cols => {
      const ticker = (iTick >= 0 ? cols[iTick] : '').toUpperCase().trim();
      const qty    = cleanNum(iQty >= 0 ? cols[iQty] : '');
      const price  = cleanNum(iPrice >= 0 ? cols[iPrice] : '');
      if (!ticker || !qty || !price) { parsedRows.push({ _skip: true }); return; }
      const sec = SECURITIES_DB[ticker];
      if (!sec) unknownTickers.add(ticker);
      parsedRows.push({
        date:     parseDate(iDate >= 0 ? cols[iDate] : ''),
        type:     ((iType >= 0 ? cols[iType] : '') || 'BUY').toUpperCase(),
        ticker,
        name:     (iName >= 0 ? cols[iName] : '') || sec?.name || ticker,
        qty,
        price,
        _account: iAcc >= 0 ? cols[iAcc] : '',
      });
    });
  }

  const valid = parsedRows.filter(r => !r._skip);
  if (!valid.length) { toast('Aucun mouvement valide détecté dans ce fichier'); return; }
  openImportPreview(parsedRows, format, unknownTickers);
}

// ── CSV IMPORT MODAL ──
let _csvPendingRows = [];

function openImportPreview(rows, format, unknownTickers) {
  _csvPendingRows = rows;
  const valid = rows.filter(r => !r._skip);
  const skipped = rows.length - valid.length;
  const buys  = valid.filter(r => r.type === 'BUY').length;
  const sells = valid.filter(r => r.type === 'SELL').length;
  const divs  = valid.filter(r => r.type === 'DIV').length;

  const accountOptions = S.accounts.map(a =>
    `<option value="${a.id}">${a.icon||'🏦'} ${esc(a.name)}</option>`
  ).join('');

  const preview = valid.slice(0, 8).map(r => {
    const isDiv = r.type==='DIV', isBuy = r.type==='BUY';
    const dot = isDiv?'DIV':isBuy?'ACH':'VTE';
    const cls = isDiv?'div':isBuy?'buy':'sell';
    const unk = unknownTickers.has(r.ticker)
      ? ' <span style="color:var(--loss);font-size:10px">⚠ inconnu</span>' : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div class="tx-dot ${cls}" style="width:32px;height:32px;font-size:10px;flex-shrink:0">${dot}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.ticker)}${unk} · ${esc(r.name||r.ticker)}</div>
        <div style="font-size:11px;color:var(--text2)">${esc(r.date)} · ${r.qty} × ${r.price.toLocaleString('fr-FR')}</div>
      </div>
    </div>`;
  }).join('');
  const moreLabel = valid.length > 8
    ? `<div style="font-size:12px;color:var(--text2);padding:8px 0;text-align:center">+${valid.length - 8} autre${valid.length-8>1?'s':''} mouvement${valid.length-8>1?'s':''}…</div>` : '';

  document.getElementById('csv-modal-title').textContent =
    `${valid.length} mouvement${valid.length>1?'s':''} détecté${valid.length>1?'s':''}`;

  document.getElementById('csv-modal-body').innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      <span style="background:var(--accent-dim);color:var(--accent);border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700">${format}</span>
      ${buys  ? `<span style="background:var(--gain-dim);color:var(--gain);border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700">${buys} achat${buys>1?'s':''}</span>` : ''}
      ${sells ? `<span style="background:var(--loss-dim);color:var(--loss);border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700">${sells} vente${sells>1?'s':''}</span>` : ''}
      ${divs  ? `<span style="background:rgba(245,158,11,.12);color:#F59E0B;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700">${divs} div.</span>` : ''}
    </div>
    ${unknownTickers.size ? `<div style="background:var(--loss-dim);border:1px solid var(--loss);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--loss)">
      ⚠ ${unknownTickers.size} ticker${unknownTickers.size>1?'s':''} non reconnu${unknownTickers.size>1?'s':''} : ${esc([...unknownTickers].join(', '))}
    </div>` : ''}
    <div style="margin-bottom:14px;border-radius:10px;overflow:hidden;border:1px solid var(--border);padding:0 12px">
      ${preview}${moreLabel}
    </div>
    <div class="form-field" style="margin-bottom:${skipped?'6px':'14px'}">
      <div class="form-label">Compte de destination</div>
      <select class="form-input" id="csv-acc-select" style="cursor:pointer">
        <option value="__new__">➕ Nouveau compte importé</option>
        ${accountOptions}
      </select>
    </div>
    ${skipped ? `<div style="font-size:11px;color:var(--text3);margin-bottom:14px">${skipped} ligne${skipped>1?'s':''} ignorée${skipped>1?'s':''} (données incomplètes)</div>` : ''}
  `;

  document.getElementById('csv-modal-bg').classList.add('show');
  document.getElementById('csv-modal-sheet').classList.add('show');
}

function closeCsvModal() {
  document.getElementById('csv-modal-bg').classList.remove('show');
  document.getElementById('csv-modal-sheet').classList.remove('show');
}

function openFxModal() {
  document.getElementById('js-fx-modal-body').innerHTML = renderFxModalRows();
  document.getElementById('fx-modal-bg').classList.add('show');
  document.getElementById('fx-modal-sheet').classList.add('show');
}
function closeFxModal() {
  document.getElementById('fx-modal-bg').classList.remove('show');
  document.getElementById('fx-modal-sheet').classList.remove('show');
}
document.getElementById('fx-modal-bg').addEventListener('click', closeFxModal);

// ── CHANGELOG MODAL ──
function renderChangelogBody(version) {
  const entries = CHANGELOG[version] || [];
  const cfg = {
    new:     { bg:'rgba(99,102,241,.12)',  color:'#6366F1', label:'Nouveau' },
    fix:     { bg:'rgba(34,197,94,.12)',   color:'#22c55e', label:'Correctif' },
    improve: { bg:'rgba(245,158,11,.12)',  color:'#f59e0b', label:'Amélioration' },
  };
  return entries.map((e, i) => {
    const c = cfg[e.type] || cfg.improve;
    const border = i < entries.length - 1 ? 'border-bottom:1px solid var(--border)' : '';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 0;${border}">
      <span style="flex-shrink:0;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.3px;background:${c.bg};color:${c.color};margin-top:2px">${c.label}</span>
      <span style="font-size:14px;line-height:1.4;color:var(--text)">${e.text}</span>
    </div>`;
  }).join('');
}
function openChangelogModal(fromStartup = false) {
  document.getElementById('js-changelog-version').textContent = 'Version ' + APP_VERSION;
  document.getElementById('js-changelog-body').innerHTML = renderChangelogBody(APP_VERSION);
  document.getElementById('js-changelog-ok').textContent = fromStartup ? 'Découvrir ✨' : 'Fermer';
  document.getElementById('changelog-modal-bg').classList.add('show');
  document.getElementById('changelog-modal-sheet').classList.add('show');
}
function closeChangelogModal() {
  document.getElementById('changelog-modal-bg').classList.remove('show');
  document.getElementById('changelog-modal-sheet').classList.remove('show');
  try { localStorage.setItem(STORE_VERSION, APP_VERSION); } catch(e) {}
}
document.getElementById('changelog-modal-bg').addEventListener('click', closeChangelogModal);
document.getElementById('js-changelog-close').addEventListener('click', closeChangelogModal);
document.getElementById('js-changelog-ok').addEventListener('click', closeChangelogModal);
document.getElementById('js-fx-modal-refresh').addEventListener('click', async () => {
  const icon = document.getElementById('js-fx-modal-refresh-icon');
  if (icon) icon.classList.add('spin');
  await fetchFxRates();
  if (icon) icon.classList.remove('spin');
  document.getElementById('js-fx-modal-body').innerHTML = renderFxModalRows();
  // Mettre à jour le sous-titre dans settings si visible
  const sub = document.getElementById('js-fx-sub');
  if (sub) sub.textContent = fxSubText();
});

function confirmImport() {
  const accIdVal = document.getElementById('csv-acc-select')?.value;
  let targetAcc;

  if (accIdVal === '__new__') {
    targetAcc = {
      id: 'csv_' + Date.now(),
      name: 'Compte importé',
      type: 'CTO',
      icon: '📊',
      iconBg: 'rgba(245,158,11,.13)',
      value: 0, change1d: 0,
      holdings: [], cashflows: [],
    };
    S.accounts.push(targetAcc);
  } else {
    targetAcc = S.accounts.find(a => a.id === accIdVal);
  }

  if (!targetAcc) { toast('Compte introuvable'); return; }

  let added = 0;
  _csvPendingRows.filter(r => !r._skip).forEach(r => {
    if (!r.ticker || !r.qty || !r.price) return;
    let h = targetAcc.holdings.find(h => h.ticker === r.ticker);
    if (!h) {
      const sec = SECURITIES_DB[r.ticker] || {};
      h = {
        id: r.ticker + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        ticker: r.ticker,
        name: r.name || sec.name || r.ticker,
        quantity: 0,
        avgBuyPrice: r.price,
        currentPrice: r.price,
        type: sec.type || 'Action',
        country: sec.country || 'Inconnu',
        sector: sec.sector || 'Inconnu',
        currency: sec.currency || 'EUR',
        transactions: [],
        value: 0, pnl: 0, pnlPct: 0,
      };
      targetAcc.holdings.push(h);
    }
    h.transactions.push({ date: r.date, type: r.type, qty: r.qty, price: r.price });
    recalcHolding(h);
    added++;
  });

  targetAcc.value = accSum(targetAcc.holdings);
  // L'import reste dans le mode courant : basculer S.isDemo=false ici transformait les
  // comptes démo en « données réelles » et écrasait le slot réel au toggle suivant
  saveData();
  refreshMain();
  closeCsvModal();
  toast(`${added} mouvement${added>1?'s':''} importé${added>1?'s':''} ✓`);
}

document.getElementById('csv-modal-bg').addEventListener('click', closeCsvModal);
document.getElementById('csv-modal-close').addEventListener('click', closeCsvModal);
document.getElementById('csv-cancel-btn').addEventListener('click', closeCsvModal);
document.getElementById('csv-import-btn').addEventListener('click', confirmImport);

// ═══════════════════════════════════════════════
// CONFIRM DIALOG
// ═══════════════════════════════════════════════
let _confirmCb=null;
function openConfirm(msg,cb){
  _confirmCb=cb;
  document.getElementById('confirm-msg').textContent=msg;
  document.getElementById('confirm-bg').classList.add('show');
  document.getElementById('confirm-sheet').classList.add('show');
}
function closeConfirm(){
  document.getElementById('confirm-bg').classList.remove('show');
  document.getElementById('confirm-sheet').classList.remove('show');
  _confirmCb=null;
}
document.getElementById('confirm-cancel').addEventListener('click',closeConfirm);
document.getElementById('confirm-bg').addEventListener('click',closeConfirm);
document.getElementById('confirm-ok').addEventListener('click',()=>{ haptic(10); if(_confirmCb)_confirmCb(); closeConfirm(); });

// ═══════════════════════════════════════════════
// ADD WATCHLIST MODAL
// ═══════════════════════════════════════════════
function openWatchModal(){
  ['watch-ticker','watch-name','watch-price'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('watch-change').value='0';
  document.getElementById('watch-modal-bg').classList.add('show');
  document.getElementById('watch-modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('watch-ticker').focus(),330);
}
function closeWatchModal(){
  document.getElementById('watch-modal-bg').classList.remove('show');
  document.getElementById('watch-modal-sheet').classList.remove('show');
}
document.getElementById('watch-modal-bg').addEventListener('click',closeWatchModal);
document.getElementById('watch-modal-close').addEventListener('click',closeWatchModal);

// Autocomplete ticker watchlist
(()=>{
  const inp  = document.getElementById('watch-ticker');
  const acL  = document.getElementById('watch-ac-list');
  function fill(ticker){
    const db = SECURITIES_DB[ticker];
    if(!db) return;
    document.getElementById('watch-name').value = db.name;
    acL.classList.add('hidden');
  }
  // Titre hors base : résolution en ligne (nom + prix + devise) via le proxy
  async function resolveWatch(tk){
    if(!tk || SECURITIES_DB[tk]) return;
    const info = await resolveTickerOnline(tk);
    if(!info){ toast(`« ${tk} » introuvable en ligne`); return; }
    const nameEl=document.getElementById('watch-name');
    const priceEl=document.getElementById('watch-price');
    if(!nameEl.value.trim()) nameEl.value=info.name;
    if(priceEl && !priceEl.value && info.price) priceEl.value=info.price;
    toast(`${tk} résolu : ${info.name} (${info.currency}) ✓`);
  }
  inp.addEventListener('input',()=>{
    const q = inp.value.trim().toUpperCase();
    if(!q){ acL.classList.add('hidden'); return; }
    const matches = Object.entries(SECURITIES_DB).filter(([k,v])=>
      k.startsWith(q) || v.name.toUpperCase().includes(q)
    ).slice(0,6);
    if(!matches.length){
      const safe=q.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      acL.innerHTML=`<div class="ac-item ac-empty" data-manual="1">
        <span class="ac-tick">🔍</span>
        <span class="ac-name">Rechercher « ${safe} » en ligne</span>
        <span class="ac-sub">nom + prix + devise auto</span>
      </div>`;
      acL.classList.remove('hidden');
      return;
    }
    acL.innerHTML = matches.map(([t,db])=>
      `<div class="ac-item" data-ticker="${t}">
        <span class="ac-tick">${t}</span>
        <span class="ac-name">${db.name}</span>
        <span class="ac-sub">${db.type} · ${db.currency}</span>
      </div>`
    ).join('');
    acL.classList.remove('hidden');
  });
  acL.addEventListener('click',e=>{
    const item = e.target.closest('.ac-item');
    if(!item) return;
    if(item.dataset.manual){
      acL.classList.add('hidden');
      resolveWatch(inp.value.trim().toUpperCase());
      document.getElementById('watch-name').focus();
      return;
    }
    inp.value = item.dataset.ticker;
    fill(item.dataset.ticker);
  });
  inp.addEventListener('blur',()=>setTimeout(()=>acL.classList.add('hidden'),200));
  inp.addEventListener('change',()=>{
    const tk=inp.value.trim().toUpperCase();
    if(SECURITIES_DB[tk]) fill(tk); else resolveWatch(tk);
  });
})();
document.getElementById('watch-submit').addEventListener('click',()=>{
  const ticker=document.getElementById('watch-ticker').value.trim().toUpperCase();
  const name=document.getElementById('watch-name').value.trim();
  const price=parseFloat(document.getElementById('watch-price').value);
  const change=parseFloat(document.getElementById('watch-change').value)||0;
  if(!ticker||!name||!(price>0)){toast('Ticker, nom et prix requis');return;}
  if(S.watchlist.find(w=>w.ticker===ticker)){toast('Ticker déjà suivi');return;}
  const _wCur = SECURITIES_DB[ticker]?.currency || _tickerMeta[ticker]?.currency || 'EUR';
  S.watchlist.push({ticker, name, price, change1d:change, currency:_wCur});
  closeWatchModal();
  refreshMain();
  toast(`${ticker} ajouté aux titres suivis ✓`);
});

// ═══════════════════════════════════════════════
// ADD ACCOUNT MODAL
// ═══════════════════════════════════════════════
let _accObserver=false;
function openAccModal(){
  _accObserver=false;
  document.getElementById('acc-icon').value='📊';
  document.getElementById('acc-name').value='';
  document.getElementById('acc-type').value='';
  document.getElementById('acc-obs-tog').classList.remove('on');
  document.getElementById('acc-modal-bg').classList.add('show');
  document.getElementById('acc-modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('acc-name').focus(),330);
}
function closeAccModal(){
  document.getElementById('acc-modal-bg').classList.remove('show');
  document.getElementById('acc-modal-sheet').classList.remove('show');
}
document.getElementById('acc-modal-bg').addEventListener('click',closeAccModal);
document.getElementById('acc-modal-close').addEventListener('click',closeAccModal);
document.getElementById('acc-obs-tog').addEventListener('click',()=>{
  _accObserver=!_accObserver;
  document.getElementById('acc-obs-tog').classList.toggle('on',_accObserver);
});
document.getElementById('acc-submit').addEventListener('click',()=>{
  const icon=document.getElementById('acc-icon').value.trim()||'📊';
  const name=document.getElementById('acc-name').value.trim();
  const type=document.getElementById('acc-type').value.trim()||'Compte titre';
  if(!name){toast('Nom du compte requis');return;}
  const id='acc_'+Date.now().toString(36);
  const bgs=['rgba(79,142,247,.13)','rgba(0,194,203,.13)','rgba(0,214,143,.13)','rgba(245,158,11,.13)','rgba(167,139,250,.13)'];
  const iconBg=bgs[S.accounts.length%bgs.length];
  const currency=document.getElementById('acc-currency').value||'EUR';
  S.accounts.push({id,name,type,icon,iconBg,currency,value:0,change1d:0,holdings:[],observer:_accObserver});
  closeAccModal();
  refreshMain();
  toast(`Compte "${name}" créé ✓`);
});

// ═══════════════════════════════════════════════
// ADD POSITION MODAL
// ═══════════════════════════════════════════════
let _posAccId=null;
function openPosModal(accId){
  _posAccId=accId;
  ['pos-ticker','pos-name','pos-qty','pos-pru','pos-country'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pos-type').value='Action';
  document.getElementById('pos-currency').value='EUR';
  document.getElementById('pos-sector').value='Technologie';
  document.getElementById('pos-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('pos-ac-list').classList.add('hidden');
  document.getElementById('pos-modal-bg').classList.add('show');
  document.getElementById('pos-modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('pos-ticker').focus(),330);
}
function closePosModal(){
  document.getElementById('pos-modal-bg').classList.remove('show');
  document.getElementById('pos-modal-sheet').classList.remove('show');
  document.getElementById('pos-ac-list').classList.add('hidden');
}

// ── Autocomplete for ticker ──
(function initPosAutocomplete(){
  const tickerInp=document.getElementById('pos-ticker');
  const acList=document.getElementById('pos-ac-list');
  function fillFromDB(ticker){
    const db=SECURITIES_DB[ticker];
    if(!db) return false;
    document.getElementById('pos-name').value=db.name;
    document.getElementById('pos-type').value=db.type;
    document.getElementById('pos-currency').value=db.currency;
    document.getElementById('pos-country').value=db.country;
    document.getElementById('pos-sector').value=db.sector;
    acList.classList.add('hidden');
    return true;
  }
  // Titre hors base : résolution en ligne (nom, devise, type) via le proxy
  async function resolveAndFill(tk){
    if(!tk || SECURITIES_DB[tk]) return;
    const info = await resolveTickerOnline(tk);
    if(!info){ toast(`« ${tk} » introuvable en ligne`); return; }
    const nameEl=document.getElementById('pos-name');
    if(!nameEl.value.trim()) nameEl.value=info.name;
    setSelectValue(document.getElementById('pos-currency'), info.currency, info.currency);
    document.getElementById('pos-type').value=info.type;
    toast(`${tk} résolu : ${info.name} (${info.currency}) ✓`);
  }
  tickerInp.addEventListener('input',()=>{
    const q=tickerInp.value.trim().toUpperCase();
    if(!q){acList.classList.add('hidden');return;}
    // ISIN detection: 12 chars, 2 letters + 10 alphanumeric
    if(/^[A-Z]{2}[A-Z0-9]{10}$/.test(q)){
      const entry=ISIN_MAP[q];
      if(entry){
        tickerInp.value=entry.ticker;
        if(!fillFromDB(entry.ticker)){
          document.getElementById('pos-name').value=entry.name;
        }
        toast(`ISIN résolu : ${entry.ticker} ✓`);
        acList.classList.add('hidden');
        return;
      }
      // ISIN inconnu → on laisse tomber dans la recherche normale (affiche l'option saisie manuelle)
    }
    const matches=Object.entries(SECURITIES_DB).filter(([k,v])=>
      k.startsWith(q)||v.name.toUpperCase().includes(q)
    ).slice(0,6);
    if(!matches.length){
      const safe=q.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      acList.innerHTML=`<div class="ac-item ac-empty" data-manual="1">
        <span class="ac-tick">🔍</span>
        <span class="ac-name">Rechercher « ${safe} » en ligne</span>
        <span class="ac-sub">nom + devise auto</span>
      </div>`;
      acList.classList.remove('hidden');
      return;
    }
    acList.innerHTML=matches.map(([ticker,db])=>
      `<div class="ac-item" data-ticker="${ticker}">
        <span class="ac-tick">${ticker}</span>
        <span class="ac-name">${db.name}</span>
        <span class="ac-sub">${db.type} · ${db.currency}</span>
      </div>`
    ).join('');
    acList.classList.remove('hidden');
  });
  acList.addEventListener('click',e=>{
    const item=e.target.closest('.ac-item');
    if(!item) return;
    if(item.dataset.manual){
      acList.classList.add('hidden');
      resolveAndFill(tickerInp.value.trim().toUpperCase());
      document.getElementById('pos-name').focus();
      return;
    }
    tickerInp.value=item.dataset.ticker;
    fillFromDB(item.dataset.ticker);
  });
  tickerInp.addEventListener('blur',()=>setTimeout(()=>acList.classList.add('hidden'),200));
  tickerInp.addEventListener('change',()=>{
    const tk=tickerInp.value.trim().toUpperCase();
    if(!fillFromDB(tk)) resolveAndFill(tk);
  });
})();

document.getElementById('pos-modal-bg').addEventListener('click',closePosModal);
document.getElementById('pos-modal-close').addEventListener('click',closePosModal);
document.getElementById('pos-submit').addEventListener('click',()=>{
  const ticker=document.getElementById('pos-ticker').value.trim().toUpperCase();
  const name=document.getElementById('pos-name').value.trim()||ticker;
  const qty=parseFloat(document.getElementById('pos-qty').value);
  const pru=parseFloat(document.getElementById('pos-pru').value);
  const country=document.getElementById('pos-country').value.trim()||'Inconnu';
  const sector=document.getElementById('pos-sector').value||'Autre';
  const type=document.getElementById('pos-type').value;
  const currency=document.getElementById('pos-currency').value;
  const dateVal=document.getElementById('pos-date').value||new Date().toISOString().slice(0,10);
  if(!ticker||!(qty>0)||!(pru>0)){toast('Ticker, quantité et PRU requis');return;}
  const acc=S.accounts.find(a=>a.id===_posAccId);
  if(!acc) return;
  if(acc.holdings.find(h=>h.ticker===ticker)){toast('Ce ticker existe déjà dans ce compte');return;}
  const hid=ticker+'_'+Date.now().toString(36);
  const newH={id:hid,ticker,name,quantity:qty,avgBuyPrice:pru,currentPrice:pru,
    type,country,sector,currency,
    transactions:[{date:dateVal,type:'BUY',qty,price:pru}],
    value:qty*pru,pnl:0,pnlPct:0,pnlRef:0,valueRef:+toRefCcy(qty*pru,currency).toFixed(2)};
  acc.holdings.push(newH);
  acc.value=accSum(acc.holdings);
  closePosModal();
  if(S.screen==='account'&&S.accountId===_posAccId) renderHoldsHTML(acc);
  refreshMain();
  toast(`${ticker} ajouté ✓`);
});

// ═══════════════════════════════════════════════
// EDIT TRANSACTION MODAL
// ═══════════════════════════════════════════════
let _editTxAccId=null, _editTxHoldId=null, _editTxIdx=null, _editTxType='BUY';

function openEditTx(accId, holdId, idx){
  _editTxAccId=accId; _editTxHoldId=holdId; _editTxIdx=idx;
  const acc=S.accounts.find(a=>a.id===accId);
  const h=acc?.holdings.find(h=>h.id===holdId);
  if(!h||idx<0||idx>=h.transactions.length) return;
  const tx=h.transactions[idx];
  _editTxType=tx.type;
  document.querySelectorAll('#edit-type-btns .type-btn').forEach(b=>{
    b.classList.toggle('on',b.dataset.etype===tx.type);
  });
  document.getElementById('edit-tx-qty').value=tx.qty;
  document.getElementById('edit-tx-price').value=tx.price;
  document.getElementById('edit-tx-date').value=tx.date;
  document.getElementById('edit-tx-bg').classList.add('show');
  document.getElementById('edit-tx-sheet').classList.add('show');
}
function closeEditTx(){
  document.getElementById('edit-tx-bg').classList.remove('show');
  document.getElementById('edit-tx-sheet').classList.remove('show');
}
document.getElementById('edit-tx-bg').addEventListener('click',closeEditTx);
document.getElementById('edit-tx-close').addEventListener('click',closeEditTx);
document.querySelectorAll('#edit-type-btns .type-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#edit-type-btns .type-btn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  _editTxType=b.dataset.etype;
}));
document.getElementById('edit-tx-submit').addEventListener('click',()=>{
  const qty=parseFloat(document.getElementById('edit-tx-qty').value);
  const price=parseFloat(document.getElementById('edit-tx-price').value);
  const date=document.getElementById('edit-tx-date').value;
  if(!(qty>0)||!(price>0)||!date){toast('Quantité, prix et date requis');return;}
  const acc=S.accounts.find(a=>a.id===_editTxAccId);
  const h=acc?.holdings.find(h=>h.id===_editTxHoldId);
  if(!h){toast('Position introuvable');return;}
  h.transactions[_editTxIdx]={date,type:_editTxType,qty,price};
  recalcHolding(h);
  acc.value=accSum(acc.holdings);
  closeEditTx();
  renderScreen('stock');
  refreshMain();
  toast('Mouvement modifié ✓');
});

// ═══════════════════════════════════════════════
// CASHFLOW MODAL
// ═══════════════════════════════════════════════
let _cfAccId=null, _cfType='DEP';

function openCfModal(accId){
  _cfAccId=accId; _cfType='DEP';
  document.getElementById('cf-amount').value='';
  document.getElementById('cf-note').value='';
  document.getElementById('cf-date').value=new Date().toISOString().slice(0,10);
  document.querySelectorAll('[data-cftype]').forEach(b=>b.classList.toggle('on',b.dataset.cftype==='DEP'));
  document.getElementById('cf-modal-bg').classList.add('show');
  document.getElementById('cf-modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('cf-amount').focus(),330);
}
function closeCfModal(){
  document.getElementById('cf-modal-bg').classList.remove('show');
  document.getElementById('cf-modal-sheet').classList.remove('show');
}
document.getElementById('cf-modal-bg').addEventListener('click',closeCfModal);
document.getElementById('cf-modal-close').addEventListener('click',closeCfModal);
document.querySelectorAll('[data-cftype]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-cftype]').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  _cfType=b.dataset.cftype;
}));
document.getElementById('cf-submit').addEventListener('click',()=>{
  const amount=parseFloat(document.getElementById('cf-amount').value);
  const date=document.getElementById('cf-date').value||new Date().toISOString().slice(0,10);
  const note=document.getElementById('cf-note').value.trim();
  if(!(amount>0)){toast('Montant requis');return;}
  const acc=S.accounts.find(a=>a.id===_cfAccId);
  if(!acc) return;
  if(!acc.cashflows) acc.cashflows=[];
  acc.cashflows.push({id:'cf_'+Date.now().toString(36),date,type:_cfType,amount,note});
  acc.cashflows.sort((a,b)=>a.date.localeCompare(b.date));
  closeCfModal();
  renderScreen('account');
  refreshMain(); // persiste le cashflow (saveData) — sans ça l'apport disparaissait au rechargement
  toast((_cfType==='DEP'?'Apport':'Retrait')+' enregistré ✓');
});

// ═══════════════════════════════════════════════
// DELETE ACCOUNT
// ═══════════════════════════════════════════════
function deleteAccount(accId){
  const acc=S.accounts.find(a=>a.id===accId); if(!acc) return;
  openConfirm(`Supprimer le compte "${acc.name}" ?`,()=>{
    S.accounts=S.accounts.filter(a=>a.id!==accId);
    if(S.screen==='account'&&S.accountId===accId) back();
    refreshMain();
    toast('Compte supprimé');
  });
}

// ═══════════════════════════════════════════════
// ACCOUNT ACTION MENU
// ═══════════════════════════════════════════════
let _menuAccId=null;

function openAccMenu(accId){
  _menuAccId=accId;
  const acc=S.accounts.find(a=>a.id===accId); if(!acc) return;
  document.getElementById('acc-action-title').textContent=acc.name;
  const obsLbl=document.getElementById('acc-action-obs-lbl');
  if(obsLbl) obsLbl.textContent=acc.observer?'Retirer le mode observateur':'Passer en observateur';
  document.getElementById('acc-action-bg').classList.add('show');
  document.getElementById('acc-action-sheet').classList.add('show');
}
function closeAccMenu(){
  document.getElementById('acc-action-bg').classList.remove('show');
  document.getElementById('acc-action-sheet').classList.remove('show');
  _menuAccId=null;
}
document.getElementById('acc-action-bg').addEventListener('click',closeAccMenu);
document.getElementById('acc-action-obs').addEventListener('click',()=>{
  const id=_menuAccId; // closeAccMenu() nullifie _menuAccId — capturer avant
  const acc=S.accounts.find(a=>a.id===id); if(!acc) return;
  acc.observer=!acc.observer;
  closeAccMenu();
  refreshMain();
  if(S.screen==='account'&&S.accountId===id) renderScreen('account');
  toast(acc.observer?'Mode observateur activé':'Mode observateur désactivé');
});
document.getElementById('acc-action-rename').addEventListener('click',()=>{
  const id=_menuAccId;
  const acc=S.accounts.find(a=>a.id===id); if(!acc) return;
  closeAccMenu();
  openRenameAcc(id, acc.name);
});
document.getElementById('acc-action-del').addEventListener('click',()=>{
  const id=_menuAccId;
  closeAccMenu();
  deleteAccount(id);
});

// ═══════════════════════════════════════════════
// RENAME ACCOUNT
// ═══════════════════════════════════════════════
let _renameAccId=null;
function openRenameAcc(accId, currentName){
  _renameAccId=accId;
  const acc=S.accounts.find(a=>a.id===accId);
  const inp=document.getElementById('rename-acc-input');
  inp.value=currentName||'';
  const curSel=document.getElementById('rename-acc-currency');
  if(curSel) curSel.value=acc?.currency||'EUR';
  document.getElementById('rename-acc-bg').classList.add('show');
  document.getElementById('rename-acc-sheet').classList.add('show');
  setTimeout(()=>{inp.focus();inp.select();},330);
}
function closeRenameAcc(){
  document.getElementById('rename-acc-bg').classList.remove('show');
  document.getElementById('rename-acc-sheet').classList.remove('show');
  _renameAccId=null;
}
document.getElementById('rename-acc-bg').addEventListener('click',closeRenameAcc);
document.getElementById('rename-acc-close').addEventListener('click',closeRenameAcc);
document.getElementById('rename-acc-submit').addEventListener('click',()=>{
  const name=document.getElementById('rename-acc-input').value.trim();
  if(!name){toast('Nom requis');return;}
  const renamedId=_renameAccId;
  const acc=S.accounts.find(a=>a.id===renamedId); if(!acc) return;
  acc.name=name;
  acc.currency=document.getElementById('rename-acc-currency').value||'EUR';
  saveAccounts();
  closeRenameAcc();
  refreshMain();
  if(S.screen==='account'&&S.accountId===renamedId) renderScreen('account');
  toast(`Compte mis à jour ✓`);
});
// Also submit on Enter key
document.getElementById('rename-acc-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();document.getElementById('rename-acc-submit').click();}
});

// ═══════════════════════════════════════════════
// EDIT HOLDING
// ═══════════════════════════════════════════════
let _ehAccId=null,_ehHoldId=null;
function openEditHolding(accId,holdId){
  _ehAccId=accId; _ehHoldId=holdId;
  const acc=S.accounts.find(a=>a.id===accId);
  const h=acc?.holdings.find(h=>h.id===holdId); if(!h) return;
  document.getElementById('eh-ticker').value=h.ticker;
  document.getElementById('eh-name').value=h.name||'';
  document.getElementById('eh-type').value=h.type||'Action';
  document.getElementById('eh-currency').value=h.currency||'EUR';
  document.getElementById('eh-country').value=h.country||'';
  document.getElementById('eh-sector').value=h.sector||'Autre';
  document.getElementById('eh-price').value=h.currentPrice||'';
  document.getElementById('edit-holding-bg').classList.add('show');
  document.getElementById('edit-holding-sheet').classList.add('show');
}
function closeEditHolding(){
  document.getElementById('edit-holding-bg').classList.remove('show');
  document.getElementById('edit-holding-sheet').classList.remove('show');
  _ehAccId=null; _ehHoldId=null;
}
document.getElementById('edit-holding-bg').addEventListener('click',closeEditHolding);
document.getElementById('edit-holding-close').addEventListener('click',closeEditHolding);
document.getElementById('eh-submit').addEventListener('click',()=>{
  const acc=S.accounts.find(a=>a.id===_ehAccId);
  const h=acc?.holdings.find(h=>h.id===_ehHoldId); if(!h) return;
  const newName=document.getElementById('eh-name').value.trim();
  if(newName) h.name=newName;
  h.type=document.getElementById('eh-type').value;
  h.currency=document.getElementById('eh-currency').value;
  h.country=document.getElementById('eh-country').value.trim()||h.country;
  h.sector=document.getElementById('eh-sector').value;
  const newPrice=parseFloat(document.getElementById('eh-price').value);
  if(newPrice>0){
    h.currentPrice=newPrice;
    recalcHolding(h);
    acc.value=accSum(acc.holdings);
  }
  saveAccounts();
  closeEditHolding();
  renderScreen('stock');
  refreshMain();
  toast(`${h.ticker} mis à jour ✓`);
});

// ═══════════════════════════════════════════════
// ADD ORDER MODAL
// ═══════════════════════════════════════════════
let _mAccId=null, _mHoldId=null, _mType='BUY';

function openAddOrder(accId, holdId) {
  _mAccId=accId; _mHoldId=holdId; _mType='BUY';
  const acc=S.accounts.find(a=>a.id===accId);
  const h=acc?.holdings.find(h=>h.id===holdId);
  if(!h) return;
  document.getElementById('modal-ticker').textContent=h.ticker;
  document.getElementById('modal-name').textContent=h.name;
  document.getElementById('modal-qty').value='';
  document.getElementById('modal-price').value=h.currentPrice.toFixed(2);
  document.getElementById('modal-date').value=new Date().toISOString().slice(0,10);
  document.querySelectorAll('.type-btn').forEach(b=>b.classList.toggle('on',b.dataset.type==='BUY'));
  document.getElementById('modal-bg').classList.add('show');
  document.getElementById('modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('modal-qty').focus(),330);
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('show');
  document.getElementById('modal-sheet').classList.remove('show');
}

document.getElementById('modal-bg').addEventListener('click', closeModal);
document.getElementById('modal-close').addEventListener('click', closeModal);

document.querySelectorAll('.type-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.type-btn').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  _mType=b.dataset.type;
  const qtyLabel=document.querySelector('#modal-qty').closest('.form-field').querySelector('.form-label');
  qtyLabel.textContent=_mType==='DIV'?'Nb actions':'Quantité';
  const priceLabel=document.querySelector('#modal-price').closest('.form-field').querySelector('.form-label');
  priceLabel.textContent=_mType==='DIV'?'Dividende/action':'Prix unitaire';
}));

document.getElementById('modal-submit').addEventListener('click',()=>{
  const qty=parseFloat(document.getElementById('modal-qty').value);
  const price=parseFloat(document.getElementById('modal-price').value);
  const date=document.getElementById('modal-date').value||new Date().toISOString().slice(0,10);
  if(!(qty>0)||!(price>0)){toast('Quantité et prix requis');return;}
  const acc=S.accounts.find(a=>a.id===_mAccId);
  const h=acc?.holdings.find(h=>h.id===_mHoldId);
  if(!h){toast('Position introuvable');return;}
  h.transactions.push({date,type:_mType,qty,price});
  // recalcHolding recompute tout (dont valueRef/pnlRef, que le calcul manuel oubliait :
  // accSum lit valueRef → patrimoine faux jusqu'au prochain fetch), comme edit-tx-submit
  recalcHolding(h);
  acc.value=accSum(acc.holdings);
  closeModal();
  const accEl=document.getElementById('s-account');
  const holdsEl=accEl?.querySelector('#js-holds');
  if(holdsEl) renderHoldsHTML(acc);
  refreshMain();
  const lbl={BUY:'Achat',SELL:'Vente',DIV:'Dividende'}[_mType];
  toast(`${lbl} enregistré ✓`);
});

// ═══════════════════════════════════════════════
// BOTTOM NAV
// ═══════════════════════════════════════════════
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{
  const t=b.dataset.nav;
  if(t===S.screen) return;
  const fi=NAV_SCREENS.indexOf(S.screen), ti=NAV_SCREENS.indexOf(t);
  const dir=(fi>=0&&ti<fi)?'back':'forward';
  go(t,dir);
}));

// ═══════════════════════════════════════════════
// SWIPE ENTRE ONGLETS
// ═══════════════════════════════════════════════
(function(){
  let x0=0, y0=0, tgt0=null, scrolling=null, lastNav=0;
  const app=document.getElementById('app');

  app.addEventListener('touchstart', e=>{
    x0=e.touches[0].clientX;
    y0=e.touches[0].clientY;
    tgt0=e.target;
    scrolling=null;
  },{passive:true});

  app.addEventListener('touchmove', e=>{
    if(scrolling!==null) return;
    const dx=Math.abs(e.touches[0].clientX-x0);
    const dy=Math.abs(e.touches[0].clientY-y0);
    if(dy>dx+4) scrolling=true;        // geste vertical → scroll natif
    else if(dx>10) scrolling=false;    // geste horizontal → swipe
  },{passive:true});

  app.addEventListener('touchend', e=>{
    if(scrolling!==false) return;                      // scroll ou ambigu
    if(!NAV_SCREENS.includes(S.screen)) return;        // hors onglets nav
    if(tgt0&&tgt0.closest('.tabs')) return;            // chips filtres (scroll horizontal)
    if(Date.now()-lastNav<350) return;                 // animation déjà en cours

    const dx=e.changedTouches[0].clientX-x0;
    if(Math.abs(dx)<52) return;                        // trop court (<52px)

    const idx=NAV_SCREENS.indexOf(S.screen);
    if(dx<0 && idx<NAV_SCREENS.length-1){              // ← swipe gauche : onglet suivant
      lastNav=Date.now();
      go(NAV_SCREENS[idx+1],'forward');
    } else if(dx>0 && idx>0){                          // → swipe droite : onglet précédent
      lastNav=Date.now();
      go(NAV_SCREENS[idx-1],'back');
    }
  },{passive:true});
})();

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
let toastTimer;
function toast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2400);
}

// ═══════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════

function timeSince(ts) { return PU.timeSince(ts); }

// ── Sauvegarde données financières ──
function saveAccounts() {
  try {
    localStorage.setItem(STORE_ACCOUNTS, JSON.stringify({
      accounts:  S.accounts,
      isDemo:    S.isDemo,
      watchlist: S.watchlist,
      targets:   S.targets,
      user:      S.user,
    }));
  } catch(e) {}
}

// ── Sauvegarde préférences ──
function saveSettings() {
  try {
    localStorage.setItem(STORE_SETTINGS, JSON.stringify({
      theme:       S.theme,
      currency:    S.currency,
      privacy:     S.privacy,
      histPeriod:  S.histPeriod,
      sort:        S.sort,
      sortDir:     S.sortDir,
      debug:       S.debug,
      autoRefresh: S.autoRefresh,
      assistantEnabled: S.assistantEnabled,
      priceApiKey: S.priceApiKey,
      fmpApiKey:   S.fmpApiKey,
    }));
  } catch(e) {}
}

// ── Sauvegarde tout ──
function saveData() { saveAccounts(); saveSettings(); }

// ── Chargement avec migration automatique depuis l'ancien format ──
function loadData() {
  try {
    // Migration : si l'ancienne clé existe, ventiler dans les deux nouvelles
    const legacy = localStorage.getItem(STORE_LEGACY);
    if (legacy) {
      const d = JSON.parse(legacy);
      if (!localStorage.getItem(STORE_ACCOUNTS)) {
        localStorage.setItem(STORE_ACCOUNTS, JSON.stringify({
          accounts:  d.accounts  || [],
          isDemo:    d.isDemo    !== undefined ? d.isDemo : true,
          watchlist: d.watchlist || [],
          targets:   d.targets   || {},
          user:      d.user      || { name: 'Moi' },
        }));
      }
      if (!localStorage.getItem(STORE_SETTINGS)) {
        localStorage.setItem(STORE_SETTINGS, JSON.stringify({
          theme:       d.theme       || 'auto',
          currency:    d.currency    || 'EUR',
          privacy:     d.privacy     !== undefined ? d.privacy : false,
          histPeriod:  d.histPeriod  || '1M',
          sort:        d.sort        || 'value',
          sortDir:     d.sortDir     !== undefined ? d.sortDir : -1,
          debug:       d.debug       !== undefined ? d.debug : false,
          autoRefresh: d.autoRefresh !== undefined ? d.autoRefresh : false,
          priceApiKey: d.priceApiKey || '',
        }));
      }
      localStorage.removeItem(STORE_LEGACY); // supprimer l'ancienne clé
    }

    const rawA = localStorage.getItem(STORE_ACCOUNTS);
    const rawS = localStorage.getItem(STORE_SETTINGS);
    if (!rawA && !rawS) return false;

    // Charger les données financières
    if (rawA) {
      const a = JSON.parse(rawA);
      if (a.accounts)             S.accounts  = a.accounts;
      if (a.isDemo !== undefined) S.isDemo    = a.isDemo;
      if (a.watchlist)            S.watchlist = a.watchlist;
      if (a.targets)              S.targets   = a.targets;
      if (a.user)                 S.user      = a.user;
    }
    // Charger les préférences
    if (rawS) {
      const s = JSON.parse(rawS);
      if (s.theme)                  S.theme       = s.theme;
      if (s.currency)               S.currency    = s.currency;
      if (s.privacy !== undefined)  S.privacy     = s.privacy;
      if (s.histPeriod)             S.histPeriod  = s.histPeriod;
      if (s.sort)                   S.sort        = s.sort;
      if (s.sortDir !== undefined)  S.sortDir     = s.sortDir;
      if (s.debug !== undefined)    S.debug       = s.debug;
      if (s.autoRefresh !== undefined) S.autoRefresh = s.autoRefresh;
      if (s.assistantEnabled !== undefined) S.assistantEnabled = s.assistantEnabled;
      if (s.priceApiKey)            S.priceApiKey = s.priceApiKey;
      if (s.fmpApiKey)              S.fmpApiKey   = s.fmpApiKey;
    }
    return true;
  } catch(e) { return false; }
}

function savePrices(prices) {
  // prices = { 'MC': 734.2, 'AAPL': 189.3, ... }
  try {
    const fxToSave = Object.fromEntries(Object.entries(FX_RATES).filter(([k]) => k !== 'EUR'));
    localStorage.setItem(STORE_PRICES, JSON.stringify({ prices, updatedAt: Date.now(), fxRates: fxToSave, fxUpdatedAt: _fxUpdatedAt }));
  } catch(e) {}
}

function saveFxRates() {
  try {
    const raw = localStorage.getItem(STORE_PRICES);
    const data = raw ? JSON.parse(raw) : { prices: {}, updatedAt: 0 };
    data.fxRates = Object.fromEntries(Object.entries(FX_RATES).filter(([k]) => k !== 'EUR'));
    data.fxUpdatedAt = _fxUpdatedAt;
    localStorage.setItem(STORE_PRICES, JSON.stringify(data));
  } catch(e) {}
}

function loadPrices() {
  try {
    const raw=localStorage.getItem(STORE_PRICES);
    return raw ? JSON.parse(raw) : null;  // { prices:{...}, updatedAt: ms, fxRates:{...}, fxUpdatedAt: ms }
  } catch(e) { return null; }
}

// ── Historique réel des cours (séries quotidiennes par ticker) ──
// Format stocké : { 'AAPL': { series:[{d:'YYYY-MM-DD', c:close}], currency:'USD', fetchedAt: ms }, ... }
let _historyCache = null;
function loadHistory() {
  if (_historyCache) return _historyCache;
  try {
    const raw = localStorage.getItem(STORE_HISTORY);
    _historyCache = raw ? JSON.parse(raw) : {};
  } catch(e) { _historyCache = {}; }
  return _historyCache;
}
function saveHistory(ticker, series, currency) {
  const all = loadHistory();
  all[ticker] = { series, currency: currency || 'EUR', fetchedAt: Date.now() };
  _historyCache = all;
  try { localStorage.setItem(STORE_HISTORY, JSON.stringify(all)); } catch(e) {}
}
// Renvoie l'entrée historique d'un ticker si elle existe et contient des points, sinon null
function getHistorySeries(ticker) {
  const h = loadHistory()[ticker];
  return (h && Array.isArray(h.series) && h.series.length >= 2) ? h : null;
}

// ── Historique réel du patrimoine (snapshots quotidiens de la valeur totale) ──
// Format stocké : [{ d:'YYYY-MM-DD', v: valeur_en_devise_appli }] trié par date croissante.
// Clé jour en date LOCALE (toISOString décalait d'un jour en fuseau UTC+) — implémentation dans utils.js
function _dayKey(d) { return PU.dayKey(d); }
function loadWealth() {
  try { const a = JSON.parse(localStorage.getItem(STORE_WEALTH) || '[]'); return Array.isArray(a) ? a : []; }
  catch(e) { return []; }
}
function saveWealth(arr) { try { localStorage.setItem(STORE_WEALTH, JSON.stringify(arr)); } catch(e) {} }
// Enregistre (ou écrase) le point du jour avec la valeur totale courante. No-op en mode démo.
function snapshotWealth() {
  if (S.isDemo) return;
  const w = totalWealth();
  if (!(w > 0)) return;
  const key = _dayKey(Date.now());
  const arr = loadWealth().filter(p => p.d !== key);
  arr.push({ d: key, v: +w.toFixed(2) });
  arr.sort((a,b) => a.d.localeCompare(b.d));
  const overflow = arr.length - 800; // ~2 ans de points max
  if (overflow > 0) arr.splice(0, overflow);
  saveWealth(arr);
}
// Quantité détenue par un holding à une date donnée (cumul des transactions <= dayKey).
function _qtyOnDay(h, dayKey) {
  if (!h.transactions || !h.transactions.length) return h.quantity ?? 0;
  let q = 0;
  for (const tx of h.transactions) {
    if (tx.date > dayKey) continue;
    if (tx.type === 'BUY') q += tx.qty;
    else if (tx.type === 'SELL') q = Math.max(0, q - tx.qty);
  }
  return q;
}
// Reconstruit (approximativement) la valeur totale du patrimoine à une date passée :
// quantité détenue ce jour-là × dernière clôture connue <= ce jour (série réelle si dispo,
// sinon cours actuel), convertie en devise appli avec les taux FX courants.
function reconstructWealthOnDay(dayKey) {
  let tot = 0;
  S.accounts.filter(a => !a.observer).forEach(a => {
    a.holdings.forEach(h => {
      const qty = _qtyOnDay(h, dayKey);
      if (qty <= 0) return;
      const hist = getHistorySeries(h.ticker);
      let price = h.currentPrice;
      if (hist) {
        let c = null;
        for (const p of hist.series) { if (p.d <= dayKey) c = p.c; else break; }
        if (c != null) price = c;
      }
      tot += toRefCcy(qty * price, h.currency);
    });
  });
  return +tot.toFixed(2);
}
// Comble les jours passés manquants du store par reconstruction (idempotent : ne touche jamais
// aux vrais snapshots déjà enregistrés, ni au jour courant réservé au snapshot live).
function backfillWealthHistory(days = 365) {
  if (S.isDemo) return;
  const arr = loadWealth();
  const have = new Set(arr.map(p => p.d));
  const today = new Date(); today.setHours(0,0,0,0);
  let added = 0;
  for (let i = days; i >= 1; i--) {
    const key = _dayKey(today.getTime() - i*86400000);
    if (have.has(key)) continue;
    const v = reconstructWealthOnDay(key);
    if (v > 0) { arr.push({ d: key, v }); added++; }
  }
  if (added) { arr.sort((a,b) => a.d.localeCompare(b.d)); saveWealth(arr); }
}

function applyPrices(priceData) {
  if(!priceData?.prices) return;
  S.accounts.flatMap(a=>a.holdings).forEach(h=>{
    const p=priceData.prices[h.ticker];
    if(p!=null){ h.currentPrice=p; recalcHolding(h); }
  });
  S.accounts.forEach(a=>{ a.value=accSum(a.holdings); });
  S.lastPriceUpdate=priceData.updatedAt;
}

// ═══════════════════════════════════════════════
// THÈME
// ── Log debug global (utilisé par fetch global ET refreshs individuels) ──
function dbgLog(tag, msg) {
  if (!S.debug) return;
  S._debugLog.unshift(`${tag} ${msg}`);
  if (S._debugLog.length > 80) S._debugLog.length = 80;
  // Mise à jour live du bloc log si la page settings est ouverte
  const logEl = document.getElementById('js-debug-log');
  if (logEl) {
    logEl.innerHTML = S._debugLog.map(l => {
      const col = l.startsWith('[OK')  ? 'var(--gain)'
                : l.startsWith('[ERR') ? 'var(--loss)'
                : l.startsWith('[WRN') ? '#F59E0B'
                : 'var(--text2)';
      return `<span style="color:${col}">${l.replace(/</g,'&lt;')}</span>`;
    }).join('\n');
  } else if (S.screen !== 'settings') {
    // Badge sur le bouton ⚙ pour signaler qu'il y a des logs à consulter
    document.querySelectorAll('#js-settings-btn').forEach(btn => {
      if (!btn.querySelector('.log-badge')) {
        const b = document.createElement('div');
        b.className = 'log-badge';
        b.style.cssText = 'position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#F59E0B;border:1.5px solid var(--card);pointer-events:none';
        btn.style.position = 'relative';
        btn.appendChild(b);
      }
    });
  }
}

// ═══════════════════════════════════════════════
function applyTheme(theme) {
  const dark = theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? '' : 'light');
}

// ═══════════════════════════════════════════════
// LIVE PRICES  (PWA / HTTPS uniquement)
// ═══════════════════════════════════════════════
const PROXY_URL = 'https://patrimoine-prices.al-the-best.workers.dev';

// Cache session des titres résolus en ligne (hors SECURITIES_DB)
const _tickerMeta = {}; // ticker → {name, currency, type, price}

// Résout un ticker absent de la base via le proxy (route ?symbols= déjà déployée).
// Renvoie {name, currency, type, price} ou null. Best-effort, silencieux.
async function resolveTickerOnline(ticker){
  if(!ticker || SECURITIES_DB[ticker]) return null;
  if(_tickerMeta[ticker]) return _tickerMeta[ticker];
  try{
    const r = await fetch(PROXY_URL + '?symbols=' + encodeURIComponent(yahooSymbolFor(ticker)),
      { signal: AbortSignal.timeout(12000) });  // 12 s : absorbe le cold-start du worker (auth crumb Yahoo)
    if(!r.ok) return null;
    const data = await r.json();
    const q = data?.quoteResponse?.result?.find(x => x.regularMarketPrice);
    if(!q) return null;
    const qt = (q.quoteType||'').toUpperCase();
    const info = {
      name:     q.longName || q.shortName || ticker,
      currency: (q.currency||'EUR').toUpperCase(),
      type:     qt==='ETF' ? 'ETF' : qt==='CRYPTOCURRENCY' ? 'Crypto' : 'Action',
      price:    q.regularMarketPrice,
    };
    _tickerMeta[ticker] = info;
    return info;
  }catch(_){ return null; }
}

// Affecte une valeur à un <select>, en créant l'option si absente (ex: devise CAD/JPY).
function setSelectValue(sel, val, label){
  if(!sel) return;
  if(![...sel.options].some(o => o.value === val)){
    const o = document.createElement('option');
    o.value = val; o.textContent = label || val;
    sel.appendChild(o);
  }
  sel.value = val;
}

let _fetching = false;
let _tdRateLimited = 0;
let _fxUpdatedAt = null;

// Helper partagé : fetch un cours unique via Twelve Data ou Yahoo
async function _fetchSinglePrice(yhSym, cgId) {
  let price = null, change1d = null;
  const sym = yhSym || cgId;
  dbgLog('[INF]', `─── Refresh individuel: ${sym} ───`);

  if (cgId) {
    try {
      dbgLog('[INF]', `CoinGecko → ${cgId}`);
      const r  = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true`,
        { signal: AbortSignal.timeout(8000) }
      );
      dbgLog(r.ok?'[OK]':'[WRN]', `CoinGecko status=${r.status}`);
      if (r.ok) {
        const d = await r.json();
        price    = d[cgId]?.usd             || null;
        change1d = d[cgId]?.usd_24h_change  ?? null;
        dbgLog(price?'[OK]':'[WRN]', `CoinGecko prix=${price} change=${change1d}`);
      }
    } catch(e) { dbgLog('[ERR]', `CoinGecko: ${e?.message||e}`); }
    return { price, change1d };
  }

  // Proxy Cloudflare (Yahoo Finance sans CORS)
  try {
    dbgLog('[INF]', `Proxy → ${yhSym}`);
    const r = await fetch(`${PROXY_URL}?symbols=${encodeURIComponent(yhSym)}`,
      { signal: AbortSignal.timeout(8000) });
    dbgLog(r.ok?'[OK]':'[WRN]', `Proxy status=${r.status}`);
    if (r.ok) {
      const d = await r.json();
      const q = d?.quoteResponse?.result?.[0];
      if (q?.regularMarketPrice) {
        price    = q.regularMarketPrice;
        change1d = q.regularMarketChangePercent || 0;
        dbgLog('[OK]', `Proxy prix=${price} change=${change1d?.toFixed(2)}%`);
      }
    }
  } catch(e) { dbgLog('[ERR]', `Proxy: ${e?.message||e}`); }

  // Fallback FMP (si proxy en panne)
  if (!price && S.fmpApiKey) {
    try {
      dbgLog('[INF]', `FMP fallback → ${yhSym}`);
      const r = await fetch(
        `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(yhSym)}?apikey=${encodeURIComponent(S.fmpApiKey)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      dbgLog(r.ok?'[OK]':'[WRN]', `FMP status=${r.status}`);
      if (r.ok) {
        const d = await r.json();
        const q = Array.isArray(d) ? d[0] : d;
        if (q?.price && !q?.Error) {
          price    = parseFloat(q.price);
          change1d = parseFloat(q.changesPercentage) || 0;
          dbgLog('[OK]', `FMP prix=${price} change=${change1d?.toFixed(2)}%`);
        }
      }
    } catch(e) { dbgLog('[ERR]', `FMP: ${e?.message||e}`); }
  }

  if (!price) dbgLog('[ERR]', `Aucun cours trouvé pour ${sym}`);
  return { price, change1d };
}

// Rafraîchit le cours d'un holding (écran stock)
let _tickerFetching = false;
async function fetchTickerPrice(ticker, accId, holdingId) {
  if (_tickerFetching) return;
  _tickerFetching = true;
  const yhSym = yahooSymbolFor(ticker);
  const cgId  = CG_IDS[ticker];
  if (!yhSym && !cgId) { toast('Ticker non reconnu'); _tickerFetching=false; return; }

  const btn = document.querySelector('#js-ticker-refresh svg');
  if (btn) btn.classList.add('spin');

  const { price } = await _fetchSinglePrice(yhSym, cgId);

  if (btn) btn.classList.remove('spin');
  _tickerFetching = false;

  if (!price) { if (!_tdRateLimited || Date.now()-_tdRateLimited>61000) toast('Cours introuvable'); return; }

  const acc = S.accounts.find(a => a.id === accId);
  const h   = acc?.holdings.find(h => h.id === holdingId);
  if (h) {
    h.currentPrice = price;
    recalcHolding(h);
    acc.value = accSum(acc.holdings);
    const cached = loadPrices() || { prices: {} };
    cached.prices[ticker] = price;
    savePrices(cached.prices);
    S.lastPriceUpdate = Date.now();
    renderScreen('stock');
    refreshMain();
    toast(`${ticker} · ${fmtNative(price, h.currency||'EUR')} ✓`);
  }
}

// ── Reprise d'historique réel à la demande (écran titre) ──
// Choisit la profondeur Yahoo couvrant la 1ère transaction (capée à 'max')
function _histRange(h) {
  const txMs = h.transactions.map(t => new Date(t.date+'T00:00:00').getTime());
  const first = txMs.length ? Math.min(...txMs) : Date.now() - 365*86400000;
  const yrs = (Date.now() - first) / (365*86400000);
  return yrs <= 1 ? '1y' : yrs <= 2 ? '2y' : yrs <= 5 ? '5y' : yrs <= 10 ? '10y' : 'max';
}

// Normalise un dictionnaire {jour → close} en série ascendante [{d, c}]
function _histSeriesFromByDay(byDay) {
  return Object.keys(byDay).sort().map(d => ({ d, c: byDay[d] }));
}

async function _fetchYahooHistory(yhSym, range) {
  range = range || '5y';
  dbgLog('[INF]', `Proxy chart → ${yhSym} range=${range}`);
  const r = await fetch(`${PROXY_URL}?chart=${encodeURIComponent(yhSym)}&range=${range}&interval=1d`,
    { signal: AbortSignal.timeout(12000) });
  dbgLog(r.ok?'[OK]':'[WRN]', `Proxy chart status=${r.status}`);
  if (!r.ok) return null;
  const d = await r.json();
  const res = d?.chart?.result?.[0];
  const ts  = res?.timestamp;
  if (!ts) return null;
  const vals = res.indicators?.adjclose?.[0]?.adjclose || res.indicators?.quote?.[0]?.close;
  if (!vals) return null;
  const byDay = {};
  for (let i = 0; i < ts.length; i++) {
    if (vals[i] == null) continue;
    byDay[_dayKey(ts[i]*1000)] = +vals[i].toFixed(4); // clé jour locale (toISOString décalait de -1j en UTC+)
  }
  dbgLog('[OK]', `Yahoo history ${Object.keys(byDay).length} jours`);
  return _histSeriesFromByDay(byDay);
}

async function _fetchCryptoHistory(cgId, days) {
  // CoinGecko free tier : daily limité à ~365 jours
  days = Math.min(days || 365, 365);
  dbgLog('[INF]', `CoinGecko chart → ${cgId} days=${days}`);
  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    { signal: AbortSignal.timeout(12000) });
  dbgLog(r.ok?'[OK]':'[WRN]', `CoinGecko chart status=${r.status}`);
  if (!r.ok) return null;
  const d = await r.json();
  if (!Array.isArray(d?.prices)) return null;
  const byDay = {};
  d.prices.forEach(([ms, price]) => {
    byDay[_dayKey(ms)] = +price.toFixed(6); // clé jour locale, cohérente avec _dayKey partout
  });
  dbgLog('[OK]', `CoinGecko history ${Object.keys(byDay).length} jours`);
  return _histSeriesFromByDay(byDay);
}

let _histFetching = false;
async function fetchTickerHistory(ticker, accId, holdingId) {
  if (_histFetching) return;
  const acc = S.accounts.find(a => a.id === accId);
  const h   = acc?.holdings.find(h => h.id === holdingId);
  if (!h) return;
  const yhSym = yahooSymbolFor(ticker);
  const cgId  = CG_IDS[ticker];
  if (!yhSym && !cgId) { toast('Ticker non reconnu'); return; }

  _histFetching = true;
  const btn = document.querySelector('#js-ticker-history svg');
  if (btn) btn.classList.add('spin');

  // Profondeur adaptée à la 1ère transaction du titre (transactions peut manquer sur données importées)
  const txMs = (h.transactions||[]).map(t => new Date(t.date+'T00:00:00').getTime());
  const first = txMs.length ? Math.min(...txMs) : Date.now() - 365*86400000;
  const cryptoDays = Math.ceil((Date.now() - first)/86400000) + 5;

  let series = null;
  try {
    series = cgId ? await _fetchCryptoHistory(cgId, cryptoDays) : await _fetchYahooHistory(yhSym, _histRange(h));
  } catch(e) { dbgLog('[ERR]', `Historique ${ticker}: ${e?.message||e}`); }

  if (btn) btn.classList.remove('spin');
  _histFetching = false;

  if (!series || series.length < 2) { toast('Historique introuvable'); return; }
  saveHistory(ticker, series, h.currency || 'EUR');
  renderScreen('stock');
  toast(`Historique ${ticker} repris · ${series.length} points ✓`);
}

// ── Reprise d'historique réel à la demande (écran watchstock) ──
// Pas de transactions ici → profondeur fixe (Yahoo 2y / crypto 365j) couvrant toutes les périodes (1S→1A, 52 sem.)
let _watchHistFetching = false;
async function fetchWatchHistory(ticker) {
  if (_watchHistFetching) return;
  const w = S.watchlist.find(w => w.ticker === ticker);
  if (!w) return;
  const yhSym = yahooSymbolFor(ticker);
  const cgId  = CG_IDS[ticker];
  if (!yhSym && !cgId) { toast('Ticker non reconnu'); return; }

  _watchHistFetching = true;
  const btn = document.querySelector('#js-watch-ticker-history svg');
  if (btn) btn.classList.add('spin');

  let series = null;
  try {
    series = cgId ? await _fetchCryptoHistory(cgId, 365) : await _fetchYahooHistory(yhSym, '2y');
  } catch(e) { dbgLog('[ERR]', `Historique ${ticker}: ${e?.message||e}`); }

  if (btn) btn.classList.remove('spin');
  _watchHistFetching = false;

  if (!series || series.length < 2) { toast('Historique introuvable'); return; }
  saveHistory(ticker, series, w.currency || SECURITIES_DB[ticker]?.currency || 'EUR');
  renderScreen('watchstock');
  toast(`Historique ${ticker} repris · ${series.length} points ✓`);
}

// Rafraîchit le cours d'un titre suivi (écran watchstock)
let _watchFetching = false;
async function fetchWatchPrice(ticker) {
  if (_watchFetching) return;
  _watchFetching = true;
  const yhSym = yahooSymbolFor(ticker);
  const cgId  = CG_IDS[ticker];
  if (!yhSym && !cgId) { toast('Ticker non reconnu'); _watchFetching=false; return; }

  const btn = document.querySelector('#js-watch-ticker-refresh svg');
  if (btn) btn.classList.add('spin');

  const { price, change1d } = await _fetchSinglePrice(yhSym, cgId);

  if (btn) btn.classList.remove('spin');
  _watchFetching = false;

  if (!price) { if (!_tdRateLimited || Date.now()-_tdRateLimited>61000) toast('Cours introuvable'); return; }

  const w = S.watchlist.find(w => w.ticker === ticker);
  if (w) {
    w.price = price;
    if (change1d !== null) w.change1d = change1d;
    saveAccounts();
    renderScreen('watchstock');
    refreshMain();
    const wCur = w.currency || SECURITIES_DB[ticker]?.currency || 'EUR';
    toast(`${ticker} · ${fmtNative(price, wCur)} ✓`);
  }
}

// FX pairs to fetch: EURUSD=X → regularMarketPrice = USD per EUR = FX_RATES.USD
// Base fixe + toutes les devises réellement présentes (un titre résolu en ligne peut être
// en CAD/AUD/SEK… — sans son taux, toRefCcy retombait silencieusement sur la parité 1:1)
function fxPairsNeeded() {
  const ccys = new Set(['USD','GBP','CHF','JPY']);
  if (S.currency) ccys.add(S.currency);
  S.accounts.forEach(a => {
    if (a.currency) ccys.add(a.currency);
    a.holdings.forEach(h => { if (h.currency) ccys.add(h.currency); });
  });
  S.watchlist.forEach(w => { if (w.currency) ccys.add(w.currency); });
  ccys.delete('EUR');
  return [...ccys].map(c => `EUR${c}=X`);
}

async function fetchFxRates() {
  const FX_PAIRS = fxPairsNeeded();
  dbgLog('[INF]', `FX → ${FX_PAIRS.join(', ')}`);
  try {
    const url = PROXY_URL + '?symbols=' + FX_PAIRS.join(',');
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) { dbgLog('[WRN]', `FX status=${r.status}`); return; }
    const data = await r.json();
    const results = data?.quoteResponse?.result || [];
    let updated = 0;
    results.forEach(q => {
      const m = q.symbol.match(/^EUR(\w+)=X$/);
      if (m && q.regularMarketPrice) {
        FX_RATES[m[1]] = q.regularMarketPrice;
        updated++;
      }
    });
    if (updated) {
      _fxUpdatedAt = Date.now();
      saveFxRates();
      // Recalculer valueRef/pnlRef pour tous les titres avec les nouveaux taux
      S.accounts.forEach(acc => {
        acc.holdings.forEach(h => {
          h.valueRef = +toRefCcy(h.value||0, h.currency).toFixed(2);
          h.pnlRef   = +toRefCcy(h.pnl||0,   h.currency).toFixed(2);
        });
        acc.value = accSum(acc.holdings);
      });
      dbgLog('[OK]', `FX mis à jour: ${Object.entries(FX_RATES).map(([k,v])=>`${k}=${v}`).join(', ')}`);
    } else dbgLog('[WRN]', 'FX: aucun résultat');
  } catch(e) {
    dbgLog('[ERR]', `FX: ${e?.message||e}`);
  }
}

async function fetchLivePrices() {
  if (_fetching) return;
  _fetching = true;

  // Indicateur visuel sur le bouton refresh
  const btnSvg = document.querySelector('#js-refresh-btn svg');
  if (btnSvg) btnSvg.classList.add('spin');

  const allH = S.accounts.flatMap(a => a.holdings);
  // Watchlist seule = toujours rafraîchie (l'ancien return coupait aussi watchlist + FX)
  if (!allH.length && !S.watchlist.length) { _fetching=false; if(btnSvg) btnSvg.classList.remove('spin'); return; }
  try {

  // Taux de change live (avant recalcHolding pour que valueRef soit correct)
  await fetchFxRates();

  // Tickers uniques : comptes + watchlist (sauf crypto).
  // Fallback yahooSymbolFor → titres hors base envoyés avec leur ticker brut.
  const watchSymbols = S.watchlist
    .filter(w => !CG_IDS[w.ticker])           // crypto suivie → gérée par CoinGecko
    .map(w => yahooSymbolFor(w.ticker));
  const yahooSymbols = [...new Set([
    ...allH.filter(h=>h.type!=='Crypto').map(h=>yahooSymbolFor(h.ticker)),
    ...watchSymbols,
  ])];
  // Cryptos des comptes ET de la watchlist (une crypto suivie sans position n'était jamais rafraîchie)
  const cgIds = [...new Set([
    ...allH.filter(h=>h.type==='Crypto').map(h=>CG_IDS[h.ticker]),
    ...S.watchlist.map(w=>CG_IDS[w.ticker]),
  ].filter(Boolean))];

  // Map inverse : symbole Yahoo → ticker app
  const yahooRev = {};
  Object.entries(YAHOO_MAP).forEach(([app,yh])=>yahooRev[yh]=app);
  // Map inverse : CoinGecko id → ticker app
  const cgRev = {};
  Object.entries(CG_IDS).forEach(([app,cg])=>cgRev[cg]=app);

  let updated = 0;
  const errors = [];
  const prices = {}; // pour savePrices()

  // ── Proxy Cloudflare → Yahoo Finance (+ FMP en fallback) ──
  if (yahooSymbols.length) {
    let yResults = null;
    const parseV7 = data => data?.quoteResponse?.result?.filter(q => q.regularMarketPrice) || [];
    dbgLog('[INF]', `Proxy → ${yahooSymbols.length} symboles: ${yahooSymbols.join(', ')}`);

    // Proxy Cloudflare (Yahoo Finance sans CORS)
    try {
      const url = PROXY_URL + '?symbols=' + yahooSymbols.join(',');
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      dbgLog(r.ok?'[OK]':'[WRN]', `Proxy status=${r.status}`);
      if (r.ok) { yResults = parseV7(await r.json()); dbgLog('[OK]', `Proxy résultats=${yResults.length}`); }
    } catch(e) { dbgLog('[ERR]', `Proxy: ${e?.message||e}`); }

    // Fallback FMP (si proxy en panne)
    if (!yResults?.length && S.fmpApiKey) {
      try {
        dbgLog('[INF]', `FMP fallback → ${yahooSymbols.join(',')}`);
        const r = await fetch(
          `https://financialmodelingprep.com/api/v3/quote/${yahooSymbols.join(',')}?apikey=${encodeURIComponent(S.fmpApiKey)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        dbgLog(r.ok?'[OK]':'[WRN]', `FMP status=${r.status}`);
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length) {
            yResults = data.filter(q => q.price).map(q => ({
              symbol: q.symbol, regularMarketPrice: parseFloat(q.price)
            }));
            dbgLog('[OK]', `FMP résultats=${yResults.length}`);
          }
        }
      } catch(e) { dbgLog('[ERR]', `FMP: ${e?.message||e}`); }
    }

    if (yResults?.length) {
      yResults.forEach(q => {
        const ticker = yahooRev[q.symbol] || q.symbol;
        const price  = q.regularMarketPrice;
        if (!price) return;
        // Titre hors base : la devise Yahoo fait foi (le défaut EUR n'était qu'une supposition)
        const known = !!SECURITIES_DB[ticker];
        const qCur  = q.currency ? q.currency.toUpperCase() : null;
        // Mettre à jour les holdings
        allH.filter(h => h.ticker === ticker).forEach(h => {
          h.currentPrice = price;
          if (!known && qCur) h.currency = qCur;
          recalcHolding(h);
          updated++;
        });
        // Mettre à jour la watchlist
        const wItem = S.watchlist.find(w => w.ticker === ticker);
        if (wItem) {
          wItem.price    = price;
          wItem.change1d = q.regularMarketChangePercent || wItem.change1d;
          if (!known && qCur) wItem.currency = qCur;
        }
        prices[ticker] = price;
      });
    } else {
      errors.push('Proxy Yahoo Finance');
    }
  }

  // ── CoinGecko ──────────────────────────────────
  if (cgIds.length) {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids='
        + cgIds.join(',') + '&vs_currencies=usd&include_24hr_change=true';
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      cgIds.forEach(id => {
        const ticker = cgRev[id];
        const price  = data[id]?.usd;  // toujours en USD (devise native des cryptos)
        if (!ticker || !price) return;
        allH.filter(h=>h.ticker===ticker).forEach(h=>{ h.currentPrice=price; recalcHolding(h); updated++; });
        // Mettre à jour la watchlist si présente
        const wItem = S.watchlist.find(w => w.ticker === ticker);
        if (wItem) {
          wItem.price    = price;
          wItem.change1d = data[id]?.usd_24h_change ?? wItem.change1d;
        }
        prices[ticker] = price;
      });
    } catch(e) {
      errors.push('CoinGecko');
      dbgLog('[ERR]', `CoinGecko: ${e?.message||e}`);
    }
  }

  // ── Finalisation ───────────────────────────────
  // Le log est mis à jour en live par dbgLog(), pas besoin de re-render
  if (updated > 0) {
    S.accounts.forEach(a=>{ a.value=accSum(a.holdings); });
    savePrices(prices);
    snapshotWealth(); // fige la valeur totale du jour avec les cours fraîchement mis à jour
    refreshMain();
    // Animation wealth card + montants clés
    requestAnimationFrame(() => {
      const wc = document.querySelector('.wealth-card');
      if (wc) { wc.classList.remove('card-glow'); void wc.offsetWidth; wc.classList.add('card-glow'); }
      document.querySelectorAll('.wealth-amount,.metric-val,.stat-box div:last-child').forEach(el => {
        el.classList.remove('num-flash'); void el.offsetWidth; el.classList.add('num-flash');
      });
      // Mettre à jour le dot fraîcheur
      const dot = document.getElementById('js-fresh-dot');
      if (dot) dot.style.background = 'var(--gain)';
    });
    const total = allH.filter(h=>h.type!=='Crypto').length
                + allH.filter(h=>h.type==='Crypto').map(h=>CG_IDS[h.ticker]).filter(Boolean).length;
    const partial = updated < total ? ` (${updated}/${total})` : '';
    toast(errors.length
      ? `${updated} cours mis à jour · ⚠ ${errors.join(', ')}`
      : `${updated} cours mis à jour ✓${partial}${partial?' · rafraîchir pour la suite':''}`);
  } else {
    toast(errors.length ? `Erreur : ${errors.join(', ')}` : 'Aucun cours trouvé');
  }

  } finally {
    // Toujours réarmer, même si le rendu lève une exception : sinon _fetching restait
    // bloqué à true et tout refresh ultérieur sortait silencieusement
    _fetching = false;
    if (btnSvg) btnSvg.classList.remove('spin');
  }
}

// ═══════════════════════════════════════════════
// INIT
// ── Retour haptique (no-op sur desktop) ──
function haptic(ms=8) { try { navigator.vibrate?.(ms); } catch(_) {} }

// ═══════════════════════════════════════════════
const _hasData=loadData();
// Si aucune donnée ou en mode démo → régénérer les données d'exemple (jamais persistées)
if(!_hasData || S.isDemo) S.accounts=genDemo();
// Première ouverture : sauvegarder les préférences par défaut
if(!_hasData) saveData();
// Appliquer thème sauvegardé (auto suit le système)
applyTheme(S.theme);
// Appliquer le cache de prix uniquement en mode réel
const _priceCache=loadPrices();
if(_priceCache?.fxRates) {
  Object.assign(FX_RATES, _priceCache.fxRates);
  _fxUpdatedAt = _priceCache.fxUpdatedAt || null;
}
if(_priceCache && !S.isDemo) applyPrices(_priceCache);
// Historique du patrimoine : reconstruire le passé manquant puis figer le point du jour (mode réel)
if(!S.isDemo) { backfillWealthHistory(); snapshotWealth(); }
['dashboard','comptes','recherche','analysis'].forEach(renderScreen);
document.getElementById('nav').classList.remove('hidden');
// Suivre les changements du thème système (uniquement en mode auto)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{
  if(S.theme==='auto') applyTheme('auto');
});
// Auto-refresh au démarrage (uniquement si activé dans les réglages)
if (S.autoRefresh && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const _stale = !S.lastPriceUpdate || (Date.now() - S.lastPriceUpdate > 15 * 60 * 1000);
  if (_stale) setTimeout(fetchLivePrices, 800);
}
// Popup changelog si nouvelle version
try {
  if (localStorage.getItem(STORE_VERSION) !== APP_VERSION) {
    setTimeout(() => openChangelogModal(true), 600);
  }
} catch(e) {}

// ═══════════════════════════════════════════════
// ANDROID BACK BUTTON (PWA)
// Intercepts the hardware/gesture back so it navigates
// within the app instead of exiting the PWA.
// ═══════════════════════════════════════════════
(function initBackHandler() {
  // Seed with TWO extra entries (depth:1 + depth:2).
  // Protects against rapid double-tap on Android: even if the
  // OS fires two back events before JS runs, depth:0 is never
  // reached and the PWA stays alive.
  history.replaceState({ appNav: true, depth: 0 }, '');
  history.pushState({ appNav: true, depth: 1 }, '');
  history.pushState({ appNav: true, depth: 2 }, '');

  let _exitTs = 0;
  let _lastBack = 0; // debounce : absorbe les double-taps rapides

  window.addEventListener('popstate', () => {
    // Re-push immediately to always maintain a forward entry.
    history.pushState({ appNav: true, depth: 2 }, '');

    // Debounce : si deux popstate arrivent en moins de 250 ms
    // (double-tap Android), on absorbe le second silencieusement.
    const now = Date.now();
    if (now - _lastBack < 250) { _lastBack = now; return; }
    _lastBack = now;

    // Close any open modal first (regardless of stack depth)
    const anyOpen = ['modal-sheet','confirm-sheet','watch-modal-sheet',
                     'acc-modal-sheet','pos-modal-sheet','edit-tx-sheet','cf-modal-sheet',
                     'acc-action-sheet','rename-acc-sheet','csv-modal-sheet','fx-modal-sheet',
                     'changelog-modal-sheet']
                    .some(id => document.getElementById(id)?.classList.contains('show'));
    if (anyOpen) {
      closeModal(); closeConfirm(); closeWatchModal(); closeAccModal(); closePosModal();
      closeEditTx(); closeCfModal(); closeAccMenu(); closeRenameAcc(); closeCsvModal(); closeFxModal();
      closeChangelogModal();
      return;
    }

    if (S.stack.length > 1) {
      back();
      _exitTs = 0;
    } else if (!NAV_SCREENS.includes(S.screen)) {
      // Stack corrompu mais on est sur un écran non-racine : utiliser les fallbacks
      back();
      _exitTs = 0;
    } else {
      // Sur un écran racine (tab) avec stack à 1 entrée → logique de sortie
      const now = Date.now();
      if (now - _exitTs < 2200) {
        toast('Utilisez le sélecteur d\'apps pour fermer');
        _exitTs = 0;
      } else {
        _exitTs = now;
        toast('Appuyez à nouveau pour quitter');
      }
    }
  });
})();

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS (desktop)
// ═══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const anyOpen = ['modal-sheet','confirm-sheet','watch-modal-sheet',
                     'acc-modal-sheet','pos-modal-sheet','edit-tx-sheet','cf-modal-sheet',
                     'acc-action-sheet','rename-acc-sheet','csv-modal-sheet','fx-modal-sheet',
                     'changelog-modal-sheet']
                    .some(id => document.getElementById(id)?.classList.contains('show'));
    if (anyOpen) {
      closeModal(); closeConfirm(); closeWatchModal(); closeAccModal(); closePosModal();
      closeEditTx(); closeCfModal(); closeAccMenu(); closeRenameAcc(); closeCsvModal(); closeFxModal();
      closeChangelogModal();
    } else if (S.stack.length > 1) {
      back();
    }
  }
});

// ═══════════════════════════════════════════════
// SERVICE WORKER (PWA)
// ═══════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Registered, scope:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}
