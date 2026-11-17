// Modale Apports / Retraits d un compte et liste des mouvements de trésorerie.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// ═══════════════════════════════════════════════
// CASHFLOW MODAL
// ═══════════════════════════════════════════════
let _cfAccId=null, _cfType='DEP';

// Liste des mouvements déjà saisis, avec suppression — indispensable depuis que les
// apports/retraits entrent dans le solde du compte (une saisie erronée le fausse).
function renderCfList(){
  const el=document.getElementById('cf-list'); if(!el) return;
  const acc=S.accounts.find(a=>a.id===_cfAccId);
  const cfs=[...(acc?.cashflows||[])].sort((a,b)=>b.date.localeCompare(a.date));
  if(!cfs.length){ el.innerHTML=''; return; }
  const accCcy=acc.currency||S.currency;
  el.innerHTML=`<div class="t-label" style="margin:14px 0 4px">Mouvements enregistrés</div>`+
    cfs.map(c=>{
      const dep=c.type!=='WIT';
      return `<div class="tx-item" style="padding:10px 0">
        <div class="tx-dot ${dep?'buy':'sell'}">${dep?'AP':'RE'}</div>
        <div class="flex1 col gap4" style="min-width:0">
          <div style="font-size:13px;font-weight:700">${dep?'Apport':'Retrait'} · ${fmtDate(c.date)}</div>
          ${c.note?`<div class="t-sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.note)}</div>`:''}
        </div>
        <div style="font-size:13px;font-weight:800" class="${dep?'t-gain':'t-loss'} t-num">${dep?'+':'−'}${maskedNative(+c.amount||0,accCcy)}</div>
        <div class="tx-del-btn" data-cfdel="${esc(c.id)}" title="Supprimer">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </div>
      </div>`;
    }).join('');
  el.querySelectorAll('[data-cfdel]').forEach(b=>b.addEventListener('click',()=>{
    const acc=S.accounts.find(a=>a.id===_cfAccId); if(!acc) return;
    acc.cashflows=(acc.cashflows||[]).filter(c=>c.id!==b.dataset.cfdel);
    acc.value=accTotal(acc);
    renderCfList();
    renderScreen('account');
    refreshMain();
    toast('Mouvement supprimé');
  }));
}

function openCfModal(accId){
  _cfAccId=accId; _cfType='DEP';
  document.getElementById('cf-amount').value='';
  document.getElementById('cf-note').value='';
  document.getElementById('cf-date').value=_dayKey(Date.now());
  // Les montants sont saisis dans la devise du compte (convertis ensuite pour le patrimoine)
  const lbl=document.getElementById('cf-amount-label');
  if(lbl) lbl.textContent='Montant ('+(S.accounts.find(a=>a.id===accId)?.currency||S.currency)+')';
  document.querySelectorAll('[data-cftype]').forEach(b=>b.classList.toggle('on',b.dataset.cftype==='DEP'));
  renderCfList();
  document.getElementById('cf-modal-bg').classList.add('show');
  document.getElementById('cf-modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('cf-amount').focus(),330);
}
function closeCfModal(){
  document.getElementById('cf-modal-bg').classList.remove('show');
  document.getElementById('cf-modal-sheet').classList.remove('show');
}
document.getElementById('cf-modal-bg').addEventListener('click',closeCfModal);
document.getElementById('cf-modal-close').addEventListener('click',closeCfModal);
document.querySelectorAll('[data-cftype]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-cftype]').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');
  _cfType=b.dataset.cftype;
}));
document.getElementById('cf-submit').addEventListener('click',()=>{
  const amount=parseFloat(document.getElementById('cf-amount').value);
  const date=document.getElementById('cf-date').value||_dayKey(Date.now());
  const note=document.getElementById('cf-note').value.trim();
  if(!(amount>0)){toast('Montant requis');return;}
  const acc=S.accounts.find(a=>a.id===_cfAccId);
  if(!acc) return;
  if(!acc.cashflows) acc.cashflows=[];
  acc.cashflows.push({id:'cf_'+Date.now().toString(36),date,type:_cfType,amount,note});
  acc.cashflows.sort((a,b)=>a.date.localeCompare(b.date));
  acc.value=accTotal(acc); // le solde intègre désormais les apports/retraits non investis
  closeCfModal();
  renderScreen('account');
  refreshMain(); // persiste le cashflow (saveData) — sans ça l'apport disparaissait au rechargement
  toast((_cfType==='DEP'?'Apport':'Retrait')+' enregistré ✓');
});


// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('cf-modal-sheet', closeCfModal);
