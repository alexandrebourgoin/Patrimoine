// Graphiques SVG : sparklines, donut, courbe du patrimoine, graphique d un titre détenu / suivi.
// Chaque graphique a une fonction de données (gen*), un rendu SVG (*Svg) et une interactivité (init*Chart : crosshair, tooltip).
// Dépend, À L APPEL seulement, de S, PU (utils.js), loadHistory/loadWealth, FX_RATES… (mon-patrimoine.js).
// Aucun code exécuté à l évaluation : que des fonctions.

// ═══════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════
function sparkData(base, n=22, vol=0.025) {
  const d=[base];
  for(let i=1;i<n;i++) d.push(d[i-1]+d[i-1]*vol*(Math.random()*2-.85));
  d[d.length-1]=base;
  return d;
}

function sparkSvg(data, w, h, color='#4F8EF7', fill=true) {
  if(!data||data.length<2) return '';
  const mn=Math.min(...data), mx=Math.max(...data), rng=mx-mn||1;
  const pts=data.map((v,i)=>`${((i/(data.length-1))*w).toFixed(1)},${(h-((v-mn)/rng)*h*.9-h*.05).toFixed(1)}`);
  const line='M'+pts.join('L');
  const area=line+`L${w},${h}L0,${h}Z`;
  const gid='g'+Math.random().toString(36).slice(2,6);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">
    ${fill?`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".28"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs><path d="${area}" fill="url(#${gid})"/>`:``}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function donutSvg(segs, size=108, sw=16) {
  const cx=size/2, cy=size/2, r=(size-sw)/2;
  const C=2*Math.PI*r;
  const tot=segs.reduce((s,sg)=>s+sg.value,0);
  let acc=0;
  const circles=segs.map(sg=>{
    const raw=tot>0?(sg.value/tot)*C:0;
    // ⚠️ Une tranche minuscule (raw < 1.5) donnait un stroke-dasharray NÉGATIF, invalide en SVG :
    // le navigateur ignore alors l'attribut et trace un cercle plein, qui écrase visuellement
    // toutes les tranches précédentes (surtout grave car triées par valeur croissante à la fin,
    // donc dessinées par-dessus les autres — le donut entier prenait la couleur de cette tranche).
    const dash=Math.max(0,raw-1.5);
    const gap=C-dash;
    const off=-acc;
    acc+=raw;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${sg.color}"
      stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${off.toFixed(2)}" stroke-linecap="butt"
      transform="rotate(-90 ${cx} ${cy})"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex-shrink:0">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}"/>
    ${circles.join('')}
  </svg>`;
}

// ═══════════════════════════════════════════════
// HISTORY CHART
// ═══════════════════════════════════════════════
function genHistData(period) {
  const w = totalWealth();
  const n = { '1S': 7, '1M': 30, '3M': 90, '1A': 365 }[period] || 30;
  const today = new Date(); today.setHours(0,0,0,0);

  // ── Série réelle si des snapshots existent → forward-fill jour par jour (mode réel uniquement) ──
  const wl = S.isDemo ? [] : loadWealth();
  if (wl.length >= 2) {
    const byDay = {};
    wl.forEach(p => { byDay[p.d] = p.v; });
    const startKey = _dayKey(today.getTime() - (n-1)*86400000);
    let last = null;
    for (const p of wl) { if (p.d < startKey) last = p.v; else break; } // dernière valeur avant la fenêtre
    const pts = new Array(n);
    let anyReal = false;
    for (let i = 0; i < n; i++) {
      const key = _dayKey(today.getTime() - (n-1-i)*86400000);
      if (byDay[key] != null) { last = byDay[key]; anyReal = true; }
      pts[i] = last;
    }
    if (w > 0) pts[n-1] = w; // ancrer le dernier point sur la valeur live courante
    if (pts[0] == null) {    // combler le début si aucune donnée avant la fenêtre
      const firstKnown = pts.find(v => v != null) ?? w;
      for (let i = 0; i < n && pts[i] == null; i++) pts[i] = firstKnown;
    }
    if (anyReal && pts.every(v => v != null)) { pts.real = true; return pts; }
  }

  // ── Fallback synthétique déterministe (marche aléatoire) ──
  const key = period + '_' + Math.round(w / 100);
  if (S._histCache[key]) return S._histCache[key];
  const pts = new Array(n);
  pts[n - 1] = w;
  for (let i = n - 2; i >= 0; i--) {
    const drift = period === '1A' ? 0.0008 : 0.0003;
    pts[i] = pts[i + 1] / (1 + drift + (Math.random() * 0.032 - 0.015));
  }
  S._histCache[key] = pts;
  return pts;
}

function histSvg(pts, w, h) {
  if (!pts || pts.length < 2) return '';
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const pad = 2;
  const last = pts[pts.length - 1], first = pts[0];
  const color = last >= first ? 'var(--gain)' : 'var(--loss)';
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (w - pad * 2));
  const ys = pts.map(v => pad + (1 - (v - mn) / rng) * (h - pad * 2));
  const line = 'M' + xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join('L');
  const area = line + `L${xs[xs.length-1].toFixed(1)},${h}L${xs[0].toFixed(1)},${h}Z`;
  const gid = 'hg' + Math.random().toString(36).slice(2, 7);
  return `<svg id="hist-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:hidden;cursor:crosshair">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".2"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line id="hist-xhair" x1="0" y1="0" x2="0" y2="${h}" stroke="var(--text3)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>
    <circle id="hist-dot" cx="0" cy="0" r="4" fill="${color}" stroke="var(--bg)" stroke-width="2" opacity="0"/>
  </svg>`;
}

// Curseur commun aux courbes (patrimoine, titre suivi) : ligne verticale + point sur la valeur la plus proche, info-bulle.
// tipText(i) : texte de l'info-bulle pour le point i ; tipW : largeur estimée de l'info-bulle (bascule à gauche du doigt).
function _bindChartCursor(svg, pts, { xhair, dot, tip, tipW, tipText }) {
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1, pad = 2;
  function update(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const idx = Math.round((relX - pad) / (rect.width - pad * 2) * (pts.length - 1));
    const i = Math.max(0, Math.min(pts.length - 1, idx));
    const x = pad + (i / (pts.length - 1)) * (rect.width - pad * 2);
    const y = pad + (1 - (pts[i] - mn) / rng) * (rect.height - pad * 2);
    xhair.setAttribute('x1', x.toFixed(1)); xhair.setAttribute('x2', x.toFixed(1));
    xhair.setAttribute('opacity', '1');
    dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
    dot.setAttribute('opacity', '1');
    if (!tip) return;
    let tipX = relX + 10;
    if (tipX + tipW > rect.width) tipX = relX - tipW - 8;
    tip.style.left = Math.max(0, tipX) + 'px';
    tip.style.top = Math.max(0, y - 22) + 'px';
    if (S.privacy) { tip.style.opacity = '0'; return; }
    tip.style.opacity = '1';
    tip.textContent = tipText(i);
  }
  function hide() {
    xhair.setAttribute('opacity', '0');
    dot.setAttribute('opacity', '0');
    if (tip) tip.style.opacity = '0';
  }
  svg.addEventListener('touchstart', e => { e.stopPropagation(); update(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchmove',  e => { e.stopPropagation(); update(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchend', hide, { passive: true });
  svg.addEventListener('mousemove', e => update(e.clientX));
  svg.addEventListener('mouseleave', hide);
}

function initHistChart(container, pts) {
  const svg = container.querySelector('#hist-svg');
  if (!svg || !pts || pts.length < 2) return;
  _bindChartCursor(svg, pts, {
    xhair: svg.querySelector('#hist-xhair'), dot: svg.querySelector('#hist-dot'), tip: container.querySelector('.hist-tip'),
    tipW: 115, tipText: i => fmtCur(pts[i]),
  });
}

// Construit pts[] (un point par jour calendaire) depuis une série réelle :
// forward-fill weekends/fériés, backfill avant la 1ère clôture, dernier point ancré sur anchorPrice.
function _ptsFromRealSeries(hist, startDate, days, anchorPrice) {
  const byDay = {};
  hist.series.forEach(p => { byDay[p.d] = p.c; });
  let last = null;
  const startKey = _dayKey(startDate);
  for (const p of hist.series) { if (p.d < startKey) last = p.c; else break; }
  const pts = new Array(days);
  for (let i = 0; i < days; i++) {
    const key = _dayKey(startDate.getTime() + i*86400000);
    if (byDay[key] != null) last = byDay[key];
    pts[i] = last;
  }
  if (pts[0] == null) {
    const firstKnown = pts.find(v => v != null) ?? anchorPrice;
    for (let i = 0; i < days && pts[i] == null; i++) pts[i] = firstKnown;
  }
  pts[days-1] = anchorPrice; // cours live, plus frais que la dernière clôture
  return pts;
}

// ── SECURITY CHART (90-day price history) ──
function genSecurityHistory(h, period) {
  period = period || 'MAX';
  const today = new Date(); today.setHours(0,0,0,0);
  const txDates = h.transactions.map(t => new Date(t.date+'T00:00:00'));
  const firstTxDate = txDates.length > 0 ? new Date(Math.min(...txDates)) : new Date(today.getTime() - 90*86400000);
  const periodDaysMap = {'1M':30,'3M':90,'6M':182,'1A':365};
  const periodDays = periodDaysMap[period];
  const days = periodDays || Math.max(90, Math.round((today - firstTxDate) / 86400000) + 1);
  const startDate = new Date(today.getTime() - (days - 1) * 86400000);

  // ── Série réelle si récupérée → forward-fill jour par jour (weekends/fériés = dernière clôture) ──
  const hist = getHistorySeries(h.ticker);
  if (hist) {
    return { pts: _ptsFromRealSeries(hist, startDate, days, h.currentPrice), startDate, days, real: true };
  }

  // ── Fallback synthétique déterministe (marche aléatoire seedée sur le ticker) ──
  let seed = 0;
  for(let i=0;i<h.ticker.length;i++) seed = (Math.imul(31, seed) + h.ticker.charCodeAt(i)) | 0;
  seed = Math.abs(seed) || 42;
  const lcg = () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const pts = new Array(days);
  pts[days-1] = h.currentPrice;
  for(let i=days-2;i>=0;i--) pts[i] = pts[i+1] / (1 + 0.0003 + (lcg()*0.038 - 0.018));
  return { pts, startDate, days, real: false };
}

function stockChartSvg(h, w, ch, period) {
  const {pts, startDate, days} = genSecurityHistory(h, period);
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const padT=8, padB=8;
  const xs = pts.map((_,i) => (i/(pts.length-1))*w);
  const ys = pts.map(v => padT + (1-(v-mn)/rng)*(ch-padT-padB));
  const isUp = pts[pts.length-1] >= pts[0];
  const color = isUp ? 'var(--gain)' : 'var(--loss)';
  const line = 'M'+xs.map((x,i)=>`${x.toFixed(1)},${ys[i].toFixed(1)}`).join('L');
  const area = line+`L${xs[xs.length-1].toFixed(1)},${ch}L0,${ch}Z`;
  const gid = 'sc'+Math.random().toString(36).slice(2,7);
  // Ligne du PRU, étiquette à GAUCHE : le cours actuel est annoté à droite, les deux ne se chevauchent plus
  const pruClamp = Math.max(mn, Math.min(mx, h.avgBuyPrice));
  const pruY = (padT+(1-(pruClamp-mn)/rng)*(ch-padT-padB)).toFixed(1);
  const pruLabel = `PRU ${h.avgBuyPrice.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const pruLine = `<line x1="0" x2="${w}" y1="${pruY}" y2="${pruY}" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.8"/>
    <text x="4" y="${Math.max(padT + 9, parseFloat(pruY) - 3).toFixed(1)}" text-anchor="start" font-size="9" fill="#2563eb" font-weight="700" opacity="0.9">${pruLabel}</text>`;
  // Current price annotation at the right edge
  const lastY = ys[ys.length - 1];
  const txtY = Math.max(padT + 10, Math.min(ch - padB - 2, lastY - 4));
  const curLabel = fmtNative(pts[pts.length - 1], h.currency || 'EUR');
  const curPriceAnnot = `<text x="${w - 4}" y="${txtY.toFixed(1)}" text-anchor="end" font-size="9" fill="${color}" font-weight="700">${curLabel}</text>`;
  // BUY / SELL markers mapped to extended history window
  const markers = h.transactions.filter(t=>t.type!=='DIV').map(tx=>{
    const idx = Math.max(0, Math.min(days-1, Math.round((new Date(tx.date+'T00:00:00') - startDate) / 86400000)));
    const x = Math.max(4, Math.min(w - 4, xs[idx])).toFixed(1);   // marqueur entier, même au bord du graphique
    const yy = ys[idx].toFixed(1);
    const mc = tx.type==='BUY'?'var(--gain)':'var(--loss)';
    return `<line x1="${x}" x2="${x}" y1="${padT}" y2="${ch-padB}" stroke="${mc}" stroke-width="1.5" opacity="0.55"/>
      <circle cx="${x}" cy="${yy}" r="3.5" fill="${mc}" stroke="var(--surface)" stroke-width="1.5"/>`;
  }).join('');
  // Period label
  const periodLabel = days>=365 ? Math.round(days/365)+'a' : days>=30 ? Math.round(days/30)+'m' : days+'j';
  return `<svg id="stock-svg" width="${w}" height="${ch}" viewBox="0 0 ${w} ${ch}" style="display:block;overflow:hidden;cursor:crosshair" data-startdate="${startDate.toISOString().slice(0,10)}" data-days="${days}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".15"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    ${pruLine}
    ${curPriceAnnot}
    ${markers}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line id="stock-xhair" x1="0" y1="${padT}" x2="0" y2="${ch-padB}" stroke="var(--text3)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>
    <circle id="stock-dot" cx="0" cy="0" r="4" fill="${color}" stroke="var(--bg)" stroke-width="2" opacity="0"/>
    <text id="stock-period-lbl" x="${w/2}" y="${ch-2}" text-anchor="middle" font-size="9" fill="var(--text3)" font-weight="600">${periodLabel}</text>
  </svg>`;
}

function initStockChart(container, h) {
  const {pts, startDate} = genSecurityHistory(h, S.stockPeriod||'MAX');
  const svg = container.querySelector('#stock-svg');
  const tip = container.querySelector('.stock-chart-tip');
  if(!svg||!pts||pts.length<2) return;
  const mn=Math.min(...pts), mx=Math.max(...pts), rng=mx-mn||1;
  const padT=8, padB=8;
  const xhair=svg.querySelector('#stock-xhair');
  const dot=svg.querySelector('#stock-dot');
  let locked=false;
  function update(clientX) {
    const rect=svg.getBoundingClientRect();
    const relX=Math.max(0,Math.min(rect.width,clientX-rect.left));
    const idx=Math.round(relX/rect.width*(pts.length-1));
    const i=Math.max(0,Math.min(pts.length-1,idx));
    const x=(i/(pts.length-1))*rect.width;
    const y=padT+(1-(pts[i]-mn)/rng)*(rect.height-padT-padB);
    xhair.setAttribute('x1',x.toFixed(1)); xhair.setAttribute('x2',x.toFixed(1));
    xhair.setAttribute('opacity','1');
    dot.setAttribute('cx',x.toFixed(1)); dot.setAttribute('cy',y.toFixed(1));
    dot.setAttribute('opacity','1');
    let tipX=relX+8;
    if(tipX+130>rect.width) tipX=relX-138;
    tip.style.left=Math.max(0,tipX)+'px';
    tip.style.top=Math.max(0,y-22)+'px';
    tip.style.opacity='1';
    const d=new Date(startDate.getTime()+i*86400000);
    if(S.privacy){tip.style.opacity='0';return;}
    tip.textContent=fmtNative(pts[i], h.currency||'EUR')+'  '+d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
  }
  function hide(){if(locked) return; xhair.setAttribute('opacity','0');dot.setAttribute('opacity','0');tip.style.opacity='0';}
  // Touch: drag to scrub, tap to lock/unlock tooltip
  let touchMoved=false;
  svg.addEventListener('touchstart',e=>{e.stopPropagation();touchMoved=false;update(e.touches[0].clientX);},{passive:true});
  svg.addEventListener('touchmove',e=>{e.stopPropagation();touchMoved=true;update(e.touches[0].clientX);},{passive:true});
  svg.addEventListener('touchend',e=>{
    if(!touchMoved){locked=!locked;if(!locked)hide();}
    else{if(!locked)hide();}
  },{passive:true});
  // Mouse
  svg.addEventListener('mousemove',e=>{if(!locked)update(e.clientX);});
  svg.addEventListener('click',e=>{locked=!locked;if(locked)update(e.clientX);else hide();});
  svg.addEventListener('mouseleave',hide);
}

// ── WATCHSTOCK CHART ──
function genWatchHistory(ticker, price, period) {
  const today = new Date(); today.setHours(0,0,0,0);
  let days;
  if (period === 'YTD') {
    days = Math.max(2, Math.round((today - new Date(today.getFullYear(), 0, 1)) / 86400000) + 1);
  } else {
    const map = {'1S':7,'1M':30,'3M':90,'6M':182,'1A':365};
    days = map[period] || 90;
  }
  const startDate = new Date(today.getTime() - (days - 1) * 86400000);

  // ── Série réelle si récupérée (partagée avec les titres détenus via le ticker) ──
  const hist = getHistorySeries(ticker);
  if (hist) {
    return { pts: _ptsFromRealSeries(hist, startDate, days, price), startDate, days, real: true };
  }

  // ── Fallback synthétique déterministe ──
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed = (Math.imul(31, seed) + ticker.charCodeAt(i)) | 0;
  seed = Math.abs(seed) || 42;
  const lcg = () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const pts = new Array(days);
  pts[days - 1] = price;
  for (let i = days - 2; i >= 0; i--) pts[i] = pts[i + 1] / (1 + 0.0002 + (lcg() * 0.032 - 0.015));
  return { pts, startDate, days, real: false };
}

function watchChartSvg(pts, w, h, wCur = 'EUR') {
  if (!pts || pts.length < 2) return '';
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const pad = 2;
  const color = pts[pts.length - 1] >= pts[0] ? 'var(--gain)' : 'var(--loss)';
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (w - pad * 2));
  const ys = pts.map(v => pad + (1 - (v - mn) / rng) * (h - pad * 2));
  const line = 'M' + xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join('L');
  const area = line + `L${xs[xs.length-1].toFixed(1)},${h}L${xs[0].toFixed(1)},${h}Z`;
  const gid = 'wg' + Math.random().toString(36).slice(2, 7);
  const lastY = ys[ys.length - 1];
  const curTxtY = Math.max(14, Math.min(h - 4, lastY - 4));
  const curAnnot = `<text x="${(w - pad - 2).toFixed(1)}" y="${curTxtY.toFixed(1)}" text-anchor="end" font-size="10" fill="${color}" font-weight="700">${fmtNative(pts[pts.length - 1], wCur)}</text>`;
  return `<svg id="watch-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:hidden;cursor:crosshair">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".22"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${curAnnot}
    <line id="watch-xhair" x1="0" y1="0" x2="0" y2="${h}" stroke="var(--text3)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>
    <circle id="watch-dot" cx="0" cy="0" r="4" fill="${color}" stroke="var(--bg)" stroke-width="2" opacity="0"/>
  </svg>`;
}

function initWatchChart(container, pts, startDate, wCur = 'EUR') {
  const svg = container.querySelector('#watch-svg');
  if (!svg || !pts || pts.length < 2) return;
  _bindChartCursor(svg, pts, {
    xhair: svg.querySelector('#watch-xhair'), dot: svg.querySelector('#watch-dot'), tip: container.querySelector('#watch-chart-tip'),
    tipW: 145,
    tipText: i => fmtNative(pts[i], wCur) + '  ' + new Date(startDate.getTime() + i * 86400000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
  });
}

// ═══════════════════════════════════════════════
// RÉPARTITIONS : couleurs, segments, donut + légende (Analyse et Accueil)
// ═══════════════════════════════════════════════
const SEC_C=['#4F8EF7','#00C2CB','#00D68F','#F59E0B','#A78BFA','#FF5A5A','#F97316','#EC4899'];
const ACCTYPE_C=['#4F8EF7','#00C2CB','#00D68F','#F59E0B','#A78BFA','#FF5A5A','#F97316','#EC4899','#22D3EE','#84CC16'];
const POCKET_C={'Liquidités':'#F59E0B','Fonds euros':'#14B8A6','Bourse':'#4F8EF7','Crypto':'#A78BFA','Immobilier':'#00D68F','Autres':'#8A94A6'};
const ASSET_C={'Actions':'#4F8EF7','ETF / Fonds':'#00C2CB','Obligations':'#00D68F','Fonds euros':'#14B8A6','Cash':'#F59E0B','Crypto':'#A78BFA','Immobilier':'#10B981','Autres':'#8A94A6'};

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
// Donut + légende : le nom a sa propre ligne (avec le pourcentage), le montant passe dessous. Ainsi rien n'est tronqué
// (« Obligati… », « ETF / Fo… » en largeur de téléphone) ; un nom vraiment trop long reste coupé par une ellipse.
// Sous le camembert des grandes classes (Accueil et Analyse, même texte) : ce que le graphique ne montre pas.
//   - classe nette négative (immobilier dont les crédits dépassent la valeur) : absente du camembert ;
//   - autres crédits : déduits du patrimoine net mais pas répartis par classe, donc la somme des classes le dépasse d'autant.
function pocketNotes(d) {
  const notes = Object.entries(d.byPocket || {}).filter(([, v]) => v < -0.005)
    .map(([n, v]) => `${n} : ${masked(v)} net (crédits supérieurs à la valeur), non représenté dans le graphique.`);
  const od = d.wealth && d.wealth.otherDebt;
  if (od > 0.005) notes.push(`Autres crédits : −${masked(od)}, déduits du patrimoine net mais non répartis par classe : la somme des classes dépasse le net de ce montant.`);
  return notes;
}
function pocketNotesHTML(d, cls) {
  const n = pocketNotes(d);
  return n.length ? `<div class="t-sm ${cls || ''}">${n.map(esc).join('<br>')}</div>` : '';
}
function donutBlock(title, segs) {
  const legend=segs.map(s=>`<div class="legend-row legend-2l">
    <div class="leg-dot" style="background:${s.color}"></div>
    <div class="leg-txt"><div class="leg-line"><span class="leg-name">${esc(s.name)}</span><span class="leg-pct" style="color:${s.color}">${s.pct}%</span></div><div class="t-sm t-num">${masked(s.value)}</div></div>
  </div>`).join('');
  return `<div class="donut-block anim">
    ${donutSvg(segs,108,16)}
    <div class="legend">${legend}</div>
  </div>`;
}
