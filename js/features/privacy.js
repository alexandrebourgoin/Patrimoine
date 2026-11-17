// Confidentialité en arrière-plan : voile pendant le passage en arrière-plan + masquage après inactivité.
// Les écouteurs principaux vivent dans le pré-script du <head> de mon-patrimoine.html (armés avant tout parsing).
// Dépend, À L APPEL seulement, de S (mon-patrimoine.js). _idleReset() est armé à l init (mon-patrimoine.js).

// ═══════════════════════════════════════════════
// VOILE DE CONFIDENTIALITÉ EN ARRIÈRE-PLAN
// ═══════════════════════════════════════════════
// Les écouteurs et la bascule vivent dans le pré-script du <head> (armés avant le
// parsing de ce fichier). Ici on ne fait que synchroniser le réglage utilisateur.
function _bgShield(on) { window.__bgShield?.(on); }

// Le panneau de diagnostic n'était peint qu'au rendu de l'écran Réglages : les lignes
// enregistrées pendant l'absence n'apparaissaient jamais (« rien ne s'ajoute »).
function _bgLogPaint() {
  const el = document.getElementById('js-bg-log'); if (!el) return;
  const l = window.__bgLog || [];
  el.textContent = l.length ? l.join('\n') : "Aucun événement. Passez l'appli en arrière-plan puis revenez ici.";
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(_bgLogPaint, 0); });
window.addEventListener('focus', () => setTimeout(_bgLogPaint, 0));

// ── Masquage après inactivité ──────────────────────────────────────────────
// Seul levier réellement fiable : poser le voile PENDANT que l'appli est encore au
// premier plan. Le journal montre que le voile est bien posé sur `blur`, 170 ms avant
// `hidden` et page encore visible — et que la miniature Android montre quand même les
// montants : le système photographie la fenêtre avant. Un masquage déclenché au départ
// arrivera donc toujours trop tard sur cet appareil.
let _idleTimer = null;
function _shieldNow(on) { document.documentElement.classList.toggle('bgshield', !!on); }
function _idleReset() {
  clearTimeout(_idleTimer); _idleTimer = null;
  if (!document.hidden && document.documentElement.classList.contains('bgshield')) _shieldNow(false);
  const s = +S.bgIdle || 0;
  if (s > 0 && !document.hidden) _idleTimer = setTimeout(() => _shieldNow(true), s * 1000);
}
['pointerdown','keydown','touchstart','wheel','scroll'].forEach(ev =>
  document.addEventListener(ev, _idleReset, { passive: true, capture: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) _idleReset(); });


function _bgPrivacySync() { window.__bgPrivacy = !!S.bgPrivacy; }
