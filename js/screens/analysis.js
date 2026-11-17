// Écran Analyse : répartitions (type, géographie, secteur, type de compte) et objectifs + binding.
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
const GEO_C=['#4F8EF7','#F59E0B','#00D68F','#A78BFA','#FF5A5A','#F97316'];
const TYPE_C={'Action':'#4F8EF7','ETF':'#00C2CB','Obligation':'#00D68F','Cash':'#F59E0B'};
const SEC_C=['#4F8EF7','#00C2CB','#00D68F','#F59E0B','#A78BFA','#FF5A5A','#F97316','#EC4899'];
const ACCTYPE_C=['#4F8EF7','#00C2CB','#00D68F','#F59E0B','#A78BFA','#FF5A5A','#F97316','#EC4899','#22D3EE','#84CC16'];

function buildSegs(obj, colors) {
  // Une part à 0 (ou négative, ex. compte vide / cash négatif) n'a rien à représenter dans le
  // donut — la garder faisait planter le dessin des tranches (voir donutSvg).
  const entries=Object.entries(obj).filter(([,v])=>v>0);
  const tot=entries.reduce((s,[,v])=>s+v,0);
  return entries.sort((a,b)=>b[1]-a[1]).map(([name,value],i)=>({
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
  // Les liquidités non investies des comptes comptent comme du « Cash » : sans elles,
  // le total de l'Analyse ne collait pas au patrimoine affiché sur le dashboard.
  const cashTot=S.accounts.reduce((s,a)=>s+accCash(a),0);
  const tot=all.reduce((s,h)=>s+(h.valueRef??h.value),0)+cashTot; // devise appli — h.value est en devise native
  if(!all.length&&!cashTot) return `<div class="analysis-top"><div class="t-title">Analyse</div></div>
    <div style="text-align:center;padding:60px 20px;color:var(--text2)">
      <div style="font-size:40px;margin-bottom:12px">📈</div>
      <div style="font-size:15px;font-weight:600">Aucune donnée</div>
    </div>`;
  const byType={}, byGeo={}, bySec={}, byAccType={};
  all.forEach(h=>{
    const v=h.valueRef??h.value;
    byType[h.type]=(byType[h.type]||0)+v;
    byGeo[h.country]=(byGeo[h.country]||0)+v;
    bySec[h.sector]=(bySec[h.sector]||0)+v;
  });
  // byGeo/bySec restent sur les titres seuls (le cash n'a ni pays ni secteur)
  if(cashTot) byType['Cash']=(byType['Cash']||0)+cashTot;
  // Répartition par type de compte : titres + liquidités de chaque compte (accTotal), agrégés par a.type
  S.accounts.forEach(a=>{ byAccType[a.type||'Autre']=(byAccType[a.type||'Autre']||0)+accTotal(a); });
  return `<div class="analysis-top anim">
    ${renderTopBar(`<span class="t-sm" style="margin-right:4px">Tous comptes · ${masked(tot)}</span>`)}
  </div>
  <div style="height:10px"></div>
  <div class="t-section px" style="padding-bottom:10px">Objectifs d'allocation</div>
  ${renderTargetsBlock(byType, tot)}
  <div class="t-section px" style="padding-bottom:10px">Répartition par type de compte</div>
  ${donutBlock('',buildSegs(byAccType,ACCTYPE_C))}
  <div class="t-section px" style="padding-bottom:10px">Par type d'actif</div>
  ${donutBlock('',buildSegs(byType,TYPE_C))}
  <div class="t-section px" style="padding-bottom:10px">Répartition géographique</div>
  ${donutBlock('',buildSegs(byGeo,GEO_C))}
  <div class="t-section px" style="padding-bottom:10px">Par secteur</div>
  ${donutBlock('',buildSegs(bySec,SEC_C))}`;
}


SCREEN_BIND.analysis = function (el, id) {
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
};
