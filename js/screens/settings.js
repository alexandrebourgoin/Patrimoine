// Écran Réglages : toutes les sections + binding (thème, devise, sécurité, données, débogage…).
// Dépend, À L APPEL seulement, de S et des helpers de mon-patrimoine.js ; enregistre son binding dans SCREEN_BIND (js/core/screens.js, chargé avant).

// ── SETTINGS ──
function fxSubText() { return PU.fxSubText(FX_RATES, S.currency || 'EUR', _fxUpdatedAt); }

function renderFxModalRows() {
  const appCcy = S.currency || 'EUR';
  const appFx  = FX_RATES[appCcy] || 1;
  const ALL_CCY = [
    { ccy:'EUR', symbol:'€',  flag:'🇪🇺', label:'Euro' },
    { ccy:'USD', symbol:'$',  flag:'🇺🇸', label:'Dollar US' },
    { ccy:'GBP', symbol:'£',  flag:'🇬🇧', label:'Livre sterling' },
    { ccy:'CHF', symbol:'Fr', flag:'🇨🇭', label:'Franc suisse' },
    { ccy:'JPY', symbol:'¥',  flag:'🇯🇵', label:'Yen japonais' },
  ];
  const pairs = ALL_CCY.filter(p => p.ccy !== appCcy);
  const ageStr = _fxUpdatedAt
    ? 'Mis à jour ' + timeSince(_fxUpdatedAt)
    : 'Valeurs approximatives (non actualisées)';
  const rows = pairs.map((p, i) => {
    const rate = (FX_RATES[p.ccy] || 1) / appFx;
    const rateStr = rate >= 10 ? rate.toFixed(2) : rate.toFixed(4);
    const border = i < pairs.length - 1 ? `border-bottom:1px solid var(--border)` : '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;${border}">
      <div style="font-size:24px;flex-shrink:0;width:32px;text-align:center">${p.flag}</div>
      <div class="flex1 col gap4">
        <div style="font-size:14px;font-weight:700">${appCcy} / ${p.ccy}</div>
        <div class="t-sm">${p.label}</div>
      </div>
      <div class="t-num" style="text-align:right">
        <span style="font-size:18px;font-weight:800">${rateStr}</span>
        <span style="font-size:12px;color:var(--text2);margin-left:3px">${p.symbol}</span>
      </div>
    </div>`;
  }).join('');
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:0 16px;margin-bottom:12px">${rows}</div>
  <div class="t-sm" style="text-align:center;color:var(--text3)">${ageStr}</div>`;
}

function renderSettings() {
  const demo=S.isDemo;
  return `${backBarHTML()}
  <div class="settings-top" style="padding-top:4px">
    <div class="t-title">${navLabel('settings')}</div>
  </div>
  <div class="s-section">Profil</div>
  <div class="s-group">
    <div class="s-item">
      <div class="s-ico" style="background:var(--accent-dim)">
        <svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Nom</div></div>
      <input class="s-input" id="js-name" value="${esc(S.user.name)}" placeholder="Votre nom">
    </div>
  </div>
  <div class="s-section">Données</div>
  <div class="s-group">
    <div class="s-item tap" id="js-demo-row">
      <div class="s-ico" style="background:rgba(0,194,203,.12)">
        <svg viewBox="0 0 24 24" fill="#00C2CB"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Mode démo</div><div class="s-sub">Données d'exemple — modifiables et persistées</div></div>
      <div class="toggle ${demo?'on':''}" id="js-demo-tog"><div class="toggle-thumb"></div></div>
    </div>
    ${demo?`<div class="s-item tap" id="js-demo-reset">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Réinitialiser les données démo</div><div class="s-sub">Recharge les données d'exemple d'origine</div></div>
    </div>`:''}
    <div class="s-item tap" id="js-csv-btn">
      <div class="s-ico" style="background:rgba(0,214,143,.12)">
        <svg viewBox="0 0 24 24" fill="#00D68F"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Importer CSV</div><div class="s-sub">Colonnes : account, ticker, name, date, type, quantity, price</div></div>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </div>
  </div>
  <div class="s-section">Stockage</div>
  <div class="s-group">
    <div class="s-item tap" id="js-export-btn">
      <div class="s-ico" style="background:rgba(99,102,241,.12)">
        <svg viewBox="0 0 24 24" fill="#6366F1"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Exporter les données</div>
        <div class="s-sub">Télécharge comptes &amp; transactions en JSON</div>
      </div>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </div>
    <div class="s-item tap" id="js-clear-prices">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Effacer le cache des prix</div>
        <div class="s-sub" id="js-price-cache-age">${(()=>{const p=loadPrices();return p?'Mis à jour '+timeSince(p.updatedAt):'Aucun cache enregistré';})()}</div>
      </div>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </div>
    <div class="s-item tap" id="js-reset-all">
      <div class="s-ico" style="background:var(--loss-dim)">
        <svg viewBox="0 0 24 24" fill="var(--loss)"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name" style="color:var(--loss)">Réinitialiser les données</div>
        <div class="s-sub">Supprime comptes et transactions · réglages conservés</div>
      </div>
    </div>
  </div>

  <div class="s-section">Cours en direct</div>
  <div class="s-group">
    <div class="s-item tap" id="js-autorefresh-tog">
      <div class="s-ico" style="background:rgba(0,194,203,.12)">
        <svg viewBox="0 0 24 24" fill="#00C2CB"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Actualisation auto</div>
        <div class="s-sub">Rafraîchit les cours au démarrage</div>
      </div>
      <div class="toggle ${S.autoRefresh?'on':''}" id="js-autorefresh-inner"><div class="toggle-thumb"></div></div>
    </div>
    <div class="sep"></div>
    <div class="s-item tap" id="js-fx-row">
      <div class="s-ico" style="background:rgba(99,102,241,.12)">
        <svg viewBox="0 0 24 24" fill="#6366F1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.38 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Cours de change</div>
        <div class="s-sub" id="js-fx-sub">${fxSubText()}</div>
      </div>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </div>
  </div>
  <div class="s-section" style="color:var(--text3)">Clés API — fallback si proxy indisponible</div>
  <div class="s-group">
    <div class="s-item">
      <div class="s-ico" style="background:rgba(0,214,143,.08)">
        <svg viewBox="0 0 24 24" fill="#00D68F" opacity=".6"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name" style="color:var(--text2)">Twelve Data <a class="api-link" href="https://twelvedata.com" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a></div>
        <div class="s-sub">Fallback · 800 req/jour · actions US</div>
      </div>
      <input class="s-input" id="js-price-key" value="${S.priceApiKey||''}" placeholder="Clé API" style="max-width:110px;font-size:11px;opacity:.8">
    </div>
    <div class="s-item">
      <div class="s-ico" style="background:rgba(99,102,241,.08)">
        <svg viewBox="0 0 24 24" fill="#6366F1" opacity=".6"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm1 14.5h-2v-4.5H9l3-5.5 3 5.5h-2v4.5z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name" style="color:var(--text2)">Financial Modeling Prep <a class="api-link" href="https://financialmodelingprep.com/developer/docs" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a></div>
        <div class="s-sub">Fallback · 250 req/jour · EU + US</div>
      </div>
      <input class="s-input" id="js-fmp-key" value="${S.fmpApiKey||''}" placeholder="Clé API" style="max-width:110px;font-size:11px;opacity:.8">
    </div>
  </div>

  <div class="s-section">Débogage</div>
  <div class="s-group">
    <div class="s-item tap" id="js-debug-tog">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Mode débogage</div>
        <div class="s-sub">Affiche les erreurs réseau détaillées</div>
      </div>
      <div class="toggle ${S.debug?'on':''}" id="js-debug-tog-inner"><div class="toggle-thumb"></div></div>
    </div>
    ${S.debug && S._debugLog.length ? `
    <div style="padding:12px 16px;border-top:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Dernier log réseau</div>
      <div id="js-debug-log" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:11px;font-family:monospace;line-height:1.7;color:var(--text2);max-height:260px;overflow-y:auto;white-space:pre-wrap;word-break:break-all">${S._debugLog.map(l=>{
        const col=l.startsWith('[OK')  ?'var(--gain)'
                 :l.startsWith('[ERR') ?'var(--loss)'
                 :l.startsWith('[WRN') ?'#F59E0B'
                 :'var(--text2)';
        return `<span style="color:${col}">${l.replace(/</g,'&lt;')}</span>`;
      }).join('\n')}</div>
      <div style="display:flex;justify-content:flex-end;gap:14px;margin-top:8px">
        <div class="tap" id="js-debug-copy" style="font-size:12px;color:var(--accent);font-weight:600">Copier 📋</div>
        <div class="tap" id="js-debug-clear" style="font-size:12px;color:var(--text3)">Effacer ↺</div>
      </div>
    </div>` : ''}
    ${S.debug ? `
    <div style="padding:12px 16px;border-top:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Arrière-plan — ce que déclenche l'appareil</div>
      <div id="js-bg-log" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:11px;font-family:monospace;line-height:1.7;color:var(--text2);max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-all">${
        (window.__bgLog||[]).length ? esc((window.__bgLog||[]).join('\n'))
        : 'Aucun événement. Passez l\'appli en arrière-plan puis revenez ici.'}</div>
      <div style="display:flex;justify-content:flex-end;gap:14px;margin-top:8px">
        <div class="tap" id="js-bg-copy" style="font-size:12px;color:var(--accent);font-weight:600">Copier 📋</div>
        <div class="tap" id="js-bg-clear" style="font-size:12px;color:var(--text3)">Effacer ↺</div>
      </div>
    </div>` : ''}
  </div>

  <div class="s-section">${navLabel('assistant')}</div>
  <div class="s-group">
    <div class="s-item tap" id="js-assistant-tog">
      <div class="s-ico" style="background:var(--accent-dim)">
        <svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l.9 2.5L21.5 15.5l-2.6.95L18 19l-.9-2.55L14.5 15.5l2.6-1L18 12z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">${navLabel('assistant')}</div>
        <div class="s-sub">Recommandations locales sur vos comptes et titres</div>
      </div>
      <div class="toggle ${S.assistantEnabled ? 'on' : ''}" id="js-assistant-inner"><div class="toggle-thumb"></div></div>
    </div>
  </div>

  <div class="s-section">Sécurité</div>
  <div class="s-group">
    <div class="s-item tap" id="js-lock-tog">
      <div class="s-ico" style="background:rgba(0,214,143,.12)">
        <svg viewBox="0 0 24 24" fill="var(--gain)"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm3 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Verrouillage par code</div>
        <div class="s-sub">${cryptoOk() ? `Code à ${LOCK_LEN} chiffres demandé à l'ouverture` : 'Indisponible : nécessite une connexion HTTPS'}</div>
      </div>
      <div class="toggle ${S.lockEnabled ? 'on' : ''}" id="js-lock-inner"><div class="toggle-thumb"></div></div>
    </div>
    ${lockArmed() ? `
    <div class="s-item tap" id="js-lock-change">
      <div class="s-ico" style="background:var(--accent-dim)">
        <svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Changer le code</div>
      </div>
      <div style="color:var(--text3);font-size:18px">›</div>
    </div>
    ${_bioOk && S.lockBio && S.lockBioId ? `
    <div class="s-item tap" id="js-lock-reset">
      <div class="s-ico" style="background:var(--loss-dim)">
        <svg viewBox="0 0 24 24" fill="var(--loss)"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Réinitialiser le code</div>
        <div class="s-sub">Tire un nouveau code au hasard après vérification biométrique</div>
      </div>
      <div style="color:var(--text3);font-size:18px">›</div>
    </div>` : ''}
    ${_bioOk ? `
    <div class="s-item tap" id="js-lock-bio">
      <div class="s-ico" style="background:rgba(167,139,250,.12)">
        <svg viewBox="0 0 24 24" fill="#A78BFA"><path d="M12 1a11 11 0 0 0-5.5 1.47.75.75 0 0 0 .75 1.3A9.5 9.5 0 0 1 12 2.5c1.9 0 3.75.55 5.32 1.57a.75.75 0 1 0 .82-1.26A11 11 0 0 0 12 1zm0 3.7c-3.9 0-7.3 2.4-8.6 6a.75.75 0 1 0 1.41.5A7.68 7.68 0 0 1 12 6.2c4.24 0 7.7 3.3 7.7 7.35 0 1.5-1.27 2.7-2.85 2.7s-2.85-1.2-2.85-2.7c0-1.1-.98-2-2.18-2s-2.17.9-2.17 2c0 2.03.79 3.93 2.23 5.37a.75.75 0 1 0 1.06-1.06 6.07 6.07 0 0 1-1.79-4.31c0-.27.3-.5.67-.5s.68.23.68.5c0 2.32 1.95 4.2 4.35 4.2s4.35-1.88 4.35-4.2C21.2 8.66 17.06 4.7 12 4.7zm0 3.05c-2.55 0-4.77 1.55-5.7 3.85-.3.74-.45 1.55-.45 2.4 0 1.42.25 2.6.8 4.06a.75.75 0 1 0 1.4-.53c-.49-1.29-.7-2.3-.7-3.53 0-.66.11-1.27.34-1.84A4.65 4.65 0 0 1 12 9.25c.35 0 .7.04 1.03.11a.75.75 0 1 0 .32-1.46A6.4 6.4 0 0 0 12 7.75zm-2.7 1.9a.75.75 0 0 0-.4.12A4.2 4.2 0 0 0 7.1 13.3c0 .9.14 1.72.43 2.5a.75.75 0 1 0 1.4-.52 5.6 5.6 0 0 1-.33-1.98c0-.95.48-1.8 1.25-2.28a.75.75 0 0 0-.55-1.37zm7.2 8.9c-.2 0-.4.01-.55.04-1.5.26-2.9-.3-3.83-1.42a.75.75 0 1 0-1.15.96 5.1 5.1 0 0 0 5.24 1.94.75.75 0 0 0-.14-1.49l.43-.03zm-6.98 1.5a.75.75 0 0 0-.53 1.28c.86.86 1.8 1.4 3.06 1.75a.75.75 0 1 0 .4-1.45c-1.03-.28-1.76-.7-2.4-1.35a.75.75 0 0 0-.53-.22z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Empreinte / Face</div>
        <div class="s-sub">Déverrouiller avec la biométrie du téléphone</div>
      </div>
      <div class="toggle ${S.lockBio ? 'on' : ''}" id="js-lock-bio-inner"><div class="toggle-thumb"></div></div>
    </div>` : ''}
    <div class="s-item">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Verrouiller après</div>
        <div class="s-sub">Délai passé en arrière-plan</div>
      </div>
      <div class="cur-opts">
        <div class="cur-opt tap ${S.lockDelay === 0 ? 'on' : ''}" data-lockdelay="0">Imm.</div>
        <div class="cur-opt tap ${S.lockDelay === 60 ? 'on' : ''}" data-lockdelay="60">1 min</div>
        <div class="cur-opt tap ${S.lockDelay === 300 ? 'on' : ''}" data-lockdelay="300">5 min</div>
      </div>
    </div>` : ''}
    <div class="s-item tap" id="js-bgpriv-tog">
      <div class="s-ico" style="background:rgba(167,139,250,.12)">
        <svg viewBox="0 0 24 24" fill="#A78BFA"><path d="M12 6.5c2.76 0 5 2.24 5 5 0 .51-.1 1-.24 1.46l2.06 2.06c1.12-.92 2.01-2.11 2.54-3.52C20.27 7.61 16.47 5 12 5c-1.09 0-2.14.16-3.13.46l1.72 1.72c.46-.11.93-.18 1.41-.18zM2.71 3.16a.996.996 0 0 0 0 1.41l1.97 1.97A11.9 11.9 0 0 0 1 11.5C2.73 15.89 7 19 12 19c1.52 0 2.97-.3 4.31-.82l2.72 2.72a.996.996 0 1 0 1.41-1.41L4.13 3.16a.996.996 0 0 0-1.42 0zM12 16.5c-2.76 0-5-2.24-5-5 0-.77.18-1.5.49-2.14l1.57 1.57c-.03.18-.06.37-.06.57 0 1.66 1.34 3 3 3 .2 0 .38-.03.57-.07L14.14 16c-.65.32-1.37.5-2.14.5z"/></svg>
      </div>
      <div class="flex1 col gap4">
        <div class="s-name">Masquer en arrière-plan</div>
        <div class="s-sub">Cache les montants dans l'aperçu du sélecteur d'applications</div>
      </div>
      <div class="toggle ${S.bgPrivacy ? 'on' : ''}" id="js-bgpriv-inner"><div class="toggle-thumb"></div></div>
    </div>
    <div class="s-item stack">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
      </div>
      <div class="flex1 col gap4" style="min-width:0">
        <div class="s-name">Masquer après inactivité</div>
        <div class="s-sub" id="js-bgidle-sub">${S.bgIdle ? `Voile automatique après ${S.bgIdle < 60 ? S.bgIdle + ' s' : '1 min'} sans toucher l'écran` : 'Désactivé — le voile ne se pose qu\'au passage en arrière-plan'}</div>
      </div>
      <div class="cur-opts">
        <div class="cur-opt tap ${!S.bgIdle ? 'on' : ''}" data-bgidle="0">Jamais</div>
        <div class="cur-opt tap ${S.bgIdle === 15 ? 'on' : ''}" data-bgidle="15">15 s</div>
        <div class="cur-opt tap ${S.bgIdle === 30 ? 'on' : ''}" data-bgidle="30">30 s</div>
        <div class="cur-opt tap ${S.bgIdle === 60 ? 'on' : ''}" data-bgidle="60">1 min</div>
      </div>
    </div>
  </div>
  <div style="margin:8px 20px 0;font-size:11px;color:var(--text3);line-height:1.5">
    Le verrou bloque l'accès à l'application. Il ne chiffre pas les données stockées sur l'appareil.${_bioOk && S.lockBio && S.lockBioId ? ` En cas d'oubli, la réinitialisation tire un code au hasard et ne l'affiche qu'une fois : elle exige l'application déverrouillée et votre biométrie.` : ''}
  </div>

  <div class="s-section">Préférences</div>
  <div class="s-group">
    <div class="s-item">
      <div class="s-ico" style="background:rgba(245,158,11,.12)">
        <svg viewBox="0 0 24 24" fill="#F59E0B"><path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-4h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Devise</div></div>
      <div class="cur-opts">
        <div class="cur-opt tap ${S.currency==='EUR'?'on':''}" data-cur="EUR">EUR</div>
        <div class="cur-opt tap ${S.currency==='USD'?'on':''}" data-cur="USD">USD</div>
      </div>
    </div>
    <div class="s-item">
      <div class="s-ico" style="background:rgba(167,139,250,.12)">
        <svg viewBox="0 0 24 24" fill="#A78BFA"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Thème</div></div>
      <div class="cur-opts">
        <div class="cur-opt tap ${S.theme==='auto'?'on':''}" data-theme-opt="auto">Auto</div>
        <div class="cur-opt tap ${S.theme==='light'?'on':''}" data-theme-opt="light">☀</div>
        <div class="cur-opt tap ${S.theme==='dark'?'on':''}" data-theme-opt="dark">🌙</div>
      </div>
    </div>
  </div>
  <div class="s-section">À propos</div>
  <div class="s-group">
    <div class="s-item">
      <div class="s-ico" style="background:var(--accent-dim)">
        <svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Mon patrimoine</div><div class="s-sub">Version ${APP_VERSION} — Septembre 2026<span id="js-cache-state"></span></div></div>
    </div>
    <div class="s-item tap" id="js-force-update" style="cursor:pointer">
      <div class="s-ico" style="background:var(--accent-dim)">
        <svg viewBox="0 0 24 24" fill="var(--accent)"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Recherche de mise à jour</div><div class="s-sub">Vérifie si une nouvelle version est disponible</div></div>
    </div>
    <div class="s-item tap" id="js-open-changelog" style="cursor:pointer">
      <div class="s-ico" style="background:rgba(255,200,50,.13)">
        <svg viewBox="0 0 24 24" fill="rgba(255,200,50,1)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
      <div class="flex1 col gap4"><div class="s-name">Quoi de neuf ?</div><div class="s-sub">Voir les dernières nouveautés</div></div>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--t3)"><path d="M9 18l6-6-6-6"/></svg>
    </div>
  </div>
  <div style="height:20px"></div>`;
}


SCREEN_BIND.settings = function (el, id) {
    // Retirer le badge de logs sur tous les boutons ⚙
    document.querySelectorAll('.log-badge').forEach(b => b.remove());
    el.querySelector('#js-back')?.addEventListener('click',back);
    el.querySelector('#js-name')?.addEventListener('change',e=>{
      S.user.name=e.target.value||S.user.name;
      renderScreen('dashboard');
      saveData();
      toast('Nom mis à jour');
    });
    el.querySelector('#js-demo-tog')?.addEventListener('click',()=>{
      if(S.isDemo){
        // Démo → réel : sauvegarde le slot démo, charge le slot réel
        localStorage.setItem(STORE_ACCOUNTS_DEMO, localStorage.getItem(STORE_ACCOUNTS)||'{}');
        const rawReal = localStorage.getItem(STORE_ACCOUNTS_REAL);
        // Toujours réaffecter watchlist/targets : sinon les données démo restent dans S
        // et sont sauvegardées comme données réelles au premier passage
        let d=null;
        if(rawReal){ try{ d=JSON.parse(rawReal); }catch(e){} }
        S.accounts  = d?.accounts  || [];
        S.watchlist = d?.watchlist || [];
        S.targets   = d?.targets   || { Action: 60, ETF: 25, Obligation: 10, Cash: 5 };
        if(d?.user) S.user = d.user;
        S.isDemo=false;
        saveAccounts();
        toast('Mode réel chargé');
      } else {
        // Réel → démo : sauvegarde le slot réel, charge le slot démo
        localStorage.setItem(STORE_ACCOUNTS_REAL, localStorage.getItem(STORE_ACCOUNTS)||'{}');
        const rawDemo = localStorage.getItem(STORE_ACCOUNTS_DEMO);
        let d=null;
        if(rawDemo){ try{ d=JSON.parse(rawDemo); }catch(e){} }
        S.accounts  = d?.accounts  || genDemo();
        S.watchlist = d?.watchlist || genDemoWatchlist();
        S.targets   = d?.targets   || { Action: 60, ETF: 25, Obligation: 10, Cash: 5 };
        if(d?.user) S.user = d.user;
        S.isDemo=true;
        saveAccounts();
        toast('Mode démo chargé ✓');
      }
      S.accounts.forEach(a => { a.value = accTotal(a); }); // soldes recalculés (titres + liquidités)
      loadDca();                                           // DCA du mode qu'on vient d'activer
      refreshMain();
      renderScreen('settings');
    });
    el.querySelector('#js-demo-reset')?.addEventListener('click',()=>{
      openConfirm('Réinitialiser les données démo ?',()=>{
        S.accounts=genDemo();
        localStorage.removeItem(STORE_DCA_DEMO); loadDca();
        createOrderAlertStore(localStorage, 'demo').clear();   // les ordres démo visent des comptes régénérés
        createImmoStore(localStorage, 'demo').clear();
        saveAccounts();
        refreshMain();
        renderScreen('settings');
        toast('Données démo réinitialisées ✓');
      });
    });
    el.querySelector('#js-csv-btn')?.addEventListener('click',()=>document.getElementById('csv-file').click());
    el.querySelectorAll('[data-cur]').forEach(b=>b.addEventListener('click',()=>{
      S.currency=b.dataset.cur;
      el.querySelectorAll('[data-cur]').forEach(x=>x.classList.toggle('on',x.dataset.cur===S.currency));
      refreshMain();
      toast('Devise : '+S.currency);
    }));
    el.querySelectorAll('[data-theme-opt]').forEach(b=>b.addEventListener('click',()=>{
      S.theme=b.dataset.themeOpt;
      applyTheme(S.theme);
      el.querySelectorAll('[data-theme-opt]').forEach(x=>x.classList.toggle('on',x.dataset.themeOpt===S.theme));
      saveData();
      const lbl={auto:'automatique',light:'clair',dark:'sombre'};
      toast('Thème '+(lbl[S.theme]||S.theme));
    }));
    el.querySelector('#js-clear-prices')?.addEventListener('click',()=>{
      localStorage.removeItem(STORE_PRICES);
      S.lastPriceUpdate=null;
      const sub=el.querySelector('#js-price-cache-age');
      if(sub) sub.textContent='Aucun cache enregistré';
      toast('Cache des prix effacé');
    });
    el.querySelector('#js-export-btn')?.addEventListener('click', () => {
      let ordersAlerts = null;
      if (!S.isDemo) {
        try { ordersAlerts = createOrderAlertStore(localStorage, 'real').read(); }
        catch (e) { toast('Ordres et alertes illisibles : non inclus dans l\'export'); }
      }
      let immo = null;
      if (!S.isDemo) {
        try { immo = createImmoStore(localStorage, 'real').read(); }
        catch (e) { toast('Biens immobiliers illisibles : non inclus dans l\'export'); }
      }
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0.2',
        accounts:  S.isDemo ? [] : S.accounts,
        watchlist: S.watchlist,
        targets:   S.targets,
        user:      S.user,
        dca:       S.isDemo ? null : S.dca,
        ordersAlerts,
        immo,
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `patrimoine-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Export téléchargé ✓');
    });
    el.querySelector('#js-reset-all')?.addEventListener('click',()=>{
      openConfirm('Supprimer tous les comptes et transactions ? Les réglages sont conservés.', ()=>{
        localStorage.removeItem(STORE_ACCOUNTS);
        localStorage.removeItem(STORE_ACCOUNTS_DEMO);
        localStorage.removeItem(STORE_ACCOUNTS_REAL);
        localStorage.removeItem(STORE_DCA_DEMO);
        localStorage.removeItem(STORE_DCA_REAL);
        ['demo', 'real'].forEach(m => createOrderAlertStore(localStorage, m).clear());
        localStorage.removeItem(STORE_ORDERS_LEGACY);
        localStorage.removeItem(STORE_ALERTS_LEGACY);
        ['demo', 'real'].forEach(m => createImmoStore(localStorage, m).clear());
        localStorage.removeItem(STORE_IMMO_LEGACY);
        localStorage.removeItem(STORE_PRICES);
        localStorage.removeItem(STORE_WEALTH);
        location.reload();
      });
    });
    el.querySelector('#js-autorefresh-tog')?.addEventListener('click', () => {
      S.autoRefresh = !S.autoRefresh;
      el.querySelector('#js-autorefresh-inner')?.classList.toggle('on', S.autoRefresh);
      saveData();
      toast('Actualisation auto ' + (S.autoRefresh ? 'activée' : 'désactivée'));
    });
    el.querySelector('#js-assistant-tog')?.addEventListener('click', () => {
      S.assistantEnabled = !S.assistantEnabled;
      el.querySelector('#js-assistant-inner')?.classList.toggle('on', S.assistantEnabled);
      saveSettings();
      // Re-render des écrans à top-bar pour afficher/masquer le bouton immédiatement
      ['dashboard','comptes','recherche','analysis'].forEach(renderScreen);
      renderNav();
      toast(navLabel('assistant') + ' ' + (S.assistantEnabled ? 'activé' : 'masqué'));
    });
    el.querySelector('#js-bgpriv-tog')?.addEventListener('click', () => {
      S.bgPrivacy = !S.bgPrivacy;
      el.querySelector('#js-bgpriv-inner')?.classList.toggle('on', S.bgPrivacy);
      _bgPrivacySync();
      if (!S.bgPrivacy) _bgShield(false);   // retirer un voile déjà posé
      saveSettings();
      toast('Masquage en arrière-plan ' + (S.bgPrivacy ? 'activé' : 'désactivé'));
    });
    el.querySelectorAll('[data-bgidle]').forEach(o => o.addEventListener('click', () => {
      S.bgIdle = +o.dataset.bgidle;
      el.querySelectorAll('[data-bgidle]').forEach(x => x.classList.toggle('on', x === o));
      const sub = el.querySelector('#js-bgidle-sub');
      if (sub) sub.textContent = S.bgIdle
        ? `Voile automatique après ${S.bgIdle < 60 ? S.bgIdle + ' s' : '1 min'} sans toucher l'écran`
        : "Désactivé — le voile ne se pose qu'au passage en arrière-plan";
      _idleReset();
      saveSettings();
      toast(S.bgIdle ? `Masquage après ${S.bgIdle < 60 ? S.bgIdle + ' s' : '1 min'} sans activité`
                     : 'Masquage par inactivité désactivé');
    }));
    el.querySelector('#js-lock-tog')?.addEventListener('click', () => {
      if (!cryptoOk()) { toast('Le verrouillage nécessite une connexion HTTPS'); return; }
      const done = () => renderScreen('settings');
      if (S.lockEnabled) lockDisable(done); else lockEnable(done);
    });
    el.querySelector('#js-lock-change')?.addEventListener('click', () => lockChange(() => renderScreen('settings')));
    el.querySelector('#js-lock-reset')?.addEventListener('click', () => lockResetCode(() => renderScreen('settings')));
    el.querySelector('#js-lock-bio')?.addEventListener('click', async () => {
      if (S.lockBio) {
        S.lockBio = false; S.lockBioId = ''; saveSettings();
        renderScreen('settings');
        toast('Déverrouillage biométrique désactivé');
        return;
      }
      try {
        S.lockBioId = await bioRegister();
        S.lockBio = true; saveSettings();
        renderScreen('settings');
        toast('Biométrie activée ✓');
      } catch (e) {
        toast(e && (e.name === 'NotAllowedError' || e.name === 'AbortError')
          ? 'Enregistrement annulé'
          : 'Biométrie indisponible sur cet appareil');
      }
    });
    el.querySelectorAll('[data-lockdelay]').forEach(b => b.addEventListener('click', () => {
      S.lockDelay = +b.dataset.lockdelay;
      saveSettings();
      renderScreen('settings');
      toast(S.lockDelay ? 'Verrouillage après ' + (S.lockDelay / 60) + ' min' : 'Verrouillage immédiat');
    }));
    el.querySelector('#js-fx-row')?.addEventListener('click', openFxModal);
    el.querySelector('#js-open-changelog')?.addEventListener('click', openChangelogModal);
    el.querySelector('#js-price-key')?.addEventListener('change', e => {
      S.priceApiKey = e.target.value.trim();
      saveSettings();
      toast(S.priceApiKey ? 'Clé Twelve Data enregistrée ✓' : 'Clé Twelve Data supprimée');
    });
    el.querySelector('#js-fmp-key')?.addEventListener('change', e => {
      S.fmpApiKey = e.target.value.trim();
      saveSettings();
      toast(S.fmpApiKey ? 'Clé FMP enregistrée ✓' : 'Clé FMP supprimée');
    });
    el.querySelector('#js-debug-tog')?.addEventListener('click',()=>{
      S.debug = !S.debug;
      el.querySelector('#js-debug-tog-inner')?.classList.toggle('on', S.debug);
      saveData();
      toast('Mode débogage ' + (S.debug ? 'activé' : 'désactivé'));
      if (S.debug) renderScreen('settings'); // rafraîchit pour afficher le log
    });
    // Cache réellement servi : c'est lui qui décide du code exécuté, pas APP_VERSION.
    // Un écart = le service worker n'a pas encore basculé sur la nouvelle version.
    const cacheEl = el.querySelector('#js-cache-state');
    if (cacheEl) caches?.keys?.().then(ks => {
      const mine = ks.filter(k => k.startsWith('patrimoine-v'));
      if (!mine.length) { cacheEl.textContent = ' · sans cache hors ligne'; return; }
      const ok = mine.length === 1 && mine[0] === CACHE_NAME;
      cacheEl.textContent = ok ? ` · cache ${CACHE_NAME} ✓` : ` · ⚠ cache ${mine.join(' + ')}`;
      if (!ok) cacheEl.style.color = 'var(--loss)';
    }).catch(()=>{});
    el.querySelector('#js-force-update')?.addEventListener('click', forceAppUpdate);
    el.querySelector('#js-bg-copy')?.addEventListener('click',()=>{
      _copyText((window.__bgLog||[]).join('\n'));
    });
    el.querySelector('#js-bg-clear')?.addEventListener('click',()=>{
      window.__bgLog=[];
      try{ localStorage.removeItem('patrimoine-bglog'); }catch(e){}
      renderScreen('settings');
    });
    el.querySelector('#js-debug-copy')?.addEventListener('click',()=>{
      const txt = S._debugLog.slice().reverse().join('\n');
      navigator.clipboard?.writeText(txt)
        .then(()=>toast('Log copié ✓'))
        .catch(()=>{
          // Fallback si clipboard API indisponible
          const ta=document.createElement('textarea');
          ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          toast('Log copié ✓');
        });
    });
    el.querySelector('#js-debug-clear')?.addEventListener('click',()=>{
      S._debugLog = [];
      renderScreen('settings');
    });
};
