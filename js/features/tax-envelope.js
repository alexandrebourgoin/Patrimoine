// Enveloppes fiscales (E11) : jalons de durée et plafonds de versements, déduits du TYPE du compte. Fonctions PURES (aucun accès à S ni au DOM).
// Règles vérifiées sur service-public.gouv.fr (PEA : fiche F2385 ; assurance-vie : F22414 ; livrets réglementés), novembre 2026.
// Un type absent de la table n'a pas d'enveloppe : aucune information n'est affichée.
//
// Clés : libellés EXACTS de ACCOUNT_TYPES (js/features/account-rules.js) ; une faute de frappe est détectée par taxEnvelopeProblems().
//   years   : durée de détention qui change la fiscalité (point de départ : date d'ouverture du compte, sinon 1er versement connu)
//   ceiling : plafond des versements (€), hors intérêts / plus-values
//   shared  : plafond commun avec d'autres types (PEA + PEA-PME : 225 000 € au total)
//   basis   : 'deposits' = versements cumulés (PEA : un retrait ne libère pas de plafond) ; 'net' = versements − retraits (livrets)
const TAX_ENVELOPES = {
  "Plan d'Épargne en Actions (PEA)": {
    short: 'PEA', years: 5, ceiling: 150000, basis: 'deposits',
    before: 'Avant 5 ans, un retrait clôture le plan (sauf licenciement, invalidité, retraite anticipée, création d\'entreprise).',
    after: 'Depuis 5 ans : gains exonérés d\'impôt sur le revenu (prélèvements sociaux dus) ; un retrait partiel ne clôture plus le plan.',
  },
  "PEA-PME": {
    short: 'PEA-PME', years: 5, ceiling: 225000, basis: 'deposits', shared: { with: ["Plan d'Épargne en Actions (PEA)"], total: 225000 },
    before: 'Avant 5 ans, un retrait clôture le plan (sauf exceptions légales).',
    after: 'Depuis 5 ans : gains exonérés d\'impôt sur le revenu (prélèvements sociaux dus).',
  },
  "Assurance-Vie": {
    short: 'Assurance-vie', years: 8,
    before: 'Avant 8 ans, les gains rachetés sont imposés sans abattement.',
    after: 'Depuis 8 ans : abattement annuel sur les gains rachetés de 4 600 € (9 200 € pour un couple imposé en commun).',
  },
  "Plan d'Épargne Retraite (PER)": {
    short: 'PER', note: 'Épargne bloquée jusqu\'à la retraite, sauf cas de déblocage anticipé prévus par la loi.',
  },
  "Livret A": { short: 'Livret A', ceiling: 22950, basis: 'net', note: 'Intérêts exonérés d\'impôt et de prélèvements sociaux ; les intérêts capitalisés peuvent dépasser le plafond.' },
  "LDDS": { short: 'LDDS', ceiling: 12000, basis: 'net', note: 'Intérêts exonérés d\'impôt et de prélèvements sociaux ; les intérêts capitalisés peuvent dépasser le plafond.' },
  "LEP": { short: 'LEP', ceiling: 10000, basis: 'net', note: 'Réservé sous conditions de revenus ; intérêts exonérés.' },
  "Livret Jeune": { short: 'Livret Jeune', ceiling: 1600, basis: 'net', note: 'Réservé aux 12-25 ans ; intérêts exonérés.' },
};

// Types de la table absents de la liste des comptes (faute de frappe) → [] si tout va bien
function taxEnvelopeProblems(types) {
  const keys = Object.keys(TAX_ENVELOPES);
  const shared = keys.flatMap(k => (TAX_ENVELOPES[k].shared?.with || []));
  return [...new Set([...keys, ...shared])].filter(k => !types.includes(k));
}

// Dépend (à l'appel) de loanAddMonths (js/features/loan-calc.js) et accFlows, _apDay (js/features/account-perf.js), chargés avant.
function _teUsed(acc, rule, conv) {
  const fl = accFlows(acc, conv);
  if (!fl.length) return rule.basis === 'net' ? Math.max(0, acc.value || 0) : null;   // livret sans apports saisis : le solde sert d'estimation
  const dep = fl.filter(f => f.amt > 0).reduce((s, f) => s + f.amt, 0);
  return rule.basis === 'net' ? Math.max(0, fl.reduce((s, f) => s + f.amt, 0)) : dep;
}

// Informations fiscales d'un compte, ou null s'il n'a pas d'enveloppe.
// ctx = { today:'YYYY-MM-DD', conv(v, ccy), accounts:[…] (pour les plafonds communs) }
// → { short, note, milestone:{years, start, date, reached, daysLeft, text} | null, ceiling:{amount, used, left, pct, over, sharedNote} | null }
function taxEnvelopeInfo(acc, ctx) {
  const rule = acc && TAX_ENVELOPES[acc.type];
  if (!rule) return null;
  const conv = ctx.conv || (v => v);
  let milestone = null;
  if (rule.years) {
    const fl = accFlows(acc, conv);
    const start = acc.startDate || fl.map(f => f.date).sort()[0] || null;
    if (start) {
      const date = loanAddMonths(start, 12 * rule.years);
      const daysLeft = Math.ceil(_apDay(date) - _apDay(ctx.today));
      const reached = daysLeft <= 0;
      milestone = { years: rule.years, start, date, reached, daysLeft: reached ? 0 : daysLeft, text: reached ? rule.after : rule.before, auto: !acc.startDate };
    } else milestone = { years: rule.years, start: null, date: null, reached: false, daysLeft: null, text: rule.before, auto: true };
  }
  let ceiling = null;
  if (rule.ceiling) {
    const used = _teUsed(acc, rule, conv);
    if (used != null) {
      let amount = rule.ceiling, sharedNote = '';
      if (rule.shared) {
        // Plafond commun : ce qui est déjà versé sur les autres plans (PEA) réduit la place restante de celui-ci
        const others = (ctx.accounts || []).filter(a => a && a.id !== acc.id && rule.shared.with.includes(a.type))
          .reduce((s, a) => s + (_teUsed(a, TAX_ENVELOPES[a.type] || rule, conv) || 0), 0);
        amount = Math.max(0, rule.shared.total - others);
        sharedNote = `Plafond commun PEA + PEA-PME : ${rule.shared.total.toLocaleString('fr-FR')} €${others > 0 ? ' (déjà versé sur le PEA déduit)' : ''}`;
      }
      const left = Math.max(0, amount - used);
      ceiling = { amount, used, left, pct: amount > 0 ? Math.min(100, used / amount * 100) : 100, over: used > amount + 0.005, sharedNote };
    }
  }
  return { short: rule.short, note: rule.note || '', milestone, ceiling };
}

// Jalon fiscal proche (≤ days jours) : pour le bloc « À surveiller » de l'accueil → [{ acc, info }]
function taxMilestonesSoon(accounts, ctx, days = 90) {
  return (accounts || []).map(acc => ({ acc, info: taxEnvelopeInfo(acc, { ...ctx, accounts }) }))
    .filter(x => x.info && x.info.milestone && !x.info.milestone.reached && x.info.milestone.daysLeft != null && x.info.milestone.daysLeft <= days);
}
