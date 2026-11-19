// Registre des écrans, chargé avant leurs bindings.
const SCREEN_BIND = {};
function bindEvents(id, el) {
  const fn = SCREEN_BIND[id];
  if (fn) fn(el, id);
}

// Adaptation du module immobilier après initialisation du point d'entrée historique.
document.addEventListener('DOMContentLoaded', function () {
  if (typeof renderImmo !== 'function') return;
  IMMO_KIND.secondary = 'Résidence secondaire';
  const kind = document.getElementById('im-kind');
  if (kind && !kind.querySelector('[value="secondary"]')) {
    const option = document.createElement('option');
    option.value = 'secondary'; option.textContent = IMMO_KIND.secondary;
    kind.insertBefore(option, kind.querySelector('[value="rental"]'));
  }
  const works = document.getElementById('im-works');
  if (works && !document.getElementById('im-other-fees')) {
    const row = document.createElement('div'); row.className = 'form-row';
    row.innerHTML = `<div class="form-field"><div class="form-label">Autres frais</div><input class="form-input" id="im-other-fees" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0"><div class="t-sm">Frais bancaires, de dossier ou de garantie. Hors intérêts et assurance.</div></div>`;
    works.closest('.form-row').after(row);
  }
  const originalRead = _imRead;
  _imRead = function () {
    const p = originalRead();
    p.otherFees = Number(String(document.getElementById('im-other-fees')?.value || '0').replace(',', '.'));
    return p;
  };
  const originalCalc = immoCalc;
  immoCalc = function (p) {
    const c = originalCalc(p);
    const fees = Number(p.otherFees) || 0;
    c.cost += fees; c.gap = c.value - c.cost;
    return c;
  };
  const originalOpen = openImmoForm;
  openImmoForm = function (id) {
    originalOpen(id);
    const p = id ? loadImmo().find(x => x.id === id) : null;
    const input = document.getElementById('im-other-fees');
    if (input) input.value = p?.otherFees || '';
    const taken = loadImmo().some(x => x.kind === 'main' && x.id !== _imEditId);
    const main = kind?.querySelector('[value="main"]');
    if (main) main.disabled = taken;
    if (taken && kind.value === 'main') kind.value = 'secondary';
  };
  document.getElementById('im-save')?.addEventListener('click', function (e) {
    const p = _imRead();
    let error = '';
    if (!Number.isFinite(p.otherFees) || p.otherFees < 0) error = 'Autres frais : indique un montant positif ou nul';
    if (p.kind === 'main' && loadImmo().some(x => x.kind === 'main' && x.id !== _imEditId)) error = 'Une résidence principale existe déjà';
    if (error) { e.preventDefault(); e.stopImmediatePropagation(); toast(error); }
  }, true);

  const originalRender = renderImmo;
  let selected = null;
  const detail = document.createElement('div');
  detail.id = 's-immodetail'; detail.className = 'screen no-nav';
  document.getElementById('s-immo').after(detail);
  const style = document.createElement('style');
  style.textContent = '#s-immodetail [data-imamort],#s-immodetail [data-imedit],#s-immodetail [data-imdel]{height:auto!important;min-height:46px;padding:12px 16px!important;line-height:1.35;white-space:normal;overflow-wrap:anywhere;flex:1 1 100%!important;box-sizing:border-box}';
  document.head.append(style);
  renderImmo = function () {
    const list = loadImmo();
    const sums = list.reduce((s,p) => { const c=immoCalc(p); s.value+=c.value; s.debt+=c.debt; return s; }, {value:0,debt:0});
    return `${renderTopBar()}<div class="settings-top"><div class="t-title">Immobilier</div><div class="t-sm">Sélectionne un bien pour consulter sa fiche.</div></div><div style="padding:12px 20px"><div class="t-label">Patrimoine immobilier net</div><div class="t-num" style="font-size:28px;font-weight:800">${masked(sums.value-sums.debt)}</div><div class="t-sm">Valeur brute ${masked(sums.value)} · Crédit restant ${masked(sums.debt)}</div><button class="form-submit" data-imnew="1">+ Ajouter un bien</button></div><div class="col gap12 px" style="padding-bottom:100px">${list.map(p => {const c=immoCalc(p);return `<button type="button" class="acc-card tap" data-imopen="${esc(p.id)}" style="text-align:left;width:100%;color:var(--text);font:inherit"><div class="row gap12"><div class="acc-icon" style="background:var(--card2)">⌂</div><div class="flex1" style="min-width:0"><div style="font-weight:700;overflow-wrap:anywhere">${esc(p.name)}</div><div class="t-sm">${esc(IMMO_KIND[p.kind]||'Bien')}</div></div><div class="col right gap4"><span class="t-num" style="font-weight:800">${masked(c.equity)}</span><span class="t-sm">Valeur nette</span></div></div>${c.loan?`<div class="acc-bar" style="margin-top:12px"><div class="acc-bar-fill" style="width:${Math.max(0,Math.min(100,c.loan.pct))}%"></div></div><div class="t-sm" style="margin-top:4px">Crédit remboursé : ${c.loan.pct.toFixed(1)} %</div>`:''}</button>`;}).join('') || '<div class="t-sm">Aucun bien.</div>'}</div>`;
  };
  const originalBind = bindImmo;
  bindImmo = function(el) {
    originalBind(el);
    el.addEventListener('click', function(e) {
      const tile = e.target.closest('[data-imopen]');
      if (tile) { selected=tile.dataset.imopen; go('immodetail'); }
    }, {once:true});
    // Délégation remplacée à chaque rendu : pas d'accumulation de gestionnaires.
    el.onclick = function(e) {
      if (e.target.closest('[data-imnew]')) {openImmoForm();return;}
      const tile=e.target.closest('[data-imopen]');
      if(tile && S.screen!=='immodetail'){selected=tile.dataset.imopen;go('immodetail');}
    };
  };
  function drawDetail() {
    const p=loadImmo().find(x=>x.id===selected);
    if(!p){detail.innerHTML='<div class="back tap" data-imlist>Retour aux biens</div><div class="px">Bien introuvable.</div>';return;}
    const parsed=document.createElement('div');parsed.innerHTML=originalRender();
    const marker=[...parsed.querySelectorAll('[data-imedit]')].find(b=>b.dataset.imedit===p.id);
    const card=marker?.parentElement?.parentElement;
    if(card && p.otherFees>0){
      const row=document.createElement('div');
      row.innerHTML=_immoRow('Autres frais',masked(p.otherFees));
      const rows=[...card.children];
      const label=el=>el.firstElementChild?.textContent.trim();
      const notary=rows.find(el=>label(el)==='Frais de notaire');
      const price=rows.find(el=>label(el)==="Prix d'achat");
      const anchor=notary||price;
      if(anchor)anchor.after(row);else card.insertBefore(row,card.children[2]||null);
    }
    detail.innerHTML=`<div class="back tap" data-imlist>← Retour aux biens</div>${card?card.outerHTML:'<div class="px">Fiche indisponible.</div>'}<div style="height:100px"></div>`;
  }
  const originalScreen=renderScreen;
  renderScreen=function(id){if(id==='immodetail'){drawDetail();return;}return originalScreen(id);};
  detail.onclick=function(e){
    if(e.target.closest('[data-imlist]')){go('immo','back');return;}
    if(e.target.closest('[data-imedit]')){openImmoForm(selected);return;}
    if(e.target.closest('[data-imamort]')){openImmoAmort(selected);return;}
    if(e.target.closest('[data-imdel]')){const id=selected;openConfirm('Supprimer ce bien ?',()=>{saveImmo(loadImmo().filter(p=>p.id!==id));go('immo','back');});}
  };
  const originalSave=saveImmo;
  saveImmo=function(list){originalSave(list);if(S.screen==='immodetail')drawDetail();};
  if(S.screen==='immo')renderScreen('immo');
}, {once:true});
