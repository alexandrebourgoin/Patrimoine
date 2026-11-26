// Autres crédits (consommation, auto, travaux, étudiant…) : validation, calculs et stockage. Fonctions PURES sauf le magasin,
// qui reçoit son « localStorage » en paramètre. Échéancier : loanSchedule (js/features/loan-calc.js, chargé avant).
// Crédit : { id, name, kind, amount, rate (%/an nominal), years, signDate 'AAAA-MM-JJ', first ('AAAA-MM-JJ', optionnelle :
//            défaut = signature + 1 mois), insurance (€/mois), debtShare (% de la dette supportée, défaut 100) }
// Stockage : patrimoine-credits-demo | patrimoine-credits-real → [ crédit, … ] (sauvegardé automatiquement : préfixe « patrimoine- »).
// Comme l'immobilier : des données illisibles ou invalides font LEVER une erreur, elles ne sont jamais remplacées par une liste vide.

const CREDIT_KINDS = { conso: 'Crédit à la consommation', auto: 'Crédit auto', works: 'Crédit travaux', student: 'Prêt étudiant', personal: 'Prêt personnel', other: 'Autre crédit' };
const STORE_CREDITS_PREFIX = 'patrimoine-credits-';
const _CR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const _crNum = n => typeof n === 'number' && Number.isFinite(n);

function creditValid(c) {
  return !!c && typeof c === 'object' && typeof c.id === 'string' && c.id !== '' && typeof c.name === 'string'
    && !!CREDIT_KINDS[c.kind] && _crNum(c.amount) && c.amount > 0 && _crNum(c.years) && c.years > 0
    && _crNum(c.rate ?? 0) && (c.rate ?? 0) >= 0 && _crNum(c.insurance ?? 0) && (c.insurance ?? 0) >= 0
    && _CR_DATE.test(c.signDate || '') && (!c.first || _CR_DATE.test(c.first))
    && (c.debtShare === undefined || (_crNum(c.debtShare) && c.debtShare > 0 && c.debtShare <= 100));
}
// Saisie du formulaire → message d'erreur ou null
function creditFormError(c) {
  if (!(c.amount > 0)) return 'Indique le montant emprunté';
  if (!(c.years > 0)) return 'Indique la durée du crédit';
  if (!(c.rate >= 0)) return 'Le taux doit être positif ou nul';
  if (!_CR_DATE.test(c.signDate || '')) return 'La date de signature est obligatoire';
  if (c.first && c.first < c.signDate) return 'La première échéance doit suivre la signature';
  if (!(c.insurance >= 0)) return "L'assurance doit être positive ou nulle";
  if (!(c.debtShare > 0 && c.debtShare <= 100)) return 'La part de dette doit être comprise entre 1 et 100 %';
  return null;
}
// Échéancier d'un crédit au jour « today » (1re échéance par défaut : un mois après la signature)
function creditSchedule(c, today) { return loanSchedule(c, loanAddMonths(c.signDate, 1), today); }
// Part de la dette supportée (0 à 1)
function creditShare(c) { return (c.debtShare ?? 100) / 100; }
// Totaux : capital restant dû à 100 % et part supportée, mensualités assurance comprise (part supportée)
function creditTotals(list, today) {
  return list.reduce((t, c) => {
    const s = creditSchedule(c, today); if (!s) return t;
    const k = creditShare(c);
    t.remaining += s.remaining; t.myRemaining += s.remaining * k;
    if (s.next) t.myMonthly += (s.pmt + s.ins) * k;
    t.count++;
    return t;
  }, { remaining: 0, myRemaining: 0, myMonthly: 0, count: 0 });
}

function _crCheckList(list) {
  if (!Array.isArray(list)) throw new Error('Crédits : liste attendue');
  const seen = new Set();
  list.forEach((c, i) => {
    if (!creditValid(c)) throw new Error(`Crédit n°${i + 1} invalide`);
    if (seen.has(c.id)) throw new Error(`Crédits : identifiant en double (${c.id})`);
    seen.add(c.id);
  });
  return list;
}
function createCreditStore(storage, mode) {
  if (mode !== 'demo' && mode !== 'real') throw new Error('Mode inconnu : ' + mode);
  const key = STORE_CREDITS_PREFIX + mode;
  function read() {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined) return [];
    let list;
    try { list = JSON.parse(raw); } catch (e) { throw new Error('Crédits : JSON invalide'); }
    return _crCheckList(list).map(c => ({ ...c }));
  }
  // Relit d'abord : des données corrompues déjà enregistrées bloquent l'écriture au lieu d'être écrasées
  function save(list) { read(); storage.setItem(key, JSON.stringify(_crCheckList(list))); }
  return { read, save };
}

// ── Accès à l'état (À L'APPEL : S, localStorage) : crédits du mode courant, lecture protégée ──
const crStore = () => createCreditStore(localStorage, S.isDemo ? 'demo' : 'real');
let _crError = '';
// Des données illisibles sont signalées (bandeau de l'écran Crédits), jamais effacées ; le patrimoine les ignore alors
function crRead() {
  try { const l = crStore().read(); _crError = ''; return l; }
  catch (e) { _crError = (e && e.message) || 'erreur'; return []; }
}
function crReadError() { return _crError; }   // message de la dernière lecture en échec ('' si tout va bien)
