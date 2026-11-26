// Bloc « À surveiller » de l'accueil : chaque module enregistre sa source, comme les pastilles (NAV_BADGES).
//   HOME_WATCH.<clé> = () => [{ text, sub?, level, when?, go, accountId? }]
//   level : 'alert' (à traiter), 'soon' (échéance proche), 'info' ; when : 'AAAA-MM-JJ' pour trier les échéances
//   go : écran à ouvrir au toucher ; accountId : compte à ouvrir quand go === 'account'
// Une source en erreur est ignorée (le bloc ne doit jamais casser l'accueil). Le bloc n'est affiché que s'il a au moins un élément.
// Chargé avant les modules (js/features/dca.js…) qui y enregistrent leur source.
const HOME_WATCH = {};
const HOME_WATCH_LEVELS = { alert: 0, soon: 1, info: 2 };

// Éléments triés : niveau, puis échéance la plus proche, puis ordre d'enregistrement ; au plus `limit`
function homeWatchItems(sources, limit = 6) {
  const all = [];
  Object.entries(sources || {}).forEach(([key, fn], i) => {
    let got = [];
    try { got = fn() || []; } catch (e) { console.warn('[à surveiller] ' + key, e); }
    got.filter(x => x && x.text && x.go).forEach((x, j) => all.push({ key, ...x, _o: i * 100 + j }));
  });
  const lv = x => HOME_WATCH_LEVELS[x.level] ?? 2;
  return all.sort((a, b) => lv(a) - lv(b) || (a.when || '9999').localeCompare(b.when || '9999') || a._o - b._o)
    .slice(0, limit).map(({ _o, ...x }) => x);
}

// Échéances de crédits dans les `days` prochains jours → [{ name, date, amount }]. loans : [{ name, schedule }] (schedule : loanSchedule)
function homeWatchLoanDue(loans, today, days = 10) {
  const lim = _hwAddDays(today, days);
  return (loans || []).filter(l => l.schedule && l.schedule.next && l.schedule.next.date >= today && l.schedule.next.date <= lim)
    .map(l => ({ ...l, date: l.schedule.next.date, amount: l.schedule.next.pmt + (l.schedule.next.ins || 0) }));
}
// Ajoute n jours à une date ISO (UTC, sans décalage horaire)
function _hwAddDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
