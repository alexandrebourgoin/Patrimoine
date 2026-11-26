// Modales de compte : types de compte, ajout, menu d actions, modification, suppression.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// ── Types de compte ────────────────────────────────────────────────────
// La liste ACCOUNT_TYPES et les règles (devise par type, types d'actifs autorisés) sont dans js/features/account-rules.js (pures, testées).
// Une table de règles qui référencerait un libellé inconnu serait inopérante sans bruit : on le signale dès le démarrage.
accountRulesProblems().forEach(p => console.warn('[règles de comptes] ' + p));
taxEnvelopeProblems(ACCOUNT_TYPES).forEach(p => console.warn('[enveloppes fiscales] type inconnu : ' + p));
// Accueil « À surveiller » (sous garde) : plus de comptes d'un type que permis (ex. deux Livret A)
if (typeof HOME_WATCH !== 'undefined') HOME_WATCH.accountLimits = () => accTypeLimitProblems(S.accounts)
  .map(x => ({ level: 'alert', go: 'comptes', text: `${x.count} comptes « ${x.type} »`, sub: x.max === 1 ? 'Un seul autorisé par personne : supprime le doublon ou passe-le en « Compte observateur »' : `Au plus ${x.max} par personne` }));

// Accueil « À surveiller » (sous garde) : comptes dont le type n'est plus proposé, à reclasser (migration guidée)
if (typeof HOME_WATCH !== 'undefined') HOME_WATCH.accountTypes = () => accToReclassify(S.accounts)
  .map(a => ({ level: 'info', go: 'account', accountId: a.id, text: `« ${a.name} » à reclasser`, sub: `Le type « ${a.type} » n'est plus proposé` }));

// Aligne le sélecteur de devise sur le type choisi (règle : accCurrencyForType). apply = true à la création, false pour un compte existant.
function syncAccCurrency(typeSelId, curSelId, apply){
  const typeSel=document.getElementById(typeSelId), cur=document.getElementById(curSelId);
  if(!typeSel||!cur) return;
  const r=accCurrencyForType(typeSel.value, cur.value, [...cur.options].map(o=>o.value), apply);
  cur.value=r.value;
  cur.disabled=r.locked;
  cur.title=r.reason;
}

// Remplit un <select> de types, regroupés par catégorie (ACCOUNT_TYPE_GROUPS), et pré-sélectionne `value`.
// Un type hors liste (données anciennes) est conservé dans une section « Type actuel ».
// `curSelId` (optionnel) : sélecteur de devise à aligner sur le type ; `applyCurrency` : true à la création (la devise suit le type).
function fillAccTypeSelect(selId, value, curSelId, applyCurrency){
  const sel=document.getElementById(selId); if(!sel) return;
  const opt=t=>`<option value="${esc(t)}">${esc(t)}</option>`;
  const legacy=value&&!ACCOUNT_TYPES.includes(value)?`<optgroup label="Type actuel">${opt(value)}</optgroup>`:'';
  sel.innerHTML=legacy+ACCOUNT_TYPE_GROUPS.map(g=>`<optgroup label="${esc(g.label)}">${g.types.map(opt).join('')}</optgroup>`).join('');
  sel.value=value||ACCOUNT_TYPES[0];
  sel.onchange=()=>{
    if(curSelId) syncAccCurrency(selId,curSelId,!!applyCurrency);
    syncAccEnvHint(selId);
    syncAccSavings(selId,true);
    syncAccShareRow(selId);
    syncAccNamePlaceholder();
  };
  syncAccEnvHint(selId);
  syncAccSavings(selId,false);
  syncAccShareRow(selId);
  if(typeof syncTypePickerButton==='function') syncTypePickerButton(selId);   // bouton du choix du type (js/modals/type-picker.js)
}

// Part du compte (compte joint) : seulement pour les types qui peuvent être détenus à plusieurs (accJointAllowed)
function syncAccShareRow(selId){
  const sel=document.getElementById(selId), inp=document.getElementById(selId.replace(/-type$/,'-share'));
  if(!sel||!inp) return;
  const ok=accJointAllowed(sel.value);
  inp.closest?.('.form-row')?.classList.toggle('hidden',!ok);
  if(!ok) inp.value='';
}
// Nom proposé (création) : affiché en grisé, retenu si le champ reste vide
function syncAccNamePlaceholder(){
  const inp=document.getElementById('acc-name'); if(!inp) return;
  inp.placeholder=accDefaultName(readAccType('acc-type',ACCOUNT_TYPES[0]),document.getElementById('acc-bank')?.value,S.accounts);
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

// Type choisi dans la liste (ou le type actuel conservé)
function readAccType(selId, fallback){ return document.getElementById(selId)?.value||fallback; }

// ═══════════════════════════════════════════════
// ADD ACCOUNT MODAL
// ═══════════════════════════════════════════════
let _accObserver=false;
function openAccModal(){
  _accObserver=false;
  document.getElementById('acc-name').value='';
  document.getElementById('acc-bank').value='';
  document.getElementById('acc-start').value='';
  document.getElementById('acc-share').value='';
  document.getElementById('acc-balance').value='';
  document.getElementById('acc-type-rate').value='';
  fillAccTypeSelect('acc-type','','acc-currency',true);
  document.getElementById('acc-currency').value='EUR';
  syncAccCurrency('acc-type','acc-currency',true);   // la devise suit le type proposé par défaut
  document.getElementById('acc-obs-tog').classList.remove('on');
  document.getElementById('acc-modal-bg').classList.add('show');
  document.getElementById('acc-modal-sheet').classList.add('show');
  syncAccNamePlaceholder();
  setTimeout(()=>document.getElementById('acc-name').focus(),330);
}
function closeAccModal(){
  document.getElementById('acc-modal-bg').classList.remove('show');
  document.getElementById('acc-modal-sheet').classList.remove('show');
}
document.getElementById('acc-modal-bg').addEventListener('click',closeAccModal);
document.getElementById('acc-modal-close').addEventListener('click',closeAccModal);
document.getElementById('acc-bank').addEventListener('input',syncAccNamePlaceholder);
document.getElementById('acc-obs-tog').addEventListener('click',()=>{
  _accObserver=!_accObserver;
  document.getElementById('acc-obs-tog').classList.toggle('on',_accObserver);
});
document.getElementById('acc-submit').addEventListener('click',()=>{
  const type=readAccType('acc-type',ACCOUNT_TYPES[0]);
  const bank=document.getElementById('acc-bank').value.trim();
  const name=document.getElementById('acc-name').value.trim()||accDefaultName(type,bank,S.accounts);   // nom proposé si vide
  const limit=accTypeLimitError(S.accounts,type,null,_accObserver); if(limit){toast(limit);return;}
  const startDate=document.getElementById('acc-start').value||'';
  const share=accJointAllowed(type)?accShareInput('acc-share'):100; if(share===null) return;
  if(startDate&&startDate>_dayKey(Date.now())){toast("La date d'ouverture ne peut pas être dans le futur");return;}
  const id='acc_'+Date.now().toString(36);
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
  const acc={id,name,type,bank,currency,value:0,change1d:0,holdings:[],cashflows,observer:_accObserver,...(startDate?{startDate}:{}),...(share<100?{share}:{}),...(rate!=null?{rate}:{})};
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
// Quote-part modifiée sur un compte existant : les points d'historique déjà enregistrés gardent l'ancienne part
// (snapshots de totalWealth) ; la courbe d'évolution fait donc un saut le jour du changement. '' si la part ne change pas.
function accShareHistoryNote(before, after){
  if(Math.abs(before-after)<1e-9) return '';
  return `Les totaux comptent maintenant ${Math.round(after*100)} % de ce compte. L'historique déjà enregistré n'est pas recalculé : la courbe d'évolution fera un saut à partir d'aujourd'hui.`;
}
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
// Compte concerné par le choix du type (js/modals/type-picker.js) : le compte modifié, ou un brouillon vide à la création
function accTypePickerContext(selId){
  if(selId==='rename-acc-type') return S.accounts.find(a=>a.id===_renameAccId)||null;
  if(selId==='acc-type') return { id:null, type:'', holdings:[], observer:!!_accObserver };
  return null;
}
function openRenameAcc(accId, currentName){
  _renameAccId=accId;
  const acc=S.accounts.find(a=>a.id===accId);
  const inp=document.getElementById('rename-acc-input');
  inp.value=currentName||'';
  const curSel=document.getElementById('rename-acc-currency');
  if(curSel) curSel.value=acc?.currency||'EUR';
  document.getElementById('rename-acc-bank').value=acc?.bank||'';
  document.getElementById('rename-acc-start').value=acc?.startDate||'';
  document.getElementById('rename-acc-share').value=acc?.share??'';
  document.getElementById('rename-acc-type-rate').value=acc?.rate??'';
  // Un type hors liste (données anciennes) est ajouté comme option pour ne pas être perdu
  fillAccTypeSelect('rename-acc-type',acc?.type||'','rename-acc-currency',false);
  syncAccCurrency('rename-acc-type','rename-acc-currency',false);   // compte existant : sa devise n'est pas modifiée
  document.getElementById('rename-acc-bg').classList.add('show');
  document.getElementById('rename-acc-sheet').classList.add('show');
  setTimeout(()=>{inp.focus();inp.select();},330);
}
function closeRenameAcc(){
  document.getElementById('rename-acc-bg').classList.remove('show');
  document.getElementById('rename-acc-sheet').classList.remove('show');
  _renameAccId=null;
}
document.getElementById('rename-acc-bg').addEventListener('click',closeRenameAcc);
document.getElementById('rename-acc-close').addEventListener('click',closeRenameAcc);
document.getElementById('rename-acc-submit').addEventListener('click',()=>{
  const renamedId=_renameAccId;
  const acc=S.accounts.find(a=>a.id===renamedId); if(!acc) return;
  const shareBefore=accShare(acc);   // avant tout changement de type ou de part (message sur l'historique)
  const newType0=readAccType('rename-acc-type',acc.type||ACCOUNT_TYPES[0]);
  const name=document.getElementById('rename-acc-input').value.trim()||accDefaultName(newType0,document.getElementById('rename-acc-bank').value,S.accounts.filter(a=>a.id!==acc.id));
  { const why=accTypeBlockReason(acc,newType0,S.accounts); if(why){toast(why);return;} }   // positions non autorisées, nombre maximal
  acc.name=name;
  // Changer de type ne doit pas rendre interdites des positions déjà saisies (un compte déjà non conforme reste modifiable sans changer de type)
  const newType=readAccType('rename-acc-type',acc.type||ACCOUNT_TYPES[0]);
  accApplyTypeChange(acc,newType);   // garde l'ancien type s'il a été retiré de la liste (acc.formerType)
  acc.bank=document.getElementById('rename-acc-bank').value.trim();
  const startDate=document.getElementById('rename-acc-start').value||'';
  if(startDate&&startDate>_dayKey(Date.now())){toast("La date d'ouverture ne peut pas être dans le futur");return;}
  const share=accJointAllowed(newType)?accShareInput('rename-acc-share'):100; if(share===null) return;   // PEA, livrets… : 100 %
  const rt=isSavingsType(newType)?savingsRateInput(document.getElementById('rename-acc-type-rate').value):{rate:null};
  if(rt.error){toast(rt.error);return;}
  if(rt.rate!=null) acc.rate=rt.rate; else delete acc.rate;
  if(share<100) acc.share=share; else delete acc.share;
  const shareMsg=accShareHistoryNote(shareBefore, accShare(acc));
  if(startDate) acc.startDate=startDate; else delete acc.startDate;
  cfStampCcy(acc); // les apports anciens gardent leur devise : changer la devise du compte ne les réinterprète pas
  acc.currency=document.getElementById('rename-acc-currency').value||'EUR';
  acc.value=accTotal(acc);
  saveAccounts();
  closeRenameAcc();
  refreshMain();
  if(S.screen==='account'&&S.accountId===renamedId) renderScreen('account');
  toast(shareMsg?`Compte mis à jour ✓ ${shareMsg}`:`Compte mis à jour ✓`);
});
// Also submit on Enter key
document.getElementById('rename-acc-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();document.getElementById('rename-acc-submit').click();}
});


// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('acc-modal-sheet', closeAccModal);
registerModal('acc-action-sheet', closeAccMenu);
registerModal('rename-acc-sheet', closeRenameAcc);
