// Fenêtre « Remboursement anticipé » (E08) et comparaison « rembourser ou placer » (E09).
// Calculs purs : js/features/early-repay.js. Fenêtre #er-sheet de mon-patrimoine.html.
// Ouverte depuis la fiche d'un crédit (js/screens/credits.js) et depuis chaque crédit d'un bien (js/screens/immo.js).
// Dépend, À L'APPEL seulement, de masked, fmtDate, esc, _dayKey (mon-patrimoine.js).

let _er = null;   // { title, L, defaultFirst }

const _erNum = id => parseFloat(String(document.getElementById(id)?.value || '').replace(',', '.'));
const _erVal = id => document.getElementById(id)?.value || '';
function _erOpts() {
  const amount = _erNum('er-amount');
  return {
    amount: amount > 0 ? amount : 0, mode: _erVal('er-mode'), regime: _erVal('er-regime'),
    ira: { kind: _erVal('er-ira'), value: _erNum('er-ira-val') }, fees: _erNum('er-fees') || 0, insBasis: _erVal('er-insbasis'),
  };
}
const _erCmpOpts = () => ({ rate: _erNum('er-ret') || 0, fees: _erNum('er-pfees') || 0, tax: _erNum('er-tax') || 0 });
const _erPct = v => (v == null ? '—' : v.toFixed(2).replace('.', ',') + ' %');
const _erMonths = n => (n >= 12 ? `${Math.floor(n / 12)} an${n >= 24 ? 's' : ''}${n % 12 ? ' ' + (n % 12) + ' mois' : ''}` : `${n} mois`);
const _erRow = (a, b, strong) => `<div class="im-row${strong ? ' strong' : ''}"><span>${a}</span><span class="t-num">${b}</span></div>`;

function _erResultHTML(sim) {
  if (!sim) return '<div class="t-sm">Ce crédit est déjà remboursé.</div>';
  if (!(sim.paid > 0)) return `<div class="t-sm">Capital restant dû : <b>${masked(sim.bal)}</b>. Indique la somme à rembourser.</div>`;
  const B = sim.before, A = sim.after;
  const iraLine = _erVal('er-ira') === 'legal'
    ? `Plafond légal : ${esc(sim.legal.text)}${sim.legal.six != null ? ` (6 mois d'intérêts : ${masked(sim.legal.six)} · 3 % : ${masked(sim.legal.three)})` : ''}.`
    : '';
  const effect = sim.total ? 'Crédit soldé : plus aucune échéance.'
    : sim.mode === 'duration' ? `Fin le ${fmtDate(A.end)} au lieu du ${fmtDate(B.end)} (${_erMonths(sim.monthsSaved)} de moins), même mensualité.`
    : `Mensualité ${masked(A.pmt + A.ins)} au lieu de ${masked(B.pmt + B.ins)} (−${masked(sim.paymentDrop)}/mois), même fin.`;
  return `<div class="im-loan">
      ${_erRow('Capital restant dû avant', masked(sim.bal))}
      ${_erRow('Somme remboursée', masked(sim.paid), true)}
      ${_erRow('Indemnités (IRA)', masked(sim.ira))}
      ${sim.fees ? _erRow('Frais', masked(sim.fees)) : ''}
      ${_erRow('À verser au total', masked(sim.cash), true)}
      ${iraLine ? `<div class="t-sm" style="margin-top:4px">${iraLine} Le contrat peut prévoir moins : vérifie-le.</div>` : ''}
    </div>
    <div class="t-sm" style="margin:10px 0 4px">${effect}</div>
    <div class="er-grid"><span></span><b>Avant</b><b>Après</b>
      <span class="er-l">Intérêts restants</span><span class="t-num">${masked(B.interest)}</span><span class="t-num">${masked(A.interest)}</span>
      <span class="er-l">Assurance restante</span><span class="t-num">${masked(B.insurance)}</span><span class="t-num">${masked(A.insurance)}</span>
      <span class="er-l">Coût restant</span><span class="t-num">${masked(B.interest + B.insurance)}</span><span class="t-num">${masked(A.interest + A.insurance + sim.ira + sim.fees)}</span>
    </div>
    <div class="im-row strong" style="margin-top:6px"><span>Économie nette (indemnités et frais déduits)</span><span class="t-num ${sim.net >= 0 ? 't-gain' : 't-loss'}">${sim.net >= 0 ? '' : '−'}${masked(Math.abs(sim.net))}</span></div>
    ${A.rows.length ? `<div class="tap im-link" id="er-amort">Nouveau tableau d'amortissement →</div>` : ''}`;
}
// Comparaison « rembourser ou placer » (zone #er-cmp, sous les hypothèses saisies)
function _erCompareHTML(sim) {
  if (!sim || !(sim.paid > 0)) return '';
  const cmpP = _erCmpOpts(), cmp = erCompare(sim, cmpP), be = erBreakEven(sim, cmpP), sens = erSensitivity(sim, cmpP, 0, 8);
  const verdict = Math.abs(cmp.gap) < 0.5 ? 'Les deux options se valent avec ces hypothèses.'
    : cmp.gap > 0 ? `Placer donnerait <b>${masked(cmp.gap)}</b> de plus que rembourser au ${fmtDate(sim.horizon)}.`
    : `Rembourser donnerait <b>${masked(-cmp.gap)}</b> de plus que placer au ${fmtDate(sim.horizon)}.`;
  return `<div class="t-sm">Même horizon (fin prévue : ${fmtDate(sim.horizon)}) et mêmes flux : soit tu rembourses et tu places chaque mois ce que tu ne paies plus, soit tu places les ${masked(sim.cash)} et tu gardes ton crédit.</div>
    <div class="im-loan" style="margin-top:8px">
      <div class="t-sm" style="margin-bottom:6px">${verdict}</div>
      ${_erRow('Placement si tu gardes le crédit', masked(cmp.keep))}
      ${_erRow('Placement si tu rembourses', masked(cmp.repay))}
      ${_erRow("Rendement net d'équilibre", be == null ? 'hors de −20 % à 30 %' : _erPct(be) + ' /an', true)}
      <div class="t-sm" style="margin-top:4px">Au-dessus de ce rendement net de frais (avec l'impôt saisi), placer rapporte plus ; en dessous, rembourser.</div>
    </div>
    <div class="er-grid er-sens"><b>Rendement brut</b><b>Placer − rembourser</b>
      ${sens.map(x => `<span class="er-l">${x.rate} %</span><span class="t-num ${x.gap >= 0 ? 't-gain' : 't-loss'}">${x.gap >= 0 ? '+' : '−'}${masked(Math.abs(x.gap))}</span>`).join('')}
    </div>
    <div class="t-sm" style="margin-top:8px">Simulation indicative : le rendement d'un placement n'est pas garanti, contrairement à l'économie d'intérêts. Remboursement supposé juste après une échéance.</div>`;
}
function _erRefresh() {
  const out = document.getElementById('er-out'); if (!out || !_er) return;
  const sim = earlyRepaySim(_er.L, _er.defaultFirst, _dayKey(Date.now()), _erOpts());
  out.innerHTML = _erResultHTML(sim);
  document.getElementById('er-cmp').innerHTML = _erCompareHTML(sim);
  document.getElementById('er-cmp-box')?.classList.toggle('hidden', !(sim && sim.paid > 0));
  document.getElementById('er-mode-row')?.classList.toggle('hidden', !!(sim && sim.total));
  document.getElementById('er-ira-val-row')?.classList.toggle('hidden', _erVal('er-ira') !== 'amount');
}

// title : déjà échappé ; L : crédit ; defaultFirst : 1re échéance par défaut ; regime : 'immo' | 'conso'
function openEarlyRepay(title, L, defaultFirst, regime) {
  const s = loanSchedule(L, defaultFirst, _dayKey(Date.now()));
  if (!s) return;
  _er = { title, L, defaultFirst };
  document.getElementById('er-title').innerHTML = 'Remboursement anticipé — ' + title;
  document.getElementById('er-amount').value = s.next ? Math.round(s.remaining * 100) / 100 : '';
  document.getElementById('er-mode').value = 'duration';
  document.getElementById('er-regime').value = regime === 'conso' ? 'conso' : 'immo';
  document.getElementById('er-ira').value = 'legal';
  document.getElementById('er-ira-val').value = '';
  document.getElementById('er-fees').value = '';
  document.getElementById('er-insbasis').value = 'initial';
  document.getElementById('er-out').innerHTML = '';
  if (!_erVal('er-ret')) document.getElementById('er-ret').value = '4';   // hypothèses de placement conservées d'une ouverture à l'autre
  _erRefresh();
  document.getElementById('er-bg').classList.add('show');
  document.getElementById('er-sheet').classList.add('show');
}
function closeEarlyRepay() {
  document.getElementById('er-bg').classList.remove('show');
  document.getElementById('er-sheet').classList.remove('show');
  _er = null;
}
document.getElementById('er-bg').addEventListener('click', closeEarlyRepay);
document.getElementById('er-close').addEventListener('click', closeEarlyRepay);
document.getElementById('er-sheet').addEventListener('input', _erRefresh);
document.getElementById('er-sheet').addEventListener('change', _erRefresh);
document.getElementById('er-all').addEventListener('click', () => {
  const s = _er && loanSchedule(_er.L, _er.defaultFirst, _dayKey(Date.now()));
  if (s) { document.getElementById('er-amount').value = Math.round(s.remaining * 100) / 100; _erRefresh(); }
});
document.getElementById('er-out').addEventListener('click', e => {
  if (!e.target.closest('#er-amort') || !_er) return;
  const sim = earlyRepaySim(_er.L, _er.defaultFirst, _dayKey(Date.now()), _erOpts());
  if (!sim || !sim.after.rows.length) return;
  // Échéancier après remboursement, au format de loanSchedule (dates reprises de l'échéancier d'origine)
  const s = loanSchedule(_er.L, _er.defaultFirst, _dayKey(Date.now())), k0 = s.rows.filter(x => x.past).length;
  const rows = sim.after.rows.map((x, i) => ({ ...x, k: i + 1, date: s.rows[k0 + i].date, ins: sim.after.ins, past: false }));
  openLoanAmort(_er.title + ' · après remboursement', { n: rows.length, pmt: sim.after.pmt, ins: sim.after.ins, rows, next: rows[0] });
});
// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('er-sheet', closeEarlyRepay);
