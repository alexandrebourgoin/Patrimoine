// Tables de référence des titres (données pures, sans dépendance).
// Chargé AVANT mon-patrimoine.js. Script classique : les const sont visibles de tous les scripts.
// Ajout manuel d un titre : SECURITIES_DB + YAHOO_MAP (+ CG_IDS si crypto, + ISIN_MAP si ISIN connu).

// ─── Securities database for autocomplete ───
const SECURITIES_DB = {
  'MC':    {name:'LVMH',                  sector:'Luxe',           country:'France',   currency:'EUR',type:'Action'},
  'TTE':   {name:'TotalEnergies',          sector:'Énergie',        country:'France',   currency:'EUR',type:'Action'},
  'BNP':   {name:'BNP Paribas',            sector:'Finance',        country:'France',   currency:'EUR',type:'Action'},
  'OR':    {name:"L'Oréal",               sector:'Cosmétiques',    country:'France',   currency:'EUR',type:'Action'},
  'SAN':   {name:'Sanofi',                 sector:'Santé',          country:'France',   currency:'EUR',type:'Action'},
  'AIR':   {name:'Airbus',                 sector:'Aéronautique',   country:'France',   currency:'EUR',type:'Action'},
  'BN':    {name:'Danone',                 sector:'Agroalimentaire',country:'France',   currency:'EUR',type:'Action'},
  'KER':   {name:'Kering',                 sector:'Luxe',           country:'France',   currency:'EUR',type:'Action'},
  'AI':    {name:'Air Liquide',            sector:'Chimie',         country:'France',   currency:'EUR',type:'Action'},
  'ORA':   {name:'Orange',                 sector:'Télécoms',       country:'France',   currency:'EUR',type:'Action'},
  'SGO':   {name:'Saint-Gobain',           sector:'Matériaux',      country:'France',   currency:'EUR',type:'Action'},
  'DSY':   {name:'Dassault Systèmes',      sector:'Technologie',    country:'France',   currency:'EUR',type:'Action'},
  'RNO':   {name:'Renault',                sector:'Automobile',     country:'France',   currency:'EUR',type:'Action'},
  'STLAM': {name:'Stellantis',             sector:'Automobile',     country:'Europe',   currency:'EUR',type:'Action'},
  'ASML':  {name:'ASML Holding',           sector:'Technologie',    country:'Europe',   currency:'EUR',type:'Action'},
  'NOVO':  {name:'Novo Nordisk',           sector:'Santé',          country:'Europe',   currency:'EUR',type:'Action'},
  'SAP':   {name:'SAP',                    sector:'Technologie',    country:'Europe',   currency:'EUR',type:'Action'},
  'ALV':   {name:'Allianz',                sector:'Finance',        country:'Europe',   currency:'EUR',type:'Action'},
  'AAPL':  {name:'Apple',                  sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'MSFT':  {name:'Microsoft',              sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'NVDA':  {name:'NVIDIA',                 sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'GOOGL': {name:'Alphabet',               sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'AMZN':  {name:'Amazon',                 sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'META':  {name:'Meta Platforms',         sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'TSLA':  {name:'Tesla',                  sector:'Automobile',     country:'USA',      currency:'USD',type:'Action'},
  'NFLX':  {name:'Netflix',                sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'V':     {name:'Visa',                   sector:'Finance',        country:'USA',      currency:'USD',type:'Action'},
  'JPM':   {name:'JPMorgan Chase',         sector:'Finance',        country:'USA',      currency:'USD',type:'Action'},
  'JNJ':   {name:'Johnson & Johnson',      sector:'Santé',          country:'USA',      currency:'USD',type:'Action'},
  'WMT':   {name:'Walmart',                sector:'Consommation',   country:'USA',      currency:'USD',type:'Action'},
  'UNH':   {name:'UnitedHealth',           sector:'Santé',          country:'USA',      currency:'USD',type:'Action'},
  'CW8':   {name:'Amundi MSCI World',      sector:'Diversifié',     country:'Monde',    currency:'EUR',type:'ETF'},
  'IWDA':  {name:'iShares MSCI World',     sector:'Diversifié',     country:'Monde',    currency:'USD',type:'ETF'},
  'SP5':   {name:'Amundi S&P 500',         sector:'Diversifié',     country:'USA',      currency:'EUR',type:'ETF'},
  'PAEEM': {name:'Amundi EM ESG',          sector:'Diversifié',     country:'Émergents',currency:'EUR',type:'ETF'},
  'EWLD':  {name:'iShares MSCI World ESG', sector:'Diversifié',     country:'Monde',    currency:'EUR',type:'ETF'},
  'QQQ':   {name:'Invesco QQQ (Nasdaq)',   sector:'Technologie',    country:'USA',      currency:'USD',type:'ETF'},
  'MWRD':  {name:'Lyxor MSCI World',       sector:'Diversifié',     country:'Monde',    currency:'EUR',type:'ETF'},
  'PANX':  {name:'Amundi PEA US Tech Screened', sector:'Technologie', country:'USA',    currency:'EUR',type:'ETF'},
  'BTC':   {name:'Bitcoin',                sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'ETH':   {name:'Ethereum',               sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'SOL':   {name:'Solana',                 sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'BNB':   {name:'BNB',                    sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'XRP':   {name:'Ripple',                 sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  // Asia & others
  'BABA':  {name:'Alibaba',                sector:'Technologie',    country:'Chine',    currency:'USD',type:'Action'},
  'TSM':   {name:'Taiwan Semiconductor',   sector:'Technologie',    country:'Asie',     currency:'USD',type:'Action'},
  'SHOP':  {name:'Shopify',               sector:'Technologie',    country:'Canada',   currency:'USD',type:'Action'},
  'PLTR':  {name:'Palantir',              sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'ARM':   {name:'ARM Holdings',           sector:'Technologie',    country:'UK',       currency:'USD',type:'Action'},
  'COIN':  {name:'Coinbase',              sector:'Finance',        country:'USA',      currency:'USD',type:'Action'},
  'UBER':  {name:'Uber',                  sector:'Technologie',    country:'USA',      currency:'USD',type:'Action'},
  'SPOT':  {name:'Spotify',               sector:'Technologie',    country:'Europe',   currency:'USD',type:'Action'},
  'SIE':   {name:'Siemens',              sector:'Industrie',      country:'Europe',   currency:'EUR',type:'Action'},
  'BAS':   {name:'BASF',                 sector:'Chimie',         country:'Europe',   currency:'EUR',type:'Action'},
  'SU':    {name:'Schneider Electric',   sector:'Industrie',      country:'France',   currency:'EUR',type:'Action'},
  'CS':    {name:'AXA',                  sector:'Finance',        country:'France',   currency:'EUR',type:'Action'},
  'CAP':   {name:'Capgemini',            sector:'Technologie',    country:'France',   currency:'EUR',type:'Action'},
  'HO':    {name:'Thales',               sector:'Aéronautique',   country:'France',   currency:'EUR',type:'Action'},
  // Crypto
  'DOGE':  {name:'Dogecoin',              sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'ADA':   {name:'Cardano',               sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'AVAX':  {name:'Avalanche',             sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'DOT':   {name:'Polkadot',              sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
  'LINK':  {name:'Chainlink',             sector:'Crypto',         country:'—',        currency:'USD',type:'Crypto'},
};

// ─── Yahoo Finance symbol mapping ───
// Ticker app → symbole Yahoo Finance
const YAHOO_MAP = {
  // France – Euronext Paris
  'MC':'MC.PA','TTE':'TTE.PA','BNP':'BNP.PA','OR':'OR.PA','SAN':'SAN.PA',
  'AIR':'AIR.PA','BN':'BN.PA','KER':'KER.PA','AI':'AI.PA','ORA':'ORA.PA',
  'SGO':'SGO.PA','DSY':'DSY.PA','RNO':'RNO.PA','STLAM':'STLAM.MI',
  // Europe
  'ASML':'ASML.AS','NOVO':'NOVO-B.CO','SAP':'SAP.DE','ALV':'ALV.DE',
  // USA (identiques)
  'AAPL':'AAPL','MSFT':'MSFT','NVDA':'NVDA','GOOGL':'GOOGL','AMZN':'AMZN',
  'META':'META','TSLA':'TSLA','NFLX':'NFLX','V':'V','JPM':'JPM',
  'JNJ':'JNJ','WMT':'WMT','UNH':'UNH',
  // ETFs
  'CW8':'CW8.PA','IWDA':'IWDA.AS','SP5':'SP5.PA','PAEEM':'PAEEM.PA',
  'EWLD':'EWLD.PA','QQQ':'QQQ','MWRD':'MWRD.PA','PANX':'PANX.PA',
  // Asia & others
  'BABA':'BABA','TSM':'TSM','SHOP':'SHOP','PLTR':'PLTR','ARM':'ARM',
  'COIN':'COIN','UBER':'UBER','SPOT':'SPOT',
  'SIE':'SIE.DE','BAS':'BAS.DE',
  'SU':'SU.PA','CS':'CS.PA','CAP':'CAP.PA','HO':'HO.PA',
};

// Symbole Yahoo pour un titre : symbole choisi par l'utilisateur (écran « Non synchro », js/features/symbols.js),
// valable pour toute l'app ; puis override du holding (résolution ISIN, ex. "PANX.PA") ; puis table explicite
// YAHOO_MAP ; sinon le ticker brut (vrai pour la plupart des actions/ETF US cotés sans suffixe : HOOD, AMD…).
function yahooSymbolFor(ticker, override){
  const u = typeof symbolUser === 'function' ? symbolUser(ticker) : null;
  return (u && u.yahoo) || override || YAHOO_MAP[ticker] || ticker;
}
// Identifiant CoinGecko d'une crypto : choix de l'utilisateur, sinon table CG_IDS ; undefined si inconnue.
function cgIdFor(ticker){
  const u = typeof symbolUser === 'function' ? symbolUser(ticker) : null;
  return (u && u.cg) || CG_IDS[ticker];
}

// ─── CoinGecko IDs (crypto uniquement) ───
const CG_IDS = {
  'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','BNB':'binancecoin','XRP':'ripple',
  'DOGE':'dogecoin','ADA':'cardano','AVAX':'avalanche-2','DOT':'polkadot','LINK':'chainlink',
};

// (Twelve Data cascade supprimée — proxy Cloudflare utilisé directement)

// ─── ISIN → ticker (pour import Degiro) ───
const ISIN_MAP = {
  'US0378331005':{ ticker:'AAPL', name:'Apple' },
  'US5949181045':{ ticker:'MSFT', name:'Microsoft' },
  'US02079K3059':{ ticker:'GOOGL',name:'Alphabet' },
  'US0231351067':{ ticker:'AMZN', name:'Amazon' },
  'US67066G1040':{ ticker:'NVDA', name:'NVIDIA' },
  'US30303M1027':{ ticker:'META', name:'Meta' },
  'US88160R1014':{ ticker:'TSLA', name:'Tesla' },
  'US5128071082':{ ticker:'NFLX', name:'Netflix' },
  'US92826C8394':{ ticker:'V',    name:'Visa' },
  'US46625H1005':{ ticker:'JPM',  name:'JPMorgan' },
  'US4581401001':{ ticker:'INTC', name:'Intel' },
  'US17275R1023':{ ticker:'CSCO', name:'Cisco' },
  'US4592001014':{ ticker:'IBM',  name:'IBM' },
  'US79466L3024':{ ticker:'SPGI', name:'S&P Global' },
  'FR0000131104':{ ticker:'BNP',  name:'BNP Paribas' },
  'FR0000121014':{ ticker:'MC',   name:'LVMH' },
  'FR0000120271':{ ticker:'TTE',  name:'TotalEnergies' },
  'FR0000120321':{ ticker:'OR',   name:"L'Oréal" },
  'FR0000073135':{ ticker:'AI',   name:'Air Liquide' },
  'FR0000120628':{ ticker:'AXA',  name:'AXA' },
  'FR0000131228':{ ticker:'BN',   name:'Danone' },
  'FR0000045072':{ ticker:'GLE',  name:'Société Générale' },
  'FR0000131906':{ ticker:'SGO',  name:'Saint-Gobain' },
  'FR0000120073':{ ticker:'AIR',  name:'Airbus' },
  'FR0000125338':{ ticker:'DSY',  name:'Dassault Systèmes' },
  'FR0000133308':{ ticker:'ORA',  name:'Orange' },
  'FR0000120503':{ ticker:'RNO',  name:'Renault' },
  'FR0000121667':{ ticker:'SAN',  name:'Sanofi' },
  'FR0000121972':{ ticker:'KER',  name:'Kering' },
  'NL0010273215':{ ticker:'ASML', name:'ASML' },
  'DE0007164600':{ ticker:'SAP',  name:'SAP' },
  'DE0008404005':{ ticker:'ALV',  name:'Allianz' },
  'IE00B4L5Y983':{ ticker:'IWDA', name:'iShares Core MSCI World' },
  'LU1681043599':{ ticker:'CW8',  name:'Amundi MSCI World' },
  'FR0010315770':{ ticker:'SP5',  name:'Amundi S&P 500' },
  'FR0013412285':{ ticker:'EWLD', name:'Lyxor MSCI World' },
  'FR0010429068':{ ticker:'PAEEM',name:'Amundi MSCI Emerging' },
  'FR0013412269':{ ticker:'PANX', name:'Amundi PEA US Tech Screened' },
};
