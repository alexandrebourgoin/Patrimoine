// Écran d'un livret ou compte d'épargne : solde, taux, intérêts estimés, place restante sous le plafond, mouvements.
// Pas de totaux versé / retiré / intérêts en tête (demande de Julien, 26/11) : seul le solde actuel compte.
// Pas de portefeuille ni de titres. Appelé par renderAccount() (js/screens/account.js) quand isSavingsAccount(acc).
// Règles pures : js/features/savings.js ; plafond et fiscalité : accEnvelopeHTML (js/screens/account.js).
// Dépend, À L'APPEL seulement, de S, masked, fmtDate, esc, backBarHTML, iconHtml, toRefCcy, accEnvelopeHTML.

function renderSavingsAccount(acc) {
  const sv = savingsSummary(acc, (v, c) => toRefCcy(v, c));
  const rateTxt = sv.rate != null
    ? `Taux ${String(sv.rate).replace('.', ',')} % · ≈ ${masked(sv.yearly)} d'intérêts par an au solde actuel`
    : 'Taux non renseigné : indique-le dans « Modifier » pour estimer les intérêts';
  const reg = SAVINGS_RATES[acc.type] != null && sv.rate != null && Math.abs(SAVINGS_RATES[acc.type] - sv.rate) > 1e-9
    ? `<div class="t-sm" style="margin-top:2px">Taux réglementé en vigueur depuis le ${fmtDate(SAVINGS_RATES_DATE)} : ${String(SAVINGS_RATES[acc.type]).replace('.', ',')} %.</div>` : '';
  return `${backBarHTML()}
  <div class="acc-hero">
    <div class="row gap10" style="margin-bottom:6px;align-items:center">
      <div style="font-size:26px">${iconHtml(acc.icon)}</div>
      <div class="col" style="gap:2px;flex:1;min-width:0">
        <div style="font-size:20px;font-weight:800;letter-spacing:-.5px">${esc(acc.name)}</div>
        <div class="t-sm">${esc(acc.type || '')}${acc.bank ? ' · ' + esc(acc.bank) : ''}</div>
      </div>
    </div>
    <div class="acc-hero-val t-num" id="js-acc-val">${accHeroValHTML(acc)}</div>
    <div class="t-sm" style="margin-top:4px" id="js-sv-rate">${rateTxt}</div>${reg}
    ${accEnvelopeHTML(acc)}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <div id="js-cf-btn" class="tap" style="${_CHIP}">+ Versement / Retrait / Intérêts</div>
    </div>
  </div>
  <div class="row" style="padding:20px 20px 6px;justify-content:space-between;align-items:center">
    <div class="t-section">Mouvements</div>
    <div id="js-mcnt" style="font-size:12px;font-weight:600;color:var(--text2)"></div>
  </div>
  <div id="js-moves"></div>`;
}
