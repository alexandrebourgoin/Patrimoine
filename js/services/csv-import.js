// Import CSV (Degiro et formats génériques) : parsing + modale d aperçu.
// Dépend, À L APPEL seulement, de S, ISIN_MAP, SECURITIES_DB, recalcHolding, refreshMain… (mon-patrimoine.js).

// ═══════════════════════════════════════════════
// CSV IMPORT
// ═══════════════════════════════════════════════
document.getElementById('csv-file').addEventListener('change',function(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>parseCSV(ev.target.result);
  r.readAsText(f); this.value='';
});

// ── Parser robuste d'une ligne (gère les champs entre guillemets) ──
function _csvParseLine(line, delim) {
  const cells = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === delim && !inQ) { cells.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  cells.push(cur.trim());
  return cells.map(c => c.replace(/^"|"$/g, '').trim());
}

// ── Nettoyage nombre (gère "1 234,56" et "1,234.56") ──
function _csvCleanNum(s) {
  if (!s) return 0;
  s = String(s).replace(/\s/g, '').replace(/"/g, '');
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); // French: 1.234,56
  else if (lc !== -1 && ld > lc) s = s.replace(/,/g, '');  // English: 1,234.56
  else if (lc !== -1) s = s.replace(',', '.');
  return parseFloat(s) || 0;
}

// ── Normalisation date → YYYY-MM-DD ──
function _csvParseDate(s) {
  if (!s) return new Date().toISOString().slice(0, 10);
  const m = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/); // DD-MM-YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

// Entrée de l'import : le texte du fichier → erreur affichée, ou aperçu des mouvements détectés.
function parseCSV(text) {
  const r = parseCsvText(text);
  if (r.error) { toast(r.error); return; }
  openImportPreview(r.rows, r.format, r.unknownTickers);
}

// PURE (aucune dépendance à l'écran ni à S ; lit seulement les tables ISIN_MAP / SECURITIES_DB) :
// texte CSV → { rows, format, unknownTickers } ou { error } (message à afficher à l'utilisateur).
function parseCsvText(text) {
  const allLines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (allLines.length < 2) return { error: 'CSV vide ou invalide' };

  // ── Détection du délimiteur ──
  const sample = allLines[0];
  const delim = (sample.match(/;/g)||[]).length > (sample.match(/,/g)||[]).length ? ';' : ',';
  const parseLine = line => _csvParseLine(line, delim);
  const cleanNum = _csvCleanNum, parseDate = _csvParseDate;

  // ── Normalisation en-têtes ──
  const rawHdrs = parseLine(allLines[0]);
  const hdrs = rawHdrs.map(h =>
    h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  );
  const col = (...names) => hdrs.findIndex(h => names.some(n => h.includes(n)));

  // ── Détection format Degiro ──
  const isDegiro = hdrs.some(h => h.includes('isin')) && hdrs.some(h => h.includes('quantit'));
  const format = isDegiro ? 'Degiro (auto-détecté)' : 'Générique';

  const dataRows = allLines.slice(1).map(l => parseLine(l));
  const parsedRows = [];
  const unknownTickers = new Set();

  if (isDegiro) {
    const iDate  = col('date');
    const iProd  = col('produit', 'product');
    const iISIN  = col('isin');
    const iQty   = col('quantit');
    const iPrice = col('cours', 'price');

    dataRows.forEach(cols => {
      const dateRaw  = cols[iDate]  || '';
      const produit  = cols[iProd]  || '';
      const isin     = (cols[iISIN] || '').trim();
      const qtyRaw   = cleanNum(cols[iQty]);
      const priceRaw = cleanNum(cols[iPrice]);

      if (!priceRaw || qtyRaw === 0) return; // lignes de frais ou dividende cash → skip

      const type = qtyRaw > 0 ? 'BUY' : 'SELL';
      const qty = Math.abs(qtyRaw);

      // Résoudre ticker depuis l'ISIN
      const secFromISIN = ISIN_MAP[isin];
      let ticker = secFromISIN?.ticker || '';
      let name   = secFromISIN?.name   || '';

      if (!ticker) {
        // Extraire un ticker depuis le nom du produit (premier mot, max 6 car.)
        const cleanProd = produit
          .replace(/\s*[-–]\s*(COMMON STOCK|ORD|ADS|ADR|ETF|FUND|INC|SA|NV|SE|PLC|SHARE|ACTION).*$/i, '')
          .trim();
        ticker = cleanProd.split(/\s+/)[0].toUpperCase().slice(0, 6);
        name   = cleanProd;
        unknownTickers.add(ticker);
      }

      parsedRows.push({ date: parseDate(dateRaw), type, ticker, name, qty, price: priceRaw });
    });

  } else {
    // Format générique : account, ticker, name, date, type, quantity/qty, price
    const iAcc   = col('account', 'compte');
    const iTick  = col('ticker', 'code', 'symbole');
    const iName  = col('name', 'nom', 'libelle');
    const iDate  = col('date');
    const iType  = col('type');
    const iQty   = col('quantity', 'quantit', 'qty');
    const iPrice = col('price', 'prix', 'cours');

    dataRows.forEach(cols => {
      const ticker = (iTick >= 0 ? cols[iTick] : '').toUpperCase().trim();
      const qty    = cleanNum(iQty >= 0 ? cols[iQty] : '');
      const price  = cleanNum(iPrice >= 0 ? cols[iPrice] : '');
      if (!ticker || !qty || !price) { parsedRows.push({ _skip: true }); return; }
      const sec = SECURITIES_DB[ticker];
      if (!sec) unknownTickers.add(ticker);
      parsedRows.push({
        date:     parseDate(iDate >= 0 ? cols[iDate] : ''),
        type:     ((iType >= 0 ? cols[iType] : '') || 'BUY').toUpperCase(),
        ticker,
        name:     (iName >= 0 ? cols[iName] : '') || sec?.name || ticker,
        qty,
        price,
        _account: iAcc >= 0 ? cols[iAcc] : '',
      });
    });
  }

  const valid = parsedRows.filter(r => !r._skip);
  if (!valid.length) return { error: 'Aucun mouvement valide détecté dans ce fichier' };
  return { rows: parsedRows, format, unknownTickers };
}

// ── CSV IMPORT MODAL ──
let _csvPendingRows = [];

function openImportPreview(rows, format, unknownTickers) {
  _csvPendingRows = rows;
  const valid = rows.filter(r => !r._skip);
  const skipped = rows.length - valid.length;
  const buys  = valid.filter(r => r.type === 'BUY').length;
  const sells = valid.filter(r => r.type === 'SELL').length;
  const divs  = valid.filter(r => r.type === 'DIV').length;

  const accountOptions = S.accounts.map(a =>
    `<option value="${a.id}">${esc(a.name)}</option>`
  ).join('');

  const preview = valid.slice(0, 8).map(r => {
    const isDiv = r.type==='DIV', isBuy = r.type==='BUY';
    const dot = isDiv?'DIV':isBuy?'ACH':'VTE';
    const cls = isDiv?'div':isBuy?'buy':'sell';
    const unk = unknownTickers.has(r.ticker)
      ? ' <span style="color:var(--loss);font-size:10px">⚠ inconnu</span>' : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div class="tx-dot ${cls}" style="width:32px;height:32px;font-size:10px;flex-shrink:0">${dot}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.ticker)}${unk} · ${esc(r.name||r.ticker)}</div>
        <div style="font-size:11px;color:var(--text2)">${esc(r.date)} · ${r.qty} × ${r.price.toLocaleString('fr-FR')}</div>
      </div>
    </div>`;
  }).join('');
  const moreLabel = valid.length > 8
    ? `<div style="font-size:12px;color:var(--text2);padding:8px 0;text-align:center">+${valid.length - 8} autre${valid.length-8>1?'s':''} mouvement${valid.length-8>1?'s':''}…</div>` : '';

  document.getElementById('csv-modal-title').textContent =
    `${valid.length} mouvement${valid.length>1?'s':''} détecté${valid.length>1?'s':''}`;

  document.getElementById('csv-modal-body').innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      <span style="background:var(--accent-dim);color:var(--accent);border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700">${format}</span>
      ${buys  ? `<span style="background:var(--gain-dim);color:var(--gain);border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700">${buys} achat${buys>1?'s':''}</span>` : ''}
      ${sells ? `<span style="background:var(--loss-dim);color:var(--loss);border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700">${sells} vente${sells>1?'s':''}</span>` : ''}
      ${divs  ? `<span style="background:rgba(245,158,11,.12);color:#F59E0B;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700">${divs} div.</span>` : ''}
    </div>
    ${unknownTickers.size ? `<div style="background:var(--loss-dim);border:1px solid var(--loss);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--loss)">
      ⚠ ${unknownTickers.size} ticker${unknownTickers.size>1?'s':''} non reconnu${unknownTickers.size>1?'s':''} : ${esc([...unknownTickers].join(', '))}
    </div>` : ''}
    <div style="margin-bottom:14px;border-radius:10px;overflow:hidden;border:1px solid var(--border);padding:0 12px">
      ${preview}${moreLabel}
    </div>
    <div class="form-field" style="margin-bottom:${skipped?'6px':'14px'}">
      <div class="form-label">Compte de destination</div>
      <select class="form-input" id="csv-acc-select" style="cursor:pointer">
        <option value="__new__">➕ Nouveau compte importé</option>
        ${accountOptions}
      </select>
    </div>
    ${skipped ? `<div style="font-size:11px;color:var(--text3);margin-bottom:14px">${skipped} ligne${skipped>1?'s':''} ignorée${skipped>1?'s':''} (données incomplètes)</div>` : ''}
  `;

  document.getElementById('csv-modal-bg').classList.add('show');
  document.getElementById('csv-modal-sheet').classList.add('show');
}

function closeCsvModal() {
  document.getElementById('csv-modal-bg').classList.remove('show');
  document.getElementById('csv-modal-sheet').classList.remove('show');
}

// ── Confirmation d import + écouteurs de la modale CSV (déplacés depuis mon-patrimoine.js) ──
// Les règles du compte de destination (types d'actifs autorisés, PEA européen… : js/features/account-rules.js) s'appliquent aussi
// à l'import : un NOUVEAU titre interdit est refusé (tous ses mouvements), l'utilisateur est prévenu et confirme l'import du reste.
// Rien n'est créé tant que l'import n'est pas confirmé (pas de compte « Compte importé » vide si tout est refusé).
function confirmImport() {
  const accIdVal = document.getElementById('csv-acc-select')?.value;
  const isNew = accIdVal === '__new__';
  const targetAcc = isNew
    ? { id: 'csv_' + Date.now(), name: 'Compte importé', type: ACCOUNT_TYPES[0], value: 0, change1d: 0, holdings: [], cashflows: [] }
    : S.accounts.find(a => a.id === accIdVal);
  if (!targetAcc) { toast('Compte introuvable'); return; }

  const usable = _csvPendingRows.filter(r => !r._skip && r.ticker && r.qty && r.price);
  const rejected = csvRejectedTickers(targetAcc, usable, SECURITIES_DB);
  const refused = new Set(rejected.map(x => x.ticker));
  const rows = usable.filter(r => !refused.has(r.ticker));
  const summary = rejected.map(x => `${x.ticker} (${x.reason})`).join(', ');
  if (!rows.length) { toast(rejected.length ? 'Import refusé : ' + summary : 'Aucun mouvement à importer'); return; }

  const run = () => {
    if (isNew) S.accounts.push(targetAcc);
    let added = 0;
    rows.forEach(r => {
      let h = targetAcc.holdings.find(h => h.ticker === r.ticker);
      if (!h) {
        const sec = SECURITIES_DB[r.ticker] || {};
        h = {
          id: r.ticker + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          ticker: r.ticker,
          name: r.name || sec.name || r.ticker,
          quantity: 0,
          avgBuyPrice: r.price,
          currentPrice: r.price,
          type: sec.type || 'Action',
          country: sec.country || 'Inconnu',
          sector: sec.sector || 'Inconnu',
          currency: sec.currency || 'EUR',
          transactions: [],
          value: 0, pnl: 0, pnlPct: 0,
        };
        targetAcc.holdings.push(h);
      }
      h.transactions.push({ date: r.date, type: r.type, qty: r.qty, price: r.price });
      recalcHolding(h);
      added++;
    });
    targetAcc.value = accTotal(targetAcc);
    // L'import reste dans le mode courant : basculer S.isDemo=false ici transformait les
    // comptes démo en « données réelles » et écrasait le slot réel au toggle suivant
    saveData();
    refreshMain();
    closeCsvModal();
    toast(`${added} mouvement${added>1?'s':''} importé${added>1?'s':''} ✓`);
  };
  if (rejected.length) openConfirm(`${rejected.length} titre${rejected.length>1?'s':''} refusé${rejected.length>1?'s':''} par les règles du compte : ${summary}. Importer le reste ?`, run);
  else run();
}

document.getElementById('csv-modal-bg').addEventListener('click', closeCsvModal);
document.getElementById('csv-modal-close').addEventListener('click', closeCsvModal);
document.getElementById('csv-cancel-btn').addEventListener('click', closeCsvModal);
document.getElementById('csv-import-btn').addEventListener('click', confirmImport);

// Fermée par le bouton retour Android et la touche Échap (voir js/core/modals.js).
registerModal('csv-modal-sheet', closeCsvModal);
