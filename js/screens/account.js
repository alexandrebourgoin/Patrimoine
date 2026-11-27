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
  // Compte détenu en partie (compte joint) : valeur à 100 %, puis MA PART, seule comptée dans le patrimoine
  const part = accShare(acc) < 1 ? `<div class="t-sm" style="font-size:13px;font-weight:700;margin-top:2px">Ma part (${acc.share} %) : ${masked(acc.value * accShare(acc))}</div>` : '';
  if ((acc.currency || S.currency) === S.currency) return masked(acc.value) + part;
  return `${accNative(acc, acc.value)}<div class="t-sm" style="font-size:13px;font-weight:600;margin-top:2px">≈ ${masked(acc.value)}</div>${part}`;
}

// ── Performance : le calcul est pur (js/features/account-perf.js) ; ici seulement le contexte de l'appli ──
// Mode d'affichage mémorisé : 'ytd' (depuis le 1er janvier) ou 'all' (historique)
function _perfModeGet() { try { return localStorage.getItem('accPerfMode') === 'all' ? 'all' : 'ytd'; } catch (e) { return 'ytd'; } }
function _perfModeSet(m) { try { localStorage.setItem('accPerfMode', m); } catch (e) {} }
// Dernière clôture connue ≤ jour (série réelle de l'historique), ou null
function _closeOn(ticker, day) {
  const h = getHistorySeries(ticker);
  if (!h) return S.isDemo ? _demoCloseOn(ticker, day) : null;
  let c = null;
  for (const p of h.series) { if (p.d <= day) c = p.c; else break; }
  return c;
}
// Mode démo uniquement : pas d'historique réel. Cours de démonstration interpolé linéairement entre le premier achat
// (prix et date de la 1re transaction) et le cours actuel : déterministe, et réaliste pour un fonds euros comme pour
// une action (les performances de démonstration ne valent plus 0 %). Jamais utilisé en mode réel.
function _demoCloseOn(ticker, day) {
  const h = S.accounts.flatMap(a => a.holdings || []).find(x => x.ticker === ticker);
  const tx = h && (h.transactions || []).filter(t => t.type === 'BUY' && t.price > 0).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  if (!tx || !(h.currentPrice > 0)) return null;
  const t0 = Date.parse(tx.date + 'T00:00:00'), t1 = Date.parse(_dayKey(Date.now()) + 'T00:00:00'), t = Date.parse(day + 'T00:00:00');
  if (!(t1 > t0)) return h.currentPrice;
  const f = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
  return tx.price + (h.currentPrice - tx.price) * f;
}
const _accValueEnv = { qtyOnDay: _qtyOnDay, closeOn: _closeOn, conv: (v, c) => toRefCcy(v, c), cashOn: (a, day) => accCash(a, day) };
function accPerfNow(acc) {
  const ctx = { today: _dayKey(Date.now()), conv: (v, c) => toRefCcy(v, c), value: acc.value };
  const perf = accPerfInfo(acc, ctx);
  return { ctx, perf, sum: accPerfSummary(acc, perf, ctx, day => accValueOnDay(acc, day, _accValueEnv)) };
}
// Performance affichée dans la liste des comptes : la même que sur l'écran du compte (mode YTD ou historique mémorisé)
function accPerfPctNow(acc) {
  const { ctx } = accPerfNow(acc);
  return accPerfPct(acc, _perfModeGet(), ctx, day => accValueOnDay(acc, day, _accValueEnv));
}

const _CHIP = 'padding:6px 14px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer';
function accPerfCardHTML(acc, perf, sum) {
  if (!perf || !sum) return '';
  const mode = _perfModeGet(), cur = mode === 'all' ? sum.all : sum.ytd;
  // Sans base de calcul pour la période (ex. valeur au 31 décembre inconnue) : on garde la carte et sa bascule, avec « — »
  const modeBtn = (k, l) => `<span data-pm="${k}" class="tap" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;${mode === k ? 'background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.18)' : 'color:var(--text2)'}">${l}</span>`;
  const sub = mode === 'all'
    ? `Depuis le ${fmtDate(sum.t0)}${sum.annual != null ? ' · ' + fmtPct(sum.annual) + ' / an' : ''}`
    : (cur ? `Depuis le 1er janvier${sum.approx ? ' · approximatif (historique de cours incomplet)' : ''}` : 'Cours au 31 décembre inconnus : récupère l\'historique des titres (⟲ sur la fiche titre) ou consulte la performance historique');
  return `<div style="margin-top:12px;padding:12px 14px;border-radius:14px;background:var(--card2)">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div class="t-label">Performance ${mode === 'all' ? 'historique' : 'YTD'}</div>
      <div style="display:flex;gap:2px;padding:2px;border-radius:20px;background:rgba(127,127,127,.15)">${modeBtn('ytd', 'YTD')}${modeBtn('all', 'Historique')}</div>
    </div>
    <div style="display:flex;align-items:baseline;gap:10px;margin-top:6px;flex-wrap:wrap">
      ${cur ? `<div style="font-size:26px;font-weight:800" class="${pctClass(cur.pct)} t-num">${fmtPct(cur.pct)}</div>
      <div style="font-size:14px;font-weight:700" class="${Math.round(cur.gain * 100) === 0 ? '' : cur.gain > 0 ? 't-gain' : 't-loss'} t-num">${Math.round(cur.gain * 100) > 0 ? '+' : ''}${accNative(acc, Math.round(cur.gain * 100) === 0 ? 0 : cur.gain)}</div>`
        : '<div style="font-size:26px;font-weight:800" class="t-num">—</div>'}
    </div>
    <div class="t-sm" style="margin-top:4px">${sub}</div>
  </div>`;
}
// Poches de liquidités (si plusieurs devises) et cumul des apports / retraits
function accCashDetailHTML(acc, perf) {
  const ccy = acc.currency || S.currency;
  const pk = Object.entries(PU.accCashByCcy(acc)).filter(([, v]) => Math.abs(v) > 0.005);
  let h = '';
  if (pk.length > 1 || (pk.length === 1 && pk[0][0] !== ccy))
    h += `<div class="t-sm" style="margin-top:6px">Poches de liquidités : ${pk.map(([c, v]) => `<b class="t-num">${maskedNative(v, c)}</b>`).join(' · ')}</div>`;
  if (perf)
    h += `<div class="t-sm" style="margin-top:6px;display:flex;gap:4px 14px;flex-wrap:wrap"><span>Apports cumulés <b class="t-num">${accNative(acc, perf.dep)}</b></span><span>Retraits cumulés <b class="t-num">${accNative(acc, perf.wit)}</b></span></div>`;
  return h;
}
// Enveloppe fiscale (E11) : jalon de durée (PEA 5 ans, assurance-vie 8 ans) et plafond de versements. Règles pures : js/features/tax-envelope.js
function accEnvelopeHTML(acc) {
  const info = taxEnvelopeInfo(acc, { today: _dayKey(Date.now()), conv: (v, c) => toRefCcy(v, c), accounts: S.accounts });
  if (!info) return '';
  const m = info.milestone, c = info.ceiling;
  let h = '';
  if (m) {
    const when = !m.date ? `Saisis la date d'ouverture du compte pour suivre les ${m.years} ans`
      : m.reached ? `✓ ${m.years} ans atteints le ${fmtDate(m.date)}`
      : `${m.years} ans le ${fmtDate(m.date)} · encore ${m.daysLeft > 60 ? Math.round(m.daysLeft / 30.44) + ' mois' : m.daysLeft + ' j'}`;
    h += `<div style="font-size:14px;font-weight:800;margin-top:4px${m.reached ? ';color:var(--gain)' : ''}">${when}</div>`
      + (m.date && m.auto ? `<div class="t-sm">Compté depuis le 1er versement connu (${fmtDate(m.start)}) : précise la date d'ouverture dans « Modifier ».</div>` : '')
      + `<div class="t-sm" style="margin-top:4px">${esc(m.text)}</div>`;
  }
  if (c) {
    h += `<div class="t-sm" style="margin-top:8px;display:flex;justify-content:space-between;gap:8px"><span>${c.basis === 'balance' ? 'Plafond' : 'Versements <b class="t-num">' + masked(c.used) + '</b> /'} ${masked(c.amount)}</span><span>${c.basis === 'balance' ? (c.left > 0.005 ? `Encore <b class="t-num">${masked(c.left)}</b> à verser` : '<b>Plus de versement possible</b>') : c.over ? '<b style="color:var(--loss)">Plafond dépassé</b>' : `Reste <b class="t-num">${masked(c.left)}</b>`}</span></div>
    <div style="height:6px;border-radius:3px;background:rgba(127,127,127,.18);margin-top:4px;overflow:hidden"><div style="height:100%;width:${c.pct.toFixed(1)}%;background:${c.over ? 'var(--loss)' : 'var(--accent)'}"></div></div>`
      + (c.sharedNote ? `<div class="t-sm" style="margin-top:4px">${esc(c.sharedNote)}</div>` : '');
  }
  if (info.note) h += `<div class="t-sm" style="margin-top:6px">${esc(info.note)}</div>`;
  return `<div id="js-acc-env" style="margin-top:12px;padding:12px 14px;border-radius:14px;background:var(--card2)"><div class="t-label">Enveloppe fiscale · ${esc(info.short)}</div>${h}</div>`;
}
// Accueil « À surveiller » : jalon fiscal (PEA 5 ans, assurance-vie 8 ans) dans les 90 jours
HOME_WATCH.taxEnvelope = () => taxMilestonesSoon(S.accounts, { today: _dayKey(Date.now()), conv: (v, c) => toRefCcy(v, c) }, 90)
  .map(({ acc, info }) => ({ level: 'info', when: info.milestone.date, go: 'account', accountId: acc.id,
    text: `${info.short} « ${acc.name} » : ${info.milestone.years} ans le ${fmtDate(info.milestone.date)}`, sub: 'Fiscalité allégée à partir de cette date' }));
// Comparaison à l'indice : tableau Période / Compte / Indice / Écart, depuis la même date de début que le compte
function accBenchHTML(acc, perf, sum) {
  const key = accBenchmarkKey(acc), b = BENCHMARKS[key];
  const chip = `<span id="js-bm-btn" class="tap" style="padding:3px 10px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">${b ? 'Indice : ' + esc(b.label) : 'Comparer à un indice'}</span>`;
  if (!b) return `<div class="t-sm" style="margin-top:8px">${chip}</div>`;
  if (!perf || !sum) return `<div class="t-sm" style="margin-top:8px">${chip} · Ajoute un apport pour comparer</div>`;
  const needsFx = benchNeedsFx(key, S.currency), t0 = sum.t0;
  const ser = benchSeries(getHistorySeries('IDX:' + key), getHistorySeries('IDX:EURUSD'), needsFx);
  const covers = !!ser && benchCovers(ser.series, t0);
  const wait = txt => `<div class="t-sm" style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${chip}<span>${txt}</span></div>`;
  if (!covers && !_benchTried[key + '|' + t0]) return wait("chargement de l'indice…");   // le chargement est lancé par le binding de l'écran
  if (!ser) return wait('indice indisponible pour le moment');
  const g = 'display:grid;grid-template-columns:1.7fr 1fr 1fr 1fr;gap:6px;align-items:baseline;font-size:12px';
  const cell = v => v == null ? '<span class="t-sm">—</span>' : `<b class="${pctClass(v)} t-num">${fmtPct(v)}</b>`;
  const bAll = benchRet(ser.series, t0), sameYtd = t0 > sum.pye, bYtd = sameYtd ? bAll : benchRet(ser.series, sum.pye);
  const row = (lbl, a, r) => {
    const x = (a == null || r == null) ? null : a - r;
    return `<div style="${g};padding:7px 0;border-top:1px solid var(--border)"><span style="font-weight:700">${lbl}</span>${cell(a)}${cell(r)}${x == null ? '<span class="t-sm">—</span>' : `<b class="${x < 0 ? 't-loss' : 't-gain'} t-num">${x >= 0 ? '+' : ''}${x.toFixed(1)} pts</b>`}</div>`;
  };
  const ccyNote = ser.conv ? 'indice converti en euros' : (b.ccy === 'USD' ? 'indice en dollars (non converti)' : 'indice dans sa devise');
  const partial = covers ? '' : ` · historique de l'indice disponible depuis le ${fmtDate(ser.series[0].d)} seulement`;
  return `<div style="margin-top:8px">
    <div style="margin-bottom:8px">${chip}</div>
    <div style="padding:4px 12px 6px;border-radius:12px;background:var(--card2)">
      <div style="${g};padding:6px 0;color:var(--text2);font-size:11px;font-weight:700"><span>Période</span><span>Compte</span><span>${esc(b.label)}</span><span>Écart</span></div>
      ${sameYtd ? '' : row('Depuis le 1er janv.', sum.ytd ? sum.ytd.pct : null, bYtd)}
      ${row('Depuis le ' + fmtDate(t0), sum.all ? sum.all.pct : null, bAll)}
    </div>
    <div class="t-sm" style="font-size:10px;margin-top:4px">Perf. du compte pondérée des apports et retraits${sum.approx ? ' · YTD approximatif (historique de cours incomplet)' : ''} · ${ccyNote}${partial}.</div>
  </div>`;
}

// Type retiré de la liste (migration guidée) : bandeau avec conseil, « Choisir un type » (fiche Modifier) ou « Garder ce type »
function accRetiredTypeHTML(acc) {
  if (!accToReclassify([acc]).length) return '';
  return `<div class="acc-retired" style="margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px">
    <div style="font-size:13px;font-weight:700">Le type « ${esc(acc.type)} » n'est plus proposé</div>
    <div class="t-sm" style="margin-top:4px">${esc(accRetiredHint(acc.type))} La valeur du compte et ses mouvements ne changent pas.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <div id="js-retype" class="tap" style="${_CHIP}">Choisir un type</div>
      <div id="js-keeptype" class="tap" style="${_CHIP}">Garder ce type</div>
    </div></div>`;
}
function renderAccount() {
  const acc=S.accounts.find(a=>a.id===S.accountId); if(!acc) return '';
  if(savingsView(acc)) return renderSavingsAccount(acc);   // livret : solde, taux, mouvements, sans titres (js/screens/savings.js)
  _movesAll=false; // le relevé repart replié à chaque ouverture de l'écran
  const secVal=accSum(acc.holdings);          // titres seuls (devise appli)
  const cash=accCash(acc);                    // liquidités non investies
  const pills=SORT_OPTS.map(o=>{
    const on=S.sort===o.key;
    const arrow=on?(S.sortDir===-1?' ↓':' ↑'):'';
    return `<div class="sort-pill${on?' on':''}" data-sort="${o.key}" data-label="${o.label}">${o.label}${arrow}</div>`;
  }).join('');
  // Cashflow total
  const cfs=acc.cashflows||[];
  const adj=PU.accCashAnchor(acc);             // dernière régularisation des liquidités
  const tracked=cfs.length>0||!!adj;           // liquidités suivies (apports saisis ou régularisation)
  const {perf,sum}=accPerfNow(acc);
  const netCf=accFlows(acc,(v,c)=>toRefCcy(v,c)).reduce((s,f)=>s+f.amt,0);   // apports − retraits, devise appli
  return `${backBarHTML()}
  <div class="acc-hero">
    <div class="row gap10" style="margin-bottom:6px;align-items:center">
      ${accTypeBadgeHTML(acc.type,40)}
      <div class="col" style="gap:2px;flex:1;min-width:0">
        <div style="font-size:20px;font-weight:800;letter-spacing:-.5px">${esc(acc.name)}${acc.observer?` <span class="obs-tag" style="font-size:10px;vertical-align:middle">Obs.</span>`:''}</div>
        <div class="t-sm">${esc(acc.type||'')}${acc.bank?' · '+esc(acc.bank):''}</div>
      </div>
    </div>
    <div class="acc-hero-val t-num" id="js-acc-val">${accHeroValHTML(acc)}</div>
    ${isSavingsAccount(acc)?`<div class="t-sm" style="margin-top:4px;color:var(--loss)">Ce ${esc(acc.type)} contient des titres saisis auparavant : supprime-les pour passer à l'affichage livret (solde, taux, versements).</div>`:''}
    ${linkedChipHTML(acc)}
    ${tracked?`<div class="t-sm" style="margin-top:2px">${accNative(acc,secVal)} de titres · ${accNative(acc,cash)} de liquidités</div>`:''}${accCashDetailHTML(acc,perf)}
    ${accPerfCardHTML(acc,perf,sum)}
    ${accBenchHTML(acc,perf,sum)}
    ${accEnvelopeHTML(acc)}
    ${accRetiredTypeHTML(acc)}
    ${tracked?`<div class="row gap8" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);align-items:center">
      <div style="flex:1">
        <div class="t-label">Apport net</div>
        <div style="font-size:14px;font-weight:800" class="${netCf>=0?'t-gain':'t-loss'} t-num">${netCf>=0?'+':''}${accNative(acc,netCf)}</div>
      </div>
      <div style="flex:1">
        <div class="t-label">Liquidités</div>
        <div style="font-size:14px;font-weight:800" class="${cash>=0?'':'t-loss'} t-num">${masked(cash)}</div>
      </div>
      <div id="js-cf-btn" class="tap" style="${_CHIP}">Apports / Retraits</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><div id="js-ca-btn" class="tap" style="${_CHIP}">Régulariser les liquidités</div>${adj?`<span class="t-sm">régularisé le ${fmtDate(adj.date)}</span>`:''}</div>
    ${cash<0?`<div class="t-sm" style="margin-top:6px;color:var(--loss)">Liquidités négatives : vos achats dépassent les apports saisis — il manque probablement un apport, ou régularise les liquidités.</div>`:''}`:'<div id="js-cf-btn" class="tap" style="display:inline-block;margin-top:10px;padding:6px 14px;border-radius:20px;border:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">+ Apport / Retrait</div>'}
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
      const weight  = acc.value > 0 ? ((h.valueRef ?? h.value) / acc.value * 100).toFixed(1) : '0';
      const stale   = priceStale(h);   // cours trop ancien ou date de cotation inconnue (js/services/prices.js)
      return `
      <div class="hold-item" data-hid="${h.id}">
        <div class="ticker" style="margin-top:2px">${esc(h.ticker.slice(0,4))}</div>
        <div class="hold-item-body">
          <div class="hold-item-top">
            <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(h.name)}</div>
            <div class="col right" style="gap:1px;flex-shrink:0">
              <div style="font-size:14px;font-weight:800" class="t-num">${masked(h.valueRef??h.value)}</div>
              <div style="font-size:10px;color:var(--text3);text-align:right">${weight}%</div>
            </div>
          </div>
          <div class="hold-item-bot">
            <div class="t-sm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${stale?';color:var(--loss);font-weight:700':''}"${stale?` title="Cours non synchronisé (${esc(priceAgeLabel(h.quoteAt))})"`:''}>${h.quantity} × ${fmtNative(h.currentPrice, h.currency||'EUR')} · ${esc(h.type)}${stale?' · ⚠ cours obsolète':''}</div>
            <div style="font-size:12px;font-weight:700;flex-shrink:0" class="${pctClass(h.pnlPct)}">${fmtPct(h.pnlPct)}</div>
          </div>
        </div>
      </div>`;
    }).join('')+
  `</div>`;
  // Toucher une ligne ouvre la fiche du titre, où se trouvent toutes les actions : favori ⭐, mouvement, modifier, supprimer
  el.querySelectorAll('.hold-item').forEach(item=>{
    item.addEventListener('click',()=>{ S.holdingId=item.dataset.hid; go('stock'); });
  });
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
      label: c.type==='WIT' ? 'Retrait' : c.type==='INT' ? 'Intérêts' : isSavingsAccount(acc) ? 'Versement' : 'Apport',
      detail: c.note || '', amount: +c.amount||0, ccy: PU.cfCcy(acc, c),
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
  INT:  { dot:'INT', cls:'div',  type:'Intérêts',   sign:'+', val:'t-gain' },
};

function renderMovesHTML(acc) {
  const el=document.getElementById('js-moves'); if(!el) return;
  const all=getAccountMoves(acc);
  const cnt=document.getElementById('js-mcnt');
  if(cnt) cnt.textContent=`${all.length} mouvement${all.length!==1?'s':''}`;
  if(!all.length){
    el.innerHTML=`<div style="text-align:center;padding:26px 20px;color:var(--text2);font-size:13px">
      ${S.search?'Aucun mouvement pour cette recherche':isSavingsAccount(acc)?'Aucun mouvement — ajoute un versement ou les intérêts reçus':'Aucun mouvement — ajoutez un apport ou passez un ordre'}
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
          <div class="t-sm" style="overflow-wrap:anywhere">${fmtDate(m.date)}${m.detail?' · '+esc(m.detail):''}</div>
        </div>
        <div class="col right gap4" style="flex-shrink:0">
          <div style="font-size:13px;font-weight:800" class="${st.val} t-num">${st.sign}${maskedNative(m.amount,m.ccy)}</div>
          <div class="t-sm">${m.kind==='DEP'&&isSavingsAccount(acc)?'Versement':st.type}</div>
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
    if (S.screen==='stock') back();   // suppression depuis la fiche du titre : retour au compte
    else renderHoldsHTML(acc);
    refreshMain();
    toast('Position supprimée');
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


// ── Choix de l'indice de comparaison du compte ──
let _bmAccId = null;
function openBenchSheet(acc) {
  _bmAccId = acc.id;
  const sel = document.getElementById('bm-select');
  sel.innerHTML = '<option value="auto">Par défaut (selon le type de compte)</option><option value="">Aucun</option>'
    + Object.entries(BENCHMARKS).map(([k, b]) => `<option value="${k}">${esc(b.label)}</option>`).join('');
  sel.value = acc.benchmark === undefined ? 'auto' : acc.benchmark;
  document.getElementById('bm-bg').classList.add('show');
  document.getElementById('bm-sheet').classList.add('show');
}
function closeBenchSheet() {
  document.getElementById('bm-bg').classList.remove('show');
  document.getElementById('bm-sheet').classList.remove('show');
}
document.getElementById('bm-bg').addEventListener('click', closeBenchSheet);
document.getElementById('bm-ok').addEventListener('click', () => {
  const acc = S.accounts.find(a => a.id === _bmAccId); if (!acc) return;
  const v = document.getElementById('bm-select').value;
  if (v === 'auto') delete acc.benchmark; else acc.benchmark = v;
  saveAccounts();
  closeBenchSheet();
  if (S.screen === 'account') renderScreen('account');
  toast('Indice de comparaison enregistré ✓');
});
registerModal('bm-sheet', closeBenchSheet);

SCREEN_BIND.account = function (el, id) {
    const acc=S.accounts.find(a=>a.id===S.accountId);
    el.querySelector('#js-back')?.addEventListener('click',back);

    const savings=savingsView(acc);
    if(acc) { if(savings) renderMovesHTML(acc); else renderHoldsHTML(acc); }
    bindLinkedAccount(el,acc);   // compte lié à un service : lecture seule (js/screens/linked.js)

    el.querySelector('#js-add-hold')?.addEventListener('click',()=>openPosModal(S.accountId));

    // Cashflows button
    el.querySelector('#js-cf-btn')?.addEventListener('click',()=>openCfModal(S.accountId));
    el.querySelector('#js-add-move')?.addEventListener('click',()=>openCfModal(S.accountId));
    el.querySelector('#js-ca-btn')?.addEventListener('click',()=>openCashAdjust(S.accountId));
    el.querySelector('#js-retype')?.addEventListener('click',()=>{ if(acc) openRenameAcc(acc.id, acc.name); });
    el.querySelector('#js-keeptype')?.addEventListener('click',()=>{ if(!acc) return; acc.keepType=acc.type; saveAccounts(); refreshMain(); renderScreen('account'); toast('Type conservé ✓'); });
    el.querySelector('#js-bm-btn')?.addEventListener('click',()=>{ if(acc) openBenchSheet(acc); });
    el.querySelectorAll('[data-pm]').forEach(b=>b.addEventListener('click',()=>{ _perfModeSet(b.dataset.pm); renderScreen('account'); }));
    // Indice de comparaison : téléchargement de la série si elle est absente ou ne remonte pas jusqu'à la date de début
    if(acc && !savings && !S.isDemo){
      const {sum}=accPerfNow(acc), key=accBenchmarkKey(acc);
      if(sum && BENCHMARKS[key]){
        const ser=benchSeries(getHistorySeries('IDX:'+key),getHistorySeries('IDX:EURUSD'),benchNeedsFx(key,S.currency));
        if(!ser||!benchCovers(ser.series,sum.t0)) loadBenchmark(key,sum.t0);
      }
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

    if(savings) return;   // livret : ni cours à actualiser, ni recherche, ni tri
    initPTR(el,async ()=>{
      if(!acc) return;
      await fetchLivePrices();
      renderHoldsHTML(acc);
      const v=el.querySelector('#js-acc-val');
      if(v) v.innerHTML=accHeroValHTML(acc);
    });
};
