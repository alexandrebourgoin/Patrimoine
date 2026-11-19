// Écran Analyse : comment le patrimoine est placé aujourd'hui (grandes classes, types d'actifs, types de compte)
// + écran Projection (patrimoine actuel + DCA) + binding.
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
const POCKET_C={'Liquidités':'#F59E0B','Bourse':'#4F8EF7','Crypto':'#A78BFA','Immobilier':'#00D68F','Autres':'#8A94A6'};
const ASSET_C={'Actions':'#4F8EF7','ETF / Fonds':'#00C2CB','Obligations':'#00D68F','Cash':'#F59E0B','Crypto':'#A78BFA','Immobilier':'#00D68F','Autres':'#8A94A6'};
const ASSET_LABEL={Action:'Actions',ETF:'ETF / Fonds',Obligation:'Obligations',Cash:'Cash',Crypto:'Crypto'};

// Grande classe d'un compte, d'après son type : Liquidités (livrets, compte courant, compte à terme),
// Bourse (comptes-titres, PEA, assurance-vie, PER, épargne salariale, Pilier 3a), Crypto, Immobilier, Autres.
// La valeur du compte entier (positions + liquidités) va dans sa classe : le cash d'un PEA reste dans la Bourse.
function accPocket(acc) {
  const t = (acc.type || '').toLowerCase();
  if (/\b(livret|ldds|lep|pel|cel)\b|courant|à terme/.test(t)) return 'Liquidités';
  if (/crypto/.test(t)) return 'Crypto';
  if (/scpi|immo/.test(t)) return 'Immobilier';
  if (/métaux|metaux/.test(t)) return 'Autres';
  if (/pea|titres|assurance|retraite|\bper\b|épargne salariale|pee|perco|pilier/.test(t)) return 'Bourse';
  return 'Autres';
}
// Toutes les répartitions du patrimoine (comptes non « observateur »), en devise appli.
function analysisData() {
  const accs = S.accounts.filter(a => !a.observer);
  const byPocket = {}, byAsset = {}, byAccType = {}, byRaw = {}, byGeo = {}, bySec = {};
  let tot = 0;
  accs.forEach(a => {
    const pk = accPocket(a), v = a.value || 0;
    byPocket[pk] = (byPocket[pk] || 0) + v; tot += v;
    const at = a.type || 'Autre';
    byAccType[at] = (byAccType[at] || 0) + v;
    const cash = accCash(a);
    if (cash) { byAsset['Cash'] = (byAsset['Cash'] || 0) + cash; byRaw['Cash'] = (byRaw['Cash'] || 0) + cash; }
    (a.holdings || []).forEach(h => {
      const hv = h.valueRef ?? h.value;
      const cls = pk === 'Immobilier' ? 'Immobilier' : (h.type === 'Crypto' || pk === 'Crypto') ? 'Crypto' : (ASSET_LABEL[h.type] || h.type || 'Autres');
      byAsset[cls] = (byAsset[cls] || 0) + hv;
      byRaw[h.type] = (byRaw[h.type] || 0) + hv;
      const g = h.country || 'Autre', s = h.sector || 'Autre';
      byGeo[g] = (byGeo[g] || 0) + hv;
      bySec[s] = (bySec[s] || 0) + hv;
    });
  });
  const totRaw = Object.values(byRaw).reduce((s, v) => s + v, 0);
  return { accs, tot, totRaw, byPocket, byAsset, byAccType, byRaw, byGeo, bySec };
}

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
    <div class="t-sm t-num" style="margin-right:8px">${masked(s.value)}</div>
    <div class="leg-pct" style="color:${s.color}">${s.pct}%</div>
  </div>`).join('');
  return `<div class="donut-block anim">
    ${donutSvg(segs,108,16)}
    <div class="legend">${legend}</div>
  </div>`;
}

function renderAnalysis() {
  const d = analysisData();
  if (!d.accs.length || !(d.tot > 0)) return `${renderTopBar()}<div class="analysis-top"><div class="t-title">Analyse</div></div>
    <div style="text-align:center;padding:60px 20px;color:var(--text2)">
      <div style="font-size:40px;margin-bottom:12px">📈</div>
      <div style="font-size:15px;font-weight:600">Aucune donnée</div>
    </div>`;
  const sec = t => `<div class="t-section px" style="padding-bottom:10px">${t}</div>`;
  const fold = (t, inner) => `<details style="margin:10px 20px"><summary class="t-section" style="cursor:pointer;padding:8px 0">${t}</summary>${inner}</details>`;
  return `<div class="analysis-top anim">${renderTopBar()}</div>
  <div style="margin:6px 20px 16px;padding:16px;border-radius:16px;background:var(--card);border:1px solid var(--border)">
    <div class="t-label">Patrimoine total</div>
    <div style="font-size:28px;font-weight:800;margin-top:4px" class="t-num">${masked(d.tot)}</div>
    <div class="t-sm" style="margin-top:2px">${d.accs.length} compte${d.accs.length>1?'s':''} · comment il est placé aujourd'hui</div>
    <div id="js-go-proj" class="tap" style="display:inline-block;margin-top:10px;padding:6px 14px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">Voir la projection →</div>
  </div>
  ${sec('Grandes classes')}
  ${donutBlock('',buildSegs(d.byPocket,POCKET_C))}
  ${sec('Par type d\'actif')}
  ${donutBlock('',buildSegs(d.byAsset,ASSET_C))}
  ${sec('Par type de compte')}
  ${donutBlock('',buildSegs(d.byAccType,ACCTYPE_C))}
  ${fold('Géographie et secteurs', `<div class="t-sm" style="margin:4px 0 8px">Titres seulement (les liquidités n'ont ni pays ni secteur).</div>${donutBlock('',buildSegs(d.byGeo,GEO_C))}${donutBlock('',buildSegs(d.bySec,SEC_C))}`)}
  ${fold('Objectifs d\'allocation ⓘ', renderTargetsBlock(d.byRaw, d.totRaw))}`;
}


SCREEN_BIND.analysis = function (el, id) {
    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
    el.querySelector('#js-go-proj')?.addEventListener('click', ()=>go('projection'));
    // Delegation : un seul écouteur par élément écran (l'élément persiste entre les rendus)
    if (el._tgtBound) return;
    el._tgtBound = true;
    el.addEventListener('input', e => {
      const inp = e.target.closest('.tgt-inp');
      if (!inp) return;
      S.targets[inp.dataset.type] = Math.max(0, Math.min(100, parseFloat(inp.value) || 0));
      // Refresh bars + totals in-place without losing focus
      const d = analysisData(), byType = d.byRaw, tot = d.totRaw;
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


// ═══════════════════════════════════════════════
// PROJECTION — patrimoine actuel + versements du DCA, sur 1, 3, 5, 10, 15 et 20 ans
// Hypothèses simples et modifiables : rendement annuel des liquidités et des actifs risqués (bourse, crypto, immobilier, autres).
// Le budget mensuel du DCA est supposé investi en actifs risqués. Ni frais, ni impôts, ni inflation. Ce ne sont pas des prévisions.
// Scénarios : prudent / central / optimiste = rendement risqué − 3 / 0 / +3 points.
// ═══════════════════════════════════════════════
(function () {
  const ref = document.getElementById('s-dca');
  if (ref && !document.getElementById('s-projection')) {
    const d = document.createElement('div');
    d.id = 's-projection'; d.className = 'screen no-nav';
    ref.insertAdjacentElement('afterend', d);
  }
})();
_NAV_PATH.projection = 'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z';
NAV_CATALOG.projection = { label: 'Projection', kind: 'screen' };

const PROJ_KEY = 'patrimoine-proj';
function projSettings() {
  try {
    const d = JSON.parse(localStorage.getItem(PROJ_KEY) || 'null');
    return { rl: Number.isFinite(d?.rl) ? d.rl : 2, rr: Number.isFinite(d?.rr) ? d.rr : 7 };
  } catch (e) { return { rl: 2, rr: 7 }; }
}
// Valeur future : capital P + versement mensuel C, rendement annuel r (%), sur `months` mois (capitalisation mensuelle)
function projFV(P, C, r, months) {
  const i = Math.pow(1 + r / 100, 1 / 12) - 1, g = Math.pow(1 + i, months);
  return P * g + (i ? C * (g - 1) / i : C * months);
}
function _projK(v) {
  return S.privacy ? '● ● ●' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: S.currency, maximumFractionDigits: 0 }).format(v);
}
function renderProjection() {
  const d = analysisData();
  const st = typeof dcaStats === 'function' ? dcaStats() : null, plan = st && st.current, C = plan ? plan.budget : 0;
  const set = projSettings();
  const liq = d.byPocket['Liquidités'] || 0, risk = d.tot - liq;
  const val = (n, dr) => projFV(liq, 0, set.rl, 12 * n) + projFV(risk, C, Math.max(-50, set.rr + dr), 12 * n);
  const H = [1, 3, 5, 10, 15, 20];
  const grid = 'display:grid;grid-template-columns:.8fr 1.1fr 1fr 1.1fr 1fr;gap:6px;align-items:center;font-size:12px';
  const rows = H.map(n => `<div style="${grid};padding:9px 0;border-top:1px solid var(--border)">
    <b>${n} an${n > 1 ? 's' : ''}</b>
    <span class="t-num" style="color:var(--text2)">${_projK(C * 12 * n)}</span>
    <span class="t-num">${_projK(val(n, -3))}</span>
    <b class="t-num">${_projK(val(n, 0))}</b>
    <span class="t-num">${_projK(val(n, 3))}</span></div>`).join('');
  const inp = (id, v, lbl) => `<label style="flex:1;display:block"><span class="form-label">${lbl}</span><input class="form-input" id="${id}" type="number" step="0.1" inputmode="decimal" value="${v}"></label>`;
  return `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Retour
  </div>
  <div class="settings-top" style="padding-top:4px">
    <div class="t-title">Projection</div>
    <div class="t-sm" style="margin-top:2px">Ton patrimoine actuel et ton DCA, dans le temps — hypothèses théoriques</div>
  </div>
  <div style="margin:14px 20px 0;padding:14px;border-radius:14px;background:var(--card);border:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;font-size:13px"><span>Patrimoine actuel</span><b class="t-num">${masked(d.tot)}</b></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px"><span class="t-sm">dont liquidités</span><span class="t-num t-sm">${masked(liq)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px"><span class="t-sm">dont actifs risqués</span><span class="t-num t-sm">${masked(risk)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><span>DCA mensuel</span><b class="t-num">${plan ? masked(C) : '—'}</b></div>
    ${plan ? '' : `<div class="t-sm" style="margin-top:8px">Aucun plan DCA : projection sans versements. <span id="js-go-dca" class="tap" style="color:var(--accent);cursor:pointer;font-weight:700">Configurer le DCA</span></div>`}
  </div>
  <div style="display:flex;gap:10px;margin:12px 20px 0">${inp('proj-rl', set.rl, 'Liquidités (%/an)')}${inp('proj-rr', set.rr, 'Actifs risqués (%/an)')}</div>
  <div class="t-section px" style="padding:18px 20px 6px">Patrimoine estimé</div>
  <div style="margin:0 20px;padding:4px 14px 8px;border-radius:14px;background:var(--card);border:1px solid var(--border)">
    <div style="${grid};padding:8px 0;color:var(--text2);font-size:11px;font-weight:700"><span>Horizon</span><span>Versements</span><span>Prudent</span><span>Central</span><span>Optimiste</span></div>
    ${rows}
  </div>
  <div class="t-sm px" style="padding:12px 20px 30px">Central = ${set.rr} %/an sur les actifs risqués, prudent ${Math.max(-50, set.rr - 3)} %, optimiste ${set.rr + 3} %. Le DCA est supposé investi en actifs risqués ; les liquidités progressent à ${set.rl} %/an. Ni frais, ni impôts, ni inflation : ce sont des hypothèses, pas des prévisions.</div>`;
}
function bindProjection(el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.querySelector('#js-go-dca')?.addEventListener('click', () => go('dca'));
  ['rl', 'rr'].forEach(k => el.querySelector('#proj-' + k)?.addEventListener('change', e => {
    const s = projSettings();
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    if (Number.isFinite(v)) s[k] = Math.max(-50, Math.min(50, v));
    try { localStorage.setItem(PROJ_KEY, JSON.stringify(s)); } catch (err) {}
    renderScreen('projection');
  }));
}
