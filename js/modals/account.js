// Modales de compte : types de compte, ajout, menu d actions, modification, suppression.
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// ── Types de compte ─────────────────────────────────────────────────────────
// Liste proposée à la création ET à la modification. Un type absent de la liste
// (données anciennes, saisie « Autre ») reste conservé : il est ajouté à la volée
// comme option supplémentaire par setSelectValue.
const ACCOUNT_TYPES = [
  "Compte-Titres Ordinaire",
  "Plan d'Épargne en Actions (PEA)",
  "PEA-PME",
  "Assurance-Vie",
  "Plan d'Épargne Retraite (PER)",
  "Épargne salariale (PEE / PERCO)",
  "Pilier 3a",
  "Livret A",
  "LDDS",
  "LEP",
  "Livret Jeune",
  "Compte à terme",
  "Compte courant",
  "PEL / CEL",
  "SCPI / Immobilier",
  "Crypto / Exchange",
  "Métaux précieux",
];
const ACC_TYPE_OTHER = '__other__';

// Devise de référence par type de compte : [devise, verrouillée].
// Verrouillée = la devise est imposée par le produit (un PEA ou un Livret A sont en euros, un Pilier 3a en francs suisses).
// Non verrouillée = simple valeur par défaut, modifiable. Types absents : aucune présélection (crypto, métaux, « Autre… »).
const ACC_TYPE_CCY = {
  "Plan d'Épargne en Actions (PEA)": ['EUR', true],
  "PEA-PME": ['EUR', true],
  "Plan d'Épargne Retraite (PER)": ['EUR', true],
  "Épargne salariale (PEE / PERCO)": ['EUR', true],
  "Livret A": ['EUR', true],
  "LDDS": ['EUR', true],
  "LEP": ['EUR', true],
  "Livret Jeune": ['EUR', true],
  "PEL / CEL": ['EUR', true],
  "Pilier 3a": ['CHF', true],
  "Assurance-Vie": ['EUR', false],
  "Compte-Titres Ordinaire": ['EUR', false],
  "Compte à terme": ['EUR', false],
  "Compte courant": ['EUR', false],
  "SCPI / Immobilier": ['EUR', false],
};

// Aligne le sélecteur de devise sur le type choisi.
// apply = true (création, changement de type) : impose la devise du type, puis verrouille ou non le sélecteur.
// apply = false (ouverture d'un compte existant) : ne change pas la devise ; le sélecteur n'est verrouillé que si elle est déjà celle du type.
function syncAccCurrency(typeSelId, curSelId, apply){
  const typeSel=document.getElementById(typeSelId);
  const cur=document.getElementById(curSelId);
  if(!typeSel||!cur) return;
  const rule=ACC_TYPE_CCY[typeSel.value];
  if(apply && rule && [...cur.options].some(o=>o.value===rule[0])) cur.value=rule[0];
  cur.disabled=!!(rule && rule[1] && cur.value===rule[0]);
  cur.title=cur.disabled?'Devise imposée par le type de compte':'';
}

// Remplit un <select> de types et pré-sélectionne `value`. `otherRowId` est la ligne
// « Préciser le type », affichée quand l'option « Autre… » est choisie.
// `curSelId` (optionnel) : sélecteur de devise à aligner quand le type change.
function fillAccTypeSelect(selId, otherRowId, otherInpId, value, curSelId){
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
    if(curSelId) syncAccCurrency(selId,curSelId,true);
  };
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
  fillAccTypeSelect('acc-type','acc-type-other-row','acc-type-other','','acc-currency');
  const curSel=document.getElementById('acc-currency');
  if(curSel) curSel.value='EUR';
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
  if(!name){toast('Nom du compte requis');return;}
  const id='acc_'+Date.now().toString(36);
  const bgs=['rgba(79,142,247,.13)','rgba(0,194,203,.13)','rgba(0,214,143,.13)','rgba(245,158,11,.13)','rgba(167,139,250,.13)'];
  const iconBg=bgs[S.accounts.length%bgs.length];
  const currency=document.getElementById('acc-currency').value||'EUR';
  S.accounts.push({id,name,type,bank,icon,iconBg,currency,value:0,change1d:0,holdings:[],cashflows:[],observer:_accObserver});
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
  // Un type hors liste (données anciennes) est ajouté comme option pour ne pas être perdu
  fillAccTypeSelect('rename-acc-type','rename-acc-type-other-row','rename-acc-type-other',acc?.type||'','rename-acc-currency');
  syncAccCurrency('rename-acc-type','rename-acc-currency',false);   // compte existant : on ne change pas sa devise
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
  acc.type=readAccType('rename-acc-type','rename-acc-type-other',acc.type||ACCOUNT_TYPES[0]);
  acc.bank=document.getElementById('rename-acc-bank').value.trim();
  acc.currency=document.getElementById('rename-acc-currency').value||'EUR';
  acc.value=accTotal(acc); // la devise du compte entre dans la conversion des apports/retraits
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
