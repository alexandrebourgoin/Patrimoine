// Écran Assistant IA : affichage des recommandations (moteur : js/features/assistant.js) + binding.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

function renderAssistant() {
  const recos  = analyzePortfolio(S);
  const hasData = S.accounts.some(a => a.holdings.length);
  const SEV = {
    3: { bg: 'var(--loss-dim)',   col: 'var(--loss)' },
    2: { bg: 'rgba(245,158,11,.12)', col: '#F59E0B' },
    1: { bg: 'var(--accent-dim)', col: 'var(--accent)' },
  };
  const header = `${backBarHTML()}
  <div class="settings-top" style="padding-top:4px">
    <div class="t-title">${navLabel('assistant')}</div>
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


SCREEN_BIND.assistant = function (el, id) {
    el.querySelector('#js-back')?.addEventListener('click', back);
    el.querySelectorAll('.js-reco').forEach(item => {
      item.addEventListener('click', () => {
        S.accountId = item.dataset.acc;
        S.holdingId = item.dataset.hold;
        go('stock');
      });
    });
};
