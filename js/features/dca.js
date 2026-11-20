// DCA & objectifs : calculs théoriques, aucun ordre écrit dans les comptes.
// Dépendances applicatives utilisées à l’appel uniquement.
const STORE_DCA_DEMO = 'patrimoine-dca-demo';
const STORE_DCA_REAL = 'patrimoine-dca-real';
const STORE_DCA_LEGACY = 'patrimoine-dca';
const dcaKey = () => S.isDemo ? STORE_DCA_DEMO : STORE_DCA_REAL;
const DCA_COLORS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4'];

// Calculs purs partagés par le formulaire et les tests.
const DCAAllocation = (() => {
  function numbers(values) {
    if (!Array.isArray(values) || !values.length || values.some(v => !Number.isFinite(v) || v < 0)) throw new TypeError('Répartition invalide');
  }
  function budgetCents(budget) {
    if (!Number.isFinite(budget) || budget <= 0) throw new RangeError('Budget mensuel requis');
    const cents = Math.round(budget * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) throw new RangeError('Budget hors limites');
    return cents;
  }
  function normalized(values) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total) || total <= 0) throw new RangeError('Répartition vide ou hors limites');
    const weights = values.map(value => value / total * 100);
    const largest = values.indexOf(Math.max(...values));
    weights[largest] += 100 - weights.reduce((sum, value) => sum + value, 0);
    return weights;
  }
  function normalizeWeights(weights) {
    numbers(weights);
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.01 + 1e-10) throw new RangeError('Le total doit faire 100 %');
    return normalized(weights);
  }
  function toAmounts(weights, budget) {
    const cents = budgetCents(budget);
    numbers(weights);
    return weights.map(weight => Math.round(cents * weight / 100) / 100);
  }
  function toWeights(amounts, budget) {
    const cents = budgetCents(budget);
    numbers(amounts);
    const amountsInCents = amounts.map(amount => Math.round(amount * 100));
    if (amountsInCents.some(value => !Number.isSafeInteger(value))) throw new RangeError('Montant hors limites');
    const total = amountsInCents.reduce((sum, value) => sum + value, 0);
    if (!Number.isSafeInteger(total) || Math.abs(total - cents) > 1) throw new RangeError('Le total des montants doit égaler le budget mensuel');
    return normalized(amountsInCents);
  }
  function resolveLine(lines, index, info) {
    if (!Array.isArray(lines) || !Number.isInteger(index) || !lines[index]) throw new TypeError('Ligne introuvable');
    const ticker = typeof info?.ticker === 'string' ? info.ticker.trim().toUpperCase() : '';
    if (!ticker) throw new TypeError('Ticker résolu invalide');
    if (lines.some((line, i) => i !== index && String(line.ticker || '').trim().toUpperCase() === ticker)) throw new RangeError('Un titre apparaît deux fois après résolution');
    return lines.map((line, i) => i !== index ? { ...line } : {
      ...line, ticker, name: info.name || ticker, resolved: true,
      ...(info.yahooSymbol ? { yahooSymbol: info.yahooSymbol } : {}),
      ...(info.currency ? { currency: info.currency } : {}),
    });
  }
  return { normalizeWeights, toAmounts, toWeights, resolveLine };
})();

function loadDca() {
  S.dca = { plans: [], goals: [] };
  try {
    const legacy = localStorage.getItem(STORE_DCA_LEGACY);
    if (legacy) {
      if (!localStorage.getItem(dcaKey())) localStorage.setItem(dcaKey(), legacy);
      localStorage.removeItem(STORE_DCA_LEGACY);
    }
    const d = JSON.parse(localStorage.getItem(dcaKey()) || 'null');
    if (d && Array.isArray(d.plans)) S.dca.plans = d.plans.sort((a,b) => a.from < b.from ? -1 : 1);
    if (d && Array.isArray(d.goals)) S.dca.goals = d.goals;
  } catch(e) {}
}
function saveDca() { try { localStorage.setItem(dcaKey(), JSON.stringify(S.dca)); } catch(e) {} }
function _ymd(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function _parseYmd(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function _fmtDate(s) { return _parseYmd(s).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }); }
function _numIn(v) { return parseFloat(String(v).replace(',', '.')); }
function _isIsin(s) { return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(s || '')); }

function dcaBuildLines(draft, weights) {
  const history = S.dca.plans.flatMap(plan => plan.lines || []);
  let lines = draft.map((line, index) => {
    const ticker = line.ticker.trim().toUpperCase();
    const known = history.find(item => item.ticker === ticker || item.isin === ticker);
    const isin = _isIsin(ticker) ? ticker : known?.isin;
    return {
      ticker, name: SECURITIES_DB[ticker]?.name || S.watchlist.find(w => w.ticker === ticker)?.name || known?.name || ticker,
      weight: weights[index], color: line.color,
      ...(isin ? { isin, resolved: ticker !== isin && !!known?.resolved } : {}),
      ...(known?.yahooSymbol && ticker !== isin ? { yahooSymbol: known.yahooSymbol } : {}),
      ...(known?.currency ? { currency: known.currency } : {}),
    };
  });
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.isin || line.resolved) continue;
    const mapped = typeof ISIN_MAP !== 'undefined' ? ISIN_MAP[line.isin] : null;
    const known = history.find(item => item.isin === line.isin && item.resolved);
    const info = typeof mapped === 'string' ? { ticker: mapped } : mapped || known;
    if (info?.ticker) {
      lines = DCAAllocation.resolveLine(lines, index, { ...info, name: SECURITIES_DB[info.ticker]?.name || info.name || info.ticker });
    }
  }
  return lines;
}

// Une tentative automatique par ISIN et par mode durant la session.
// Une nouvelle synchronisation manuelle peut retenter les recherches infructueuses.
let _dcaResolving = false;
const _dcaIsinTried = new Set();
async function dcaResolveIsins(force = false) {
  const result = { resolved: 0, conflicts: 0, failed: 0, cancelled: false };
  if (_dcaResolving) return { ...result, pending: true };
  const data = S.dca, demo = S.isDemo;
  const current = () => S.dca === data && S.isDemo === demo;
  if (typeof resolveIsinOnline !== 'function') {
    if (force) toast('Résolution en ligne indisponible');
    return { ...result, unavailable: true };
  }
  const key = isin => `${demo ? 'demo' : 'real'}:${isin}`;
  const todo = [...new Set(data.plans.flatMap(plan => (plan.lines || [])
    .filter(line => line && _isIsin(line.isin) && !line.resolved).map(line => line.isin)))]
    .filter(isin => force || !_dcaIsinTried.has(key(isin)));
  if (!todo.length) {
    if (force) toast('Aucun ISIN à résoudre');
    return result;
  }
  _dcaResolving = true;
  try {
    for (const isin of todo) {
      if (!current()) { result.cancelled = true; return result; }
      _dcaIsinTried.add(key(isin));
      let info;
      try { info = await resolveIsinOnline(isin); }
      catch (error) {
        if (!current()) { result.cancelled = true; return result; }
        result.failed++;
        continue;
      }
      if (!current()) { result.cancelled = true; return result; }
      if (!info || typeof info.ticker !== 'string' || !info.ticker.trim()) { result.failed++; continue; }
      let changed = false;
      for (const plan of data.plans) {
        const index = (plan.lines || []).findIndex(line => line && line.isin === isin && !line.resolved);
        if (index < 0) continue;
        try {
          plan.lines = DCAAllocation.resolveLine(plan.lines, index, info);
          result.resolved++;
          changed = true;
        } catch (error) {
          if (error instanceof RangeError) result.conflicts++;
          else result.failed++;
        }
      }
      // Sauvegarde avant le prochain await, uniquement dans le mode encore actif.
      if (changed) saveDca();
    }
    if (result.resolved && S.screen === 'dca') renderScreen('dca');
    if (force || result.resolved || result.conflicts) {
      toast(`${result.resolved} titre(s) reconnu(s) · ${result.conflicts} doublon(s) refusé(s) · ${result.failed} recherche(s) infructueuse(s)`);
    }
    return result;
  } finally { _dcaResolving = false; }
}

function dcaPlanAt(ymd) {
  let p = null;
  for (const x of S.dca.plans) if (x.from <= ymd) p = x;
  return p;
}
function dcaOccurrences(untilYmd) {
  const plans = S.dca.plans, out = [];
  if (!plans.length) return out;
  let cur = _parseYmd(plans[0].from); cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const until = _parseYmd(untilYmd);
  while (cur <= until) {
    const y = cur.getFullYear(), m = cur.getMonth(), last = new Date(y, m+1, 0).getDate();
    for (let i = 0; i < plans.length; i++) {
      const c = _ymd(new Date(y, m, Math.min(plans[i].day, last)));
      const next = plans[i+1];
      if (c >= plans[i].from && (!next || c < next.from)) { if (c <= untilYmd) out.push({ date: c, plan: plans[i] }); break; }
    }
    cur = new Date(y, m+1, 1);
  }
  return out;
}
function dcaStats() {
  const today = _ymd(new Date());
  const past = dcaOccurrences(today);
  const cumul = past.reduce((s,o) => s + o.plan.budget, 0);
  const horizon = new Date(); horizon.setMonth(horizon.getMonth() + 14);
  const future = dcaOccurrences(_ymd(horizon)).filter(o => o.date > today).slice(0, 12);
  let run = cumul;
  const proj = future.map(o => { run += o.plan.budget; return { date: o.date, budget: o.plan.budget, cumul: run }; });
  return { today, past, cumul, next: future[0] || null, proj, current: dcaPlanAt(today) || S.dca.plans[0] || null };
}
function dcaPriceRef(ticker) {
  for (const a of S.accounts) for (const h of a.holdings) if (h.ticker === ticker && h.currentPrice) return toRefCcy(h.currentPrice, h.currency || 'EUR');
  const w = S.watchlist.find(w => w.ticker === ticker);
  return w && w.price ? toRefCcy(w.price, w.currency || 'EUR') : null;
}
function dcaGoalCalc(g, budget) {
  const now = new Date(), end = _parseYmd(g.date);
  let n = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) n--;
  n = Math.max(0, n);
  const i = (g.rate || 0) / 1200, grow = Math.pow(1 + i, n);
  const proj = (g.start || 0) * grow + (i ? budget * (grow - 1) / i : budget * n);
  let need = null;
  if (n > 0) need = Math.max(0, i ? (g.target - (g.start || 0) * grow) * i / (grow - 1) : (g.target - (g.start || 0)) / n);
  return { n, proj, need, pct: Math.min(100, (g.start || 0) / g.target * 100), ok: proj >= g.target };
}

function renderDca() {
  const st = dcaStats(), plan = st.current;
  const header = `<div class="back tap" id="js-back">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Retour
  </div>
  <div class="settings-top" style="padding-top:4px">
    <div class="t-title">DCA & objectifs</div>
    <div class="t-sm" style="margin-top:2px">Investissement programmé — calculs théoriques, aucun ordre passé</div>
  </div>`;
  const sec = t => `<div class="t-section px" style="padding:20px 20px 8px">${t}</div>`;
  if (!plan) return header + `<div style="text-align:center;padding:50px 20px;color:var(--text2)">
    <div style="font-size:40px;margin-bottom:12px">📈</div>
    <div style="font-size:15px;font-weight:600">Aucun plan DCA</div>
    <div class="t-sm" style="margin:6px 0 18px">Définis un budget mensuel et sa répartition entre tes titres.</div>
    <button class="form-submit" id="js-dca-cfg" style="max-width:260px">Configurer le plan</button>
  </div>` + renderDcaGoals(null);
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
  ${unresolved ? '<button type="button" class="form-submit" id="js-dca-sync">Résoudre les ISIN non reconnus</button>' : ''}</div>
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
  ${renderDcaGoals(plan)}
  ${sec('Historique des stratégies')}
  <div class="s-group">${hist}</div>
  <div class="t-sm px" style="padding:14px 20px 30px">Cumul = somme des apports prévus par le plan, pas une valeur de portefeuille. Les données sont stockées sur cet appareil.</div>`;
}

function renderDcaGoals(plan) {
  const sec = `<div class="t-section px" style="padding:20px 20px 8px;display:flex;align-items:center;justify-content:space-between">Objectifs<div class="dr-btn" id="js-goal-add" style="font-size:18px">+</div></div>`;
  if (!S.dca.goals.length) return sec + `<div class="t-sm px" style="padding-bottom:8px">Aucun objectif. Ajoute un montant cible et une date pour savoir si ton plan y mène.</div>`;
  const budget = plan ? plan.budget : 0;
  return sec + `<div class="s-group">` + S.dca.goals.map(g => {
    const c = dcaGoalCalc(g, budget);
    return `<div class="s-item tap" data-goal="${g.id}" style="flex-wrap:wrap">
      <div class="flex1 col gap4"><div class="s-name">${esc(g.name)}</div>
        <div class="s-sub">Cible ${S.privacy ? '● ● ●' : fmtCur(g.target)} · ${_fmtDate(g.date)} · ${g.rate || 0} %/an</div></div>
      <span class="badge ${c.ok ? 'up' : 'dn'}">${c.ok ? 'Sur la bonne voie' : 'En retard'}</span>
      <div style="flex-basis:100%;height:6px;border-radius:3px;background:var(--card2);overflow:hidden"><div style="width:${c.pct}%;height:100%;background:${c.ok ? 'var(--gain)' : 'var(--accent)'}"></div></div>
      <div class="s-sub" style="flex-basis:100%">Capital actuel ${masked(g.start || 0)} · projeté ${masked(c.proj)}${c.need != null && !c.ok ? ` · il faudrait ${masked(c.need)}/mois` : ''}</div>
    </div>`;
  }).join('') + `</div>`;
}

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
const _dcaHead = t => `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
  <div class="modal-title" style="margin-bottom:0">${t}</div>
  <div id="dca-close" style="width:32px;height:32px;border-radius:50%;background:var(--card2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);font-size:16px;flex-shrink:0">✕</div></div>`;

function dcaPlanModalHTML() {
  const p = _dcaDraft, amountMode = p.mode === 'amt';
  const unit = amountMode ? esc(S.currency || 'EUR') : '%';
  const opts = Object.entries(SECURITIES_DB).map(([t, d]) => `<option value="${esc(t)}">${esc(d.name)}</option>`).join('');
  return _dcaHead('Plan DCA') + `<datalist id="dca-tickers">${opts}</datalist>
    <div class="form-row">
      <div class="form-field"><div class="form-label">Budget mensuel</div><input class="form-input" id="dca-budget" type="number" min="0" step="any" inputmode="decimal" value="${p.budget || ''}" placeholder="500"></div>
      <div class="form-field"><div class="form-label">Jour du mois</div><input class="form-input" id="dca-day" type="number" min="1" max="31" inputmode="numeric" value="${p.day}"></div>
    </div>
    <div class="form-row"><div class="form-field"><div class="form-label">Date d'effet</div><input class="form-input" id="dca-from" type="date" value="${p.from}"></div></div>
    <div class="form-label" style="margin-bottom:8px">Répartition
      <button type="button" class="tap" data-dmode="pct" aria-pressed="${!amountMode}">En %</button>
      <button type="button" class="tap" data-dmode="amt" aria-pressed="${amountMode}">En montant (${esc(S.currency || 'EUR')})</button>
    </div>
    ${p.lines.map((l, i) => `<div class="dca-line" data-i="${i}" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input class="form-input dl-t" list="dca-tickers" placeholder="Ticker ou ISIN" value="${esc(l.ticker)}" style="flex:1;min-width:0">
      <input class="form-input dl-w" type="number" min="0" ${amountMode ? '' : 'max="100"'} step="any" inputmode="decimal" placeholder="${unit}" value="${Number.isFinite(l.weight) ? l.weight : ''}" style="width:86px">
      <input class="dl-c" type="color" value="${l.color}" style="width:34px;height:34px;border:none;background:none;padding:0">
      <div class="dr-btn${p.lines.length <= 1 ? ' off' : ''}" data-ldel="${i}">✕</div></div>`).join('')}
    <div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 14px">
      <div class="dr-row" id="dca-ladd" style="padding:6px 0;color:var(--accent)">+ Ajouter un titre</div>
      <div id="dca-total" class="t-sm" style="font-weight:700"></div></div>
    <div class="t-sm">En montants, un écart maximal d’un centime est normalisé à l’enregistrement.</div>
    <button class="form-submit" id="dca-save">Enregistrer le plan</button>`;
}

// Dans le brouillon seulement, weight est la valeur saisie dans le mode actif.
// Les plans persistés conservent toujours des poids en pourcentages.
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
function dcaUpdateTotal() {
  const b = document.getElementById('dca-modal-body');
  if (!b || !_dcaDraft) return;
  const values = [...b.querySelectorAll('.dl-w')].map(input => _numIn(input.value));
  const total = values.reduce((sum, value) => sum + value, 0);
  const el = b.querySelector('#dca-total');
  if (!el) return;
  const budget = _numIn(b.querySelector('#dca-budget').value);
  const label = Number.isFinite(total) ? (Math.round(total * 100) / 100).toLocaleString('fr-FR') : '—';
  el.textContent = _dcaDraft.mode === 'amt' ? `Total : ${label} / ${Number.isFinite(budget) ? budget : '—'}` : `Total : ${label} %`;
  try {
    if (_dcaDraft.mode === 'amt') DCAAllocation.toWeights(values, budget);
    else DCAAllocation.normalizeWeights(values);
    el.style.color = 'var(--gain)';
  } catch (error) { el.style.color = 'var(--loss)'; }
}
function openDcaPlanModal() {
  const cur = dcaStats().current, today = _ymd(new Date());
  _dcaDraft = cur
    ? { mode: 'pct', budget: cur.budget, day: cur.day, from: today, lines: cur.lines.map(l => ({ ticker: l.ticker, weight: l.weight, color: l.color })) }
    : { mode: 'pct', budget: 0, day: 5, from: today, lines: [{ ticker: '', weight: 100, color: DCA_COLORS[0] }] };
  openDcaModal(dcaPlanModalHTML()); dcaUpdateTotal();
}
function saveDcaPlan() {
  readDcaPlanForm();
  const p = _dcaDraft;
  if (!Number.isFinite(p.budget) || p.budget <= 0) return toast('Indique un budget mensuel');
  if (!Number.isInteger(p.day) || p.day < 1 || p.day > 31) return toast('Jour du mois entre 1 et 31');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.from) || _ymd(_parseYmd(p.from)) !== p.from) return toast("Indique une date d'effet valide");
  if (p.lines.some(l => !l.ticker)) return toast('Renseigne le ticker ou l’ISIN de chaque ligne');
  if (new Set(p.lines.map(l => l.ticker)).size !== p.lines.length) return toast('Un titre apparaît deux fois');
  let lines;
  try {
    const values = p.lines.map(l => l.weight);
    const weights = p.mode === 'amt' ? DCAAllocation.toWeights(values, p.budget) : DCAAllocation.normalizeWeights(values);
    lines = dcaBuildLines(p.lines, weights);
  } catch (error) { return toast(error.message); }
  const plan = { from: p.from, budget: p.budget, day: p.day, lines };
  S.dca.plans = S.dca.plans.filter(x => x.from !== plan.from).concat(plan).sort((a, b) => a.from < b.from ? -1 : 1);
  saveDca(); closeDcaModal(); renderScreen('dca'); toast('Plan DCA enregistré ✓');
  if (!S.isDemo) void dcaResolveIsins();
}

function openDcaGoalModal(id) {
  const g = S.dca.goals.find(x => x.id === id);
  const y = new Date(); y.setFullYear(y.getFullYear() + 5);
  _dcaGoalDraft = g ? { ...g } : { id: 'g' + Date.now(), name: '', target: 0, date: _ymd(y), start: Math.round(dcaStats().cumul), rate: 4, isNew: true };
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
    <div class="t-sm" style="margin-bottom:12px">Projection : capital actuel + versements mensuels du plan, capitalisés au rendement hypothétique. Rendement 0 = sans intérêts.</div>
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
  if (!d.name) return toast("Donne un nom à l'objectif");
  if (!(d.target > 0)) return toast('Indique un montant cible');
  if (!d.date) return toast('Indique une date cible');
  const isNew = d.isNew; delete d.isNew;
  S.dca.goals = isNew ? [...S.dca.goals, d] : S.dca.goals.map(x => x.id === d.id ? d : x);
  saveDca(); closeDcaModal(); renderScreen('dca'); toast('Objectif enregistré ✓');
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
    return openConfirm('Supprimer cet objectif ?', () => { S.dca.goals = S.dca.goals.filter(x => x.id !== id); saveDca(); renderScreen('dca'); });
  }
  const mode = t.closest('[data-dmode]');
  if (mode && _dcaDraft && ['pct', 'amt'].includes(mode.dataset.dmode) && mode.dataset.dmode !== _dcaDraft.mode) {
    const budget = _numIn(document.getElementById('dca-modal-body').querySelector('#dca-budget').value);
    if (!Number.isFinite(budget) || budget <= 0) return toast('Indique un budget mensuel avant de convertir');
    readDcaPlanForm();
    try {
      const values = _dcaDraft.lines.map(l => l.weight);
      const converted = mode.dataset.dmode === 'amt' ? DCAAllocation.toAmounts(values, budget) : DCAAllocation.toWeights(values, budget);
      _dcaDraft.lines = _dcaDraft.lines.map((line, index) => ({ ...line, weight: converted[index] }));
      _dcaDraft.mode = mode.dataset.dmode;
    } catch (error) { return toast(error.message); }
    openDcaModal(dcaPlanModalHTML()); dcaUpdateTotal(); return;
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

function bindDca(el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.querySelector('#js-dca-cfg')?.addEventListener('click', openDcaPlanModal);
  el.querySelector('#js-dca-sync')?.addEventListener('click', () => { void dcaResolveIsins(true); });
  el.querySelector('#js-goal-add')?.addEventListener('click', () => openDcaGoalModal());
  el.querySelectorAll('[data-goal]').forEach(i => i.addEventListener('click', () => openDcaGoalModal(i.dataset.goal)));
  el.querySelectorAll('[data-plandel]').forEach(b => b.addEventListener('click', () => {
    const from = b.dataset.plandel;
    const last = S.dca.plans.length === 1;
    openConfirm(last ? `Supprimer le plan DCA (stratégie du ${_fmtDate(from)}) ? Le cumul et la projection seront effacés ; les objectifs sont conservés.` : `Supprimer la stratégie du ${_fmtDate(from)} ?`, () => {
      S.dca.plans = S.dca.plans.filter(p => p.from !== from); saveDca(); renderScreen('dca');
    });
  }));
  el.querySelectorAll('.dca-bar').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('.dca-bar').forEach(x => x.style.opacity = x === b ? 1 : .55);
    el.querySelector('#dca-bar-info').innerHTML = `${_fmtDate(b.dataset.date)} · ${masked(+b.dataset.cumul)} cumulés`;
  }));
  if (!S.isDemo) void dcaResolveIsins();
}
registerModal('dca-modal-sheet', closeDcaModal);
