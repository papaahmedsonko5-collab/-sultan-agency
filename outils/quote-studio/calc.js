/* Quote Studio — calculs (sans dépendance, utilisable dans le navigateur et dans Node pour les tests).
   Règles :
   - les montants en FCFA sont des entiers (arrondi au franc le plus proche) ;
   - les montants en USD sont arrondis au centime ;
   - les USD ne sont convertis en FCFA que si un taux a été saisi : sinon ils restent en USD
     et ne sont jamais additionnés aux montants en FCFA ;
   - la remise porte sur les prestations ponctuelles ; les frais annexes s'ajoutent après remise ;
   - l'échéancier (acompte / solde) porte sur le total ponctuel ; les abonnements sont facturés à part. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SACalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RECURRENCE = { once: 'Ponctuel', month: 'Mensuel', year: 'Annuel' };
  var RECURRENCE_SUFFIX = { once: '', month: '/mois', year: '/an' };
  var STATUS = { brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré' };
  var INVOICE_STATUS = { brouillon: 'Brouillon', envoye: 'Envoyée', payee: 'Payée', partielle: 'Partiellement payée' };

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function roundXof(n) { return Math.round(num(n)); }
  function roundUsd(n) { return Math.round(num(n) * 100) / 100; }
  function roundIn(cur, n) { return cur === 'USD' ? roundUsd(n) : roundXof(n); }

  /* Taux saisi par l'utilisateur (FCFA pour 1 USD), ou null s'il n'est pas renseigné */
  function rateOf(r) { var n = num(r); return n > 0 ? n : null; }

  function lineTotal(line) {
    return roundIn(line.currency, num(line.qty) * num(line.unitPrice));
  }

  /* Conversion vers le FCFA : null si impossible (USD sans taux) */
  function toXof(amount, currency, rate) {
    if (currency !== 'USD') return roundXof(amount);
    var r = rateOf(rate);
    return r ? roundXof(amount * r) : null;
  }

  function computeTotals(doc, rate) {
    var lines = (doc && doc.lines) || [];
    var r = rateOf(rate);
    var res = {
      rate: r,
      servicesXof: 0,
      feesXof: 0,
      discountXof: 0,
      oneTimeXof: 0,
      unconvertedOneTimeUsd: 0,
      recurring: { month: { xof: 0, usd: 0, xofEquivalent: null }, year: { xof: 0, usd: 0, xofEquivalent: null } },
      internalCostXof: 0,
      marginXof: null,
      lineTotals: {},
      warnings: []
    };
    var unconvertedRecurring = false;

    lines.forEach(function (l) {
      var t = lineTotal(l);
      res.lineTotals[l.id] = t;
      var rec = l.recurrence === 'month' || l.recurrence === 'year' ? l.recurrence : 'once';
      if (rec === 'once') {
        var x = toXof(t, l.currency, r);
        if (x === null) { res.unconvertedOneTimeUsd = roundUsd(res.unconvertedOneTimeUsd + t); return; }
        if (l.kind === 'fee') res.feesXof += x; else res.servicesXof += x;
      } else {
        var bucket = res.recurring[rec];
        if (l.currency === 'USD') bucket.usd = roundUsd(bucket.usd + t); else bucket.xof += roundXof(t);
      }
      if (num(l.internalCost) > 0) {
        var c = toXof(num(l.internalCost) * (num(l.qty) || 0), l.currency, r);
        if (c !== null && rec === 'once') res.internalCostXof += c;
      }
      if (!(num(l.unitPrice) > 0)) res.warnings.push({ id: l.id, type: 'prix', message: 'Prix non renseigné : ' + (l.label || 'ligne sans titre') });
    });

    ['month', 'year'].forEach(function (k) {
      var b = res.recurring[k];
      if (b.usd > 0) {
        if (r) b.xofEquivalent = b.xof + roundXof(b.usd * r);
        else unconvertedRecurring = true;
      } else {
        b.xofEquivalent = b.xof;
      }
    });

    var d = doc && doc.discount ? doc.discount : null;
    if (d && num(d.value) > 0) {
      if (d.type === 'percent') res.discountXof = roundXof(res.servicesXof * Math.min(num(d.value), 100) / 100);
      else res.discountXof = Math.min(roundXof(d.value), res.servicesXof);
    }
    res.oneTimeXof = res.servicesXof - res.discountXof + res.feesXof;
    if (res.internalCostXof > 0) res.marginXof = res.oneTimeXof - res.internalCostXof;

    if (res.unconvertedOneTimeUsd > 0) res.warnings.push({ type: 'taux', message: 'Des montants ponctuels en USD ne sont pas convertis : renseignez le taux de change.' });
    if (unconvertedRecurring) res.warnings.push({ type: 'taux-info', message: 'Les abonnements en USD sont affichés en USD (aucun taux renseigné).' });
    return res;
  }

  /* Échéancier : le dernier versement absorbe l'écart d'arrondi, la somme est toujours exacte. */
  function schedule(total, payment) {
    var parts = payment && payment.mode === 'custom' && payment.steps && payment.steps.length
      ? payment.steps
      : [{ label: 'Acompte à la commande', percent: 60, date: '' }, { label: 'Solde avant livraison finale', percent: 40, date: '' }];
    var sumPct = parts.reduce(function (s, p) { return s + num(p.percent); }, 0);
    var t = roundXof(total), acc = 0;
    var steps = parts.map(function (p, i) {
      var amount = i === parts.length - 1 ? t - acc : roundXof(t * num(p.percent) / 100);
      acc += amount;
      return { label: p.label || ('Échéance ' + (i + 1)), percent: num(p.percent), date: p.date || '', amount: amount };
    });
    return { steps: steps, percentTotal: Math.round(sumPct * 100) / 100, valid: Math.abs(sumPct - 100) < 0.001 };
  }

  /* Dates au format AAAA-MM-JJ (sans fuseau) */
  function addDays(iso, days) {
    var p = String(iso || '').split('-').map(Number);
    if (p.length !== 3 || !p[0]) return '';
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + num(days)));
    return d.toISOString().slice(0, 10);
  }
  function validUntil(doc) { return addDays(doc.issueDate, doc.validityDays == null ? 15 : doc.validityDays); }

  function effectiveStatus(doc, todayIso) {
    if (doc.type !== 'devis') return doc.status;
    if ((doc.status === 'brouillon' || doc.status === 'envoye') && todayIso && validUntil(doc) && todayIso > validUntil(doc)) return 'expire';
    return doc.status;
  }

  /* Numérotation : DEV-2026-001 / FAC-2026-001, une séquence par type et par année */
  function nextNumber(counters, type, year) {
    var prefix = type === 'facture' ? 'FAC' : 'DEV';
    var key = prefix + '-' + year;
    var n = (counters[key] || 0) + 1;
    counters[key] = n;
    return key + '-' + String(n).padStart(3, '0');
  }

  /* Formats (espace insécable comme séparateur de milliers) */
  var NBSP = ' ';
  function groupThousands(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP); }
  function fmtXof(n) {
    var v = roundXof(n), neg = v < 0;
    return (neg ? '-' : '') + groupThousands(String(Math.abs(v))) + NBSP + 'FCFA';
  }
  function fmtUsd(n) {
    var v = roundUsd(n), neg = v < 0, a = Math.abs(v);
    var s = Number.isInteger(a) ? String(a) : a.toFixed(2).replace('.', ',');
    var parts = s.split(',');
    return (neg ? '-' : '') + groupThousands(parts[0]) + (parts[1] ? ',' + parts[1] : '') + NBSP + 'USD';
  }
  function fmtMoney(n, cur) { return cur === 'USD' ? fmtUsd(n) : fmtXof(n); }
  function fmtQty(n) { var v = num(n); return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ','); }
  function fmtDate(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }

  return { RECURRENCE: RECURRENCE, RECURRENCE_SUFFIX: RECURRENCE_SUFFIX, STATUS: STATUS, INVOICE_STATUS: INVOICE_STATUS,
    num: num, roundXof: roundXof, roundUsd: roundUsd, lineTotal: lineTotal, toXof: toXof, computeTotals: computeTotals,
    schedule: schedule, addDays: addDays, validUntil: validUntil, effectiveStatus: effectiveStatus, nextNumber: nextNumber,
    fmtXof: fmtXof, fmtUsd: fmtUsd, fmtMoney: fmtMoney, fmtQty: fmtQty, fmtDate: fmtDate, rateOf: rateOf };
});
