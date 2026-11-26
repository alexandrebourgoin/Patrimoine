// Écran Analyse : patrimoine net, grandes classes, types d'actifs et de compte, géographie, secteurs, objectifs d'allocation + binding.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

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
// Calculs : analysisData() (js/features/wealth.js, pur). Ici : rendu uniquement.
// Couleurs, buildSegs et donutBlock : js/features/charts.js (partagés avec l'Accueil).
// Liste en barres (géographie, secteurs) : 7 premières lignes + « Autres », pourcentage et montant alignés à droite
function barList(obj) {
  const entries=Object.entries(obj).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const tot=entries.reduce((s,[,v])=>s+v,0);
  if(!(tot>0)) return `<div class="t-sm" style="padding:6px 0">Aucune donnée</div>`;
  const top=entries.slice(0,7), rest=entries.slice(7).reduce((s,[,v])=>s+v,0);
  if(rest>0) top.push(['Autres',rest]);
  return top.map(([n,v],i)=>{
    const p=v/tot*100;
    return `<div class="bar-item">
      <div class="bar-line"><span class="bar-name">${esc(n)}</span><span class="t-num" style="flex-shrink:0"><b>${p.toFixed(1)} %</b> <span class="t-sm">· ${masked(v)}</span></span></div>
      <div class="bar-track"><div style="width:${p.toFixed(1)}%;background:${SEC_C[i%SEC_C.length]}"></div></div>
    </div>`;
  }).join('');
}
// Carte de synthèse : patrimoine net, puis brut / crédits / immobilier brut s'il y a des biens, puis le détail financier
function wealthCardHTML(d) {
  const w=d.wealth, row=(k,v)=>`<div class="wl-row"><span>${k}</span><span class="t-num">${masked(v)}</span></div>`;
  const parts=`${d.accs.length} compte${d.accs.length===1?'':'s'}${w.count?` · ${w.count} bien${w.count===1?'':'s'} immobilier${w.count===1?'':'s'}`:''}`;
  return `<div class="wl-card">
    <div class="t-label">Patrimoine net</div>
    <div class="wl-amount t-num">${masked(d.tot)}</div>
    ${(w.count||w.otherDebt)?`${row('Patrimoine brut',w.gross)}${w.count?row('Crédits immobiliers restants',w.debt):''}${w.otherDebt?row('Autres crédits restants',w.otherDebt):''}${w.count?row('Dont immobilier brut',w.property):''}`:''}
    ${row('Dont comptes financiers',w.financial)}
    <div class="t-sm" style="margin-top:8px">${parts} · comment le patrimoine est placé aujourd'hui</div>
  </div>`;
}

function renderAnalysis() {
  const d=analysisNow();
  if(!(d.tot>0)) return `<div class="analysis-top anim">${renderTopBar('', navLabel('analysis'))}</div>
    <div style="text-align:center;padding:60px 20px;color:var(--text2)">
      <div style="font-size:40px;margin-bottom:12px">📈</div>
      <div style="font-size:15px;font-weight:600">Aucune donnée</div>
    </div>`;
  const sec=t=>`<div class="t-section px" style="padding-bottom:10px">${t}</div>`;
  return `<div class="analysis-top anim">${renderTopBar('', navLabel('analysis'))}</div>
  ${wealthCardHTML(d)}
  ${sec('Grandes classes')}
  ${donutBlock('',buildSegs(d.byPocket,POCKET_C))}
  ${sec("Par type d'actif")}
  ${donutBlock('',buildSegs(d.byAsset,ASSET_C))}
  ${sec('Par type de compte')}
  ${donutBlock('',buildSegs(d.byAccType,ACCTYPE_C))}
  ${sec('Répartition géographique')}
  <div class="px" style="padding-bottom:6px">${barList(d.byGeo)}</div>
  ${sec('Par secteur')}
  <div class="px" style="padding-bottom:6px">${barList(d.bySec)}</div>
  <div class="t-sm px" style="padding-bottom:10px">Titres seulement : les liquidités n'ont ni pays ni secteur, les cryptos sont regroupées.</div>
  ${renderDcaProjectionNow()}
  <details style="margin:10px 20px"><summary class="t-section" style="cursor:pointer;padding:8px 0">Objectifs d'allocation ⓘ</summary>${renderTargetsBlock(d.byRaw,d.totRaw)}</details>`;
}


SCREEN_BIND.analysis = function (el, id) {
    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
    bindDcaProjection(el);   // projection du patrimoine (js/features/dca.js)
    // Délégation : un seul écouteur par élément écran (l'élément persiste entre les rendus)
    if (el._tgtBound) return;
    el._tgtBound = true;
    el.addEventListener('input', e => {
      const inp = e.target.closest('.tgt-inp');
      if (!inp) return;
      S.targets[inp.dataset.type] = Math.max(0, Math.min(100, parseFloat(inp.value) || 0));
      // Refresh bars + totals in-place without losing focus
      const d = analysisNow(), byType = d.byRaw, tot = d.totRaw;
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
};
