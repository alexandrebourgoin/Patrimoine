// Navigation entre écrans : pile S.stack, go() / back(), renderScreen() (injecte le HTML puis bindEvents) et refreshMain().
// Dépend, À L APPEL seulement, de S, des render*() de js/screens/* et de saveData (storage.js).

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
const EASE='cubic-bezier(.4,0,.2,1)';
const NAV_SCREENS=['dashboard','comptes','recherche','analysis'];

// dir: 'back' | 'forward' | null (null = auto-detect from stack for hierarchical nav)
function go(target, dir=null) {
  if(target===S.screen) return;
  const prevEl=document.getElementById('s-'+S.screen);
  const nextEl=document.getElementById('s-'+target);

  // Direction: explicit for tab nav, auto-detect from stack for back()
  const isBack = dir!=null ? dir==='back'
    : (S.stack.length>1 && S.stack[S.stack.length-2]===target);

  // Always re-render for tab nav and forward; skip re-render on hierarchical back (preserves scroll)
  if(dir!=null || !isBack) { renderScreen(target); nextEl.scrollTop=0; }

  // Bring both transitioning screens above inactive ones
  prevEl.style.zIndex='1';
  nextEl.style.zIndex='2';

  nextEl.style.transition='none';
  nextEl.style.transform=isBack?'translateX(-22%)':'translateX(100%)';
  nextEl.offsetHeight; // force reflow
  nextEl.style.transition=`transform .32s ${EASE}`;
  prevEl.style.transition=`transform .32s ${EASE}`;
  nextEl.style.transform='translateX(0)';
  prevEl.style.transform=isBack?'translateX(100%)':'translateX(-22%)';

  // Stack management
  if(dir!=null) S.stack=[target];        // tab nav: flat stack
  else if(isBack) S.stack.pop();          // back(): unwind
  else S.stack.push(target);              // forward: push

  S.screen=target;
  setTimeout(()=>{
    prevEl.style.zIndex='';
    prevEl.style.transition='';
    prevEl.style.transform='';
    nextEl.style.zIndex='';
    nextEl.style.transition='';
  }, 350);

  const showNav=navVisibleFor(target);
  document.getElementById('nav').classList.toggle('hidden',!showNav);
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('on',b.dataset.nav===target));
}

function back() {
  if (S.screen === 'account' && S.stack[S.stack.length - 2] !== 'comptes') {
    go('comptes', 'back');
    return;
  }
  if (S.stack.length > 1) {
    go(S.stack[S.stack.length - 2]);
  } else {
    // Fallback défensif : si le stack est corrompu, on sait quand même
    // où on doit revenir selon l'écran courant
    const fallbacks = {
      account: 'comptes', stock: 'account',
      watchstock: 'dashboard', settings: 'dashboard', assistant: 'dashboard', dca: 'dashboard', orders: 'dashboard', stale: 'dashboard', immo: 'dashboard', immodetail: 'immo',
    };
    const fb = fallbacks[S.screen];
    if (fb) go(fb);
  }
}

// ═══════════════════════════════════════════════
// RENDERERS
// ═══════════════════════════════════════════════
function renderScreen(id) {
  const el=document.getElementById('s-'+id);
  const map={dashboard:renderDash,comptes:renderComptes,recherche:renderRecherche,account:renderAccount,stock:renderStock,analysis:renderAnalysis,settings:renderSettings,watchstock:renderWatchStock,assistant:renderAssistant,dca:renderDca,orders:renderOrders,stale:renderStale,immo:renderImmo,immodetail:renderImmoDetail};
  if(map[id]) { el.innerHTML=map[id](); bindEvents(id,el); }
}

// Refresh all top-level screens (dashboard, comptes, analysis)
// + recherche if it's currently visible (search results may change)
function refreshMain() {
  renderScreen('dashboard');
  renderScreen('comptes');
  renderScreen('analysis');
  if(S.screen==='recherche') renderScreen('recherche');
  if(S.screen==='orders') renderScreen('orders');   // alertes recalculées après chaque actualisation des cours
  if(S.screen==='stale')  renderScreen('stale');    // liste « Non synchro » recalculée après chaque actualisation
  renderNav();                                      // pastilles de la barre du bas
  saveData();
}
