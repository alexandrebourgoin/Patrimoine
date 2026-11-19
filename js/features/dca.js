// DCA : plan d investissement programmé + objectifs de capital (calculs théoriques).
// Dépend, À L APPEL seulement, de S, masked, toast… (mon-patrimoine.js). S.dca est initialisé dans le littéral de S.

// ═══════════════════════════════════════════════
// DCA
// Plan d'investissement programmé (budget mensuel réparti en % entre des titres) + objectifs
// de capital. Calculs 100 % théoriques (apports prévus), aucun achat n'est écrit dans les comptes.
// Données : S.dca = { plans:[{from,budget,day,lines:[{ticker,name,weight,color,isin?,resolved?,yahooSymbol?,currency?}]}], goals:[{id,name,target,date,start,rate}] }
// `plans` trié par date d'effet : les échéances passées gardent l'ancien budget / l'ancienne répartition.
// Une ligne saisie avec un code ISIN non reconnu garde cet ISIN (isin, resolved:false) ; dès que le titre est retrouvé
// (synchronisation), la ligne reçoit son ticker et son libellé final et l'ISIN reste mémorisé.
// ═══════════════════════════════════════════════
// Un slot par mode (comme les comptes) : le DCA démo ne se mélange pas au DCA réel.
const STORE_DCA_DEMO = 'patrimoine-dca-demo';
const STORE_DCA_REAL = 'patrimoine-dca-real';
const STORE_DCA_LEGACY = 'patrimoine-dca'; // v1.11.97 : slot unique → migré vers le mode courant
const dcaKey = () => S.isDemo ? STORE_DCA_DEMO : STORE_DCA_REAL;
const DCA_COLORS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4'];

// Charge le slot du mode courant (à rappeler après chaque bascule démo ↔ réel)
function loadDca() {
  S.dca = { plans: [], goals: [] };
  try {
    const legacy = localStorage.getItem(STORE_DCA_LEGACY);
    if (legacy) {                       // migration unique, vers le mode actif au moment du chargement
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

// ── ISIN : mémorisation et résolution en libellé final ──
function _isIsin(s) { return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(String(s || '')); }
// Ticker connu pour un ISIN (table ISIN_MAP de l'appli), sinon null
function _isinMapped(isin) {
  try {
    const m = typeof ISIN_MAP !== 'undefined' ? ISIN_MAP[isin] : null;
    return typeof m === 'string' ? m : (m && m.ticker) || null;
  } catch (e) { return null; }
}
// Ligne déjà connue dans un plan (par ticker ou par ISIN) : permet de garder le libellé et l'ISIN déjà retrouvés
function dcaKnown(key) {
  for (const p of S.dca.plans) for (const l of p.lines) if (l.ticker === key || l.isin === key) return l;
  return null;
}
// Libellé affiché : le libellé final si le titre est reconnu, sinon l'ISIN saisi
function dcaLabel(l) { return (l.isin && !l.resolved) ? 'ISIN ' + l.isin : (l.name || l.ticker); }
// Construit la ligne enregistrée à partir de la saisie (ticker ou ISIN)
function dcaBuildLine(l) {
  const raw = l.ticker, k = dcaKnown(raw), base = { weight: l.weight, color: l.color };
  if (_isIsin(raw)) {
    const m = _isinMapped(raw);
    if (m) return { ticker: m, isin: raw, name: SECURITIES_DB[m]?.name || m, resolved: true, ...base };
    if (k && k.resolved) return { ticker: k.ticker, isin: raw, name: k.name, resolved: true, yahooSymbol: k.yahooSymbol, currency: k.currency, ...base };
    return { ticker: raw, isin: raw, name: raw, resolved: false, ...base };
  }
  const name = SECURITIES_DB[raw]?.name || S.watchlist.find(w => w.ticker === raw)?.name || (k && k.resolved ? k.name : null) || raw;
  return { ticker: raw, name, ...base, ...(k && k.isin ? { isin: k.isin, resolved: k.resolved, yahooSymbol: k.yahooSymbol, currency: k.currency } : {}) };
}
// Retrouve en ligne les titres saisis par ISIN : ticker + libellé final. force = ignore les essais déjà faits cette session.
let _dcaResolving = false;
const _dcaIsinTried = new Set();
async function dcaResolveIsins(force) {
  if (_dcaResolving) return;
  const todo = [];
  S.dca.plans.forEach(p => p.lines.forEach(l => { if (l.isin && !l.resolved && (force || !_dcaIsinTried.has(l.isin))) todo.push(l); }));
  if (!todo.length) { if (force) toast('Tous les titres sont reconnus'); return; }
  _dcaResolving = true;
  let ok = 0;
  try {
    for (const l of todo) {
      _dcaIsinTried.add(l.isin);
      const info = await resolveIsinOnline(l.isin);
      if (!info) continue;
      l.ticker = info.ticker; l.name = info.name; l.resolved = true;
      if (info.yahooSymbol) l.yahooSymbol = info.yahooSymbol;
      if (info.currency) l.currency = info.currency;
      ok++;
    }
  } finally { _dcaResolving = false; }
  if (ok) { saveDca(); if (S.screen === 'dca') renderScreen('dca'); }
  if (force || ok) toast(ok ? `${ok} titre${ok > 1 ? 's' : ''} reconnu${ok > 1 ? 's' : ''} ✓` : 'Titre introuvable pour le moment');
}

// Plan en vigueur à une date (le dernier dont la date d'effet est passée)
function dcaPlanAt(ymd) {
  let p = null;
  for (const x of S.dca.plans) if (x.from <= ymd) p = x;
  return p;
}
// Toutes les échéances de la 1re date d'effet jusqu'à `untilYmd` (incluse) : [{date, plan}]
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
  // 12 prochaines échéances (stratégie en vigueur à chaque date)
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
    <div class="t-title">DCA</div>
    <div class="t-sm" style="margin-top:2px">Investissement programmé et objectifs — calculs théoriques, aucun ordre passé</div>
  </div>`;
  const sec = t => `<div class="t-section px" style="padding:20px 20px 8px">${t}</div>`;
  if (!plan) return header + `<div style="text-align:center;padding:50px 20px;color:var(--text2)">
    <div style="font-size:40px;margin-bottom:12px">📈</div>
    <div style="font-size:15px;font-weight:600">Aucun plan DCA</div>
    <div class="t-sm" style="margin:6px 0 18px">Définis un budget mensuel et sa répartition entre tes titres.</div>
    <button class="form-submit" id="js-dca-cfg" style="max-width:260px">Configurer le plan</button>
  </div>` + renderDcaGoals(null);

  const pct = n => (Math.round(n * 100) / 100).toString().replace('.', ',');
  const unresolved = plan.lines.filter(l => l.isin && !l.resolved).length;
  const lines = plan.lines.map(l => {
    const amt = plan.budget * l.weight / 100, px = dcaPriceRef(l.ticker);
    const unres = l.isin && !l.resolved;
    const sub = unres ? `libellé non reconnu` : esc(l.ticker) + (l.isin ? ' · ' + esc(l.isin) : '');
    return `<div class="s-item" style="cursor:default">
      <div class="s-ico" style="background:${l.color}22"><span style="width:12px;height:12px;border-radius:50%;background:${l.color}"></span></div>
      <div class="flex1 col gap4"><div class="s-name">${esc(dcaLabel(l))}</div>
        <div class="s-sub">${sub} · ${pct(l.weight)} %${px ? ` · ≈ ${(amt / px).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} part(s)` : ''}</div></div>
      <div style="font-weight:700">${masked(amt)}</div>
    </div>`;
  }).join('');

  const maxC = st.proj.length ? st.proj[st.proj.length - 1].cumul : 1;
  const bars = st.proj.map((p, i) => `<div class="dca-bar" data-i="${i}" data-date="${p.date}" data-cumul="${p.cumul}" style="flex:1;background:var(--accent);opacity:${i === 0 ? 1 : .55};border-radius:4px 4px 0 0;height:${Math.max(4, p.cumul / maxC * 100)}%;cursor:pointer"></div>`).join('');

  const hist = [...S.dca.plans].reverse().map(p => `<div class="s-item" style="cursor:default">
      <div class="flex1 col gap4"><div class="s-name">${_fmtDate(p.from)}${p === plan ? ' · en vigueur' : ''}</div>
        <div class="s-sub">${S.privacy ? '● ● ●' : fmtCur(p.budget)}/mois · le ${p.day} · ${p.lines.map(l => esc(dcaLabel(l)) + ' ' + pct(l.weight) + '%').join(', ')}</div></div>
      <div class="dr-btn" data-plandel="${p.from}">✕</div>
    </div>`).join('');

  const syncCard = unresolved ? `<div class="px" style="margin-top:12px"><div style="padding:12px 14px;border-radius:14px;background:var(--card2);display:flex;align-items:center;gap:10px">
      <div class="t-sm" style="flex:1">${unresolved} titre${unresolved > 1 ? 's' : ''} saisi${unresolved > 1 ? 's' : ''} par code ISIN, libellé non reconnu pour l'instant. L'ISIN est conservé.</div>
      <button class="form-submit" id="js-dca-sync" style="margin:0;width:auto;padding:0 14px;height:38px">Synchroniser</button>
    </div></div>` : '';

  return header + `
  <div class="px" style="margin-top:14px"><button class="form-submit" id="js-dca-cfg" style="margin-top:0">Modifier le plan / changer de stratégie</button></div>
  ${syncCard}
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

// ── Modales (plan / objectif) ──
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
  const p = _dcaDraft;
  const opts = Object.entries(SECURITIES_DB).map(([t, d]) => `<option value="${esc(t)}">${esc(d.name)}</option>`).join('');
  return _dcaHead('Plan DCA') + `<datalist id="dca-tickers">${opts}</datalist>
    <div class="form-row">
      <div class="form-field"><div class="form-label">Budget mensuel</div><input class="form-input" id="dca-budget" type="number" min="0" step="any" inputmode="decimal" value="${p.budget || ''}" placeholder="500"></div>
      <div class="form-field"><div class="form-label">Jour du mois</div><input class="form-input" id="dca-day" type="number" min="1" max="31" inputmode="numeric" value="${p.day}"></div>
    </div>
    <div class="form-row"><div class="form-field"><div class="form-label">Date d'effet</div><input class="form-input" id="dca-from" type="date" value="${p.from}"></div></div>
    <div class="form-label" style="margin-bottom:8px">Répartition (total = 100 %)</div>
    ${p.lines.map((l, i) => `<div class="dca-line" data-i="${i}" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input class="form-input dl-t" list="dca-tickers" placeholder="Ticker ou ISIN" value="${esc(l.ticker)}" style="flex:1;min-width:0">
      <input class="form-input dl-w" type="number" min="0" max="100" step="any" inputmode="decimal" placeholder="%" value="${l.weight}" style="width:76px">
      <input class="dl-c" type="color" value="${l.color}" style="width:34px;height:34px;border:none;background:none;padding:0">
      <div class="dr-btn${p.lines.length <= 1 ? ' off' : ''}" data-ldel="${i}">✕</div></div>`).join('')}
    <div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 14px">
      <div class="dr-row" id="dca-ladd" style="padding:6px 0;color:var(--accent)">+ Ajouter un titre</div>
      <div id="dca-total" class="t-sm" style="font-weight:700"></div></div>
    <button class="form-submit" id="dca-save">Enregistrer le plan</button>`;
}
function readDcaPlanForm() {
  const b = document.getElementById('dca-modal-body'), p = _dcaDraft;
  p.budget = _numIn(b.querySelector('#dca-budget').value) || 0;
  p.day = parseInt(b.querySelector('#dca-day').value, 10) || 1;
  p.from = b.querySelector('#dca-from').value || p.from;
  p.lines = [...b.querySelectorAll('.dca-line')].map(r => ({
    ticker: r.querySelector('.dl-t').value.trim().toUpperCase(),
    weight: _numIn(r.querySelector('.dl-w').value) || 0,
    color: r.querySelector('.dl-c').value,
  }));
}
function dcaUpdateTotal() {
  const b = document.getElementById('dca-modal-body'); if (!b) return;
  const t = [...b.querySelectorAll('.dl-w')].reduce((s, i) => s + (_numIn(i.value) || 0), 0);
  const el = b.querySelector('#dca-total'); if (!el) return;
  el.textContent = `Total : ${Math.round(t * 100) / 100} %`;
  el.style.color = Math.abs(t - 100) < 0.01 ? 'var(--gain)' : 'var(--loss)';
}
function openDcaPlanModal() {
  const cur = dcaStats().current, today = _ymd(new Date());
  // Une ligne non reconnue est réaffichée avec son ISIN (c'est lui qui est stocké comme ticker)
  _dcaDraft = cur
    ? { budget: cur.budget, day: cur.day, from: today, lines: cur.lines.map(l => ({ ticker: l.ticker, weight: l.weight, color: l.color })) }
    : { budget: 0, day: 5, from: today, lines: [{ ticker: '', weight: 100, color: DCA_COLORS[0] }] };
  openDcaModal(dcaPlanModalHTML()); dcaUpdateTotal();
}
function saveDcaPlan() {
  readDcaPlanForm();
  const p = _dcaDraft;
  if (!(p.budget > 0)) return toast('Indique un budget mensuel');
  if (p.day < 1 || p.day > 31) return toast('Jour du mois entre 1 et 31');
  if (!p.from) return toast("Indique une date d'effet");
  if (p.lines.some(l => !l.ticker)) return toast('Renseigne le ticker ou l\'ISIN de chaque ligne');
  if (new Set(p.lines.map(l => l.ticker)).size !== p.lines.length) return toast('Un titre apparaît deux fois');
  if (Math.abs(p.lines.reduce((s, l) => s + l.weight, 0) - 100) > 0.01) return toast('Le total doit faire exactement 100 %');
  const plan = { from: p.from, budget: p.budget, day: p.day, lines: p.lines.map(dcaBuildLine) };
  // Même date d'effet : on remplace ; sinon on ajoute (l'historique des stratégies est conservé)
  S.dca.plans = S.dca.plans.filter(x => x.from !== plan.from).concat(plan).sort((a, b) => a.from < b.from ? -1 : 1);
  saveDca(); closeDcaModal(); renderScreen('dca'); toast('Plan DCA enregistré ✓');
  if (!S.isDemo) dcaResolveIsins(false);   // retrouve en arrière-plan le libellé des ISIN saisis
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
document.getElementById('dca-modal-body').addEventListener('input', e => { if (e.target.classList.contains('dl-w')) dcaUpdateTotal(); });

function bindDca(el) {
  el.querySelector('#js-back')?.addEventListener('click', back);
  el.querySelector('#js-dca-cfg')?.addEventListener('click', openDcaPlanModal);
  el.querySelector('#js-dca-sync')?.addEventListener('click', () => dcaResolveIsins(true));
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
  if (!S.isDemo) dcaResolveIsins(false);   // une tentative par ISIN et par session
}


// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('dca-modal-sheet', closeDcaModal);
