// Comptes d'épargne et livrets : un solde, un taux, des versements / retraits / intérêts — jamais de titres.
// Fonctions PURES (aucun accès à S ni au DOM). Plafonds de versements : TAX_ENVELOPES (js/features/tax-envelope.js).
// Dépend, À L'APPEL, de accFlows (js/features/account-perf.js) et TAX_ENVELOPES.
//
// Mouvements (acc.cashflows) : DEP = versement, WIT = retrait, INT = intérêts versés par la banque.
// Les intérêts entrent dans le solde mais PAS dans les versements : ils peuvent faire dépasser le plafond
// (ex. LDDS : 12 000 € versés au plus, intérêts capitalisés au-delà).

const SAVINGS_TYPES = ['Livret A', 'LDDS', 'LEP', 'Livret Jeune', 'PEL / CEL'];
// Taux réglementés en vigueur (Livret A et LDDS : 1,7 % depuis le 1er août 2026 ; LEP : 2,5 %), vérifiés en novembre 2026.
// Proposés à la saisie seulement : chaque compte garde SON taux (acc.rate), modifiable (révision au 1er février et au 1er août).
const SAVINGS_RATES = { 'Livret A': 1.7, 'LDDS': 1.7, 'LEP': 2.5 };
const SAVINGS_RATES_DATE = '2026-08-01';

function isSavingsType(type) { return SAVINGS_TYPES.includes(type); }
function isSavingsAccount(acc) { return !!acc && isSavingsType(acc.type); }
// Affichage « livret » (sans portefeuille) : un livret qui contient encore des titres saisis avant garde l'écran complet
function savingsView(acc) { return isSavingsAccount(acc) && !(acc.holdings || []).length; }

// Synthèse : solde, versements, retraits, intérêts reçus, versements nets, taux, intérêts annuels estimés au taux actuel.
// conv(v, devise) → devise appli
function savingsSummary(acc, conv = v => v) {
  const flows = accFlows(acc, conv);
  const dep = flows.filter(f => f.amt > 0).reduce((s, f) => s + f.amt, 0);
  const wit = Math.abs(flows.filter(f => f.amt < 0).reduce((s, f) => s + f.amt, 0));
  const interest = (acc.cashflows || []).filter(c => c && c.type === 'INT').reduce((s, c) => s + conv(+c.amount || 0, c.ccy || acc.currency), 0);
  const rate = Number.isFinite(+acc.rate) && acc.rate !== '' && acc.rate != null ? +acc.rate : null;
  const balance = acc.value || 0;
  return { balance, dep, wit, net: dep - wit, interest, rate, yearly: rate != null ? balance * rate / 100 : null };
}

// Plafond de versements du type (€) ou null
function savingsCeiling(type) { return (TAX_ENVELOPES[type] && TAX_ENVELOPES[type].ceiling) || null; }

// Règle du plafond d'un livret : aucun versement ne peut porter le solde (intérêts compris) au-delà du plafond.
// Les intérêts, eux, peuvent le dépasser ; un retrait libère de la place.
// Ex. Livret A : 22 000 € versés le 20/11, 200 € d'intérêts le 21/11 → il ne reste que 750 € à verser à partir du 21/11.
const _svFmt = v => Math.max(0, Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
const _svSign = t => (t === 'WIT' ? -1 : 1);
// Mouvements du livret triés par date (à date égale, dans l'ordre de saisie), montants en devise appli
function _svFlows(acc, conv) {
  return (acc.cashflows || []).filter(c => c && c.date && ['DEP', 'WIT', 'INT'].includes(c.type))
    .map((c, i) => ({ date: c.date, type: c.type, amt: conv(+c.amount || 0, c.ccy || acc.currency), i }))
    .sort((x, y) => x.date.localeCompare(y.date) || x.i - y.i);
}
// Solde du livret à une date (mouvements datés de ce jour compris)
function savingsBalanceAt(acc, date, conv = v => v) {
  return _svFlows(acc, conv).filter(f => f.date <= date).reduce((s, f) => s + _svSign(f.type) * f.amt, 0);
}
// Place restante sous le plafond à une date (null si pas de plafond)
function savingsRoomAt(acc, date, conv = v => v) {
  const cap = isSavingsAccount(acc) && savingsCeiling(acc.type);
  return cap ? Math.max(0, cap - savingsBalanceAt(acc, date, conv)) : null;
}
// Message d'erreur si un versement de `amount` à la date `date` ferait dépasser le plafond, maintenant ou pour un versement
// déjà saisi après cette date ; '' sinon
function savingsDepositError(acc, amount, conv = v => v, date) {
  if (!isSavingsAccount(acc)) return '';
  const cap = savingsCeiling(acc.type);
  if (!cap || !(amount > 0)) return '';
  date = date || '9999-12-31';
  const flows = _svFlows(acc, conv), at = flows.filter(f => f.date <= date).length;
  flows.splice(at, 0, { date, type: 'DEP', amt: amount, isNew: true });
  let bal = 0;
  for (const f of flows) {
    if (f.type === 'DEP' && bal + f.amt > cap + 0.005) {
      const short = TAX_ENVELOPES[acc.type].short;
      return f.isNew
        ? `Plafond ${short} (${_svFmt(cap)}) : au ${f.date.split('-').reverse().join('/')}, il reste ${_svFmt(cap - bal)} à verser (intérêts compris dans le solde).`
        : `Ce versement ferait dépasser le plafond ${short} (${_svFmt(cap)}) lors du versement déjà saisi le ${f.date.split('-').reverse().join('/')}.`;
    }
    bal += _svSign(f.type) * f.amt;
  }
  return '';
}

// Mouvements de départ d'un livret créé avec un solde : ce qui dépasse le plafond ne peut être que des intérêts capitalisés.
// → [{ type:'DEP', amount }, { type:'INT', amount }?]
function savingsOpeningFlows(type, balance) {
  if (!(balance > 0)) return [];
  const cap = savingsCeiling(type);
  if (!cap || balance <= cap) return [{ type: 'DEP', amount: balance }];
  return [{ type: 'DEP', amount: cap }, { type: 'INT', amount: Math.round((balance - cap) * 100) / 100 }];
}

// Taux saisi : '' → null (taux non renseigné) ; nombre entre 0 et 20 % ; NaN → erreur
function savingsRateInput(raw) {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!s) return { rate: null };
  const v = Number(s);
  return Number.isFinite(v) && v >= 0 && v <= 20 ? { rate: v } : { error: 'Taux entre 0 et 20 %' };
}
