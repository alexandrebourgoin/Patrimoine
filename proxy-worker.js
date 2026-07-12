/* ────────────────────────────────────────────────────────────────────────
   Cloudflare Worker — proxy "patrimoine-prices"
   Déployé sur : https://patrimoine-prices.al-the-best.workers.dev

   Deux routes :
   1) ?symbols=MC.PA,AAPL,EURUSD=X      → cours spot Yahoo (v7 quote, crumb auth)
   2) ?chart=MC.PA&range=5y&interval=1d → historique Yahoo (v8 chart)

   La récupération crumb/cookie (cache 5 min) est factorisée dans getCrumb()
   et partagée par les deux routes. Le v8 chart n'a pas besoin du crumb mais
   réutilise le cookie (limite les 401/429 de Yahoo).
   ──────────────────────────────────────────────────────────────────────── */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

// Cache module-level : persiste entre les requêtes d'une même instance
let _crumbCache = { cookie: '', crumb: '', expires: 0 };

async function getCrumb() {
  if (Date.now() > _crumbCache.expires) {
    const fcResp = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } });
    const rawCookie = fcResp.headers.get('set-cookie') || '';
    const cookie = rawCookie.split('\n').map(c => c.split(';')[0]).join('; ');

    const crumbResp = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': cookie }
    });
    const crumb = crumbResp.ok ? await crumbResp.text() : '';

    _crumbCache = { cookie, crumb, expires: Date.now() + 5 * 60 * 1000 };
  }
  return _crumbCache;
}

export default {
  async fetch(req) {
    const url = new URL(req.url);

    // ── ROUTE HISTORIQUE (v8 chart) ──
    const chart = url.searchParams.get('chart');
    if (chart) {
      const range    = url.searchParams.get('range')    || '5y';
      const interval = url.searchParams.get('interval') || '1d';
      try {
        const { cookie } = await getCrumb();   // réutilise le cookie (pas de crumb requis ici)
        const yfResp = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(chart)}`
            + `?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`,
          { headers: { 'User-Agent': UA, 'Cookie': cookie } }
        );
        return new Response(await yfResp.text(), {
          status: yfResp.status,
          headers: { ...CORS, 'Cache-Control': 'max-age=3600' }   // historique : cache 1 h
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── ROUTE COURS SPOT (v7 quote, inchangée) ──
    const symbols = url.searchParams.get('symbols');
    if (!symbols) return new Response(JSON.stringify({ error: 'symbols or chart required' }), { status: 400, headers: CORS });
    try {
      const { cookie, crumb } = await getCrumb();
      const yfResp = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}`,
        { headers: { 'User-Agent': UA, 'Cookie': cookie } }
      );
      const data = await yfResp.json();
      return new Response(JSON.stringify(data), { headers: { ...CORS, 'Cache-Control': 'max-age=180' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    }
  }
};
