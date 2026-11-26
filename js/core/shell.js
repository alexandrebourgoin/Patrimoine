// Coque de l application : barre du haut, menu burger (tiroir), barre du bas configurable (raccourcis), swipe entre onglets.
// Dépend de dom-guard.js (tiroir créé si absent) ; le reste À L APPEL seulement (S, go, renderScreen, toast…).

// ── TOP BAR commun (tous les écrans principaux) ──
const _SVG_SETTINGS = `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35c-.59.24-1.13.56-1.62.94L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`;
const _SVG_ASSISTANT = `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15.5l-2.6.95L18 19l-.9-2.55L14.5 15.5l2.6-1L18 12zM6 14l.75 2.05L8.8 16.8l-2.05.75L6 19.6l-.75-2.05L3.2 16.8l2.05-.75L6 14z"/></svg>`;
const _SVG_VIEW_LIST = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z"/></svg>`;
const _SVG_VIEW_GRID = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/></svg>`;

// Bouton du menu burger (ouvre le tiroir : écouteur délégué sur #js-burger-btn plus bas), avec la pastille de l'assistant.
function burgerBtnHTML() {
  const _n = S.assistantEnabled ? assistantAlertCount() : 0;
  return `<div id="js-burger-btn" class="top-btn tap" title="Menu${_n?` — ${_n} point${_n>1?'s':''} important${_n>1?'s':''} dans l'assistant`:''}" style="position:relative"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>${_n?`<span class="assistant-badge">${_n>9?'9+':_n}</span>`:''}</div>`;
}

function renderTopBar(extraBtns='') {
  return `<div class="top-bar">
    <div class="top-bar-title">Mon patrimoine</div>
    <div class="row gap8">
      ${extraBtns}
      ${burgerBtnHTML()}
    </div>
  </div>`;
}

// ── BARRE DE TITRE des écrans de module (DCA, Ordres, Immobilier, Assistant, Réglages…) : on y arrive par le menu ou la
// barre du bas, comme aux écrans principaux : nom du module (navLabel) + burger, pas de « Retour » (le retour Android reste).
// subtitle : texte déjà échappé, facultatif.
function moduleBarHTML(key, subtitle='') {
  return `<div class="top-bar"><div class="top-bar-title">${navLabel(key)}</div><div class="row gap8">${burgerBtnHTML()}</div></div>${subtitle ? `<div class="module-sub">${subtitle}</div>` : ''}`;
}

// ── BARRE « RETOUR » commune aux écrans de détail (compte, fiche titre, fiche d'un bien…) : lien retour à gauche, menu burger à droite ──
// label : texte déjà échappé par l'appelant (ex. esc(acc.name)).
const _SVG_BACK = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`;
function backBarHTML(label='Retour') {
  return `<div class="back-bar"><div class="back tap" id="js-back">${_SVG_BACK} ${label}</div>${burgerBtnHTML()}</div>`;
}

// ═══════════════════════════════════════════════
// MENU BURGER (tiroir) + RACCOURCIS DE LA BARRE DU BAS
// ═══════════════════════════════════════════════
const _NAV_PATH = {
  dashboard: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  comptes:   'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zM11.5 1L2 6v2h19V6l-9.5-5z',
  recherche: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  analysis:  'M11 2v20C5.93 21.5 2 17.21 2 12s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z',
  assistant: 'M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15.5l-2.6.95L18 19l-.9-2.55L14.5 15.5l2.6-1L18 12zM6 14l.75 2.05L8.8 16.8l-2.05.75L6 19.6l-.75-2.05L3.2 16.8l2.05-.75L6 14z',
  settings:  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35c-.59.24-1.13.56-1.62.94L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  dca:       'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  orders:    'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  immo:      'M17 11V3H7v4H3v14h8v-4h2v4h8V11h-4zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm4 4H9v-2h2v2zm0-4H9V9h2v2zm0-4H9V5h2v2zm4 8h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 12h-2v-2h2v2zm0-4h-2v-2h2v2z',
  refresh:   'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  eye:       'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  eyeoff:    'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
};
// kind: 'screen' (ouvre un écran) | 'action' (exécute sans changer d'écran)
// label : LIBELLÉ UNIQUE du module (navLabel) : barre du bas, menu ET titre de l'écran. Le changer ici le change partout.
const NAV_CATALOG = {
  dashboard: { label:'Accueil',    kind:'screen' },
  comptes:   { label:'Comptes',    kind:'screen' },
  recherche: { label:'Recherche',  kind:'screen' },
  analysis:  { label:'Analyse',    kind:'screen' },
  dca:       { label:'DCA',        kind:'screen' },
  orders:    { label:'Ordres',     kind:'screen' },
  immo:      { label:'Immobilier', kind:'screen' },
  assistant: { label:'Assistant',  kind:'screen' },
  settings:  { label:'Réglages',   kind:'screen' },
  refresh:   { label:'Actualiser', kind:'action' },
  privacy:   { label:'Masquer',    kind:'action' },
};
const NAV_DEFAULT = ['dashboard','comptes','recherche','analysis'];
const NAV_MIN = 3, NAV_MAX = 5;

// Pastilles de compteur : chaque module enregistre sa fonction (NAV_BADGES.<clé> = () => nombre) ; l'assistant est géré ici.
// Une seule source par raccourci, utilisée par la barre du bas ET le tiroir.
const NAV_BADGES = {};
function navBadgeCount(key) {
  if (key==='assistant') return S.assistantEnabled ? assistantAlertCount() : 0;
  return NAV_BADGES[key] ? NAV_BADGES[key]() : 0;
}

function navIconSvg(key, size=22) {
  const p = key==='privacy' ? (S.privacy ? _NAV_PATH.eyeoff : _NAV_PATH.eye) : _NAV_PATH[key];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="${p}"/></svg>`;
}
function navLabel(key) {
  if (key==='privacy') return S.privacy ? 'Afficher' : 'Masquer';
  return NAV_CATALOG[key].label;
}
// Raccourcis effectivement affichés (l'assistant disparaît s'il est désactivé dans Réglages)
function activeNavItems() {
  return S.navItems.filter(k => NAV_CATALOG[k] && !(k==='assistant' && !S.assistantEnabled));
}
// La barre du bas est visible sur les écrans principaux ET sur tous les écrans de module du catalogue (DCA, Ordres,
// Immobilier, Assistant, Réglages…), raccourci ou non : depuis un module, on rejoint directement les raccourcis.
// Les écrans de détail (compte, fiche titre, fiche d'un bien, titre suivi) gardent tout l'écran.
function navVisibleFor(screen) {
  return NAV_SCREENS.includes(screen) || NAV_CATALOG[screen]?.kind === 'screen' || activeNavItems().includes(screen);
}
function renderNav() {
  const nav = document.getElementById('nav'); if (!nav) return;
  const items = activeNavItems();
  // Écrans « sans nav » où la barre s'affiche quand même (modules) : on leur réserve sa place en bas
  document.querySelectorAll('.screen.no-nav').forEach(s => s.classList.toggle('has-nav', navVisibleFor(s.id.slice(2))));
  nav.classList.toggle('hidden', !navVisibleFor(S.screen));
  nav.innerHTML = items.map(k => {
    const n = navBadgeCount(k);
    return `<div class="nav-btn${k===S.screen?' on':''}" data-nav="${k}">${navIconSvg(k)}<span>${navLabel(k)}</span>${n?`<span class="nav-badge">${n>9?'9+':n}</span>`:''}<div class="nav-pip"></div></div>`;
  }).join('');
}
function togglePrivacy() {
  S.privacy = !S.privacy;
  ['dashboard','comptes','account','stock','analysis','recherche'].forEach(renderScreen);
  renderNav();
}
// Exécute un raccourci / une entrée de menu
function runShortcut(key) {
  const def = NAV_CATALOG[key]; if (!def) return;
  if (key==='refresh') { fetchLivePrices(); return; }
  if (key==='privacy') { togglePrivacy(); return; }
  if (key===S.screen) return;
  if (NAV_SCREENS.includes(key)) {
    const fi = NAV_SCREENS.indexOf(S.screen), ti = NAV_SCREENS.indexOf(key);
    go(key, (fi>=0 && ti<fi) ? 'back' : 'forward');
  } else {
    go(key);
  }
}
function sanitizeNavItems(arr) {
  if (!Array.isArray(arr)) return NAV_DEFAULT.slice();
  const out = [...new Set(arr.filter(k => NAV_CATALOG[k]))].slice(0, NAV_MAX);
  return out.length >= NAV_MIN ? out : NAV_DEFAULT.slice();
}



let _drawerEdit = false;
function drawerRow(key, opts={}) {
  const badge = navBadgeCount(key);
  const lbl = navLabel(key);   // même libellé que la barre du bas et le titre de l'écran
  const on = NAV_CATALOG[key].kind==='screen' && key===S.screen;
  return `<div class="dr-row${on?' on':''}" data-dkey="${key}"${key==='refresh'?' id="js-refresh-btn"':''}>
    ${navIconSvg(key,20)}<span class="dr-lbl">${lbl}</span>
    ${badge?`<span class="dr-pill">${badge>9?'9+':badge}</span>`:''}
    ${key==='refresh'?'<span class="fresh-dot" id="js-fresh-dot"></span>':''}
  </div>`;
}
function renderDrawer() {
  const d = document.getElementById('drawer'); if (!d) return;
  const close = `<div class="dr-btn" id="js-drawer-close" title="Fermer">✕</div>`;
  if (!_drawerEdit) {
    d.innerHTML = `<div class="dr-head"><div class="dr-title">Menu</div>${close}</div>
      <div class="dr-sec">Actions</div>
      ${['privacy','refresh', ...(S.assistantEnabled?['assistant']:[]), 'settings'].map(k=>drawerRow(k)).join('')}
      <div class="dr-sec">Écrans</div>
      ${[...NAV_SCREENS, 'dca', 'orders', 'immo'].map(k=>drawerRow(k)).join('')}
      <div class="dr-sep"></div>
      <div class="dr-row" id="js-drawer-edit"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg><span class="dr-lbl">Personnaliser la barre du bas</span></div>`;
  } else {
    const sel = S.navItems.filter(k => NAV_CATALOG[k]);
    const rest = Object.keys(NAV_CATALOG).filter(k => !sel.includes(k));
    const full = sel.length >= NAV_MAX;
    d.innerHTML = `<div class="dr-head"><div class="dr-title">Barre du bas</div>${close}</div>
      <div class="dr-hint">Choisis entre ${NAV_MIN} et ${NAV_MAX} raccourcis et réordonne-les (${sel.length}/${NAV_MAX}).</div>
      <div class="dr-sec">Affichés</div>
      ${sel.map((k,i)=>`<div class="dr-row" style="cursor:default">${navIconSvg(k,20)}<span class="dr-lbl">${NAV_CATALOG[k].label}</span>
        <div class="dr-btn${i===0?' off':''}" data-dmove="${k}" data-dir="-1">↑</div>
        <div class="dr-btn${i===sel.length-1?' off':''}" data-dmove="${k}" data-dir="1">↓</div>
        <div class="dr-btn${sel.length<=NAV_MIN?' off':''}" data-dtoggle="${k}">✕</div></div>`).join('')}
      <div class="dr-sec">Disponibles</div>
      ${rest.map(k=>`<div class="dr-row" style="cursor:default">${navIconSvg(k,20)}<span class="dr-lbl">${NAV_CATALOG[k].label}</span>
        <div class="dr-btn${full?' off':''}" data-dtoggle="${k}">+</div></div>`).join('')}
      <div class="dr-sep"></div>
      <div class="dr-row" id="js-drawer-back"><span class="dr-lbl">← Retour au menu</span></div>
      <div class="dr-row" id="js-drawer-reset"><span class="dr-lbl" style="color:var(--text3)">Rétablir les raccourcis par défaut</span></div>`;
  }
  // Couleur du point de fraîcheur des cours (même seuils que l'ancien bouton ↻)
  const dot = d.querySelector('#js-fresh-dot');
  if (dot) {
    const age = S.lastPriceUpdate ? Date.now() - S.lastPriceUpdate : Infinity;
    dot.style.background = age < 5*60*1000 ? 'var(--gain)' : age < 60*60*1000 ? '#F59E0B' : 'var(--text3)';
  }
}
function openDrawer() {
  _drawerEdit = false;
  renderDrawer();
  document.getElementById('drawer-bg').classList.add('show');
  document.getElementById('drawer').classList.add('show');
}
function closeDrawer() {
  document.getElementById('drawer-bg').classList.remove('show');
  document.getElementById('drawer').classList.remove('show');
}
function saveNavItems(items) {
  S.navItems = items;
  saveSettings();
  renderNav();
  renderDrawer();
}
document.getElementById('drawer-bg').addEventListener('click', closeDrawer);
document.getElementById('drawer').addEventListener('click', e => {
  if (e.target.closest('#js-drawer-close')) { closeDrawer(); return; }
  if (e.target.closest('#js-drawer-edit'))  { _drawerEdit = true;  renderDrawer(); return; }
  if (e.target.closest('#js-drawer-back'))  { _drawerEdit = false; renderDrawer(); return; }
  if (e.target.closest('#js-drawer-reset')) { saveNavItems(NAV_DEFAULT.slice()); return; }
  const mv = e.target.closest('[data-dmove]');
  if (mv && !mv.classList.contains('off')) {
    const items = S.navItems.slice(), i = items.indexOf(mv.dataset.dmove), j = i + (+mv.dataset.dir);
    if (i>=0 && j>=0 && j<items.length) { [items[i], items[j]] = [items[j], items[i]]; saveNavItems(items); }
    return;
  }
  const tg = e.target.closest('[data-dtoggle]');
  if (tg && !tg.classList.contains('off')) {
    const k = tg.dataset.dtoggle;
    const items = S.navItems.includes(k) ? S.navItems.filter(x => x!==k) : [...S.navItems, k];
    if (items.length>=NAV_MIN && items.length<=NAV_MAX) saveNavItems(items);
    return;
  }
  const row = e.target.closest('[data-dkey]');
  if (row) {
    const key = row.dataset.dkey;
    if (key==='refresh') { fetchLivePrices(); closeDrawer(); return; }   // le spinner est sur l'icône du menu
    closeDrawer();
    runShortcut(key);
  }
});
// Ouverture depuis le bouton ☰ (présent dans la barre du haut de chaque écran principal)
document.addEventListener('click', e => { if (e.target.closest('#js-burger-btn')) openDrawer(); });

// ═══════════════════════════════════════════════
// BOTTOM NAV
// ═══════════════════════════════════════════════
// Barre dynamique (raccourcis configurables, voir renderNav) : délégation d'événements
document.getElementById('nav').addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (b) runShortcut(b.dataset.nav);
});
// Filet de sécurité : au retour dans l'appli, on reconstruit la barre si elle est vide ou si son
// état (visible/masquée) ne correspond pas à l'écran courant (cas observé après une mise à jour)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const n = document.getElementById('nav');
  if (n && (!n.children.length || n.classList.contains('hidden') === navVisibleFor(S.screen))) renderNav();
});

// ═══════════════════════════════════════════════
// SWIPE ENTRE ONGLETS
// ═══════════════════════════════════════════════
(function(){
  let x0=0, y0=0, tgt0=null, scrolling=null, lastNav=0;
  const app=document.getElementById('app');

  app.addEventListener('touchstart', e=>{
    x0=e.touches[0].clientX;
    y0=e.touches[0].clientY;
    tgt0=e.target;
    scrolling=null;
  },{passive:true});

  app.addEventListener('touchmove', e=>{
    if(scrolling!==null) return;
    const dx=Math.abs(e.touches[0].clientX-x0);
    const dy=Math.abs(e.touches[0].clientY-y0);
    if(dy>dx+4) scrolling=true;        // geste vertical → scroll natif
    else if(dx>10) scrolling=false;    // geste horizontal → swipe
  },{passive:true});

  app.addEventListener('touchend', e=>{
    if(scrolling!==false) return;                      // scroll ou ambigu
    if(!NAV_SCREENS.includes(S.screen)) return;        // hors onglets nav
    if(tgt0&&tgt0.closest('.tabs')) return;            // chips filtres (scroll horizontal)
    if(Date.now()-lastNav<350) return;                 // animation déjà en cours

    const dx=e.changedTouches[0].clientX-x0;
    if(Math.abs(dx)<52) return;                        // trop court (<52px)

    const idx=NAV_SCREENS.indexOf(S.screen);
    if(dx<0 && idx<NAV_SCREENS.length-1){              // ← swipe gauche : onglet suivant
      lastNav=Date.now();
      go(NAV_SCREENS[idx+1],'forward');
    } else if(dx>0 && idx>0){                          // → swipe droite : onglet précédent
      lastNav=Date.now();
      go(NAV_SCREENS[idx-1],'back');
    }
  },{passive:true});
})();
