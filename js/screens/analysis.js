// Écran Analyse : comment le patrimoine est placé aujourd'hui (grandes classes, types d'actifs, types de compte, géographie, secteurs)
// + projection du patrimoine (affichée dans l'écran DCA) + binding.
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
// Pays / secteur affichables : un tiret, « Inconnu » ou vide devient « Non renseigné » ; une crypto n'a ni pays ni secteur
const _unk = v => !v || /^\s*(—|-|inconnu|autre)?\s*$/i.test(String(v));
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
      const crypto = h.type === 'Crypto' || pk === 'Crypto';
      const cls = pk === 'Immobilier' ? 'Immobilier' : crypto ? 'Crypto' : (ASSET_LABEL[h.type] || h.type || 'Autres');
      byAsset[cls] = (byAsset[cls] || 0) + hv;
      byRaw[h.type] = (byRaw[h.type] || 0) + hv;
      const g = crypto ? 'Crypto (sans pays)' : (_unk(h.country) ? 'Non renseigné' : h.country);
      const s = crypto ? 'Crypto' : (_unk(h.sector) ? 'Non renseigné' : h.sector);
      byGeo[g] = (byGeo[g] || 0) + hv;
      bySec[s] = (bySec[s] || 0) + hv;
    });
  });
  // Immobilier manuel : on ajoute la valeur nette (valeur estimée − capital restant dû), une seule fois au patrimoine global.
  const properties = typeof loadImmo === 'function' ? loadImmo().filter(p => p.buyDate && p.price > 0) : [];
  const immoNet = properties.reduce((s, p) => s + immoCalc(p).equity, 0);
  if (properties.length) {
    byPocket.Immobilier = (byPocket.Immobilier || 0) + immoNet;
    byAsset.Immobilier = (byAsset.Immobilier || 0) + immoNet;
    byAccType.Immobilier = (byAccType.Immobilier || 0) + immoNet;
    tot += immoNet;
  }
  const totRaw = Object.values(byRaw).reduce((s, v) => s + v, 0);
  return { accs, propertyCount: properties.length, tot, totRaw, byPocket, byAsset, byAccType, byRaw, byGeo, bySec };
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
// Donut + légende : le nom se tronque (jamais de débordement), montant et pourcentage restent sur la même ligne
function donutBlock(title, segs) {
  const legend=segs.map(s=>`<div class="legend-row" style="display:flex;align-items:center;gap:8px">
    <div class="leg-dot" style="background:${s.color};flex-shrink:0"></div>
    <div class="leg-name" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.name)}</div>
    <div class="t-sm t-num" style="flex-shrink:0">${masked(s.value)}</div>
    <div class="leg-pct" style="color:${s.color};flex-shrink:0;min-width:46px;text-align:right">${s.pct}%</div>
  </div>`).join('');
  return `<div class="donut-block anim">
    ${donutSvg(segs,108,16)}
    <div class="legend" style="flex:1;min-width:0">${legend}</div>
  </div>`;
}
// Liste en barres (géographie, secteurs) : 7 premières lignes + « Autres », pourcentage et montant alignés à droite
function barList(obj) {
  const entries = Object.entries(obj).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const tot = entries.reduce((s, [, v]) => s + v, 0);
  if (!(tot > 0)) return `<div class="t-sm" style="padding:6px 0">Aucune donnée</div>`;
  const top = entries.slice(0, 7), rest = entries.slice(7).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) top.push(['Autres', rest]);
  return top.map(([n, v], i) => {
    const p = v / tot * 100;
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:13px">
        <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${esc(n)}</span>
        <span class="t-num" style="flex-shrink:0"><b>${p.toFixed(1)} %</b> <span class="t-sm">· ${masked(v)}</span></span>
      </div>
      <div style="height:6px;border-radius:3px;background:var(--card2);margin-top:5px;overflow:hidden"><div style="width:${p.toFixed(1)}%;height:100%;background:${SEC_C[i % SEC_C.length]}"></div></div>
    </div>`;
  }).join('');
}

function renderAnalysis() {
  const d = analysisData();
  if (!(d.tot > 0)) return `${renderTopBar()}<div class="analysis-top"><div class="t-title">Analyse</div></div>
    <div style="text-align:center;padding:60px 20px;color:var(--text2)">
      <div style="font-size:40px;margin-bottom:12px">📈</div>
      <div style="font-size:15px;font-weight:600">Aucune donnée</div>
    </div>`;
  const sec = t => `<div class="t-section px" style="padding-bottom:10px">${t}</div>`;
  const fold = (t, inner) => `<details style="margin:10px 20px"><summary class="t-section" style="cursor:pointer;padding:8px 0">${t}</summary>${inner}</details>`;
  const subtitle = `${d.accs.length} compte${d.accs.length===1?'':'s'}${d.propertyCount ? ` · ${d.propertyCount} bien${d.propertyCount===1?'':'s'} immobilier${d.propertyCount===1?'':'s'}` : ''} · comment le patrimoine est placé aujourd'hui`;
  return `<div class="analysis-top anim">${renderTopBar()}</div>
  <div style="margin:6px 20px 16px;padding:16px;border-radius:16px;background:var(--card);border:1px solid var(--border)">
    <div class="t-label">Patrimoine total</div>
    <div style="font-size:28px;font-weight:800;margin-top:4px" class="t-num">${masked(d.tot)}</div>
    <div class="t-sm" style="margin-top:2px">${subtitle}</div>
    <div id="js-go-proj" class="tap" style="display:inline-block;margin-top:10px;padding:6px 14px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">DCA et projection →</div>
  </div>
  ${sec('Grandes classes')}
  ${donutBlock('',buildSegs(d.byPocket,POCKET_C))}
  ${sec('Par type d\'actif')}
  ${donutBlock('',buildSegs(d.byAsset,ASSET_C))}
  ${sec('Par type de compte')}
  ${donutBlock('',buildSegs(d.byAccType,ACCTYPE_C))}
  ${sec('Répartition géographique')}
  <div style="padding:0 20px 6px">${barList(d.byGeo)}</div>
  ${sec('Par secteur')}
  <div style="padding:0 20px 6px">${barList(d.bySec)}</div>
  <div class="t-sm px" style="padding:0 20px 10px">Titres seulement : les liquidités n'ont ni pays ni secteur, les cryptos sont regroupées.</div>
  ${fold('Objectifs d\'allocation ⓘ', renderTargetsBlock(d.byRaw, d.totRaw))}`;
}


SCREEN_BIND.analysis = function (el, id) {
    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
    el.querySelector('#js-go-proj')?.addEventListener('click', ()=>go('dca'));
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
// PROJECTION — patrimoine actuel + versements du DCA, sur 1, 3, 5, 10, 15 et 20 ans (affichée en bas de l'écran DCA)
// Hypothèses simples et modifiables : rendement annuel des liquidités et des actifs risqués (bourse, crypto, immobilier, autres).
// Le budget mensuel du DCA est supposé investi en actifs risqués. Ni frais, ni impôts, ni inflation. Ce ne sont pas des prévisions.
// Scénarios : prudent / central / optimiste = rendement risqué − 3 / 0 / +3 points.
// ═══════════════════════════════════════════════
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
// Corps de la projection (sans en-tête) : résumé, hypothèses modifiables, tableau 1 à 20 ans
function projectionBodyHTML() {
  const d = analysisData();
  const st = typeof dcaStats === 'function' ? dcaStats() : null, plan = st && st.current, C = plan ? st.current.budget : 0;
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
  return `<div style="margin:0 20px;padding:14px;border-radius:14px;background:var(--card);border:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;font-size:13px"><span>Patrimoine actuel</span><b class="t-num">${masked(d.tot)}</b></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px"><span class="t-sm">dont liquidités</span><span class="t-num t-sm">${masked(liq)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px"><span class="t-sm">dont actifs risqués</span><span class="t-num t-sm">${masked(risk)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><span>DCA mensuel</span><b class="t-num">${plan ? masked(C) : '—'}</b></div>
    ${plan ? '' : `<div class="t-sm" style="margin-top:8px">Aucun plan DCA : projection sans versements.</div>`}
  </div>
  <div style="display:flex;gap:10px;margin:12px 20px 0">${inp('proj-rl', set.rl, 'Liquidités (%/an)')}${inp('proj-rr', set.rr, 'Actifs risqués (%/an)')}</div>
  <div style="margin:12px 20px 0;padding:4px 14px 8px;border-radius:14px;background:var(--card);border:1px solid var(--border)">
    <div style="${grid};padding:8px 0;color:var(--text2);font-size:11px;font-weight:700"><span>Horizon</span><span>Versements</span><span>Prudent</span><span>Central</span><span>Optimiste</span></div>
    ${rows}
  </div>
  <div class="t-sm px" style="padding:12px 20px 10px">Central = ${set.rr} %/an sur les actifs risqués, prudent ${Math.max(-50, set.rr - 3)} %, optimiste ${set.rr + 3} %. Le DCA est supposé investi en actifs risqués ; les liquidités progressent à ${set.rl} %/an. Ni frais, ni impôts, ni inflation : ce sont des hypothèses, pas des prévisions.</div>`;
}
// Hypothèses de rendement : enregistrées puis `after()` redessine l'écran qui affiche la projection
function bindProjectionInputs(el, after) {
  ['rl', 'rr'].forEach(k => el.querySelector('#proj-' + k)?.addEventListener('change', e => {
    const s = projSettings();
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    if (Number.isFinite(v)) s[k] = Math.max(-50, Math.min(50, v));
    try { localStorage.setItem(PROJ_KEY, JSON.stringify(s)); } catch (err) {}
    if (after) after();
  }));
}
// Compatibilité : l'ancien écran « projection » n'existe plus (fusionné dans DCA) ; ces deux fonctions évitent toute erreur d'ancien appel
function renderProjection() { return projectionBodyHTML(); }
function bindProjection(el) { bindProjectionInputs(el, () => renderScreen('dca')); }
