// Utilitaires d interface : toast, retour haptique, thème, copie presse-papiers, journal de debug.
// Dépend, À L APPEL seulement, de S (mon-patrimoine.js).

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
let toastTimer;
// Durée d'affichage : 2,4 s, + 50 ms par caractère au-delà de 40, au plus 8 s
function toastDuration(msg) { return Math.min(8000, 2400 + Math.max(0, String(msg ?? '').length - 40) * 50); }
function toast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  // Message long (sur plusieurs lignes) : affiché plus longtemps pour avoir le temps de le lire
  toastTimer=setTimeout(()=>el.classList.remove('show'),toastDuration(msg));
}

function timeSince(ts) { return PU.timeSince(ts); }

// ── Log debug global (utilisé par fetch global ET refreshs individuels) ──
function dbgLog(tag, msg) {
  if (!S.debug) return;
  S._debugLog.unshift(`${tag} ${msg}`);
  if (S._debugLog.length > 80) S._debugLog.length = 80;
  // Mise à jour live du bloc log si la page settings est ouverte
  const logEl = document.getElementById('js-debug-log');
  if (logEl) {
    logEl.innerHTML = S._debugLog.map(l => {
      const col = l.startsWith('[OK')  ? 'var(--gain)'
                : l.startsWith('[ERR') ? 'var(--loss)'
                : l.startsWith('[WRN') ? '#F59E0B'
                : 'var(--text2)';
      return `<span style="color:${col}">${l.replace(/</g,'&lt;')}</span>`;
    }).join('\n');
  } else if (S.screen !== 'settings') {
    // Badge sur le bouton ⚙ pour signaler qu'il y a des logs à consulter
    document.querySelectorAll('#js-burger-btn').forEach(btn => {
      if (!btn.querySelector('.log-badge')) {
        const b = document.createElement('div');
        b.className = 'log-badge';
        b.style.cssText = 'position:absolute;bottom:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#F59E0B;border:1.5px solid var(--card);pointer-events:none';
        btn.style.position = 'relative';
        btn.appendChild(b);
      }
    });
  }
}

// ═══════════════════════════════════════════════
// Thèmes : liste, couleurs des graphiques et résolution d'« Auto » dans js/core/themes.js
function applyTheme(theme) {
  const key = resolveTheme(theme, !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  document.documentElement.setAttribute('data-theme', key === 'dark' ? '' : key);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[key] || THEME_BG.dark);
  applyChartPalette(key);
}

// ── Retour haptique (no-op sur desktop) ──
function haptic(ms=8) { try { navigator.vibrate?.(ms); } catch(_) {} }

// Copie presse-papiers avec repli (clipboard API absente hors contexte sécurisé)
function _copyText(txt) {
  navigator.clipboard?.writeText(txt).then(()=>toast('Copié ✓')).catch(()=>_copyFallback(txt))
    ?? _copyFallback(txt);
}
function _copyFallback(txt) {
  const ta=document.createElement('textarea');
  ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  toast('Copié ✓');
}
