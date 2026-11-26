// Écran Recherche : titres et mouvements + binding.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

// ── RECHERCHE ──
function renderRecherche() {
  const mode = S.srchMode || 'titres';
  const ph = mode === 'mouvements' ? 'Ticker, date, compte…' : 'Nom, ticker, secteur…';
  return `${renderTopBar('', navLabel('recherche'))}
  <div style="padding:0 20px 10px">
    <div style="position:relative">
    <div class="search-box" id="js-srch-box">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      <input type="text" id="js-srch-inp" placeholder="${ph}" autocomplete="off" spellcheck="false" value="${esc(S.srchQuery||'')}">
      ${S.srchQuery?`<div class="search-clear" id="js-srch-clr">✕</div>`:''}
    </div>
    <div id="js-srch-ac" style="display:none;position:absolute;top:44px;left:0;right:0;background:var(--card);border:1px solid var(--border);border-top:none;border-radius:0 0 12px 12px;z-index:20;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.15)"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <div class="hperiod${mode==='titres'?' on':''}" data-srchmode="titres">Titres</div>
      <div class="hperiod${mode==='mouvements'?' on':''}" data-srchmode="mouvements">Mouvements</div>
    </div>
  </div>
  <div id="js-srch-results">${srchResults(S.srchQuery||'', mode)}</div>`;
}

function srchResults(q, mode) {
  mode = mode || S.srchMode || 'titres';
  if (mode === 'mouvements') return srchTxResults(q);
  if(!q.trim()) {
    // No query — show all holdings grouped by account
    if(!S.accounts.length) return `<div style="text-align:center;padding:40px 20px;color:var(--text2);font-size:13px">Aucun compte</div>`;
    return S.accounts.map(acc=>{
      if(!acc.holdings.length) return '';
      const rows=acc.holdings.map(h=>srchRow(h,acc)).join('');
      return `<div style="margin-bottom:6px">
        <div style="padding:6px 20px 4px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3);display:flex;align-items:center;gap:6px">${accTypeBadgeHTML(acc.type,18)} ${esc(acc.name)}</div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">${rows}</div>
      </div>`;
    }).join('');
  }
  const ql=q.toLowerCase();
  const results=S.accounts.flatMap(acc=>
    acc.holdings
      .filter(h=>h.name.toLowerCase().includes(ql)||h.ticker.toLowerCase().includes(ql)||h.sector.toLowerCase().includes(ql)||h.type.toLowerCase().includes(ql))
      .map(h=>({h,acc}))
  );
  if(!results.length) return `<div style="text-align:center;padding:40px 20px;color:var(--text2)">
    <div style="font-size:32px;margin-bottom:10px">🔍</div>
    <div style="font-size:14px">Aucun résultat pour <strong>${esc(q)}</strong></div>
  </div>`;
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">
    ${results.map(({h,acc})=>srchRow(h,acc)).join('')}
  </div>`;
}

function srchRow(h, acc) {
  return `<div class="hold-item" data-hid="${h.id}" data-accid="${acc.id}">
    <div class="ticker" style="margin-top:2px">${h.ticker.slice(0,4)}</div>
    <div class="hold-item-body">
      <div class="hold-item-top">
        <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(h.name)}</div>
        <div style="font-size:14px;font-weight:800;flex-shrink:0" class="t-num">${masked(h.valueRef??h.value)}</div>
      </div>
      <div class="hold-item-bot">
        <div class="t-sm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(acc.name)} · ${h.type}</div>
        <div style="font-size:12px;font-weight:700;flex-shrink:0" class="${h.pnl>=0?'t-gain':'t-loss'}">${fmtPct(h.pnlPct)}</div>
      </div>
    </div>
  </div>`;
}

// ── RECHERCHE MOUVEMENTS ──
function srchTxResults(q) {
  const ql = q.trim().toLowerCase();
  const allTx = S.accounts.flatMap(acc =>
    acc.holdings.flatMap(h =>
      h.transactions.map(tx => ({ tx, h, acc }))
    )
  ).sort((a, b) => b.tx.date.localeCompare(a.tx.date));

  const filtered = ql
    ? allTx.filter(({ tx, h, acc }) =>
        h.ticker.toLowerCase().includes(ql) ||
        h.name.toLowerCase().includes(ql) ||
        tx.date.includes(ql) ||
        acc.name.toLowerCase().includes(ql) ||
        (tx.type==='BUY'  && ('achat'.includes(ql)||'ach'.includes(ql))) ||
        (tx.type==='SELL' && ('vente'.includes(ql)||'vte'.includes(ql))) ||
        (tx.type==='DIV'  && 'dividende'.includes(ql))
      )
    : allTx.slice(0, 30);

  if (!filtered.length) {
    if (!ql) return `<div style="text-align:center;padding:40px 20px;color:var(--text2);font-size:13px">Aucun mouvement enregistré</div>`;
    return `<div style="text-align:center;padding:40px 20px;color:var(--text2)">
      <div style="font-size:32px;margin-bottom:10px">🔍</div>
      <div style="font-size:14px">Aucun résultat pour <strong>${esc(q)}</strong></div>
    </div>`;
  }

  const rows = filtered.map(({ tx, h, acc }) => {
    const isDiv = tx.type === 'DIV', isBuy = tx.type === 'BUY';
    const dot = isDiv ? 'DIV' : isBuy ? 'ACH' : 'VTE';
    const cls = isDiv ? 'div' : isBuy ? 'buy' : 'sell';
    const total = tx.qty * tx.price;
    const hCur = h.currency || 'EUR';
    return `<div class="hold-item" data-hid="${h.id}" data-accid="${acc.id}">
      <div class="tx-dot ${cls}" style="flex-shrink:0">${dot}</div>
      <div class="hold-item-body">
        <div class="hold-item-top">
          <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(h.ticker)} · ${esc(h.name)}</div>
          <div style="font-size:13px;font-weight:800;flex-shrink:0" class="t-num ${isBuy?'t-loss':'t-gain'}">${isBuy?'-':'+'}${maskedNative(total,hCur)}</div>
        </div>
        <div class="hold-item-bot">
          <div class="t-sm" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(acc.name)} · ${fmtDate(tx.date)}</div>
          <div class="t-sm" style="flex-shrink:0">${tx.qty} × ${fmtNative(tx.price,hCur)}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const header = !ql
    ? `<div style="padding:4px 20px 6px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3)">30 derniers mouvements</div>`
    : `<div style="padding:4px 20px 6px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3)">${filtered.length} résultat${filtered.length>1?'s':''}</div>`;

  return header + `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin:0 20px;overflow:hidden">${rows}</div>`;
}


SCREEN_BIND.recherche = function (el, id) {
    const inp=el.querySelector('#js-srch-inp');
    const clrBtn=el.querySelector('#js-srch-clr');
    const results=el.querySelector('#js-srch-results');

    function bindResultClicks() {
      results.querySelectorAll('.hold-item[data-accid]').forEach(item=>{
        item.addEventListener('click',()=>{
          S.accountId=item.dataset.accid;
          S.holdingId=item.dataset.hid;
          go('stock');
        });
      });
    }

    function doSearch(q){
      S.srchQuery=q;
      results.innerHTML=srchResults(q, S.srchMode);
      bindResultClicks();
      // update clear button
      let clr=el.querySelector('#js-srch-clr');
      const box=el.querySelector('#js-srch-box');
      if(q&&!clr){
        clr=document.createElement('div');
        clr.className='search-clear';clr.id='js-srch-clr';clr.textContent='✕';
        clr.addEventListener('click',()=>{inp.value='';doSearch('');inp.focus();});
        box.appendChild(clr);
      } else if(!q&&clr){clr.remove();}
    }

    const acBox = el.querySelector('#js-srch-ac');

    function showAC(q) {
      if (!acBox || !q || q.length < 1) { if(acBox) acBox.style.display='none'; return; }
      const ql = q.toLowerCase();
      const matches = Object.entries(SECURITIES_DB)
        .filter(([t,v]) => t.toLowerCase().startsWith(ql) || v.name.toLowerCase().includes(ql))
        .slice(0, 6);
      if (!matches.length) { acBox.style.display='none'; return; }
      acBox.innerHTML = matches.map(([t,v]) =>
        `<div class="tap" data-ac="${t}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer">
          <div style="width:34px;height:34px;border-radius:8px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--accent);flex-shrink:0">${t.slice(0,4)}</div>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.name}</div>
            <div class="t-sm">${t} · ${v.type} · ${v.country}</div>
          </div>
        </div>`
      ).join('');
      acBox.style.display='block';
      acBox.querySelectorAll('[data-ac]').forEach(item => item.addEventListener('click', () => {
        inp.value = item.dataset.ac;
        acBox.style.display='none';
        doSearch(item.dataset.ac);
        inp.blur();
      }));
    }

    inp?.addEventListener('input',e=>{ doSearch(e.target.value); showAC(e.target.value); });
    inp?.addEventListener('focus', e=>showAC(e.target.value));
    clrBtn?.addEventListener('click',()=>{inp.value='';doSearch('');acBox.style.display='none';inp.focus();});
    bindResultClicks();

    // Mode pills
    el.querySelectorAll('[data-srchmode]').forEach(btn=>btn.addEventListener('click',()=>{
      S.srchMode=btn.dataset.srchmode;
      el.querySelectorAll('[data-srchmode]').forEach(b=>b.classList.toggle('on',b.dataset.srchmode===S.srchMode));
      if(inp) inp.placeholder=S.srchMode==='mouvements'?'Ticker, date, compte…':'Nom, ticker, secteur…';
      results.innerHTML=srchResults(S.srchQuery||'', S.srchMode);
      bindResultClicks();
    }));

    el.querySelector('#js-settings-btn')?.addEventListener('click', ()=>go('settings'));
    el.querySelector('#js-assistant-btn')?.addEventListener('click', ()=>go('assistant'));
    // Ferme le clavier si tap hors de la search-box
    el.addEventListener('touchstart', e => {
      if (!e.target.closest('#js-srch-box')) inp?.blur();
    }, { passive: true });
    // Pas d'auto-focus : évite l'ouverture du clavier mobile à l'arrivée sur l'écran
};
