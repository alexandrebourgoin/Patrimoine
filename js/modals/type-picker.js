// Choix du type de compte : fenêtre à sections colorées par catégorie (pastille, nom court, précision, coche).
// Le <select> d'origine (#acc-type, #rename-acc-type) reste la source de vérité, caché : la fenêtre en change la valeur et
// déclenche son onchange (règles de devise, livret, compte joint… : fillAccTypeSelect, js/modals/account.js).
// Données : ACCOUNT_TYPE_GROUPS, ACCOUNT_TYPE_INFO, accTypeTone (js/features/account-rules.js) ; taux : SAVINGS_RATES (sous garde).
// Dépend, À L'APPEL seulement, de esc.

let _tpSelId = null;

// Précision sous le nom : taux en vigueur pour un livret réglementé, sinon la précision du type
function accTypeSub(type) {
  const r = typeof SAVINGS_RATES !== 'undefined' ? SAVINGS_RATES[type] : null;
  if (r != null) return `${String(r).replace('.', ',')} % · ${(ACCOUNT_TYPE_INFO[type] || {}).sub || ''}`;
  return (ACCOUNT_TYPE_INFO[type] || {}).sub || '';
}
// Pastille : abréviation sur fond teinté de la couleur de la catégorie (classe tp-<tone>)
function accTypeBadgeHTML(type, size = 36) {
  const info = ACCOUNT_TYPE_INFO[type], tone = accTypeTone(type);
  const abbr = info ? info.abbr : String(type || '?').slice(0, 3);
  return `<span class="tp-badge tp-${tone || 'autre'}" style="width:${size}px;height:${size}px">${esc(abbr)}</span>`;
}
// Contenu de la fenêtre. Un type hors liste (données anciennes) est affiché en tête, dans « Type actuel ».
function typePickerHTML(current) {
  const row = (t, tone) => {
    const on = t === current, info = ACCOUNT_TYPE_INFO[t];
    return `<button type="button" class="tp-row tp-${tone || 'autre'}${on ? ' on' : ''}" data-type="${esc(t)}">
      ${accTypeBadgeHTML(t)}
      <span class="tp-txt"><span class="tp-name">${esc(info ? info.short : t)}</span>${accTypeSub(t) ? `<span class="tp-sub">${esc(accTypeSub(t))}</span>` : ''}</span>
      ${on ? '<svg class="tp-check" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
    </button>`;
  };
  const head = (label, tone) => `<div class="tp-head tp-${tone || 'autre'}"><span class="tp-dot"></span>${esc(label)}</div>`;
  const legacy = current && !ACCOUNT_TYPES.includes(current) ? head('Type actuel', '') + row(current, '') : '';
  return legacy + ACCOUNT_TYPE_GROUPS.map(g => head(g.label, g.tone) + g.types.map(t => row(t, g.tone)).join('')).join('');
}
// Bouton qui remplace le <select> dans le formulaire : pastille + nom court
function typePickerButtonHTML(type) {
  const info = ACCOUNT_TYPE_INFO[type];
  return `${accTypeBadgeHTML(type, 26)}<span class="tp-btn-name">${esc(info ? info.short : type)}</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style="flex-shrink:0;opacity:.6"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
}
function syncTypePickerButton(selId) {
  const sel = document.getElementById(selId), btn = document.getElementById(selId + '-btn');
  if (sel && btn) btn.innerHTML = typePickerButtonHTML(sel.value);
}
function openTypePicker(selId) {
  const sel = document.getElementById(selId); if (!sel) return;
  _tpSelId = selId;
  document.getElementById('tp-list').innerHTML = typePickerHTML(sel.value);
  document.getElementById('tp-bg').classList.add('show');
  document.getElementById('tp-sheet').classList.add('show');
}
function closeTypePicker() {
  document.getElementById('tp-bg').classList.remove('show');
  document.getElementById('tp-sheet').classList.remove('show');
  _tpSelId = null;
}
document.getElementById('tp-list').addEventListener('click', e => {
  const row = e.target.closest('[data-type]'); if (!row || !_tpSelId) return;
  const sel = document.getElementById(_tpSelId), selId = _tpSelId;
  closeTypePicker();
  if (sel.value === row.dataset.type) return;
  sel.value = row.dataset.type;
  if (sel.onchange) sel.onchange();
  syncTypePickerButton(selId);
});
document.getElementById('tp-bg').addEventListener('click', closeTypePicker);
document.getElementById('tp-close').addEventListener('click', closeTypePicker);
['acc-type', 'rename-acc-type'].forEach(id => document.getElementById(id + '-btn')?.addEventListener('click', () => openTypePicker(id)));
registerModal('tp-sheet', closeTypePicker);
