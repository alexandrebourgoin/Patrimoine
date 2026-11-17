// Modale « Ajouter à la liste de suivi » (autocomplete ticker + résolution en ligne).
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// ═══════════════════════════════════════════════
// ADD WATCHLIST MODAL
// ═══════════════════════════════════════════════
function openWatchModal(){
  ['watch-ticker','watch-name','watch-price'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('watch-change').value='0';
  document.getElementById('watch-modal-bg').classList.add('show');
  document.getElementById('watch-modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('watch-ticker').focus(),330);
}
function closeWatchModal(){
  document.getElementById('watch-modal-bg').classList.remove('show');
  document.getElementById('watch-modal-sheet').classList.remove('show');
}
document.getElementById('watch-modal-bg').addEventListener('click',closeWatchModal);
document.getElementById('watch-modal-close').addEventListener('click',closeWatchModal);

// Autocomplete ticker watchlist
(()=>{
  const inp  = document.getElementById('watch-ticker');
  const acL  = document.getElementById('watch-ac-list');
  function fill(ticker){
    const db = SECURITIES_DB[ticker];
    if(!db) return;
    document.getElementById('watch-name').value = db.name;
    acL.classList.add('hidden');
  }
  // Titre hors base : résolution en ligne (nom + prix + devise) via le proxy
  async function resolveWatch(tk){
    if(!tk || SECURITIES_DB[tk]) return;
    const info = await resolveTickerOnline(tk);
    if(!info){ toast(`« ${tk} » introuvable en ligne`); return; }
    const nameEl=document.getElementById('watch-name');
    const priceEl=document.getElementById('watch-price');
    if(!nameEl.value.trim()) nameEl.value=info.name;
    if(priceEl && !priceEl.value && info.price) priceEl.value=info.price;
    toast(`${tk} résolu : ${info.name} (${info.currency}) ✓`);
  }
  inp.addEventListener('input',()=>{
    const q = inp.value.trim().toUpperCase();
    if(!q){ acL.classList.add('hidden'); return; }
    const matches = Object.entries(SECURITIES_DB).filter(([k,v])=>
      k.startsWith(q) || v.name.toUpperCase().includes(q)
    ).slice(0,6);
    if(!matches.length){
      const safe=q.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      acL.innerHTML=`<div class="ac-item ac-empty" data-manual="1">
        <span class="ac-tick">🔍</span>
        <span class="ac-name">Rechercher « ${safe} » en ligne</span>
        <span class="ac-sub">nom + prix + devise auto</span>
      </div>`;
      acL.classList.remove('hidden');
      return;
    }
    acL.innerHTML = matches.map(([t,db])=>
      `<div class="ac-item" data-ticker="${t}">
        <span class="ac-tick">${t}</span>
        <span class="ac-name">${db.name}</span>
        <span class="ac-sub">${db.type} · ${db.currency}</span>
      </div>`
    ).join('');
    acL.classList.remove('hidden');
  });
  acL.addEventListener('click',e=>{
    const item = e.target.closest('.ac-item');
    if(!item) return;
    if(item.dataset.manual){
      acL.classList.add('hidden');
      resolveWatch(inp.value.trim().toUpperCase());
      document.getElementById('watch-name').focus();
      return;
    }
    inp.value = item.dataset.ticker;
    fill(item.dataset.ticker);
  });
  inp.addEventListener('blur',()=>setTimeout(()=>acL.classList.add('hidden'),200));
  inp.addEventListener('change',()=>{
    const tk=inp.value.trim().toUpperCase();
    if(SECURITIES_DB[tk]) fill(tk); else resolveWatch(tk);
  });
})();
document.getElementById('watch-submit').addEventListener('click',()=>{
  const ticker=document.getElementById('watch-ticker').value.trim().toUpperCase();
  const name=document.getElementById('watch-name').value.trim();
  const price=parseFloat(document.getElementById('watch-price').value);
  const change=parseFloat(document.getElementById('watch-change').value)||0;
  if(!ticker||!name||!(price>0)){toast('Ticker, nom et prix requis');return;}
  if(S.watchlist.find(w=>w.ticker===ticker)){toast('Ticker déjà suivi');return;}
  const _wCur = SECURITIES_DB[ticker]?.currency || _tickerMeta[ticker]?.currency || 'EUR';
  S.watchlist.push({ticker, name, price, change1d:change, currency:_wCur});
  closeWatchModal();
  refreshMain();
  toast(`${ticker} ajouté aux titres suivis ✓`);
});

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('watch-modal-sheet', closeWatchModal);
