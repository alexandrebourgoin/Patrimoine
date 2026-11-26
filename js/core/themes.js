// Thèmes d'affichage : Auto, Clair, Sombre + Sable, Émeraude & or, Graphite.
// Les couleurs de l'interface sont des variables CSS (mon-patrimoine.css, [data-theme="…"]).
// Les graphiques (camemberts) ont leurs palettes en JS (ACCTYPE_C, POCKET_C, ASSET_C, js/features/charts.js) :
// applyChartPalette() les recolore pour le thème choisi, à partir d'une copie des couleurs d'origine.
// Pour retirer un thème : sa ligne dans THEMES, son bloc CSS et sa table dans THEME_CHART_MAP.

const THEMES = [
  { key: 'auto',     label: 'Auto',      swatch: ['#F0F5FF', '#070D1A'] },
  { key: 'light',    label: 'Clair',     swatch: ['#F0F5FF', '#2563EB'] },
  { key: 'dark',     label: 'Sombre',    swatch: ['#070D1A', '#4F8EF7'] },
  { key: 'sable',    label: 'Sable',     swatch: ['#F6F1E8', '#2F5D50'] },
  { key: 'emeraude', label: 'Émeraude',  swatch: ['#06110E', '#D4AF6A'] },
  { key: 'graphite', label: 'Graphite',  swatch: ['#000000', '#8B7CF6'] },
];
const THEME_KEYS = THEMES.map(t => t.key);
// Fond de chaque thème : couleur de la barre du navigateur / du système (meta theme-color)
const THEME_BG = { light: '#F0F5FF', dark: '#070D1A', sable: '#F6F1E8', emeraude: '#06110E', graphite: '#000000' };

// Couleurs des graphiques : couleur d'origine → couleur du thème (les couleurs absentes restent inchangées)
const THEME_CHART_MAP = {
  sable: {
    '#4F8EF7': '#2F5D50', '#00C2CB': '#C0703F', '#00D68F': '#6B8E4E', '#F59E0B': '#D9A441', '#A78BFA': '#8C6A9E',
    '#14B8A6': '#4E8C86', '#10B981': '#7A9A5A', '#FF5A5A': '#B5452F', '#8A94A6': '#A89A88',
    '#F97316': '#D08A5C', '#EC4899': '#B76E79', '#22D3EE': '#5A8FA0', '#84CC16': '#9AAB4E',
  },
  emeraude: {
    '#4F8EF7': '#D4AF6A', '#00C2CB': '#5FC4A0', '#00D68F': '#2E9E78', '#F59E0B': '#E8C98C', '#A78BFA': '#9BB8A8',
    '#14B8A6': '#3FA58A', '#10B981': '#76D1AE', '#FF5A5A': '#F07A6A', '#8A94A6': '#6F8A80',
    '#F97316': '#C9894A', '#EC4899': '#D98C8C', '#22D3EE': '#7FC8C0', '#84CC16': '#A9C76A',
  },
  graphite: {
    '#4F8EF7': '#8B7CF6', '#00C2CB': '#C084FC', '#00D68F': '#34D399', '#F59E0B': '#FBBF24', '#A78BFA': '#E879F9',
    '#14B8A6': '#60A5FA', '#10B981': '#2DD4BF', '#FF5A5A': '#F87171', '#8A94A6': '#71717A',
    '#F97316': '#FB923C', '#EC4899': '#F472B6', '#22D3EE': '#67E8F9', '#84CC16': '#A3E635',
  },
};

// Thème effectivement affiché : 'auto' suit le système (clair ou sombre) ; une clé inconnue retombe sur le sombre
function resolveTheme(theme, prefersDark) {
  if (theme === 'auto') return prefersDark ? 'dark' : 'light';
  return THEME_KEYS.includes(theme) ? theme : 'dark';
}

// Recolore une palette (tableau ou objet) en place à partir de sa copie d'origine
let _chartOrig = null;
function themePalette(orig, map) {
  const f = c => (map && map[String(c).toUpperCase()]) || c;
  return Array.isArray(orig) ? orig.map(f) : Object.fromEntries(Object.entries(orig).map(([k, c]) => [k, f(c)]));
}
function applyChartPalette(key) {
  const pals = { ACCTYPE_C: typeof ACCTYPE_C !== 'undefined' ? ACCTYPE_C : null,
                 POCKET_C: typeof POCKET_C !== 'undefined' ? POCKET_C : null,
                 ASSET_C: typeof ASSET_C !== 'undefined' ? ASSET_C : null };
  if (!_chartOrig) _chartOrig = Object.fromEntries(Object.entries(pals).filter(([, p]) => p).map(([n, p]) => [n, Array.isArray(p) ? [...p] : { ...p }]));
  Object.entries(_chartOrig).forEach(([n, orig]) => {
    const p = pals[n], next = themePalette(orig, THEME_CHART_MAP[key]);
    if (Array.isArray(p)) next.forEach((c, i) => { p[i] = c; }); else Object.assign(p, next);
  });
}
