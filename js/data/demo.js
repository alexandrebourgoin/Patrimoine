// Données de démonstration (mode démo).
// Dépend de PU (utils.js) et, À L APPEL seulement, de toRefCcy/FX_RATES/S (mon-patrimoine.js).
// Doit être chargé AVANT mon-patrimoine.js : S appelle genDemoWatchlist() à son initialisation.

function mkH(id, ticker, name, qty, buy, cur, type, country, sector, txs, currency='EUR') {
  const value = qty * cur;
  const pnl = (cur - buy) * qty;
  const pnlPct = ((cur - buy) / buy) * 100;
  const valueRef = +toRefCcy(value, currency).toFixed(2);
  const pnlRef   = +toRefCcy(pnl,   currency).toFixed(2);
  return { id, ticker, name, quantity: qty, avgBuyPrice: buy, currentPrice: cur, type, country, sector, transactions: txs, value, pnl, pnlPct, currency, valueRef, pnlRef };
}
// ── Délégations vers utils.js (namespace PU, chargé avant ce fichier) ──
// Une seule implémentation, partagée avec les tests vitest ; les wrappers injectent S/FX_RATES.
function mkTx(date, type, qty, price) { return PU.mkTx(date, type, qty, price); }

// Watchlist d'exemple (mode démo) — déclaration hoistée, utilisée aussi par l'init de S
function genDemoWatchlist() {
  return [
    { ticker: 'OR',   name: "L'Oréal",       price: 412.35, change1d:  0.68 },
    { ticker: 'AI',   name: 'Air Liquide',    price: 168.50, change1d: -0.32 },
    { ticker: 'MSFT', name: 'Microsoft',      price: 378.50, change1d:  1.15 },
    { ticker: 'TSLA', name: 'Tesla',          price: 248.20, change1d: -2.45 },
  ];
}

function genDemo() {
  const pea = [
    mkH('MC','MC','LVMH',12,682.5,734.2,'Action','France','Luxe',[mkTx('2023-03-15','BUY',5,720),mkTx('2023-08-22','BUY',7,652.1)]),
    mkH('TTE','TTE','TotalEnergies',45,54.2,61.8,'Action','France','Énergie',[mkTx('2022-11-10','BUY',30,51.3),mkTx('2023-06-05','BUY',20,58.4),mkTx('2024-01-18','SELL',5,60.1),mkTx('2023-03-27','DIV',45,0.79),mkTx('2023-06-26','DIV',45,0.79),mkTx('2023-09-25','DIV',45,0.82),mkTx('2023-12-18','DIV',45,0.79)]),
    mkH('BNP','BNP','BNP Paribas',60,52.3,58.9,'Action','France','Finance',[mkTx('2022-09-20','BUY',40,50.8),mkTx('2023-02-14','BUY',20,55.2),mkTx('2023-05-30','DIV',60,4.60)]),
    mkH('AIR','AIR','Airbus',8,128.4,152.6,'Action','France','Aéronautique',[mkTx('2023-01-09','BUY',8,128.4)]),
    mkH('CW8','CW8','Amundi MSCI World',25,312,368.5,'ETF','Monde','Diversifié',[mkTx('2022-06-15','BUY',10,290),mkTx('2023-01-20','BUY',10,318.5),mkTx('2023-09-10','BUY',5,341)]),
  ];
  const ct = [
    mkH('AAPL','AAPL','Apple Inc.',20,148.5,189.3,'Action','USA','Technologie',[mkTx('2022-05-20','BUY',15,142.3),mkTx('2023-03-08','BUY',5,165.5),mkTx('2023-02-16','DIV',20,0.23),mkTx('2023-05-11','DIV',20,0.24),mkTx('2023-08-10','DIV',20,0.24),mkTx('2023-11-09','DIV',20,0.24)],'USD'),
    mkH('MSFT','MSFT','Microsoft',15,285.2,378.5,'Action','USA','Technologie',[mkTx('2022-07-14','BUY',10,268.4),mkTx('2023-05-22','BUY',5,319.5)],'USD'),
    mkH('NVDA','NVDA','NVIDIA',10,312.4,495.8,'Action','USA','Technologie',[mkTx('2022-10-12','BUY',10,312.4)],'USD'),
    mkH('ASML','ASML','ASML Holding',5,610,742.8,'Action','Europe','Technologie',[mkTx('2023-04-18','BUY',5,610)]),
    mkH('IWDA','IWDA','iShares Core MSCI World',30,78.4,91.2,'ETF','Monde','Diversifié',[mkTx('2022-08-10','BUY',20,74.2),mkTx('2023-02-28','BUY',10,86.8)]),
    mkH('NOVO','NOVO','Novo Nordisk',18,92.3,108.6,'Action','Europe','Santé',[mkTx('2023-06-30','BUY',18,92.3)]),
  ];
  const av = [
    mkH('EURO','FR0013309002','Fonds Euros',1,42000,44730,'Obligation','France','Fonds euros',[mkTx('2021-12-01','BUY',1,42000)]),
    mkH('PAEEM','PAEEM','Amundi EM ESG',40,42.1,45.8,'ETF','Émergents','Diversifié',[mkTx('2022-03-15','BUY',25,40.2),mkTx('2023-07-20','BUY',15,45.1)]),
    mkH('SAN','SAN','Sanofi',25,88.5,94.2,'Action','France','Santé',[mkTx('2023-09-05','BUY',25,88.5)]),
  ];
  function val(hs){ return hs.reduce((s,h)=>s+(h.valueRef ?? h.value),0); }
  // Apports calibrés pour laisser une petite trésorerie positive sur chaque compte
  // (le solde démo = titres + liquidités, cf. accTotal).
  const accs = [
    { id:'pea', name:'PEA', type:"Plan d'Épargne en Actions (PEA)", bank:'Boursorama', icon:'🇫🇷', iconBg:'rgba(79,142,247,.13)', currency:'EUR', value:0, change1d:1.24, holdings:pea, cashflows:[{id:'cf1',date:'2022-01-10',type:'DEP',amount:18000,note:'Ouverture PEA'},{id:'cf2',date:'2023-03-01',type:'DEP',amount:6000,note:'Versement annuel'}] },
    { id:'ct',  name:'Compte-Titres', type:'Compte-Titres Ordinaire', bank:'Degiro', icon:'🌍', iconBg:'rgba(0,194,203,.13)', currency:'EUR', value:0, change1d:2.18, holdings:ct,  cashflows:[{id:'cf3',date:'2022-05-15',type:'DEP',amount:14000,note:'Apport initial'},{id:'cf4',date:'2023-06-01',type:'DEP',amount:5000,note:'Renforcement'}] },
    { id:'av',  name:'Assurance-Vie', type:'Assurance-Vie', bank:'BNP Paribas', icon:'🛡️', iconBg:'rgba(0,214,143,.13)', currency:'EUR', value:0, change1d:0.42, holdings:av,  cashflows:[{id:'cf5',date:'2021-12-01',type:'DEP',amount:48000,note:'Versement initial'}] },
  ];
  accs.forEach(a => { a.value = +(val(a.holdings) + PU.accCash(a, FX_RATES, 'EUR')).toFixed(2); });
  return accs;
}
