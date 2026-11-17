// Sélecteur d icône de compte (grille d emojis, drapeaux rendus en Twemoji). Empilé AU-DESSUS d une autre feuille.
// Non enregistré dans le registre : les handlers retour/Échap le ferment seul AVANT les autres feuilles (iconPickerOpen). Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js. Les écouteurs du DOM sont attachés à l évaluation (le DOM existe : scripts en fin de body).

// ═══════════════════════════════════════════════
// SÉLECTEUR D'ICÔNE DE COMPTE
// ═══════════════════════════════════════════════
const ICON_CHOICES=['🏦','💼','📊','📈','💰','💵','💶','💷',
                    '🪙','₿','💳','🧾','🏧','🐷','🎯','🛡️',
                    '🏠','🏡','🚗','✈️','🎓','👶','👨‍👩‍👧','❤️',
                    '🌱','🌍','🇫🇷','🇺🇸','🇪🇺','🌏','🔒','🔑',
                    '⭐','🚀','⚡','🎁','📦','🪴','🧊','🏆',
                    '🔴','🟠','🟢','🔵','🟣','⚫','⚪','🟤',
                    '🇨🇭','🇬🇧','🇩🇪','🇪🇸','🇮🇹','🇵🇹','🇱🇺','🇧🇪',
                    '🇳🇱','🇨🇦','🇯🇵','🇨🇳'];
let _iconTarget=null; // {inputId, btnId}

// Windows/Chromium n'a pas de police emoji couleur pour les drapeaux (paires de regional
// indicators) : ils s'affichent en 2 lettres ("FR") au lieu du drapeau. On les remplace par
// une image Twemoji ; tout le reste (emoji normaux) continue de s'afficher via la police système.
function isFlagEmoji(s){
  const cps=Array.from(s||'');
  return cps.length===2 && cps.every(c=>{const cp=c.codePointAt(0);return cp>=0x1F1E6&&cp<=0x1F1FF;});
}
function _twemojiCode(s){ return Array.from(s).map(c=>c.codePointAt(0).toString(16)).join('-'); }
function _flagImgErr(img){ img.replaceWith(document.createTextNode(img.dataset.fallback)); }
// Rendu d'une icône de compte : image Twemoji pour un drapeau, texte brut sinon (emoji normal).
function iconHtml(ico){
  const v=(ico||'').trim()||'📊';
  if(!isFlagEmoji(v)) return v;
  return `<img class="flag-emoji-img" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${_twemojiCode(v)}.png" alt="${v}" data-fallback="${v}" onerror="_flagImgErr(this)">`;
}

// L'input caché garde la valeur (lue par les formulaires), le bouton l'affiche
function setAccIcon(inputId,btnId,val){
  const v=(val||'').trim()||'📊';
  const inp=document.getElementById(inputId); if(inp) inp.value=v;
  const btn=document.getElementById(btnId);   if(btn) btn.innerHTML=iconHtml(v);
}
function iconPickerOpen(){ return document.getElementById('icon-picker-sheet')?.classList.contains('show'); }
function openIconPicker(inputId,btnId){
  _iconTarget={inputId,btnId};
  const cur=document.getElementById(inputId)?.value||'📊';
  document.getElementById('icon-picker-grid').innerHTML=
    ICON_CHOICES.map(e=>`<div class="icon-opt tap${e===cur?' sel':''}" data-ico="${e}">${iconHtml(e)}</div>`).join('');
  const free=document.getElementById('icon-picker-free'); if(free) free.value='';
  document.getElementById('icon-picker-bg').classList.add('show');
  document.getElementById('icon-picker-sheet').classList.add('show');
}
function closeIconPicker(){
  document.getElementById('icon-picker-bg').classList.remove('show');
  document.getElementById('icon-picker-sheet').classList.remove('show');
  _iconTarget=null;
}
function _applyIcon(val){
  const v=(val||'').trim();
  if(!v){toast('Aucune icône choisie');return;}
  if(_iconTarget) setAccIcon(_iconTarget.inputId,_iconTarget.btnId,v);
  closeIconPicker();
}
document.getElementById('icon-picker-bg').addEventListener('click',closeIconPicker);
document.getElementById('icon-picker-close').addEventListener('click',closeIconPicker);
document.getElementById('icon-picker-grid').addEventListener('click',e=>{
  const opt=e.target.closest('.icon-opt'); if(!opt) return;
  _applyIcon(opt.dataset.ico);
});
document.getElementById('icon-picker-ok').addEventListener('click',()=>{
  _applyIcon(document.getElementById('icon-picker-free').value);
});
document.getElementById('icon-picker-free').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();_applyIcon(e.target.value);}
});
document.getElementById('acc-icon-btn').addEventListener('click',()=>openIconPicker('acc-icon','acc-icon-btn'));
document.getElementById('rename-acc-icon-btn').addEventListener('click',()=>openIconPicker('rename-acc-icon','rename-acc-icon-btn'));

