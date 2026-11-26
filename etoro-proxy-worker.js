// Relais Cloudflare (optionnel) pour les comptes eToro synchronisés (E14) — à déployer sur VOTRE compte Cloudflare.
// Utile seulement si eToro refuse l'appel direct depuis le navigateur (CORS).
// Il transmet la requête à https://public-api.etoro.com/api/v1 en conservant le chemin, la requête et les en-têtes de clés,
// et ajoute les en-têtes CORS. Il n'enregistre rien, ne journalise pas les clés et refuse tout autre domaine ou méthode.
// Déploiement : Workers → Créer → coller ce fichier → Déployer, puis saisir l'adresse https://…workers.dev dans
// « Clés et relais » du compte eToro. ALLOWED_ORIGIN : l'adresse où l'app est servie (ex. https://julienluigi.github.io).
const ALLOWED_ORIGIN = 'https://julienluigi.github.io';
const UPSTREAM = 'https://public-api.etoro.com/api/v1';
const PASS_HEADERS = ['x-api-key', 'x-user-key', 'x-request-id'];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': PASS_HEADERS.join(', '),
      'Access-Control-Expose-Headers': 'Retry-After',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response('Méthode refusée', { status: 405, headers: cors });
    if (origin && origin !== ALLOWED_ORIGIN) return new Response('Origine refusée', { status: 403, headers: cors });
    const url = new URL(request.url);
    // Lecture seule : uniquement le portefeuille et les données d'instruments
    if (!/^\/(trading\/info\/real\/pnl|market-data\/instruments)$/.test(url.pathname)) return new Response('Chemin refusé', { status: 404, headers: cors });
    const headers = {};
    PASS_HEADERS.forEach(h => { const v = request.headers.get(h); if (v) headers[h] = v; });
    const r = await fetch(UPSTREAM + url.pathname + url.search, { headers });
    const out = new Headers(cors);
    out.set('Content-Type', r.headers.get('Content-Type') || 'application/json');
    const ra = r.headers.get('Retry-After'); if (ra) out.set('Retry-After', ra);
    return new Response(r.body, { status: r.status, headers: out });
  },
};
