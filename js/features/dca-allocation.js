// Calculs purs du formulaire DCA : aucune dépendance au DOM, à S ou au stockage.
const DCAAllocation = (() => {
  function numbers(values) {
    if (!Array.isArray(values) || !values.length || values.some(v => !Number.isFinite(v) || v < 0)) {
      throw new TypeError('Répartition invalide');
    }
  }

  function budgetCents(budget) {
    if (!Number.isFinite(budget) || budget <= 0) throw new RangeError('Budget mensuel requis');
    const cents = Math.round(budget * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) throw new RangeError('Budget hors limites');
    return cents;
  }

  function normalized(values) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total) || total <= 0) throw new RangeError('Répartition vide ou hors limites');
    // Le reliquat va à la plus grande ligne, jamais à une ligne de poids nul.
    const weights = values.map(value => value / total * 100);
    const largest = values.indexOf(Math.max(...values));
    weights[largest] += 100 - weights.reduce((sum, value) => sum + value, 0);
    return weights;
  }

  function normalizeWeights(weights) {
    numbers(weights);
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.01 + 1e-10) throw new RangeError('Le total doit faire 100 %');
    return normalized(weights);
  }

  function toAmounts(weights, budget) {
    const cents = budgetCents(budget);
    numbers(weights);
    return weights.map(weight => Math.round(cents * weight / 100) / 100);
  }

  function toWeights(amounts, budget) {
    const cents = budgetCents(budget);
    numbers(amounts);
    const amountsInCents = amounts.map(amount => Math.round(amount * 100));
    if (amountsInCents.some(value => !Number.isSafeInteger(value))) throw new RangeError('Montant hors limites');
    const total = amountsInCents.reduce((sum, value) => sum + value, 0);
    if (!Number.isSafeInteger(total) || Math.abs(total - cents) > 1) {
      throw new RangeError('Le total des montants doit égaler le budget mensuel');
    }
    return normalized(amountsInCents);
  }

  function resolveLine(lines, index, info) {
    if (!Array.isArray(lines) || !Number.isInteger(index) || !lines[index]) throw new TypeError('Ligne introuvable');
    const ticker = typeof info?.ticker === 'string' ? info.ticker.trim().toUpperCase() : '';
    if (!ticker) throw new TypeError('Ticker résolu invalide');
    if (lines.some((line, i) => i !== index && String(line.ticker || '').trim().toUpperCase() === ticker)) {
      throw new RangeError('Un titre apparaît deux fois après résolution');
    }
    return lines.map((line, i) => i !== index ? { ...line } : {
      ...line, ticker, name: info.name || ticker, resolved: true,
      ...(info.yahooSymbol ? { yahooSymbol: info.yahooSymbol } : {}),
      ...(info.currency ? { currency: info.currency } : {}),
    });
  }

  return { normalizeWeights, toAmounts, toWeights, resolveLine };
})();
