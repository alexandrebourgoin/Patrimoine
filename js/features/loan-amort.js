// Tableau d'amortissement d'un crédit (biens immobiliers et autres crédits) : une ligne par année, dépliable en mois.
// openLoanAmort(titre déjà échappé, échéancier loanSchedule). Fenêtre #ima-sheet de mon-patrimoine.html.
// Dépend, À L'APPEL seulement, de masked, fmtDate et esc (mon-patrimoine.js).

function openLoanAmort(title, L) {
  if (!L) return;
  const years = {};
  L.rows.forEach(r => { (years[r.date.slice(0, 4)] ||= []).push(r); });
  const body = Object.entries(years).map(([y, rows]) => {
    const cap = rows.reduce((s, r) => s + r.princ, 0), int = rows.reduce((s, r) => s + r.interest, 0), last = rows[rows.length - 1];
    const allPast = rows.every(r => r.past), somePast = rows.some(r => r.past);
    const months = rows.map(r => `<div class="ima-grid ima-m${r.past ? ' past' : ''}${L.next && r.k === L.next.k ? ' next' : ''}"><span>${fmtDate(r.date)}</span><span class="t-num">${masked(r.princ)}</span><span class="t-num">${masked(r.interest)}</span><span class="t-num">${masked(r.bal)}</span></div>`).join('');
    return `<details class="ima-year"${somePast && !allPast ? ' open' : ''}>
      <summary class="ima-grid${allPast ? ' past' : ''}"><b>${esc(y)}${allPast ? ' ✓' : ''}</b><span class="t-num">${masked(cap)}</span><span class="t-num">${masked(int)}</span><span class="t-num">${masked(last.bal)}</span></summary>
      ${months}
    </details>`;
  }).join('');
  document.getElementById('ima-body').innerHTML = `<div class="oa-head" style="margin-bottom:10px">
      <div class="modal-title" style="margin-bottom:0">Amortissement — ${title}</div>
      <div id="ima-close" class="oa-x">✕</div></div>
    <div class="t-sm" style="margin-bottom:8px">${L.n} échéances · mensualité ${masked(L.pmt)}${L.ins > 0.005 ? ` + assurance ≈ ${masked(L.ins)}` : ''} · échéances passées en gris, prochaine en couleur. Touche une année pour voir les mois.</div>
    <div class="ima-grid ima-head"><span>Date</span><span>Capital</span><span>Intérêts</span><span>Reste dû</span></div>${body}`;
  document.getElementById('ima-bg').classList.add('show');
  document.getElementById('ima-sheet').classList.add('show');
}
function closeLoanAmort() {
  document.getElementById('ima-bg').classList.remove('show');
  document.getElementById('ima-sheet').classList.remove('show');
}
document.getElementById('ima-bg').addEventListener('click', closeLoanAmort);
document.getElementById('ima-body').addEventListener('click', e => { if (e.target.closest('#ima-close')) closeLoanAmort(); });
// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('ima-sheet', closeLoanAmort);
