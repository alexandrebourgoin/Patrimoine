// Patrimoine : agrégats de l'Accueil et de l'Analyse, fonctions PURES (comptes, biens et date sont passés en paramètres).
//   Patrimoine net  = comptes financiers (hors observateurs) + immobilier brut − crédits immobiliers restants
//   Patrimoine brut = comptes financiers + immobilier brut
// UNE seule règle décide quels biens comptent (wealthProperties) : l'Accueil et l'Analyse affichent donc toujours le même total.
// Les snapshots de l'historique (totalWealth, storage.js) et les performances de compte restent FINANCIERS : l'immobilier n'y entre pas.
// Dépend de immoCalc (realestate-calc.js, chargé avant). wealthNow() est le seul accès à l'état (S, biens, date), utilisé À L APPEL.

// Biens pris en compte : date d'achat renseignée et passée, prix > 0, valeurs calculables. → [{ p, c }]
function wealthProperties(properties, today) {
  return properties.filter(p => p.buyDate && p.buyDate <= today && p.price > 0)
    .map(p => ({ p, c: immoCalc(p, today) }))
    .filter(({ c }) => Number.isFinite(c.value) && Number.isFinite(c.debt));
}

function wealthBreakdown(accounts, properties, today) {
  const financial = accounts.filter(a => !a.observer).reduce((s, a) => s + (+a.value || 0), 0);
  const list = wealthProperties(properties, today);
  const property = list.reduce((s, x) => s + x.c.value, 0);
  const debt = list.reduce((s, x) => s + x.c.debt, 0);
  return { financial, property, debt, count: list.length, gross: financial + property, net: financial + property - debt };
}

// Grande classe d'un compte, d'après son type (les supports en fonds euros sont ensuite isolés : isFondsEuros) : Liquidités (livrets, compte courant, compte à terme), Bourse (comptes-titres, PEA,
// assurance-vie, PER, épargne salariale, Pilier 3a), Crypto, Immobilier (SCPI…), Autres. La valeur du compte ENTIER (positions +
// liquidités) va dans sa classe : le cash d'un PEA reste dans la Bourse.
function accPocket(acc) {
  const t = (acc.type || '').toLowerCase();
  if (/\b(livret|ldds|lep|pel|cel)\b|courant|à terme/.test(t)) return 'Liquidités';
  if (/crypto/.test(t)) return 'Crypto';
  if (/scpi|immo/.test(t)) return 'Immobilier';
  if (/métaux|metaux/.test(t)) return 'Autres';
  if (/pea|titres|assurance|retraite|\bper\b|épargne salariale|pee|perco|pilier/.test(t)) return 'Bourse';
  return 'Autres';
}

// Fonds en euros (assurance-vie, PER) : capital garanti, à part de la Bourse. Repéré par le nom, le secteur ou le type du support.
const _FONDS_EUROS_RE = /fonds\s*(en\s*)?euros?/i;
function isFondsEuros(h) {
  return !!h && (h.type === 'Fonds euros' || _FONDS_EUROS_RE.test(h.name || '') || _FONDS_EUROS_RE.test(h.sector || ''));
}

const ASSET_LABEL = { Action: 'Actions', ETF: 'ETF / Fonds', Obligation: 'Obligations', Cash: 'Cash', Crypto: 'Crypto' };
// Pays / secteur affichables : vide, tiret, « Inconnu » ou « Autre » → « Non renseigné » (une crypto n'a ni pays ni secteur)
const _wUnknown = v => !v || /^\s*(—|-|inconnu|autre)?\s*$/i.test(String(v));
const _wAdd = (o, k, v) => { o[k] = (o[k] || 0) + v; };

// Toutes les répartitions du patrimoine, en devise appli. cashOf(compte) = liquidités non investies du compte.
//   byPocket / byAsset / byAccType : incluent la valeur nette de l'immobilier saisi (une seule fois) ; tot = patrimoine net
//   byRaw / totRaw : titres et liquidités SEULEMENT, par type brut (Action, ETF, Obligation, Cash…) : base des objectifs d'allocation
//   byGeo / bySec : titres seulement
function analysisData(accounts, properties, today, cashOf) {
  const accs = accounts.filter(a => !a.observer);
  const byPocket = {}, byAsset = {}, byAccType = {}, byRaw = {}, byGeo = {}, bySec = {};
  accs.forEach(a => {
    const pk = accPocket(a);
    // Les supports en fonds euros forment leur propre grande classe ; le reste du compte garde sa classe
    const fe = (a.holdings || []).filter(isFondsEuros).reduce((s, h) => s + (h.valueRef ?? h.value ?? 0), 0);
    _wAdd(byPocket, pk, (a.value || 0) - fe);
    if (fe) _wAdd(byPocket, 'Fonds euros', fe);
    _wAdd(byAccType, a.type || 'Autre', a.value || 0);
    const cash = cashOf(a);
    if (cash) { _wAdd(byAsset, 'Cash', cash); _wAdd(byRaw, 'Cash', cash); }
    (a.holdings || []).forEach(h => {
      const hv = h.valueRef ?? h.value;
      const crypto = h.type === 'Crypto' || pk === 'Crypto';
      _wAdd(byAsset, pk === 'Immobilier' ? 'Immobilier' : crypto ? 'Crypto' : isFondsEuros(h) ? 'Fonds euros' : (ASSET_LABEL[h.type] || h.type || 'Autres'), hv);
      _wAdd(byRaw, h.type, hv);
      _wAdd(byGeo, crypto ? 'Crypto (sans pays)' : (_wUnknown(h.country) ? 'Non renseigné' : h.country), hv);
      _wAdd(bySec, crypto ? 'Crypto' : (_wUnknown(h.sector) ? 'Non renseigné' : h.sector), hv);
    });
  });
  const wealth = wealthBreakdown(accounts, properties, today);
  const immoNet = wealth.property - wealth.debt;
  if (wealth.count) {
    _wAdd(byPocket, 'Immobilier', immoNet); _wAdd(byAsset, 'Immobilier', immoNet); _wAdd(byAccType, 'Immobilier', immoNet);
  }
  const totRaw = Object.values(byRaw).reduce((s, v) => s + v, 0);
  return { accs, wealth, propertyCount: wealth.count, tot: wealth.net, totRaw, byPocket, byAsset, byAccType, byRaw, byGeo, bySec };
}

// Seul accès à l'état : comptes de S, biens du mode courant (imRead), jour d'aujourd'hui
function wealthNow() { return wealthBreakdown(S.accounts, imRead(), _dayKey(Date.now())); }
function analysisNow() { return analysisData(S.accounts, imRead(), _dayKey(Date.now()), a => accCash(a)); }
