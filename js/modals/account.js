// Modales de compte : types de compte, ajout, menu d actions, modification, suppression.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// ── Types de compte ────────────────────────────────────────────────────
// La liste ACCOUNT_TYPES et les règles (devise par type, types d'actifs autorisés) sont dans js/features/account-rules.js (pures, testées).
// Une table de règles qui référencerait un libellé inconnu serait inopérante sans bruit : on le signale dès le démarrage.
accountRulesProblems().forEach(p => console.warn('[règles de comptes] ' + p));
taxEnvelopeProblems(ACCOUNT_TYPES).forEach(p => console.warn('[enveloppes fiscales] type inconnu : ' + p));
const ACC_TYPE_OTHER = '__other__';

// Aligne le sélecteur de devise sur le type choisi (règle : accCurrencyForType). apply = true à la création, false pour un compte existant.
function syncAccCurrency(typeSelId, curSelId, apply){
  const typeSel=document.getElementById(typeSelId), cur=document.getElementById(curSelId);
  if(!typeSel||!cur) return;
  const r=accCurrencyForType(typeSel.value, cur.value, [...cur.options].map(o=>o.value), apply);
  cur.value=r.value;
  cur.disabled=r.locked;
  cur.title=r.reason;
}

// Remplit un <select> de types et pré-sélectionne `value`. `otherRowId` est la ligne
// « Préciser le type », affichée quand l'option « Autre… » est choisie.
// `curSelId` (optionnel) : sélecteur de devise à aligner sur le type ; `applyCurrency` : true à la création (la devise suit le type).
function fillAccTypeSelect(selId, otherRowId, otherInpId, value, curSelId, applyCurrency){
  const sel=document.getElementById(selId); if(!sel) return;
  // Un type hors liste (donnée ancienne, saisie « Autre ») est conservé et ajouté à la liste
  const types=ACCOUNT_TYPES.includes(value)||!value ? ACCOUNT_TYPES : [...ACCOUNT_TYPES, value];
  sel.innerHTML=types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')
    +`<option value="${ACC_TYPE_OTHER}">Autre…</option>`;
  sel.value=value||ACCOUNT_TYPES[0];
  const otherRow=document.getElementById(otherRowId);
  const otherInp=document.getElementById(otherInpId);
  if(otherInp) otherInp.value='';
  if(otherRow) otherRow.classList.add('hidden');
  sel.onchange=()=>{
    const isOther=sel.value===ACC_TYPE_OTHER;
    if(otherRow) otherRow.classList.toggle('hidden',!isOther);
    if(isOther && otherInp) otherInp.focus();
    if(curSelId) syncAccCurrency(selId,curSelId,!!applyCurrency);
    syncAccEnvHint(selId);
    syncAccSavings(selId,true);
  };
  syncAccEnvHint(selId);
  syncAccSavings(selId,false);
}

// Livret / compte d'épargne (js/features/savings.js) : champs solde et taux à la place des titres.
// prefill : au changement de type, le taux réglementé en vigueur est proposé.
function syncAccSavings(selId,prefill){
  const row=document.getElementById(selId+'-sv'), sel=document.getElementById(selId); if(!row||!sel) return;
  const sv=isSavingsType(sel.value);
  row.classList.toggle('hidden',!sv);
  document.getElementById(selId+'-svhint')?.classList.toggle('hidden',!sv);
  const rate=document.getElementById(selId+'-rate');
  if(rate&&prefill&&sv) rate.value=SAVINGS_RATES[sel.value]??'';
}

// Rappel de l'enveloppe fiscale du type choisi (E11), sous la date d'ouverture : ligne `<selId>-env` (règles : js/features/tax-envelope.js)
function syncAccEnvHint(selId){
  const el=document.getElementById(selId+'-env'), sel=document.getElementById(selId);
  if(!el||!sel) return;
  const r=TAX_ENVELOPES[sel.value];
  const parts=r?[r.years?`fiscalité allégée après ${r.years} ans, comptés depuis la date d'ouverture (1er versement)`:'',
    r.ceiling?`plafond de versements ${r.ceiling.toLocaleString('fr-FR')} €`:'',r.note&&!r.years&&!r.ceiling?r.note:''].filter(Boolean):[];
  el.textContent=parts.length?`${r.short} : ${parts.join(' · ')}.`:'';
  el.classList.toggle('hidden',!parts.length);
}

// Valeur retenue : le texte libre si « Autre… » est sélectionné, sinon l'option choisie.
function readAccType(selId, otherInpId, fallback){
  const sel=document.getElementById(selId);
  const v=sel?.value||'';
  if(v===ACC_TYPE_OTHER) return document.getElementById(otherInpId)?.value.trim()||fallback;
  return v||fallback;
}

// ═══════════════════════════════════════════════
// ADD ACCOUNT MODAL
// ═══════════════════════════════════════════════
let _accObserver=false;
function openAccModal(){
  _accObserver=false;
  setAccIcon('acc-icon','acc-icon-btn','📊');
  document.getElementById('acc-name').value='';
  document.getElementById('acc-bank').value='';
  document.getElementById('acc-start').value='';
  document.getElementById('acc-share').value='';
  document.getElementById('acc-balance').value='';
  document.getElementById('acc-type-rate').value='';
  fillAccTypeSelect('acc-type','acc-type-other-row','acc-type-other','','acc-currency',true);
  document.getElementById('acc-currency').value='EUR';
  syncAccCurrency('acc-type','acc-currency',true);   // la devise suit le type proposé par défaut
  document.getElementById('acc-obs-tog').classList.remove('on');
  document.getElementById('acc-modal-bg').classList.add('show');
  document.getElementById('acc-modal-sheet').classList.add('show');
  setTimeout(()=>document.getElementById('acc-name').focus(),330);
}
function closeAccModal(){
  closeIconPicker();
  document.getElementById('acc-modal-bg').classList.remove('show');
  document.getElementById('acc-modal-sheet').classList.remove('show');
}
document.getElementById('acc-modal-bg').addEventListener('click',closeAccModal);
document.getElementById('acc-modal-close').addEventListener('click',closeAccModal);
document.getElementById('acc-obs-tog').addEventListener('click',()=>{
  _accObserver=!_accObserver;
  document.getElementById('acc-obs-tog').classList.toggle('on',_accObserver);
});
document.getElementById('acc-submit').addEventListener('click',()=>{
  const icon=document.getElementById('acc-icon').value.trim()||'📊';
  const name=document.getElementById('acc-name').value.trim();
  const type=readAccType('acc-type','acc-type-other',ACCOUNT_TYPES[0]);
  const bank=document.getElementById('acc-bank').value.trim();
  const startDate=document.getElementById('acc-start').value||'';
  const share=accShareInput('acc-share'); if(share===null) return;
  if(!name){toast('Nom du compte requis');return;}
  if(startDate&&startDate>_dayKey(Date.now())){toast("La date d'ouverture ne peut pas être dans le futur");return;}
  const id='acc_'+Date.now().toString(36);
  const bgs=['rgba(79,142,247,.13)','rgba(0,194,203,.13)','rgba(0,214,143,.13)','rgba(245,158,11,.13)','rgba(167,139,250,.13)'];
  const iconBg=bgs[S.accounts.length%bgs.length];
  const currency=document.getElementById('acc-currency').value||'EUR';
  // Livret : taux et solde de départ (le solde au-delà du plafond est compté comme intérêts : savingsOpeningFlows)
  let rate=null, cashflows=[];
  if(isSavingsType(type)){
    const r=savingsRateInput(document.getElementById('acc-type-rate').value); if(r.error){toast(r.error);return;}
    rate=r.rate;
    const bal=parseFloat(document.getElementById('acc-balance').value);
    if(document.getElementById('acc-balance').value!==''&&!(bal>=0)){toast('Solde invalide');return;}
    const day=startDate||_dayKey(Date.now());
    cashflows=savingsOpeningFlows(type,bal).map((f,i)=>({id:'cf_'+Date.now().toString(36)+i,date:day,type:f.type,amount:f.amount,ccy:currency,note:'Solde à la création'}));
  }
  const acc={id,name,type,bank,icon,iconBg,currency,value:0,change1d:0,holdings:[],cashflows,observer:_accObserver,...(startDate?{startDate}:{}),...(share<100?{share}:{}),...(rate!=null?{rate}:{})};
  acc.value=accTotal(acc);
  S.accounts.push(acc);
  closeAccModal();
  refreshMain();
  toast(`Compte "${name}" créé ✓`);
});


// ═══════════════════════════════════════════════
// DELETE ACCOUNT
// ═══════════════════════════════════════════════
function deleteAccount(accId){
  const acc=S.accounts.find(a=>a.id===accId); if(!acc) return;
  openConfirm(`Supprimer le compte "${acc.name}" ?`,()=>{
    S.accounts=S.accounts.filter(a=>a.id!==accId);
    if(S.screen==='account'&&S.accountId===accId) back();
    refreshMain();
    toast('Compte supprimé');
  });
}

// ═══════════════════════════════════════════════
// ACCOUNT ACTION MENU
// ═══════════════════════════════════════════════
let _menuAccId=null;

function openAccMenu(accId){
  _menuAccId=accId;
  const acc=S.accounts.find(a=>a.id===accId); if(!acc) return;
  document.getElementById('acc-action-title').textContent=acc.name;
  const obsLbl=document.getElementById('acc-action-obs-lbl');
  if(obsLbl) obsLbl.textContent=acc.observer?'Retirer le mode observateur':'Passer en observateur';
  document.getElementById('acc-action-bg').classList.add('show');
  document.getElementById('acc-action-sheet').classList.add('show');
}
function closeAccMenu(){
  document.getElementById('acc-action-bg').classList.remove('show');
  document.getElementById('acc-action-sheet').classList.remove('show');
  _menuAccId=null;
}
document.getElementById('acc-action-bg').addEventListener('click',closeAccMenu);
document.getElementById('acc-action-obs').addEventListener('click',()=>{
  const id=_menuAccId; // closeAccMenu() nullifie _menuAccId — capturer avant
  const acc=S.accounts.find(a=>a.id===id); if(!acc) return;
  acc.observer=!acc.observer;
  closeAccMenu();
  refreshMain();
  if(S.screen==='account'&&S.accountId===id) renderScreen('account');
  toast(acc.observer?'Mode observateur activé':'Mode observateur désactivé');
});
document.getElementById('acc-action-rename').addEventListener('click',()=>{
  const id=_menuAccId;
  const acc=S.accounts.find(a=>a.id===id); if(!acc) return;
  closeAccMenu();
  openRenameAcc(id, acc.name);
});
// Pas de mode dédié : l'entrée du menu ne fait que rappeler le geste
document.getElementById('acc-action-order').addEventListener('click',()=>{
  closeAccMenu();
  toast(S.accounts.length<2?'Il faut au moins deux comptes'
                           :'Maintenez un compte appuyé, puis glissez-le');
});
document.getElementById('acc-action-del').addEventListener('click',()=>{
  const id=_menuAccId;
  closeAccMenu();
  deleteAccount(id);
});


// Part détenue saisie (compte joint) : vide → 100 ; refus (toast, null) hors de 1 à 100 %
function accShareInput(id){
  const raw=String(document.getElementById(id).value||'').trim();
  if(!raw) return 100;
  const v=parseFloat(raw.replace(',','.'));
  if(!(v>=1&&v<=100)){toast('Ma part du compte : entre 1 et 100 %');return null;}
  return v;
}

// ═══════════════════════════════════════════════
// EDIT ACCOUNT (nom, icône, type, devise)
// ═══════════════════════════════════════════════
let _renameAccId=null;
function openRenameAcc(accId, currentName){
  _renameAccId=accId;
  const acc=S.accounts.find(a=>a.id===accId);
  const inp=document.getElementById('rename-acc-input');
  inp.value=currentName||'';
  setAccIcon('rename-acc-icon','rename-acc-icon-btn',acc?.icon||'📊');
  const curSel=document.getElementById('rename-acc-currency');
  if(curSel) curSel.value=acc?.currency||'EUR';
  document.getElementById('rename-acc-bank').value=acc?.bank||'';
  document.getElementById('rename-acc-start').value=acc?.startDate||'';
  document.getElementById('rename-acc-share').value=acc?.share??'';
  document.getElementById('rename-acc-type-rate').value=acc?.rate??'';
  // Un type hors liste (données anciennes) est ajouté comme option pour ne pas être perdu
  fillAccTypeSelect('rename-acc-type','rename-acc-type-other-row','rename-acc-type-other',acc?.type||'','rename-acc-currency',false);
  syncAccCurrency('rename-acc-type','rename-acc-currency',false);   // compte existant : sa devise n'est pas modifiée
  document.getElementById('rename-acc-bg').classList.add('show');
  document.getElementById('rename-acc-sheet').classList.add('show');
  setTimeout(()=>{inp.focus();inp.select();},330);
}
function closeRenameAcc(){
  closeIconPicker();
  document.getElementById('rename-acc-bg').classList.remove('show');
  document.getElementById('rename-acc-sheet').classList.remove('show');
  _renameAccId=null;
}
document.getElementById('rename-acc-bg').addEventListener('click',closeRenameAcc);
document.getElementById('rename-acc-close').addEventListener('click',closeRenameAcc);
document.getElementById('rename-acc-submit').addEventListener('click',()=>{
  const name=document.getElementById('rename-acc-input').value.trim();
  if(!name){toast('Nom requis');return;}
  const renamedId=_renameAccId;
  const acc=S.accounts.find(a=>a.id===renamedId); if(!acc) return;
  acc.name=name;
  acc.icon=document.getElementById('rename-acc-icon')?.value.trim()||acc.icon||'📊';
  // Changer de type ne doit pas rendre interdites des positions déjà saisies (un compte déjà non conforme reste modifiable sans changer de type)
  const newType=readAccType('rename-acc-type','rename-acc-type-other',acc.type||ACCOUNT_TYPES[0]);
  if(newType!==acc.type){
    const bad=accTypeViolations(acc,newType);
    if(bad.length){toast('Type incompatible avec : '+bad.map(h=>h.ticker).join(', '));return;}
  }
  acc.type=newType;
  acc.bank=document.getElementById('rename-acc-bank').value.trim();
  const startDate=document.getElementById('rename-acc-start').value||'';
  if(startDate&&startDate>_dayKey(Date.now())){toast("La date d'ouverture ne peut pas être dans le futur");return;}
  const share=accShareInput('rename-acc-share'); if(share===null) return;
  const rt=isSavingsType(newType)?savingsRateInput(document.getElementById('rename-acc-type-rate').value):{rate:null};
  if(rt.error){toast(rt.error);return;}
  if(rt.rate!=null) acc.rate=rt.rate; else delete acc.rate;
  if(share<100) acc.share=share; else delete acc.share;
  if(startDate) acc.startDate=startDate; else delete acc.startDate;
  cfStampCcy(acc); // les apports anciens gardent leur devise : changer la devise du compte ne les réinterprète pas
  acc.currency=document.getElementById('rename-acc-currency').value||'EUR';
  acc.value=accTotal(acc);
  saveAccounts();
  closeRenameAcc();
  refreshMain();
  if(S.screen==='account'&&S.accountId===renamedId) renderScreen('account');
  toast(`Compte mis à jour ✓`);
});
// Also submit on Enter key
document.getElementById('rename-acc-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();document.getElementById('rename-acc-submit').click();}
});


// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('acc-modal-sheet', closeAccModal);
registerModal('acc-action-sheet', closeAccMenu);
registerModal('rename-acc-sheet', closeRenameAcc);
