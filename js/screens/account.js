// Écran d un compte : hero, portefeuille, mouvements, tirer-pour-actualiser + binding.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

// ── ACCOUNT ──
const SORT_OPTS=[{key:'value',label:'Valeur'},{key:'pnl',label:'P&L €'},{key:'pnlPct',label:'P&L %'},{key:'name',label:'Nom'},{key:'type',label:'Type'}];
const SORT_DEFAULTS={value:-1,pnl:-1,pnlPct:-1,name:1,type:1};

// Montant d'un compte dans SA devise (si différente de la devise appli) ; v = montant en devise appli
function accNative(acc, v) {
  const ccy = acc.currency || S.currency;
  if (ccy === S.currency) return masked(v);
  return maskedNative(v * (FX_RATES[ccy] || 1) / (FX_RATES[S.currency] || 1), ccy);
}
// Bloc valeur du hero : devise du compte en gros, contre-valeur en devise appli dessous
function accHeroValHTML(acc) {
  if ((acc.currency || S.currency) === S.currency) return masked(acc.value);
  return `${accNative(acc, acc.value)}<div class="t-sm" style="font-size:13px;font-weight:600;margin-top:2px">≈ ${masked(acc.value)}</div>`;
}

// Mode d'affichage de la performance (mémorisé) : 'ytd' (depuis le 1er janvier) ou 'all' (historique)
function _perfModeGet() { try { return localStorage.getItem('accPerfMode') === 'all' ? 'all' : 'ytd'; } catch (e) { return 'ytd'; } }
function _perfModeSet(m) { try { localStorage.setItem('accPerfMode', m); } catch (e) {} }

// Performance d'un compte = valorisation actuelle − apports nets (apports − retraits saisis).
// Perf. annuelle moyenne = taux annuel équivalent sur les apports nets depuis la date de début du compte
// (acc.startDate, sinon date la plus ancienne parmi apports et mouvements) ; calculée seulement à partir d'un an.
// Approximation : si les apports sont répartis dans le temps, le taux réel est plus élevé. Renvoie null sans apport saisi.
function accPerfInfo(acc) {
  const cfs = acc.cashflows || [];
  if (!cfs.length) return null;
  const ccy = acc.currency || S.currency;
  const dep = cfs.filter(c => c.type === 'DEP').reduce((s, c) => s + c.amount, 0);
  const wit = cfs.filter(c => c.type === 'WIT').reduce((s, c) => s + c.amount, 0);
  const net = toRefCcy(dep - wit, ccy);
  if (!(net > 0)) return null;
  const gain = acc.value - net;
  const pct = gain / net * 100;
  let start = acc.startDate || null, auto = false;
  if (!start) {
    const ds = [...cfs.map(c => c.date), ...acc.holdings.flatMap(h => (h.transactions || []).map(t => t.date))].filter(Boolean).sort();
    start = ds[0] || null; auto = true;
  }
  let years = null, annual = null;
  if (start) {
    years = (Date.now() - new Date(start + 'T00:00:00').getTime()) / (365.25 * 86400000);
    if (years >= 1 && acc.value > 0) annual = (Math.pow(acc.value / net, 1 / years) - 1) * 100;
  }
  return { net, gain, pct, start, auto, years, annual };
}

// ── COMPARAISON À UN INDICE ──
// Indice choisi par compte (acc.benchmark : clé ci-dessous, '' = aucun ; absent = défaut selon le type de compte :
// Bitcoin pour un compte Crypto, CAC 40 pour un PEA, aucun sinon — le choix reste libre, ex. MSCI World pour un PEA).
// Cours via le proxy Yahoo, séries gardées dans l'historique local sous la clé 'IDX:<clé>'.
// MSCI World / ACWI sont suivis via les ETF iShares URTH / ACWI.
// Les indices cotés en USD sont convertis en euros avec l'historique EUR/USD (quand la devise appli est l'euro),
// sinon la comparaison mélangerait performance de l'indice et variation du dollar.
const BENCHMARKS = {
  SPX:   { label:'S&P 500',    sym:'^GSPC',   ccy:'USD' },
  WORLD: { label:'MSCI World', sym:'URTH',    ccy:'USD' },
  ACWI:  { label:'MSCI ACWI',  sym:'ACWI',    ccy:'USD' },
  CAC40: { label:'CAC 40',     sym:'^FCHI',   ccy:'EUR' },
  BTC:   { label:'Bitcoin',    sym:'BTC-USD', ccy:'USD' },
};
function accBenchmarkKey(acc) {
  if (acc.benchmark !== undefined) return acc.benchmark;
  const t = (acc.type || '').toLowerCase();
  if (/crypto/.test(t)) return 'BTC';
  if (/\bpea\b/.test(t)) return 'CAC40';
  return '';
}
const _benchTried = {};   // une tentative de téléchargement par indice et par session
function _benchNeedsFx(key) { const b = BENCHMARKS[key]; return !!b && b.ccy === 'USD' && S.currency === 'EUR'; }
function _histStale(id, startDay) {
  const h = getHistorySeries(id);
  if (!h) return true;
  if (Date.now() - h.fetchedAt > 12 * 3600 * 1000) return true;
  return !!startDay && new Date(h.series[0].d + 'T00:00:00').getTime() > new Date(startDay + 'T00:00:00').getTime() + 7 * 86400000;
}
function benchNeedsLoad(key, startDay) {
  if (!BENCHMARKS[key]) return false;
  return _histStale('IDX:' + key, startDay) || (_benchNeedsFx(key) && _histStale('IDX:EURUSD', startDay));
}
async function loadBenchmark(key, startDay) {
  const b = BENCHMARKS[key]; if (!b) return;
  const tag = key + '|' + (startDay || '');
  if (_benchTried[tag]) return;
  _benchTried[tag] = true;
  const years = startDay ? (Date.now() - new Date(startDay + 'T00:00:00').getTime()) / (365.25 * 86400000) : 1;
  const range = years <= 0.9 ? '1y' : years <= 1.9 ? '2y' : years <= 4.9 ? '5y' : years <= 9.9 ? '10y' : 'max';
  const jobs = [['IDX:' + key, b.sym]];
  if (_benchNeedsFx(key)) jobs.push(['IDX:EURUSD', 'EURUSD=X']);
  await Promise.all(jobs.map(async ([id, sym]) => {
    try {
      const s = await _fetchYahooHistory(sym, range);
      if (s && s.length >= 2) saveHistory(id, s, 'USD');
    } catch (e) { dbgLog('[ERR]', 'Indice ' + id + ' : ' + (e?.message || e)); }
  }));
  if (S.screen === 'account') renderScreen('account');
}
// Série de l'indice dans la devise appli : un indice en USD est divisé par EUR/USD du jour (dernier cours connu).
// Renvoie { series, conv } ou null si la série (ou le taux de change nécessaire) est absente.
function benchSeries(key) {
  const h = getHistorySeries('IDX:' + key);
  if (!h) return null;
  if (!_benchNeedsFx(key)) return { series: h.series, conv: false };
  const fx = getHistorySeries('IDX:EURUSD');
  if (!fx) return null;
  let j = 0, last = null;
  const out = [];
  h.series.forEach(p => {
    while (j < fx.series.length && fx.series[j].d <= p.d) { last = fx.series[j].c; j++; }
    const r = last != null ? last : fx.series[0].c;
    if (r > 0) out.push({ d: p.d, c: p.c / r });
  });
  return out.length >= 2 ? { series: out, conv: true } : null;
}
// Variation (%) de l'indice entre le dernier cours ≤ fromDay (ou le 1er point connu) et aujourd'hui
function benchRet(series, fromDay) {
  if (!series || series.length < 2) return null;
  let base = series[0];
  for (const p of series) { if (p.d <= fromDay) base = p; else break; }
  const last = series[series.length - 1];
  return base.c > 0 ? (last.c / base.c - 1) * 100 : null;
}
// Valeur du compte à une date passée (devise appli) : quantités détenues ce jour-là × clôture connue + liquidités.
// approx = true si un titre n'a pas d'historique de cours (le cours actuel est alors utilisé).
function accValueOnDay(acc, day) {
  let tot = 0, approx = false;
  acc.holdings.forEach(h => {
    const q = _qtyOnDay(h, day); if (q <= 0) return;
    const hist = getHistorySeries(h.ticker);
    let price = h.currentPrice, found = false;
    if (hist) {
      let c = null;
      for (const p of hist.series) { if (p.d <= day) c = p.c; else break; }
      if (c != null) { price = c; found = true; }
    }
    if (!found) approx = true;
    tot += toRefCcy(q * price, h.currency);
  });
  tot += accCash(acc, day);
  return { v: tot, approx };
}
// Performance pondérée des flux (Dietz modifié) depuis t0Day : gain = V1 − V0 − flux ; % = gain / (V0 + flux pondérés par leur ancienneté).
// Les régularisations de liquidités sont des apports/retraits : elles ne comptent pas comme un gain.
function accPerfPeriod(acc, t0Day, v0, inclusive) {
  const ccy = acc.currency || S.currency, T = Date.now(), t0 = new Date(t0Day + 'T00:00:00').getTime();
  if (!(T > t0)) return null;
  let F = 0, W = 0;
  (acc.cashflows || []).forEach(c => {
    if (!c.date || c.date > _dayKey(T) || !['DEP', 'WIT'].includes(c.type) || (inclusive ? c.date < t0Day : c.date <= t0Day)) return;
    const a = (c.type === 'WIT' ? -1 : 1) * toRefCcy(c.amount, ccy);
    const t = new Date(c.date + 'T00:00:00').getTime();
    F += a; W += a * Math.max(0, (T - t) / (T - t0));
  });
  const denom = v0 + W;
  if (!(denom > 0)) return null;
  const gain = acc.value - v0 - F;
  return { pct: gain / denom * 100, gain };
}
// Résumé de performance : YTD (depuis le 31 décembre précédent) et historique (depuis le début du compte).
// Si le compte est plus récent que l'année, le YTD est l'historique. approx = historique de cours incomplet pour le YTD.
function accPerfSummary(acc, perf) {
  if (!perf) return null;
  const cfDates = (acc.cashflows || []).map(c => c.date).filter(Boolean).sort();
  const t0 = perf.start && cfDates[0] ? (perf.start < cfDates[0] ? perf.start : cfDates[0]) : (perf.start || cfDates[0]);
  if (!t0) return null;
  const pye = (new Date().getFullYear() - 1) + '-12-31';
  const all = accPerfPeriod(acc, t0, 0, true);
  if (!all) return null;
  let ytd = all, approx = false;
  if (t0 <= pye) {
    const v0 = accValueOnDay(acc, pye); approx = v0.approx;
    ytd = accPerfPeriod(acc, pye, v0.v, false);
  }
  return { t0, pye, all, ytd, approx };
}
function _bmRow(lbl, a, r, name) {
  const A = a == null ? '—' : fmtPct(a), R = r == null ? '—' : fmtPct(r);
  const d = (a == null || r == null) ? null : a - r;
  return `<div style='display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--border);font-size:12px'><span style='font-weight:700'>${lbl}</span><span style='text-align:right'>Compte <b class='${a != null && a < 0 ? 't-loss' : 't-gain'}'>${A}</b> · ${esc(name)} <b class='${r != null && r < 0 ? 't-loss' : 't-gain'}'>${R}</b>${d == null ? '' : ` · écart <b class='${d < 0 ? 't-loss' : 't-gain'}'>${d >= 0 ? '+' : ''}${d.toFixed(1)} pts</b>`}</span></div>`;
}
function accBenchHTML(acc, perf, sum) {
  const key = accBenchmarkKey(acc), b = BENCHMARKS[key];
  const chip = `<span id='js-bm-btn' class='tap' style='padding:3px 10px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer'>${b ? 'Indice : ' + esc(b.label) : 'Comparer à un indice'}</span>`;
  if (!b) return `<div class='t-sm' style='margin-top:8px'>${chip}</div>`;
  if (!perf || !sum) return `<div class='t-sm' style='margin-top:8px'>${chip} · Ajoute un apport ou régularise les liquidités pour comparer</div>`;
  const ser = benchSeries(key);
  if (!ser) {
    const tried = _benchTried[key + '|' + (perf.start || '')];
    return `<div class='t-sm' style='margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap'>${chip}<span>${tried ? 'indice indisponible pour le moment' : 'chargement de l\'indice…'}</span></div>`;
  }
  const bAll = benchRet(ser.series, sum.t0);
  const bYtd = sum.t0 > sum.pye ? bAll : benchRet(ser.series, sum.pye);
  const ccyNote = ser.conv ? 'indice converti en euros' : (b.ccy === 'USD' ? 'indice en dollars (non converti)' : 'indice dans sa devise');
  return `<div style='margin-top:8px'>
    <div class='t-sm' style='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px'>${chip}</div>
    ${_bmRow('YTD', sum.ytd ? sum.ytd.pct : null, bYtd, b.label)}
    ${_bmRow('Depuis le début', sum.all.pct, bAll, b.label)}
    <div class='t-sm' style='font-size:10px;margin-top:4px'>Perf. du compte pondérée des apports et retraits${sum.approx ? ' · YTD approximatif (historique de cours incomplet)' : ''} · ${ccyNote}.</div>
  </div>`;
}

function renderAccount() {
  const acc=S.accounts.find(a=>a.id===S.accountId); if(!acc) return '';
  _movesAll=false; // le relevé repart replié à chaque ouverture de l'écran
  const totPnl=acc.holdings.reduce((s,h)=>s+(h.pnlRef??h.pnl??0),0);
  const secVal=accSum(acc.holdings);          // positions seules (devise appli)
  const cash=accCash(acc);                    // liquidités (devise appli)
  const costBase=secVal-totPnl;
  const totPnlPct=costBase>0?(totPnl/costBase)*100:0;
  const perf=accPerfInfo(acc);
  const sum=accPerfSummary(acc,perf);
  const mode=_perfModeGet();
  const cur=sum?(mode==='all'?sum.all:sum.ytd):null;
  const pills=SORT_OPTS.map(o=>{
    const on=S.sort===o.key;
    const arrow=on?(S.sortDir===-1?' ↓':' ↑'):'';
    return `<div class="sort-pill${on?' on':''}" data-sort="${o.key}" data-label="${o.label}">${o.label}${arrow}</div>`;
  }).join('');
  const adj=PU.accCashAnchor(acc);             // dernière régularisation des liquidités
  const chipStyle='padding:6px 14px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer';
  const smallChip='padding:3px 10px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer';
  const modeBtn=(k,l)=>`<span data-pm="${k}" class="tap" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;${mode===k?'background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.18)':'color:var(--text2)'}">${l}</span>`;
  let perfCard;
  if(cur){
    const sub=mode==='all'
      ? `Depuis le ${fmtDate(sum.t0)}${perf&&perf.annual!=null?' · '+fmtPct(perf.annual)+' / an':''} <span id="js-start-btn" class="tap" style="${smallChip};margin-left:6px">Date de début</span>`
      : `Depuis le 1er janvier${sum.approx?' · approximatif (historique de cours incomplet)':''}`;
    perfCard=`<div style="margin-top:12px;padding:12px 14px;border-radius:14px;background:var(--card2)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div class="t-label">Performance ${mode==='all'?'historique':'YTD'}</div>
        <div style="display:flex;gap:2px;padding:2px;border-radius:20px;background:rgba(127,127,127,.15)">${modeBtn('ytd','YTD')}${modeBtn('all','Historique')}</div>
      </div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-top:6px;flex-wrap:wrap">
        <div style="font-size:26px;font-weight:800" class="${cur.pct>=0?'t-gain':'t-loss'} t-num">${fmtPct(cur.pct)}</div>
        <div style="font-size:14px;font-weight:700" class="${cur.gain>=0?'t-gain':'t-loss'} t-num">${cur.gain>=0?'+':''}${accNative(acc,cur.gain)}</div>
      </div>
      <div class="t-sm" style="margin-top:4px">${sub}</div>
    </div>`;
  } else {
    perfCard=`<div style="margin-top:12px;padding:12px 14px;border-radius:14px;background:var(--card2)">
      <div class="t-label">P&amp;L des positions</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-top:6px;flex-wrap:wrap">
        <div style="font-size:26px;font-weight:800" class="${totPnlPct>=0?'t-gain':'t-loss'} t-num">${fmtPct(totPnlPct)}</div>
        <div style="font-size:14px;font-weight:700" class="${totPnl>=0?'t-gain':'t-loss'} t-num">${totPnl>=0?'+':''}${accNative(acc,totPnl)}</div>
      </div>
      <div class="t-sm" style="margin-top:4px">Ajoute un apport ou régularise les liquidités pour calculer la performance du compte.</div>
    </div>`;
  }
  return `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Retour
  </div>
  <div class="acc-hero">
    <div class="row gap10" style="margin-bottom:6px;align-items:center">
      <div style="font-size:26px">${iconHtml(acc.icon)}</div>
      <div class="col" style="gap:2px;flex:1;min-width:0">
        <div style="font-size:20px;font-weight:800;letter-spacing:-.5px">${esc(acc.name)}${acc.observer?` <span class="obs-tag" style="font-size:10px;vertical-align:middle">Obs.</span>`:''}</div>
        <div class="t-sm">${esc(acc.type||'')}${acc.bank?' · '+esc(acc.bank):''}</div>
      </div>
    </div>
    <div class="acc-hero-val t-num" id="js-acc-val">${accHeroValHTML(acc)}</div>
    <div class="t-sm" style="margin-top:6px;display:flex;gap:16px;flex-wrap:wrap"><span>Liquidités <b class="t-num">${accNative(acc,cash)}</b></span><span>Positions <b class="t-num">${accNative(acc,secVal)}</b></span></div>
    ${perfCard}
    ${accBenchHTML(acc,perf,sum)}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      <div id="js-cf-btn" class="tap" style="${chipStyle}">Apports / Retraits</div>
      <div id="js-ca-btn" class="tap" style="${chipStyle}">Régulariser les liquidités</div>
      ${adj?`<span class="t-sm">régularisé le ${fmtDate(adj.date)}</span>`:''}
    </div>
    ${cash<0?`<div class="t-sm" style="margin-top:8px;color:var(--loss)">Liquidités négatives : vos achats dépassent les apports saisis. Régularisez les liquidités ou ajoutez l'apport manquant.</div>`:''}
  </div>
  <div class="search-wrap">
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      <input type="text" id="js-search" placeholder="Rechercher une valeur…" value="${esc(S.search)}" autocomplete="off" spellcheck="false">
      ${S.search?`<div class="search-clear" id="js-clr">✕</div>`:''}
    </div>
  </div>
  <div class="sort-row">${pills}</div>
  <div class="ptr-bar" id="js-ptr">↓ Tirez pour actualiser</div>
  <div class="row" style="padding:12px 20px 6px;justify-content:space-between;align-items:center">
    <div class="t-section">Portefeuille</div>
    <div class="row gap8" style="align-items:center">
      <div id="js-hcnt" style="font-size:12px;font-weight:600;color:var(--text2)"></div>
      <div class="hold-add-btn" id="js-add-hold" title="Ajouter une position">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </div>
    </div>
  </div>
  <div id="js-holds"></div>
  <div class="row" style="padding:20px 20px 6px;justify-content:space-between;align-items:center">
    <div class="t-section">Mouvements</div>
    <div class="row gap8" style="align-items:center">
      <div id="js-mcnt" style="font-size:12px;font-weight:600;color:var(--text2)"></div>
      <div class="hold-add-btn" id="js-add-move" title="Ajouter un apport / retrait">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      </div>
    </div>
  </div>
  <div id="js-moves"></div>`;
}

// ── HOLDS HELPERS ──
function getFilteredHoldings(acc) {
  let hs=[...acc.holdings];
  if(S.search){const q=S.search.toLowerCase();hs=hs.filter(h=>h.name.toLowerCase().includes(q)||h.ticker.toLowerCase().includes(q));}
  hs.sort((a,b)=>{
    if(S.sort==='name'||S.sort==='type') return S.sortDir*a[S.sort].localeCompare(b[S.sort]);
    return S.sortDir*(a[S.sort]-b[S.sort]);
  });
  return hs;
}

function renderHoldsHTML(acc) {
  const el=document.getElementById('js-holds'); if(!el) return;
  const cnt=document.getElementById('js-hcnt');
  const hs=getFilteredHoldings(acc);
  if(cnt) cnt.textContent=`${hs.length} valeur${hs.length!==1?'s':''}`;
  if(!hs.length){el.innerHTML=`<div style="text-align:center;padding:30px 20px;color:var(--text2);font-size:14px">Aucun résultat</div>`;renderMovesHTML(acc);return;}
  el.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">`+
    hs.map(h=>{
      const watched = !!S.watchlist.find(w => w.ticker === h.ticker);
      const weight  = acc.value > 0 ? ((h.valueRef ?? h.value) / acc.value * 100).toFixed(1) : '0';
      const stale   = priceStale(h);   // cours trop ancien (voir js/services/prices.js)
      return `
      <div class="hold-item" data-hid="${h.id}">
        <div class="ticker" style="margin-top:2px">${h.ticker.slice(0,4)}</div>
        <div class="hold-item-body">
          <div class="hold-item-top">
            <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(h.name)}</div>
            <div class="col right" style="gap:1px;flex-shrink:0">
              <div style="font-size:14px;font-weight:800" class="t-num">${masked(h.valueRef??h.value)}</div>
              <div style="font-size:10px;color:var(--text3);text-align:right">${weight}%</div>
            </div>
          </div>
          <div class="hold-item-bot">
            <div class="t-sm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${stale?';color:var(--loss);font-weight:700':''}"${stale?` title="Cours non synchronisé (${esc(_ageLabel(h.priceAt))})"`:''}>${h.quantity} × ${fmtNative(h.currentPrice, h.currency||'EUR')} · ${h.type}${stale?' · ⚠ cours obsolète':''}</div>
            <div style="font-size:12px;font-weight:700;flex-shrink:0" class="${h.pnl>=0?'t-gain':'t-loss'}">${fmtPct(h.pnlPct)}</div>
            <div class="hold-watch-btn" data-watch-hid="${h.id}" style="width:26px;height:26px;border-radius:7px;background:${watched?'rgba(245,158,11,.15)':'var(--card2)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:background .12s">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${watched?'#F59E0B':'none'}" stroke="${watched?'#F59E0B':'var(--text3)'}" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div class="hold-add-btn" data-add="${h.id}" style="width:26px;height:26px;border-radius:7px">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </div>
            <div class="hold-del-btn" data-del="${h.id}" style="width:26px;height:26px;border-radius:7px">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </div>
          </div>
        </div>
      </div>`;
    }).join('')+
  `</div>`;
  // Navigate on row click (excluding action buttons)
  el.querySelectorAll('.hold-item').forEach(item=>{
    item.addEventListener('click',e=>{
      if(e.target.closest('.hold-del-btn')||e.target.closest('.hold-add-btn')||e.target.closest('.hold-watch-btn')) return;
      S.holdingId=item.dataset.hid; go('stock');
    });
  });
  // Étoile : toggle watchlist
  el.querySelectorAll('.hold-watch-btn').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const h = acc.holdings.find(h => h.id === b.dataset.watchHid);
    if (!h) return;
    const idx = S.watchlist.findIndex(w => w.ticker === h.ticker);
    haptic(idx >= 0 ? 6 : 12);
    if (idx >= 0) {
      S.watchlist.splice(idx, 1);
      toast(`${h.ticker} retiré des favoris`);
    } else {
      S.watchlist.push({ ticker: h.ticker, name: h.name, price: h.currentPrice, change1d: acc.change1d || 0, currency: h.currency || 'EUR' });
      toast(`${h.ticker} ajouté aux favoris ⭐`);
      // Animation pop sur le bouton étoile
      const starBtn = b.closest('.hold-watch-btn') || b;
      starBtn.classList.remove('star-pop');
      void starBtn.offsetWidth;
      starBtn.classList.add('star-pop');
    }
    saveAccounts();
    refreshMain();
    renderHoldsHTML(acc);
  }));
  el.querySelectorAll('.hold-add-btn[data-add]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    openAddOrder(S.accountId, b.dataset.add);
  }));
  el.querySelectorAll('.hold-del-btn').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    deleteHolding(S.accountId,b.dataset.del);
  }));
  renderMovesHTML(acc); // le relevé suit toujours l'état des positions
}

// ── MOUVEMENTS DU COMPTE ──
// Relevé unifié : ordres sur titres (achat/vente/dividende) + apports/retraits,
// tous comptes de dates confondus, du plus récent au plus ancien.
const MOVES_PAGE = 15;
let _movesAll = false;

function getAccountMoves(acc) {
  const mv = [];
  (acc.holdings||[]).forEach(h => {
    (h.transactions||[]).forEach((tx, idx) => {
      mv.push({
        date: tx.date, kind: tx.type, holdId: h.id, txIdx: idx,
        label: h.name || h.ticker, ticker: h.ticker,
        detail: `${tx.qty} × ${fmtNative(tx.price, h.currency||'EUR')}`,
        amount: (+tx.qty||0)*(+tx.price||0), ccy: h.currency||'EUR',
      });
    });
  });
  (acc.cashflows||[]).forEach(c => {
    mv.push({
      date: c.date, kind: c.type, cfId: c.id,
      label: c.type==='WIT' ? 'Retrait' : 'Apport',
      detail: c.note || '', amount: +c.amount||0, ccy: acc.currency||S.currency,
    });
  });
  mv.sort((a,b) => b.date.localeCompare(a.date)); // du plus récent au plus ancien
  if (!S.search) return mv;
  const q = S.search.toLowerCase();
  return mv.filter(m => (m.label||'').toLowerCase().includes(q)
                     || (m.ticker||'').toLowerCase().includes(q)
                     || (m.detail||'').toLowerCase().includes(q));
}

const MOVE_STYLE = {
  BUY:  { dot:'ACH', cls:'buy',  type:'Achat',      sign:'−', val:'t-loss' },
  SELL: { dot:'VTE', cls:'sell', type:'Vente',      sign:'+', val:'t-gain' },
  DIV:  { dot:'DIV', cls:'div',  type:'Dividende',  sign:'+', val:'t-gain' },
  DEP:  { dot:'AP',  cls:'buy',  type:'Apport',     sign:'+', val:'t-gain' },
  WIT:  { dot:'RE',  cls:'sell', type:'Retrait',    sign:'−', val:'t-loss' },
};

function renderMovesHTML(acc) {
  const el=document.getElementById('js-moves'); if(!el) return;
  const all=getAccountMoves(acc);
  const cnt=document.getElementById('js-mcnt');
  if(cnt) cnt.textContent=`${all.length} mouvement${all.length!==1?'s':''}`;
  if(!all.length){
    el.innerHTML=`<div style="text-align:center;padding:26px 20px;color:var(--text2);font-size:13px">
      ${S.search?'Aucun mouvement pour cette recherche':'Aucun mouvement — ajoutez un apport ou passez un ordre'}
    </div>`;
    return;
  }
  const shown=_movesAll?all:all.slice(0,MOVES_PAGE);
  el.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">`+
    shown.map(m=>{
      const st=MOVE_STYLE[m.kind]||MOVE_STYLE.BUY;
      const nav=m.holdId?`data-mvhold="${esc(m.holdId)}"`:`data-mvcf="1"`;
      return `<div class="tx-item tap" ${nav} style="cursor:pointer">
        <div class="tx-dot ${st.cls}">${st.dot}</div>
        <div class="flex1 col gap4" style="min-width:0">
          <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.label)}</div>
          <div class="t-sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fmtDate(m.date)}${m.detail?' · '+esc(m.detail):''}</div>
        </div>
        <div class="col right gap4" style="flex-shrink:0">
          <div style="font-size:13px;font-weight:800" class="${st.val} t-num">${st.sign}${maskedNative(m.amount,m.ccy)}</div>
          <div class="t-sm">${st.type}</div>
        </div>
      </div>`;
    }).join('')+
  `</div>`+
  (all.length>MOVES_PAGE?`<div class="row" style="justify-content:center;padding:12px 20px 0">
    <div class="tap" id="js-moves-more" style="padding:6px 16px;border-radius:20px;border:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text2);cursor:pointer">${_movesAll?'Réduire':`Voir les ${all.length} mouvements`}</div>
  </div>`:'');
  // Un ordre renvoie vers l'écran du titre, un apport/retrait ouvre la fenêtre de saisie
  el.querySelectorAll('[data-mvhold]').forEach(r=>r.addEventListener('click',()=>{
    S.holdingId=r.dataset.mvhold; go('stock');
  }));
  el.querySelectorAll('[data-mvcf]').forEach(r=>r.addEventListener('click',()=>openCfModal(acc.id)));
  el.querySelector('#js-moves-more')?.addEventListener('click',()=>{
    _movesAll=!_movesAll;
    renderMovesHTML(acc);
  });
}


function deleteHolding(accId,holdId) {
  const acc=S.accounts.find(a=>a.id===accId); if(!acc) return;
  const h=acc.holdings.find(h=>h.id===holdId);
  if(!h) return;
  openConfirm(`Supprimer ${h.name} ?`, ()=>{
    acc.holdings=acc.holdings.filter(h=>h.id!==holdId);
    acc.value=accTotal(acc);
    renderHoldsHTML(acc);
    refreshMain();
    toast('Position supprimée');
  });
}

function applyRefresh(accId) {
  S._histCache={};
  // Refresh watchlist prices
  S.watchlist.forEach(w=>{
    const chg=(Math.random()*.03-.01);
    w.price=+(w.price*(1+chg)).toFixed(2);
    w.change1d=+((Math.random()*4-1.5).toFixed(2));
  });
  const accs=accId?[S.accounts.find(a=>a.id===accId)]:S.accounts;
  accs.filter(Boolean).forEach(acc=>{
    acc.holdings.forEach(h=>{
      const chg=(Math.random()*.028-.006);
      h.currentPrice=+(h.currentPrice*(1+chg)).toFixed(2);
      h.value=+(h.quantity*h.currentPrice).toFixed(2);
      h.valueRef=+toRefCcy(h.value,h.currency).toFixed(2);
      h.pnl=(h.currentPrice-h.avgBuyPrice)*h.quantity;
      h.pnlRef=+toRefCcy(h.pnl,h.currency).toFixed(2);
      h.pnlPct=h.avgBuyPrice>0?((h.currentPrice-h.avgBuyPrice)/h.avgBuyPrice)*100:0;
    });
    acc.value=accTotal(acc);
    acc.change1d=+(Math.random()*4-1).toFixed(2);
  });
}

function initPTR(screenEl, onRefresh) {
  // Le callback est rafraîchi à chaque render (closure fraîche), mais les listeners ne sont
  // attachés qu'une fois : l'élément écran persiste et les ré-attacher les empilait (double refresh,
  // rendu des positions de l'ancien compte).
  screenEl._ptrRefresh = onRefresh;
  if (screenEl._ptrBound) return;
  screenEl._ptrBound = true;
  let y0=0,pulling=false,dist=0,armed=false;
  const bar=()=>screenEl.querySelector('#js-ptr'); // re-query : le bar est recréé à chaque render
  screenEl.addEventListener('touchstart',e=>{
    // `armed` doit être réévalué à CHAQUE geste : sans lui, un geste ignoré laissait
    // y0 obsolète et le touchmove suivant pouvait déclencher un tirage fantôme.
    // .acc-card = surface de glisser-déposer (réordonnancement) : elle n'arme jamais le
    // pull-to-refresh, sinon amorcer un déplacement déclenche une actualisation.
    armed=false; pulling=false; dist=0;
    if(!bar()||e.target.closest('.hold-item')||e.target.closest('.acc-card')) return;
    if(screenEl.scrollTop===0){y0=e.touches[0].clientY;armed=true;}
  },{passive:true});
  screenEl.addEventListener('touchmove',e=>{
    const b=bar(); if(!b||!armed||screenEl.scrollTop>2) return;
    if(_drag?.active){   // une carte vient de décoller : on annule un tirage en cours
      if(pulling){pulling=false;dist=0;b.classList.remove('open');}
      return;
    }
    const dy=e.touches[0].clientY-y0;
    if(dy>12){pulling=true;dist=dy;b.classList.add('open');b.textContent=dy>60?'↑ Relâchez pour actualiser':'↓ Tirez pour actualiser';}
  },{passive:true});
  screenEl.addEventListener('touchend',()=>{
    const b=bar(); if(!b||!pulling) return;
    if(dist>60){
      b.innerHTML='<span class="ptr-spin">↻</span> Actualisation…';
      setTimeout(()=>{screenEl._ptrRefresh();b.classList.remove('open');},900);
    } else {b.classList.remove('open');}
    pulling=false; dist=0;
  },{passive:true});
}


// ── Date de début du compte (sert à la perf. annuelle moyenne) ──
let _startAccId=null;
(function(){
  document.body.insertAdjacentHTML('beforeend',`
<div id='start-bg' class='add-modal-bg'></div>
<div id='start-sheet' class='add-modal-sheet'>
  <div class='modal-drag'></div>
  <div class='modal-body'>
    <div class='modal-title' style='margin-bottom:6px'>Date de début du compte</div>
    <div class='t-sm' style='margin-bottom:14px'>Sert à calculer la performance annuelle moyenne. Choisis « Automatique » pour utiliser la date du premier apport ou mouvement.</div>
    <div class='form-row'><div class='form-field'><div class='form-label'>Date</div><input class='form-input' type='date' id='start-date'></div></div>
    <div style='display:flex;gap:10px;margin-top:6px'>
      <button class='confirm-cancel' id='start-clear' style='flex:1;height:46px;border-radius:12px;font-weight:700;cursor:pointer'>Automatique</button>
      <button class='form-submit' id='start-ok' style='flex:2;height:46px;margin:0'>Enregistrer</button>
    </div>
  </div>
</div>`);
})();
function openStartDate(acc){
  _startAccId=acc.id;
  document.getElementById('start-date').value=acc.startDate||'';
  document.getElementById('start-bg').classList.add('show');
  document.getElementById('start-sheet').classList.add('show');
}
function closeStartDate(){
  document.getElementById('start-bg').classList.remove('show');
  document.getElementById('start-sheet').classList.remove('show');
}
function _saveStartDate(value){
  const acc=S.accounts.find(a=>a.id===_startAccId); if(!acc) return;
  if(value && value>_dayKey(Date.now())){ toast('La date ne peut pas être dans le futur'); return; }
  if(value) acc.startDate=value; else delete acc.startDate;
  saveAccounts();
  closeStartDate();
  if(S.screen==='account') renderScreen('account');
  toast(value?'Date de début enregistrée ✓':'Date de début automatique');
}
document.getElementById('start-bg').addEventListener('click',closeStartDate);
document.getElementById('start-ok').addEventListener('click',()=>_saveStartDate(document.getElementById('start-date').value));
document.getElementById('start-clear').addEventListener('click',()=>_saveStartDate(''));
registerModal('start-sheet', closeStartDate);

// ── Choix de l'indice de comparaison du compte ──
let _bmAccId=null;
(function(){
  const opts=Object.entries(BENCHMARKS).map(([k,b])=>`<option value='${k}'>${b.label}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend',`
<div id='bm-bg' class='add-modal-bg'></div>
<div id='bm-sheet' class='add-modal-sheet'>
  <div class='modal-drag'></div>
  <div class='modal-body'>
    <div class='modal-title' style='margin-bottom:6px'>Indice de comparaison</div>
    <div class='t-sm' style='margin-bottom:14px'>Choix libre pour chaque compte (un PEA peut se comparer au MSCI World, par exemple). Par défaut : Bitcoin pour un compte Crypto, CAC 40 pour un PEA, aucun pour les autres. MSCI World et MSCI ACWI sont suivis via les ETF iShares URTH et ACWI ; les indices en dollars sont convertis en euros.</div>
    <div class='form-row'><div class='form-field'><div class='form-label'>Indice</div>
      <select class='form-input' id='bm-select' style='cursor:pointer'><option value='auto'>Par défaut (selon le type de compte)</option><option value=''>Aucun</option>${opts}</select></div></div>
    <button class='form-submit' id='bm-ok'>Enregistrer</button>
  </div>
</div>`);
})();
function openBenchSheet(acc){
  _bmAccId=acc.id;
  document.getElementById('bm-select').value=acc.benchmark===undefined?'auto':acc.benchmark;
  document.getElementById('bm-bg').classList.add('show');
  document.getElementById('bm-sheet').classList.add('show');
}
function closeBenchSheet(){
  document.getElementById('bm-bg').classList.remove('show');
  document.getElementById('bm-sheet').classList.remove('show');
}
document.getElementById('bm-bg').addEventListener('click',closeBenchSheet);
document.getElementById('bm-ok').addEventListener('click',()=>{
  const acc=S.accounts.find(a=>a.id===_bmAccId); if(!acc) return;
  const v=document.getElementById('bm-select').value;
  if(v==='auto') delete acc.benchmark; else acc.benchmark=v;
  saveAccounts();
  closeBenchSheet();
  if(S.screen==='account') renderScreen('account');
  toast('Indice de comparaison enregistré ✓');
});
registerModal('bm-sheet', closeBenchSheet);

// ── Régularisation des liquidités : une devise, un montant ──
// acc.cashAdjust = [{ id, date, balances:{DEVISE:montant}, nature:'cash' }] ; voir PU.accCash dans utils.js.
// L'écart avec le calcul est enregistré comme apport/retrait « Régularisation des liquidités » daté du jour (repéré par adjId) :
// la valeur du compte devient liquidités + positions, sans que l'écart compte comme un gain.
let _caAccId=null;
const CASH_CCYS=['EUR','USD','GBP','CHF','JPY'];
(function(){
  const opts=CASH_CCYS.map(c=>`<option value='${c}'>${c}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend',`
<div id='ca-bg' class='add-modal-bg'></div>
<div id='ca-sheet' class='add-modal-sheet'>
  <div class='modal-drag'></div>
  <div class='modal-body' style='max-height:85vh;overflow-y:auto'>
    <div class='modal-title' style='margin-bottom:6px'>Régulariser les liquidités</div>
    <div class='t-sm' style='margin-bottom:12px'>Saisis le montant réel des liquidités du compte. La valeur du compte devient liquidités + positions. L'écart est enregistré comme mouvement « Régularisation des liquidités » et ne compte pas comme un gain.</div>
    <div class='form-row'>
      <div class='form-field' style='flex:1'><div class='form-label'>Devise</div><select class='form-input' id='ca-ccy' style='cursor:pointer'>${opts}</select></div>
      <div class='form-field' style='flex:2'><div class='form-label'>Montant des liquidités</div><input class='form-input' type='number' step='0.01' inputmode='decimal' id='ca-amount' placeholder='0'></div>
    </div>
    <div class='t-sm' id='ca-sum' style='margin:6px 0 12px'></div>
    <button class='form-submit' id='ca-ok'>Enregistrer</button>
    <div id='ca-list' style='margin-top:14px'></div>
  </div>
</div>`);
})();
function _caRest(acc,d){
  const ids=(acc.cashAdjust||[]).filter(a=>a.date===d).map(a=>a.id);
  return {...acc,
    cashAdjust:(acc.cashAdjust||[]).filter(a=>a.date!==d),
    cashflows:(acc.cashflows||[]).filter(c=>!ids.includes(c.adjId))};
}
// Liquidités actuelles (hors régularisation du jour), converties dans la devise choisie
function _caCurrentIn(acc,ccy){
  const d=_dayKey(Date.now());
  return +(accCash(_caRest(acc,d),d)*(FX_RATES[ccy]||1)/(FX_RATES[S.currency]||1)).toFixed(2);
}
function _caUpdate(){
  const acc=S.accounts.find(a=>a.id===_caAccId); if(!acc) return;
  const d=_dayKey(Date.now()), ccy=document.getElementById('ca-ccy').value;
  const v=parseFloat(document.getElementById('ca-amount').value);
  const before=accCash(_caRest(acc,d),d);
  const el=document.getElementById('ca-sum');
  if(!Number.isFinite(v)){ el.innerHTML=`Liquidités actuelles : <b>${fmtCur(before)}</b>`; return; }
  const total=toRefCcy(v,ccy), diff=total-before;
  el.innerHTML=`Liquidités : ${fmtCur(before)} → <b>${fmtCur(total)}</b> (écart ${diff>=0?'+':''}${fmtCur(diff)})<br>Valeur du compte : <b>${fmtCur(accSum(acc.holdings)+total)}</b>`;
}
function _caList(acc){
  const el=document.getElementById('ca-list');
  const list=(acc.cashAdjust||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  if(!list.length){ el.innerHTML=''; return; }
  el.innerHTML=`<div class='t-label' style='margin-bottom:6px'>Régularisations enregistrées</div>`+list.map(a=>{
    const txt=Object.entries(a.balances||{}).map(([c,v])=>fmtNative(v,c)).join(' · ')||'0';
    return `<div style='display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--border);font-size:12px'><span style='flex:1'><b>${fmtDate(a.date)}</b> · ${esc(txt)}</span><span class='tap' data-ca-del='${esc(a.id)}' style='padding:3px 10px;border-radius:20px;border:1px solid var(--border);font-weight:700;cursor:pointer'>Supprimer</span></div>`;
  }).join('');
  el.querySelectorAll('[data-ca-del]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.caDel;
    acc.cashAdjust=(acc.cashAdjust||[]).filter(a=>a.id!==id);
    acc.cashflows=(acc.cashflows||[]).filter(c=>c.adjId!==id);
    if(!acc.cashAdjust.length) delete acc.cashAdjust;
    acc.value=accTotal(acc);
    saveAccounts(); refreshMain();
    _caList(acc); _caUpdate();
    if(S.screen==='account') renderScreen('account');
    toast('Régularisation supprimée');
  }));
}
function openCashAdjust(acc){
  _caAccId=acc.id;
  const ccy=CASH_CCYS.includes(acc.currency)?acc.currency:S.currency;
  document.getElementById('ca-ccy').value=ccy;
  document.getElementById('ca-amount').value=_caCurrentIn(acc,ccy);
  _caList(acc); _caUpdate();
  document.getElementById('ca-bg').classList.add('show');
  document.getElementById('ca-sheet').classList.add('show');
}
function closeCashAdjust(){
  document.getElementById('ca-bg').classList.remove('show');
  document.getElementById('ca-sheet').classList.remove('show');
}
document.getElementById('ca-bg').addEventListener('click',closeCashAdjust);
document.getElementById('ca-ccy').addEventListener('change',()=>{
  const acc=S.accounts.find(a=>a.id===_caAccId); if(!acc) return;
  document.getElementById('ca-amount').value=_caCurrentIn(acc,document.getElementById('ca-ccy').value);
  _caUpdate();
});
document.getElementById('ca-amount').addEventListener('input',_caUpdate);
document.getElementById('ca-ok').addEventListener('click',()=>{
  const acc=S.accounts.find(a=>a.id===_caAccId); if(!acc) return;
  const v=parseFloat(document.getElementById('ca-amount').value);
  if(!Number.isFinite(v)){ toast('Indique le montant des liquidités'); return; }
  const ccy=document.getElementById('ca-ccy').value, d=_dayKey(Date.now());
  const rest=_caRest(acc,d);
  const diff=toRefCcy(v,ccy)-accCash(rest,d);
  acc.cashAdjust=rest.cashAdjust;
  acc.cashflows=rest.cashflows;
  const adjId='ca'+Date.now().toString(36);
  acc.cashAdjust.push({id:adjId,date:d,balances:{[ccy]:v},nature:'cash'});
  if(Math.abs(diff)>=0.005){
    const accCcy=acc.currency||S.currency;
    const amt=Math.abs(diff)*(FX_RATES[accCcy]||1)/(FX_RATES[S.currency]||1);
    acc.cashflows.push({id:'cf'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:diff>0?'DEP':'WIT',amount:+amt.toFixed(2),date:d,note:'Régularisation des liquidités',adjId});
  }
  acc.value=accTotal(acc);
  saveAccounts();
  refreshMain();
  if(typeof snapshotWealth==='function') snapshotWealth();
  closeCashAdjust();
  if(S.screen==='account') renderScreen('account');
  toast('Liquidités régularisées ✓');
});
registerModal('ca-sheet', closeCashAdjust);


SCREEN_BIND.account = function (el, id) {
    const acc=S.accounts.find(a=>a.id===S.accountId);
    el.querySelector('#js-back')?.addEventListener('click',back);

    if(acc) renderHoldsHTML(acc);

    el.querySelector('#js-add-hold')?.addEventListener('click',()=>openPosModal(S.accountId));

    // Cashflows button
    el.querySelector('#js-cf-btn')?.addEventListener('click',()=>openCfModal(S.accountId));
    el.querySelector('#js-add-move')?.addEventListener('click',()=>openCfModal(S.accountId));
    el.querySelector('#js-start-btn')?.addEventListener('click',()=>{ if(acc) openStartDate(acc); });
    el.querySelector('#js-bm-btn')?.addEventListener('click',()=>{ if(acc) openBenchSheet(acc); });
    el.querySelector('#js-ca-btn')?.addEventListener('click',()=>{ if(acc) openCashAdjust(acc); });
    el.querySelectorAll('[data-pm]').forEach(b=>b.addEventListener('click',()=>{
      _perfModeSet(b.dataset.pm);
      renderScreen('account');
    }));

    // Indice de comparaison : téléchargement de la série si absente ou périmée
    if(acc && !S.isDemo){
      const p=accPerfInfo(acc), key=accBenchmarkKey(acc);
      if(p && key && benchNeedsLoad(key,p.start)) loadBenchmark(key,p.start);
    }

    // Search
    el.querySelector('#js-search')?.addEventListener('input',e=>{
      S.search=e.target.value;
      const sb=el.querySelector('.search-box');
      let clr=sb.querySelector('.search-clear');
      if(S.search&&!clr){
        clr=document.createElement('div');clr.className='search-clear';clr.id='js-clr';clr.textContent='✕';
        clr.addEventListener('click',()=>{S.search='';el.querySelector('#js-search').value='';clr.remove();if(acc)renderHoldsHTML(acc);});
        sb.appendChild(clr);
      } else if(!S.search&&clr){clr.remove();}
      if(acc) renderHoldsHTML(acc);
    });
    el.querySelector('#js-clr')?.addEventListener('click',()=>{
      S.search='';el.querySelector('#js-search').value='';el.querySelector('.search-clear')?.remove();
      if(acc) renderHoldsHTML(acc);
    });

    el.querySelectorAll('.sort-pill').forEach(pill=>pill.addEventListener('click',()=>{
      const key=pill.dataset.sort;
      if(S.sort===key) S.sortDir*=-1;
      else{S.sort=key;S.sortDir=SORT_DEFAULTS[key]||(-1);}
      el.querySelectorAll('.sort-pill').forEach(p=>{
        const on=p.dataset.sort===S.sort;
        p.classList.toggle('on',on);
        p.textContent=p.dataset.label+(on?(S.sortDir===-1?' ↓':' ↑'):'');
      });
      if(acc) renderHoldsHTML(acc);
    }));

    initPTR(el,async ()=>{
      if(!acc) return;
      await fetchLivePrices();
      renderHoldsHTML(acc);
      const v=el.querySelector('#js-acc-val');
      if(v) v.innerHTML=accHeroValHTML(acc);
    });
};
