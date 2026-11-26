/* ────────────────────────────────────────────────────────────────────────
   Cloudflare Worker — proxy "patrimoine-prices"
   Déployé sur : https://patrimoine-prices.al-the-best.workers.dev

   Quatre routes :
   1) ?symbols=MC.PA,AAPL,EURUSD=X      → cours spot Yahoo (v7 quote, crumb auth)
   2) ?chart=MC.PA&range=5y&interval=1d → historique Yahoo (v8 chart)
   3) ?search=FR0013412269              → recherche Yahoo (nom/ISIN → symbole, v1 search)
   4) ?api=<service>&call=<appel>[&…]   → comptes liés (lecture seule), table LINKED_APIS ci-dessous
      ex. ?api=etoro&call=pnl, ?api=etoro&call=instruments&ids=1001,100000
      Seuls les appels déclarés passent. En-têtes de clés transmis tels quels : ni stockés, ni journalisés, ni mis en cache.
      Ajouter un service = une entrée dans LINKED_APIS (et le module correspondant dans l'appli).

   La récupération crumb/cookie (cache 5 min) est factorisée dans getCrumb()
   et partagée par les trois routes. Les v8 chart et v1 search n'ont pas besoin
   du crumb mais réutilisent le cookie (limite les 401/429 de Yahoo).

   ?symbols= : le crumb peut être invalidé côté Yahoo avant expiration du cache
   5 min (résultat vide malgré un fetch qui aboutit) → 1 retry automatique avec
   un crumb frais. Le status HTTP répercuté est celui de Yahoo (plus de 200
   implicite qui masquait un échec réel côté logs de l'appli).
   ──────────────────────────────────────────────────────────────────────── */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

// Cache module-level : persiste entre les requêtes d'une même instance
let _crumbCache = { cookie: '', crumb: '', expires: 0 };

async function getCrumb(forceRefresh) {
  if (forceRefresh || Date.now() > _crumbCache.expires) {
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

// Comptes liés : services et appels autorisés (lecture seule). Pour chaque appel, path(url) → chemin, ou null si paramètres invalides.
const LINKED_APIS = {
  etoro: {
    base: 'https://public-api.etoro.com/api/v1',
    headers: ['x-api-key', 'x-user-key', 'x-request-id'],
    calls: {
      pnl: () => '/trading/info/real/pnl',
      instruments: url => {
        const ids = (url.searchParams.get('ids') || '').split(',').filter(x => /^\d+$/.test(x)).slice(0, 100);
        return ids.length ? '/market-data/instruments?instrumentIds=' + ids.join(',') : null;
      },
    },
  },
};
const LINKED_HEADERS = [...new Set(Object.values(LINKED_APIS).flatMap(a => a.headers))];
const LINKED_CORS = { ...CORS, 'Access-Control-Allow-Headers': LINKED_HEADERS.join(', '), 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Expose-Headers': 'Retry-After', 'Cache-Control': 'no-store' };

async function linkedRoute(req, url) {
  const api = LINKED_APIS[url.searchParams.get('api')];
  const call = api && Object.prototype.hasOwnProperty.call(api.calls, url.searchParams.get('call')) && api.calls[url.searchParams.get('call')];
  const path = call && call(url);
  if (!path) return new Response(JSON.stringify({ error: 'api/call inconnu ou paramètres invalides' }), { status: 400, headers: LINKED_CORS });
  const h = {};
  for (const k of api.headers) { const v = req.headers.get(k); if (v) h[k] = v; }
  try {
    const r = await fetch(api.base + path, { headers: h });
    const out = { ...LINKED_CORS }; const ra = r.headers.get('Retry-After'); if (ra) out['Retry-After'] = ra;
    return new Response(await r.text(), { status: r.status, headers: out });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: LINKED_CORS });
  }
}

export default {
  async fetch(req) {
    const url = new URL(req.url);

    // ── ROUTE COMPTES LIÉS : pré-vol CORS des en-têtes de clés, puis appel ──
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: LINKED_CORS });
    if (url.searchParams.has('api')) return linkedRoute(req, url);

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

    // ── ROUTE RECHERCHE (v1 search : nom/ISIN → symbole) ──
    const search = url.searchParams.get('search');
    if (search) {
      try {
        const { cookie } = await getCrumb();   // réutilise le cookie (pas de crumb requis ici)
        const yfResp = await fetch(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=5&newsCount=0`,
          { headers: { 'User-Agent': UA, 'Cookie': cookie } }
        );
        return new Response(await yfResp.text(), {
          status: yfResp.status,
          headers: { ...CORS, 'Cache-Control': 'max-age=86400' }   // ISIN/nom → symbole : stable, cache 24h
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
      }
    }

    // ── ROUTE COURS SPOT (v7 quote, inchangée) ──
    const symbols = url.searchParams.get('symbols');
    if (!symbols) return new Response(JSON.stringify({ error: 'symbols, chart, search or api required' }), { status: 400, headers: CORS });
    try {
      const fetchQuote = async (crumb, cookie) => {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}`,
          { headers: { 'User-Agent': UA, 'Cookie': cookie } }
        );
        const data = await r.json().catch(() => null);
        return { r, data };
      };

      let { cookie, crumb } = await getCrumb();
      let { r: yfResp, data } = await fetchQuote(crumb, cookie);

      // Crumb invalidé côté Yahoo (résultat vide malgré un statut OK) → 1 retry avec un crumb frais
      if (!data?.quoteResponse?.result?.length) {
        ({ cookie, crumb } = await getCrumb(true));
        ({ r: yfResp, data } = await fetchQuote(crumb, cookie));
      }

      // Status Yahoo répercuté tel quel (au lieu d'un 200 implicite qui masquait les échecs)
      return new Response(JSON.stringify(data), {
        status: yfResp.status,
        headers: { ...CORS, 'Cache-Control': 'max-age=180' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    }
  }
};
