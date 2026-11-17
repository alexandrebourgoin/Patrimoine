// Popup « Nouveautés » (historique des versions, données dans js/data/changelog.js).
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

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

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('changelog-modal-sheet', closeChangelogModal);
