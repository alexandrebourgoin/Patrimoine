// Réorganisation des comptes par appui long + glissement (pas une modale).
// Dépend de S, refreshMain, toast. pointermove/pointerup/pointercancel sont attachés UNE SEULE fois au document (à l évaluation).

// ═══════════════════════════════════════════════
// RÉORGANISATION DES COMPTES (appui long + glissement)
// ═══════════════════════════════════════════════
// L'ordre de S.accounts est l'ordre d'affichage partout (comptes + dashboard).
// Appui maintenu sur une carte → elle se décolle et suit le doigt ; au relâché
// l'ordre est enregistré. Aucun mode persistant : tout tient dans le geste.
const DRAG_HOLD=330;    // ms d'appui avant décollage
const DRAG_SLOP=14;     // px de mouvement qui annulent l'appui long (= l'utilisateur défile)
const DRAG_GAP=12;      // gap12 entre les cartes
let _dragSuppressClick=false;   // empêche la navigation au clic qui suit un glissement
let _skipAccAnim=false;         // saute la cascade d'apparition au rendu qui suit un déplacement

let _drag=null;   // {list, card, y0, pid, timer, active, cards, rects, from, to}

function _dragReset(){
  const st=_drag; if(!st) return;
  _drag=null;
  if(st.timer) clearTimeout(st.timer);
  if(!st.active) return;
  document.documentElement.classList.remove('dragging-acc');
  st.cards.forEach(c=>{c.style.transform='';c.classList.remove('drag-lift','drag-shift');});
  try{ st.card.releasePointerCapture(st.pid); }catch(e){}
  // Le clic qui suit le relâché ne doit pas ouvrir le compte (il n'arrive pas toujours)
  _dragSuppressClick=true;
  setTimeout(()=>{_dragSuppressClick=false;},400);
}

function _dragActivate(){
  const st=_drag; if(!st) return;
  st.cards=[...st.list.querySelectorAll('.acc-card')];
  st.from=st.cards.indexOf(st.card);
  if(st.from<0||st.cards.length<2){ _drag=null; return; }
  st.rects=st.cards.map(c=>c.getBoundingClientRect());
  st.to=st.from; st.active=true;
  document.documentElement.classList.add('dragging-acc');
  // .anim est en animation-fill-mode:both : tant qu'elle est là, son transform final
  // écrase le translateY du glissement, et la neutraliser par CSS la ferait REJOUER
  // en cascade à la fin du geste (effet « l'écran se rafraîchit »). On la retire.
  st.cards.forEach(c=>c.classList.remove('anim'));
  st.cards.forEach((c,i)=>{ if(i!==st.from) c.classList.add('drag-shift'); });
  st.card.classList.add('drag-lift');
  try{ st.card.setPointerCapture(st.pid); }catch(e){}
  navigator.vibrate?.(20);
}

function _dragMove(y){
  const st=_drag; if(!st?.active) return;
  const dy=y-st.y0;
  const h=st.rects[st.from].height, span=h+DRAG_GAP;
  const cy=st.rects[st.from].top+dy+h/2;
  let to=st.from;
  for(let i=0;i<st.from;i++){ if(cy<st.rects[i].top+st.rects[i].height/2){ to=i; break; } }
  if(to===st.from) for(let i=st.rects.length-1;i>st.from;i--){ if(cy>st.rects[i].top+st.rects[i].height/2){ to=i; break; } }
  st.to=to;
  st.cards.forEach((c,i)=>{
    if(i===st.from){ c.style.transform=`translateY(${dy}px)`; return; }
    const shift=(i>st.from&&i<=to)?-span:(i<st.from&&i>=to)?span:0;
    c.style.transform=shift?`translateY(${shift}px)`:'';
  });
}

function _dragDrop(){
  const st=_drag; if(!st) return;
  const {active,from,to}=st;
  _dragReset();
  if(!active||to===from) return;
  const [acc]=S.accounts.splice(from,1);
  S.accounts.splice(to,0,acc);
  saveAccounts();
  _skipAccAnim=true;          // pas de cascade d'apparition après un déplacement
  renderScreen('comptes');
  renderScreen('dashboard');
  navigator.vibrate?.(12);
}

// Un seul point d'entrée pour la position, quel que soit le type d'événement
function _dragPoint(y){
  const st=_drag; if(!st) return;
  if(!st.active){   // bouger avant le décollage = l'utilisateur défile
    if(Math.abs(y-st.y0)>DRAG_SLOP) _dragReset();
    return;
  }
  _dragMove(y);
}

// Souris (bureau) : le pointeur peut sortir de la liste → écouteurs sur document,
// attachés une seule fois (renderComptes re-crée la liste à chaque rafraîchissement).
document.addEventListener('pointermove',e=>{ if(e.pointerType!=='touch') _dragPoint(e.clientY); });
document.addEventListener('pointerup',_dragDrop);
// ⚠️ pointercancel : Android l'envoie dès qu'il décide que le geste est un défilement
// (html,body sont en touch-action:pan-y). Il ne doit PAS tuer un glissement déjà en
// cours — les touchmove ci-dessous continuent de le piloter.
document.addEventListener('pointercancel',()=>{ if(!_drag?.active) _dragReset(); });

// Par rendu : les écouteurs liés à la liste elle-même.
// Les événements tactiles restent adressés à la cible du touchstart pendant tout le
// geste : les attacher à la liste suffit même si le doigt en sort.
function bindAccDrag(list){
  if(!list) return;
  list.addEventListener('pointerdown',e=>{
    if(e.button>0) return;                       // clic droit / molette
    if(e.target.closest('[data-menu]')) return;  // le bouton ⋮ garde son clic
    const card=e.target.closest('.acc-card'); if(!card) return;
    _dragReset();
    _drag={list,card,y0:e.clientY,pid:e.pointerId,active:false};
    _drag.timer=setTimeout(_dragActivate,DRAG_HOLD);
  });
  list.addEventListener('touchmove',e=>{
    const t=e.touches[0]; if(!t||!_drag) return;
    // Non passif : tant que le défilement n'a pas démarré (l'appui long impose
    // 330 ms d'immobilité), preventDefault empêche Chrome de s'emparer du geste.
    if(_drag.active&&e.cancelable) e.preventDefault();
    _dragPoint(t.clientY);
  },{passive:false});
  list.addEventListener('touchend',_dragDrop);
  list.addEventListener('touchcancel',_dragDrop);
  // Neutralise le clic de fin de glissement avant qu'il n'atteigne les cartes
  list.addEventListener('click',e=>{
    if(_dragSuppressClick){ e.stopPropagation(); _dragSuppressClick=false; }
  },true);
}
