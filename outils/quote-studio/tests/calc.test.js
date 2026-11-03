/* Tests des calculs du Quote Studio. Lancement : node --test outils/quote-studio/tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../calc.js');
const CAT = require('../catalogue.js');

const L = (o) => Object.assign({ id: Math.random().toString(36).slice(2), qty: 1, unitPrice: 0, currency: 'XOF', recurrence: 'once', kind: 'service' }, o);

test('site professionnel seul : total, acompte 60 % et solde 40 %', () => {
  const doc = { lines: [L({ label: 'Site professionnel', unitPrice: 400000 })] };
  const t = C.computeTotals(doc, null);
  assert.equal(t.oneTimeXof, 400000);
  const s = C.schedule(t.oneTimeXof);
  assert.deepEqual(s.steps.map((x) => x.amount), [240000, 160000]);
  assert.equal(s.valid, true);
});

test('remise en pourcentage sur les prestations, frais annexes ajoutés après remise', () => {
  const doc = {
    lines: [L({ unitPrice: 250000 }), L({ unitPrice: 175000, qty: 2 }), L({ kind: 'fee', unitPrice: 30000 })],
    discount: { type: 'percent', value: 10 }
  };
  const t = C.computeTotals(doc, null);
  assert.equal(t.servicesXof, 600000);
  assert.equal(t.discountXof, 60000);
  assert.equal(t.feesXof, 30000);
  assert.equal(t.oneTimeXof, 570000);
});

test('remise en FCFA plafonnée au montant des prestations', () => {
  const t = C.computeTotals({ lines: [L({ unitPrice: 100000 })], discount: { type: 'amount', value: 250000 } }, null);
  assert.equal(t.discountXof, 100000);
  assert.equal(t.oneTimeXof, 0);
});

test('abonnements : mensuels et annuels séparés, jamais ajoutés au total ponctuel', () => {
  const doc = { lines: [
    L({ unitPrice: 400000 }),
    L({ unitPrice: 40, currency: 'USD', recurrence: 'month' }),
    L({ unitPrice: 50, currency: 'USD', recurrence: 'month' }),
    L({ unitPrice: 20000, recurrence: 'year' })
  ] };
  const sansTaux = C.computeTotals(doc, '');
  assert.equal(sansTaux.oneTimeXof, 400000);
  assert.equal(sansTaux.recurring.month.usd, 90);
  assert.equal(sansTaux.recurring.month.xofEquivalent, null, 'pas de conversion sans taux');
  assert.equal(sansTaux.recurring.year.xof, 20000);
  assert.equal(sansTaux.recurring.year.xofEquivalent, 20000);
  const avecTaux = C.computeTotals(doc, '600');
  assert.equal(avecTaux.recurring.month.xofEquivalent, 54000);
  assert.equal(avecTaux.rate, 600);
});

test('USD ponctuel sans taux : non additionné et signalé', () => {
  const t = C.computeTotals({ lines: [L({ unitPrice: 100000 }), L({ unitPrice: 25.5, currency: 'USD' })] }, 0);
  assert.equal(t.oneTimeXof, 100000);
  assert.equal(t.unconvertedOneTimeUsd, 25.5);
  assert.ok(t.warnings.some((w) => w.type === 'taux'));
  const t2 = C.computeTotals({ lines: [L({ unitPrice: 100000 }), L({ unitPrice: 25.5, currency: 'USD' })] }, 610);
  assert.equal(t2.oneTimeXof, 100000 + 15555);
});

test('échéancier : arrondis exacts, le dernier versement absorbe l’écart', () => {
  const s = C.schedule(333333);
  assert.deepEqual(s.steps.map((x) => x.amount), [200000, 133333]);
  const c = C.schedule(1000001, { mode: 'custom', steps: [{ percent: 30 }, { percent: 30 }, { percent: 40 }] });
  assert.equal(c.steps.reduce((a, x) => a + x.amount, 0), 1000001);
  assert.equal(c.valid, true);
  const bad = C.schedule(1000, { mode: 'custom', steps: [{ percent: 50 }, { percent: 30 }] });
  assert.equal(bad.valid, false);
  assert.equal(bad.percentTotal, 80);
});

test('quantités décimales et lignes à prix non renseigné', () => {
  const t = C.computeTotals({ lines: [L({ unitPrice: 15000, qty: 2.5 }), L({ label: 'Identité visuelle', unitPrice: 0 })] }, null);
  assert.equal(t.oneTimeXof, 37500);
  assert.equal(t.warnings.filter((w) => w.type === 'prix').length, 1);
});

test('marge interne calculée à partir des coûts internes ponctuels', () => {
  const t = C.computeTotals({ lines: [L({ unitPrice: 400000, internalCost: 150000 })] }, null);
  assert.equal(t.internalCostXof, 150000);
  assert.equal(t.marginXof, 250000);
});

test('validité 15 jours et statut expiré automatique', () => {
  const d = { type: 'devis', status: 'envoye', issueDate: '2026-11-03', validityDays: 15 };
  assert.equal(C.validUntil(d), '2026-11-18');
  assert.equal(C.effectiveStatus(d, '2026-11-18'), 'envoye');
  assert.equal(C.effectiveStatus(d, '2026-11-19'), 'expire');
  assert.equal(C.effectiveStatus(Object.assign({}, d, { status: 'accepte' }), '2027-01-01'), 'accepte');
  assert.equal(C.addDays('2026-12-25', 15), '2027-01-09');
});

test('numérotation séparée devis / factures, par année', () => {
  const c = {};
  assert.equal(C.nextNumber(c, 'devis', 2026), 'DEV-2026-001');
  assert.equal(C.nextNumber(c, 'devis', 2026), 'DEV-2026-002');
  assert.equal(C.nextNumber(c, 'facture', 2026), 'FAC-2026-001');
  assert.equal(C.nextNumber(c, 'devis', 2027), 'DEV-2027-001');
});

test('formats monétaires', () => {
  assert.equal(C.fmtXof(1000000), '1 000 000 FCFA');
  assert.equal(C.fmtXof(175000), '175 000 FCFA');
  assert.equal(C.fmtUsd(40), '40 USD');
  assert.equal(C.fmtUsd(1234.5), '1 234,50 USD');
  assert.equal(C.fmtDate('2026-11-03'), '03/11/2026');
});

test('catalogue : tarifs officiels 2026-2027', () => {
  const p = Object.fromEntries(CAT.items.map((i) => [i.id, i]));
  assert.equal(p['site-landing'].unitPrice, 175000);
  assert.equal(p['site-vitrine'].unitPrice, 250000);
  assert.equal(p['site-pro'].unitPrice, 400000);
  assert.equal(p['site-pro'].popular, true);
  assert.equal(p['site-ecommerce'].unitPrice, 500000);
  assert.equal(p['site-premium'].unitPrice, 650000);
  assert.equal(p['site-ia'].unitPrice, 1000000);
  assert.deepEqual([p['infra-vercel'].unitPrice, p['infra-vercel'].currency, p['infra-vercel'].recurrence], [40, 'USD', 'month']);
  assert.deepEqual([p['infra-supabase'].unitPrice, p['infra-supabase'].currency, p['infra-supabase'].recurrence], [50, 'USD', 'month']);
  assert.deepEqual([p['infra-domaine'].unitPrice, p['infra-domaine'].currency, p['infra-domaine'].recurrence], [20000, 'XOF', 'year']);
  CAT.items.filter((i) => i.onQuote).forEach((i) => assert.equal(i.unitPrice, 0, i.id + ' doit rester sur devis'));
});
