// DCA & objectifs : stockage, écran, formulaires (plan / objectif) et projection du patrimoine.
// Calculs et validations : js/features/dca-calc.js (purs, testés seuls) ; résolution des ISIN : js/features/dca-isin.js.
// Dépend, À L APPEL seulement, de S, masked, toast… (mon-patrimoine.js). S.dca est initialisé dans le littéral de S.
//
// Données : S.dca = { plans:[…], goals:[{id,name,target,date,start,rate}], projection?:{rl,rr} } (plans : voir dca-calc.js).
// Calculs 100 % théoriques (apports prévus), aucun achat n'est écrit dans les comptes.

// Un slot par mode (comme les comptes) : le DCA démo ne se mélange pas au DCA réel.
const STORE_DCA_DEMO = 'patrimoine-dca-demo';
const STORE_DCA_REAL = 'patrimoine-dca-real';
const STORE_DCA_LEGACY = 'patrimoine-dca'; // v1.11.97 : slot unique → migré vers le mode courant
const dcaKey = () => S.isDemo ? STORE_DCA_DEMO : STORE_DCA_REAL;
const DCA_COLORS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4'];

// Données illisibles ou invalides : message affiché sur l'écran, et ENREGISTREMENT BLOQUÉ (on n'écrase jamais des données qu'on
// n'a pas pu lire par une liste vide). Une donnée absente est simplement vide. Effacer le DCA : Réglages → Réinitialiser les données.
let _dcaLoadError = '';
function dcaLoadError() { return _dcaLoadError; }

// Charge le slot du mode courant (à rappeler après chaque bascule démo ↔ réel)
function loadDca() {
  S.dca = { plans: [], goals: [] };
  _dcaLoadError = '';
  try {
    const legacy = localStorage.getItem(STORE_DCA_LEGACY);
    if (legacy) {                       // migration unique, vers le mode actif au moment du chargement
      if (!localStorage.getItem(dcaKey())) localStorage.setItem(dcaKey(), legacy);
      localStorage.removeItem(STORE_DCA_LEGACY);
    }
    const raw = localStorage.getItem(dcaKey());
    let d = null;
    if (raw !== null && raw !== undefined) {
      try { d = JSON.parse(raw); } catch (e) { _dcaLoadError = 'JSON invalide'; return; }
      const err = dcaDataError(d);
      if (err) { _dcaLoadError = err; return; }
    }
    if (d && Array.isArray(d.plans)) S.dca.plans = d.plans.sort((a,b) => a.from < b.from ? -1 : 1);
    if (d && Array.isArray(d.goals)) S.dca.goals = d.goals;
    if (d && d.projection) S.dca.projection = dcaProjectionSettings(d.projection);
  } catch(e) { _dcaLoadError = (e && e.message) || 'lecture impossible'; }
}
// Écrit le slot du mode courant. Renvoie false (et prévient) si les données lues étaient illisibles ou si l'écriture échoue (quota plein).
function saveDca() {
  if (_dcaLoadError) { toast('Enregistrement impossible : données DCA illisibles (' + _dcaLoadError + ')'); return false; }
  try { localStorage.setItem(dcaKey(), JSON.stringify(S.dca)); return true; }
  catch(e) { toast('Enregistrement impossible : ' + ((e && e.message) || 'erreur')); return false; }
}
// Modification transactionnelle : applique `mutate`, enregistre, et RESTAURE l'état précédent si l'enregistrement échoue
// (jamais de plan ou d'objectif affiché mais perdu au rechargement). Renvoie true si tout est enregistré.
function dcaCommit(mutate) {
  if (_dcaLoadError) { saveDca(); return false; }   // prévient sans toucher à rien
  const snap = JSON.stringify(S.dca);
  mutate();
  if (saveDca()) return true;
  S.dca = JSON.parse(snap);
  return false;
}

const _dcaToday = () => dcaYmd(new Date());
function _fmtDate(s) { return dcaParseYmd(s).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }); }
function _numIn(v) { return parseFloat(String(v).replace(',', '.')); }

function dcaPriceRef(ticker) {
  for (const a of S.accounts) for (const h of a.holdings) if (h.ticker === ticker && h.currentPrice) return toRefCcy(h.currentPrice, h.currency || 'EUR');
  const w = S.watchlist.find(w => w.ticker === ticker);
  return w && w.price ? toRefCcy(w.price, w.currency || 'EUR') : null;
}

// ═══════════════════════════════════════════════
// ÉCRAN
// ═══════════════════════════════════════════════
const _dcaBanner = () => _dcaLoadError
  ? `<div class="oa-banner err" style="margin:10px 20px">Données DCA illisibles : ${esc(_dcaLoadError)}. Rien n'est modifié ni supprimé ; l'enregistrement est bloqué tant que ces données ne sont pas corrigées (Réglages → Réinitialiser les données les efface).</div>`
  : '';

function renderDca() {
  const today = _dcaToday(), st = dcaStats(S.dca.plans, today), plan = st.current;
  const header = `${backBarHTML()}
  <div class="settings-top" style="padding-top:4px">
    <div class="t-title">${navLabel('dca')}</div>
    <div class="t-sm" style="margin-top:2px">Investissement programmé, objectifs et projection — calculs théoriques, aucun ordre passé</div>
  </div>${_dcaBanner()}`;
  const sec = t => `<div class="t-section px" style="padding:20px 20px 8px">${t}</div>`;
  if (!plan) return header + `<div style="text-align:center;padding:50px 20px;color:var(--text2)">
    <div style="font-size:40px;margin-bottom:12px">📈</div>
    <div style="font-size:15px;font-weight:600">Aucun plan DCA</div>
    <div class="t-sm" style="margin:6px 0 18px">Définis un budget mensuel et sa répartition entre tes titres.</div>
    <button class="form-submit" id="js-dca-cfg" style="max-width:260px">Configurer le plan</button>
  </div>` + renderDcaGoals(null, today) + renderDcaProjection(null);

  const pct = n => (Math.round(n * 100) / 100).toString().replace('.', ',');
  const lines = plan.lines.map(l => {
    const amt = plan.budget * l.weight / 100, px = dcaPriceRef(l.ticker);
    return `<div class="s-item" style="cursor:default">
      <div class="s-ico" style="background:${l.color}22"><span style="width:12px;height:12px;border-radius:50%;background:${l.color}"></span></div>
      <div class="flex1 col gap4"><div class="s-name">${esc(l.name || l.ticker)}</div>
        <div class="s-sub">${esc(l.ticker)} · ${pct(l.weight)} %${px ? ` · ≈ ${(amt / px).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} part(s)` : ''}</div></div>
      <div style="font-weight:700">${masked(amt)}</div>
    </div>`;
  }).join('');

  const maxC = st.proj.length ? st.proj[st.proj.length - 1].cumul : 1;
  const bars = st.proj.map((p, i) => `<div class="dca-bar" data-i="${i}" data-date="${p.date}" data-cumul="${p.cumul}" style="flex:1;background:var(--accent);opacity:${i === 0 ? 1 : .55};border-radius:4px 4px 0 0;height:${Math.max(4, p.cumul / maxC * 100)}%;cursor:pointer"></div>`).join('');

  const hist = [...S.dca.plans].reverse().map(p => `<div class="s-item" style="cursor:default">
      <div class="flex1 col gap4"><div class="s-name">${_fmtDate(p.from)}${p === plan ? ' · en vigueur' : ''}</div>
        <div class="s-sub">${S.privacy ? '● ● ●' : fmtCur(p.budget)}/mois · le ${p.day} · ${p.lines.map(l => esc(l.ticker) + ' ' + pct(l.weight) + '%').join(', ')}</div></div>
      <div class="dr-btn" data-plandel="${p.from}">✕</div>
    </div>`).join('');
  const unresolved = S.dca.plans.some(p => (p.lines || []).some(l => l && l.isin && !l.resolved));

  return header + `
  <div class="px" style="margin-top:14px"><button class="form-submit" id="js-dca-cfg" style="margin-top:0">Modifier le plan / changer de stratégie</button>
  ${unresolved ? '<button type="button" class="form-submit" id="js-dca-sync" style="margin-top:10px">Résoudre les ISIN non reconnus</button>' : ''}</div>
  ${sec('Mon rythme')}
  <div class="s-group">
    <div class="s-item" style="cursor:default"><div class="flex1 s-name">Budget mensuel</div><div style="font-weight:800">${masked(plan.budget)}</div></div>
    <div class="s-item" style="cursor:default"><div class="flex1 s-name">Cumul théorique à ce jour</div><div style="font-weight:800">${masked(st.cumul)}</div></div>
    <div class="s-item" style="cursor:default"><div class="flex1 s-name">Échéances passées</div><div style="font-weight:800">${st.past.length}</div></div>
  </div>
  ${sec(`Prochaine répartition${st.next ? ' · ' + _fmtDate(st.next.date) : ''}`)}
  <div class="s-group">${lines}</div>
  ${sec('Et dans 12 échéances ?')}
  <div class="s-group" style="padding:14px 16px">
    <div style="display:flex;align-items:flex-end;gap:4px;height:90px">${bars}</div>
    <div id="dca-bar-info" class="t-sm" style="margin-top:10px;text-align:center">${st.proj.length ? `${_fmtDate(st.proj[0].date)} → ${_fmtDate(st.proj[st.proj.length - 1].date)} · ${masked(maxC)} cumulés (sans rendement)` : '—'}</div>
  </div>
  ${renderDcaGoals(plan, today)}
  ${renderDcaProjection(dcaPlanAt(S.dca.plans, today))}
  ${sec('Historique des stratégies')}
  <div class="s-group">${hist}</div>
  <div class="t-sm px" style="padding:14px 20px 30px">Cumul = somme des apports prévus par le plan, pas une valeur de portefeuille. Les données sont stockées sur cet appareil.</div>`;
}

function renderDcaGoals(plan, today) {
  const sec = `<div class="t-section px" style="padding:20px 20px 8px;display:flex;align-items:center;justify-content:space-between">Objectifs<div class="dr-btn" id="js-goal-add" style="font-size:18px">+</div></div>`;
  if (!S.dca.goals.length) return sec + `<div class="t-sm px" style="padding-bottom:8px">Aucun objectif. Ajoute un montant cible et une date pour savoir si ton plan y mène.</div>`;
  const budget = plan ? plan.budget : 0;
  return sec + `<div class="s-group">` + S.dca.goals.map(g => {
    const c = dcaGoalCalc(g, budget, today);
    return `<div class="s-item tap" data-goal="${g.id}" style="flex-wrap:wrap">
      <div class="flex1 col gap4"><div class="s-name">${esc(g.name)}</div>
        <div class="s-sub">Cible ${S.privacy ? '● ● ●' : fmtCur(g.target)} · ${_fmtDate(g.date)} · ${g.rate || 0} %/an</div></div>
      <span class="badge ${c.ok ? 'up' : 'dn'}">${c.ok ? 'Sur la bonne voie' : 'En retard'}</span>
      <div style="flex-basis:100%;height:6px;border-radius:3px;background:var(--card2);overflow:hidden"><div style="width:${c.pct}%;height:100%;background:${c.ok ? 'var(--gain)' : 'var(--accent)'}"></div></div>
      <div class="s-sub" style="flex-basis:100%">Capital actuel ${masked(g.start || 0)} · projeté ${masked(c.proj)}${c.need != null && !c.ok ? ` · il faudrait ${masked(c.need)}/mois` : ''}</div>
    </div>`;
  }).join('') + `</div>`;
}

// Projection du patrimoine FINANCIER à 1, 3, 5, 10, 15 et 20 ans (hypothèses modifiables, enregistrées avec les données DCA)
function renderDcaProjection(plan) {
  const title = '<div class="t-section px" style="padding:20px 20px 8px">Projection du patrimoine</div>';
  const set = dcaProjectionSettings(S.dca.projection), monthly = plan ? plan.budget : 0;
  let base, rows;
  try { base = dcaProjectionBase(S.accounts, a => accCash(a)); rows = dcaProjectionRows(base, monthly, set); }
  catch (error) { return title + `<div class="t-sm px">Projection indisponible : ${esc(error.message)}</div>`; }
  const k = v => S.privacy ? '● ● ●' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: S.currency, maximumFractionDigits: 0 }).format(v);
  const input = (key, label) => `<label style="flex:1;display:block"><span class="form-label">${label}</span><input class="form-input" id="dca-proj-${key}" data-dca-return="${key}" type="number" min="${DCA_RETURN_MIN}" max="${DCA_RETURN_MAX}" step="0.1" inputmode="decimal" value="${set[key]}"></label>`;
  const line = (a, b, cls = '') => `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px"><span class="${cls}">${a}</span><span class="t-num ${cls}">${b}</span></div>`;
  return title + `<div class="s-group" style="padding:14px 16px">
    ${line('Patrimoine financier actuel', `<b>${masked(base.total)}</b>`)}
    ${line('dont liquidités', masked(base.liquid), 't-sm')}
    ${line('dont autres actifs', masked(base.risk), 't-sm')}
    <div style="border-top:1px solid var(--border);margin-top:8px"></div>
    ${line('DCA mensuel', plan ? `<b>${masked(monthly)}</b>` : '—')}
    ${plan ? '' : '<div class="t-sm" style="margin-top:8px">Aucun plan en vigueur : projection sans versements.</div>'}
  </div>
  <div style="display:flex;gap:10px;margin:12px 20px 0">${input('rl', 'Liquidités (%/an)')}${input('rr', 'Autres actifs (%/an)')}</div>
  <div class="s-group dca-proj" style="margin-top:12px;padding:4px 14px 8px">
    <div class="dca-proj-row head"><span>Horizon</span><span>Versements</span><span>Prudent</span><span>Central</span><span>Optimiste</span></div>
    ${rows.map(r => `<div class="dca-proj-row"><b>${r.years} an${r.years > 1 ? 's' : ''}</b><span class="t-num dim">${k(r.contributions)}</span><span class="t-num">${k(r.prudent)}</span><b class="t-num">${k(r.central)}</b><span class="t-num">${k(r.optimistic)}</span></div>`).join('')}
  </div>
  <div class="t-sm px" style="padding:12px 20px">Rendements annuels effectifs. Liquidités : ${set.rl} %. Autres actifs : prudent ${Math.max(DCA_RETURN_MIN, set.rr - 3)} %, central ${set.rr} %, optimiste ${set.rr + 3} %.
  Les liquidités comprennent le cash non investi et les positions de type Cash. Les comptes observateurs et l'immobilier sont exclus.
  Le budget en vigueur aujourd'hui est maintenu constant et investi dans les autres actifs en fin de mois ; les changements de stratégie futurs ne sont pas pris en compte.
  Ni frais, ni fiscalité, ni inflation : simulation, pas prévision. Hypothèses enregistrées sur cet appareil, séparément en démo et en réel.</div>`;
}

// ═══════════════════════════════════════════════
// FORMULAIRES (plan / objectif)
// ═══════════════════════════════════════════════
let _dcaDraft = null, _dcaGoalDraft = null;
function openDcaModal(html) {
  document.getElementById('dca-modal-body').innerHTML = html;
  document.getElementById('dca-modal-bg').classList.add('show');
  document.getElementById('dca-modal-sheet').classList.add('show');
}
function closeDcaModal() {
  document.getElementById('dca-modal-bg').classList.remove('show');
  document.getElementById('dca-modal-sheet').classList.remove('show');
  _dcaDraft = _dcaGoalDraft = null;
}
const _dcaHead = t => `<div class="oa-head" style="margin-bottom:16px">
  <div class="modal-title" style="margin-bottom:0">${t}</div>
  <div id="dca-close" class="oa-x">✕</div></div>`;

// Dans le BROUILLON seulement, `weight` est la valeur saisie dans le mode actif (% ou montant).
// Les plans enregistrés conservent toujours des poids en pourcentages.
function dcaPlanModalHTML() {
  const p = _dcaDraft, amountMode = p.mode === 'amt', cur = esc(S.currency || 'EUR');
  const opts = Object.entries(SECURITIES_DB).map(([t, d]) => `<option value="${esc(t)}">${esc(d.name)}</option>`).join('');
  return _dcaHead('Plan DCA') + `<datalist id="dca-tickers">${opts}</datalist>
    <div class="form-row">
      <div class="form-field"><div class="form-label">Budget mensuel</div><input class="form-input" id="dca-budget" type="number" min="0" step="any" inputmode="decimal" value="${p.budget || ''}" placeholder="500"></div>
      <div class="form-field"><div class="form-label">Jour du mois</div><input class="form-input" id="dca-day" type="number" min="1" max="31" inputmode="numeric" value="${p.day}"></div>
    </div>
    <div class="form-row"><div class="form-field"><div class="form-label">Date d'effet</div><input class="form-input" id="dca-from" type="date" value="${p.from}"></div></div>
    <div class="form-label" style="margin-bottom:8px">Répartition</div>
    <div class="type-btns" style="margin-bottom:10px">
      <div class="type-btn${amountMode ? '' : ' on'}" data-dmode="pct">En %</div>
      <div class="type-btn${amountMode ? ' on' : ''}" data-dmode="amt">En montant (${cur})</div>
    </div>
    ${p.lines.map((l, i) => `<div class="dca-line" data-i="${i}" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input class="form-input dl-t" list="dca-tickers" placeholder="Ticker ou ISIN" value="${esc(l.ticker)}" style="flex:1;min-width:0">
      <input class="form-input dl-w" type="number" min="0" ${amountMode ? '' : 'max="100"'} step="any" inputmode="decimal" placeholder="${amountMode ? cur : '%'}" value="${Number.isFinite(l.weight) ? l.weight : ''}" style="width:86px">
      <input class="dl-c" type="color" value="${l.color}" style="width:34px;height:34px;border:none;background:none;padding:0">
      <div class="dr-btn${p.lines.length <= 1 ? ' off' : ''}" data-ldel="${i}">✕</div></div>`).join('')}
    <div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 14px">
      <div class="dr-row" id="dca-ladd" style="padding:6px 0;color:var(--accent)">+ Ajouter un titre</div>
      <div id="dca-total" class="t-sm" style="font-weight:700"></div></div>
    <div class="t-sm" style="margin-bottom:10px">En montants, un écart maximal d'un centime avec le budget est normalisé à l'enregistrement.</div>
    <button class="form-submit" id="dca-save">Enregistrer le plan</button>`;
}
// Lit le formulaire : un champ vide ou illisible donne NaN, refusé ensuite par la validation (jamais remplacé par 0 ou 1 en silence)
function readDcaPlanForm() {
  const b = document.getElementById('dca-modal-body'), p = _dcaDraft;
  p.budget = _numIn(b.querySelector('#dca-budget').value);
  p.day = Number(b.querySelector('#dca-day').value);
  p.from = b.querySelector('#dca-from').value;
  p.lines = [...b.querySelectorAll('.dca-line')].map(r => ({
    ticker: r.querySelector('.dl-t').value.trim().toUpperCase(),
    weight: _numIn(r.querySelector('.dl-w').value),
    color: r.querySelector('.dl-c').value,
  }));
}
// Répartition saisie → poids (%) validés, selon le mode du brouillon (lève une erreur au message affichable)
function _dcaDraftWeights(p) {
  const values = p.lines.map(l => l.weight);
  return p.mode === 'amt' ? dcaAmountsToWeights(values, p.budget) : dcaNormalizeWeights(values);
}
function dcaUpdateTotal() {
  const b = document.getElementById('dca-modal-body');
  if (!b || !_dcaDraft) return;
  const el = b.querySelector('#dca-total'); if (!el) return;
  const values = [...b.querySelectorAll('.dl-w')].map(i => _numIn(i.value));
  const total = values.reduce((s, v) => s + v, 0), budget = _numIn(b.querySelector('#dca-budget').value);
  const label = Number.isFinite(total) ? (Math.round(total * 100) / 100).toLocaleString('fr-FR') : '—';
  el.textContent = _dcaDraft.mode === 'amt' ? `Total : ${label} / ${Number.isFinite(budget) ? budget : '—'}` : `Total : ${label} %`;
  try {
    if (_dcaDraft.mode === 'amt') dcaAmountsToWeights(values, budget); else dcaNormalizeWeights(values);
    el.style.color = 'var(--gain)';
  } catch (error) { el.style.color = 'var(--loss)'; }
}
function openDcaPlanModal() {
  const cur = dcaStats(S.dca.plans, _dcaToday()).current, today = _dcaToday();
  _dcaDraft = cur
    ? { mode: 'pct', budget: cur.budget, day: cur.day, from: today, lines: cur.lines.map(l => ({ ticker: l.ticker, weight: l.weight, color: l.color })) }
    : { mode: 'pct', budget: 0, day: 5, from: today, lines: [{ ticker: '', weight: 100, color: DCA_COLORS[0] }] };
  openDcaModal(dcaPlanModalHTML()); dcaUpdateTotal();
}
function saveDcaPlan() {
  readDcaPlanForm();
  const p = _dcaDraft;
  const err = dcaPlanError(p);
  if (err) return toast(err);
  let lines;
  try { lines = dcaBuildLines(p.lines, _dcaDraftWeights(p), { plans: S.dca.plans, securities: SECURITIES_DB, watchlist: S.watchlist, isinMap: typeof ISIN_MAP !== 'undefined' ? ISIN_MAP : null }); }
  catch (error) { return toast(error.message); }
  const plan = { from: p.from, budget: p.budget, day: p.day, lines };
  // Même date d'effet : on remplace ; sinon on ajoute (l'historique des stratégies est conservé)
  if (!dcaCommit(() => { S.dca.plans = S.dca.plans.filter(x => x.from !== plan.from).concat(plan).sort((a, b) => a.from < b.from ? -1 : 1); })) return;
  closeDcaModal(); renderScreen('dca'); toast('Plan DCA enregistré ✓');
  if (!S.isDemo) void dcaResolveIsins();
}
// Bascule % ↔ montants : conversion à partir du budget saisi ; sans budget valide on ne convertit pas (la saisie n'est jamais effacée)
function switchDcaMode(mode) {
  const budget = _numIn(document.getElementById('dca-modal-body').querySelector('#dca-budget').value);
  if (!Number.isFinite(budget) || budget <= 0) return toast('Indique un budget mensuel avant de convertir');
  readDcaPlanForm();
  try {
    const values = _dcaDraft.lines.map(l => l.weight);
    const converted = mode === 'amt' ? dcaWeightsToAmounts(values, budget) : dcaAmountsToWeights(values, budget);
    _dcaDraft.lines = _dcaDraft.lines.map((l, i) => ({ ...l, weight: converted[i] }));
    _dcaDraft.mode = mode;
  } catch (error) { return toast(error.message); }
  openDcaModal(dcaPlanModalHTML()); dcaUpdateTotal();
}

function openDcaGoalModal(id) {
  const g = S.dca.goals.find(x => x.id === id);
  const y = new Date(); y.setFullYear(y.getFullYear() + 5);
  _dcaGoalDraft = g ? { ...g } : { id: 'g' + Date.now(), name: '', target: 0, date: dcaYmd(y), start: Math.round(dcaStats(S.dca.plans, _dcaToday()).cumul), rate: 4, isNew: true };
  const d = _dcaGoalDraft;
  openDcaModal(_dcaHead(g ? "Modifier l'objectif" : 'Nouvel objectif') + `
    <div class="form-row"><div class="form-field"><div class="form-label">Nom</div><input class="form-input" id="dg-name" value="${esc(d.name)}" placeholder="Apport immobilier"></div></div>
    <div class="form-row">
      <div class="form-field"><div class="form-label">Montant cible</div><input class="form-input" id="dg-target" type="number" min="0" step="any" inputmode="decimal" value="${d.target || ''}"></div>
      <div class="form-field"><div class="form-label">Date cible</div><input class="form-input" id="dg-date" type="date" value="${d.date}"></div>
    </div>
    <div class="form-row">
      <div class="form-field"><div class="form-label">Capital actuel</div><input class="form-input" id="dg-start" type="number" min="0" step="any" inputmode="decimal" value="${d.start}"></div>
      <div class="form-field"><div class="form-label">Rendement annuel (%)</div><input class="form-input" id="dg-rate" type="number" step="any" inputmode="decimal" value="${d.rate}"></div>
    </div>
    <div class="t-sm" style="margin-bottom:12px">Projection : capital actuel + versements mensuels du plan, capitalisés au rendement hypothétique nominal réparti sur douze mois. Rendement 0 = sans intérêts.</div>
    <button class="form-submit" id="dg-save">Enregistrer</button>
    ${g ? '<button class="form-submit" id="dg-del" style="background:var(--loss);margin-top:10px">Supprimer</button>' : ''}`);
}
function saveDcaGoal() {
  const b = document.getElementById('dca-modal-body'), d = _dcaGoalDraft;
  d.name = b.querySelector('#dg-name').value.trim();
  d.target = _numIn(b.querySelector('#dg-target').value);
  d.date = b.querySelector('#dg-date').value;
  d.start = _numIn(b.querySelector('#dg-start').value) || 0;
  d.rate = _numIn(b.querySelector('#dg-rate').value) || 0;
  const err = dcaGoalError(d);
  if (err) return toast(err);
  const isNew = d.isNew; delete d.isNew;
  if (!dcaCommit(() => { S.dca.goals = isNew ? [...S.dca.goals, d] : S.dca.goals.map(x => x.id === d.id ? d : x); })) return;
  closeDcaModal(); renderScreen('dca'); toast('Objectif enregistré ✓');
}

document.getElementById('dca-modal-bg').addEventListener('click', closeDcaModal);
document.getElementById('dca-modal-body').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('#dca-close')) return closeDcaModal();
  if (t.closest('#dca-save')) return saveDcaPlan();
  if (t.closest('#dg-save')) return saveDcaGoal();
  if (t.closest('#dg-del')) {
    const id = _dcaGoalDraft.id;
    closeDcaModal();
    return openConfirm('Supprimer cet objectif ?', () => { if (dcaCommit(() => { S.dca.goals = S.dca.goals.filter(x => x.id !== id); })) renderScreen('dca'); });
  }
  const mode = t.closest('[data-dmode]');
  if (mode && _dcaDraft && ['pct', 'amt'].includes(mode.dataset.dmode)) {
    if (mode.dataset.dmode !== _dcaDraft.mode) switchDcaMode(mode.dataset.dmode);
    return;
  }
  if (t.closest('#dca-ladd')) {
    readDcaPlanForm();
    if (_dcaDraft.lines.length < 8) _dcaDraft.lines.push({ ticker: '', weight: 0, color: DCA_COLORS[_dcaDraft.lines.length % DCA_COLORS.length] });
    openDcaModal(dcaPlanModalHTML()); dcaUpdateTotal(); return;
  }
  const del = t.closest('[data-ldel]');
  if (del && !del.classList.contains('off')) {
    readDcaPlanForm(); _dcaDraft.lines.splice(+del.dataset.ldel, 1);
    openDcaModal(dcaPlanModalHTML()); dcaUpdateTotal();
  }
});
document.getElementById('dca-modal-body').addEventListener('input', e => {
  if (e.target.classList.contains('dl-w') || e.target.id === 'dca-budget') dcaUpdateTotal();
});

// Hypothèses de rendement : enregistrées avec les données DCA, puis l'écran est redessiné
function bindDcaProjection(el) {
  el.querySelectorAll('[data-dca-return]').forEach(input => input.addEventListener('change', () => {
    const key = input.dataset.dcaReturn;
    if (!['rl', 'rr'].includes(key)) return;
    const text = input.value.trim(), value = Number(text.replace(',', '.'));
    const set = dcaProjectionSettings(S.dca.projection);
    if (!text || !Number.isFinite(value) || value < DCA_RETURN_MIN || value > DCA_RETURN_MAX) {
      input.value = set[key];
      return toast(`Rendement entre ${DCA_RETURN_MIN} et ${DCA_RETURN_MAX} %`);
    }
    if (dcaCommit(() => { S.dca.projection = { ...set, [key]: value }; })) renderScreen('dca');
    else input.value = set[key];
  }));
}

SCREEN_BIND.dca = function (el) {
  bindDcaProjection(el);
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.querySelector('#js-dca-cfg')?.addEventListener('click', openDcaPlanModal);
  el.querySelector('#js-dca-sync')?.addEventListener('click', () => { void dcaResolveIsins(true); });
  el.querySelector('#js-goal-add')?.addEventListener('click', () => openDcaGoalModal());
  el.querySelectorAll('[data-goal]').forEach(i => i.addEventListener('click', () => openDcaGoalModal(i.dataset.goal)));
  el.querySelectorAll('[data-plandel]').forEach(b => b.addEventListener('click', () => {
    const from = b.dataset.plandel;
    const last = S.dca.plans.length === 1;
    openConfirm(last ? `Supprimer le plan DCA (stratégie du ${_fmtDate(from)}) ? Le cumul et la projection seront effacés ; les objectifs sont conservés.` : `Supprimer la stratégie du ${_fmtDate(from)} ?`, () => {
      if (dcaCommit(() => { S.dca.plans = S.dca.plans.filter(p => p.from !== from); })) renderScreen('dca');
    });
  }));
  el.querySelectorAll('.dca-bar').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('.dca-bar').forEach(x => x.style.opacity = x === b ? 1 : .55);
    el.querySelector('#dca-bar-info').innerHTML = `${_fmtDate(b.dataset.date)} · ${masked(+b.dataset.cumul)} cumulés`;
  }));
  if (!S.isDemo) void dcaResolveIsins();
};

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('dca-modal-sheet', closeDcaModal);
