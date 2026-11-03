/* Tests de la vue client (ce que voit le client dans l'aperçu et le PDF). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../calc.js');
const D = require('../document.js');
const CAT = require('../catalogue.js');

function demo(type) {
  const settings = D.defaultSettings();
  const counters = {};
  const doc = D.newDoc(type || 'devis', settings, counters, '2026-11-03');
  doc.client.company = 'Client de démonstration';
  doc.privateNotes = 'NOTE-PRIVEE-123';
  const site = D.lineFromCatalogue(CAT.items.find((i) => i.id === 'site-pro'));
  site.internalCost = '987654';
  doc.lines.push(site, D.lineFromCatalogue(CAT.items.find((i) => i.id === 'infra-vercel')));
  return { settings, counters, doc };
}

test('la vue client ne contient ni coûts internes, ni marge, ni notes privées', () => {
  const { settings, doc } = demo();
  const text = JSON.stringify(D.publicView(doc, settings));
  assert.ok(!text.includes('NOTE-PRIVEE-123'));
  assert.ok(!text.includes('987654') && !text.includes('987 654'));
  assert.ok(!/internalCost|privateNotes|margin/i.test(text));
});

test('devis : validité, signature, conditions de révision quand il y a des services techniques', () => {
  const { settings, doc } = demo();
  const v = D.publicView(doc, settings);
  assert.equal(v.title, 'Devis');
  assert.ok(v.dates.some((d) => d.value === '18/11/2026'));
  assert.equal(v.signature, true);
  assert.ok(v.conditions.includes(D.REVISION));
  assert.ok(v.conditions.some((c) => /propriétaire de son compte/.test(c)));
  assert.equal(v.grand.value, C.fmtXof(400000));
});

test('abonnement en USD : affiché en USD sans taux, équivalent indiqué avec taux', () => {
  const { settings, doc } = demo();
  assert.equal(D.publicView(doc, settings).recurring[0].value, '40 USD / mois');
  settings.usdRate = '600';
  const v = D.publicView(doc, settings);
  assert.equal(v.recurring[0].value, '40 USD / mois, soit environ 24 000 FCFA / mois');
  assert.ok(/1 USD = 600 FCFA/.test(v.rateNote));
});

test('facture créée depuis un devis : document distinct, numéro FAC, sans validité ni « bon pour accord »', () => {
  const { settings, counters, doc } = demo();
  doc.status = 'accepte';
  const f = D.invoiceFrom(doc, counters, '2026-11-20');
  assert.equal(f.type, 'facture');
  assert.equal(f.number, 'FAC-2026-001');
  assert.equal(f.sourceNumber, doc.number);
  assert.notEqual(f.id, doc.id);
  f.amountPaid = '240000';
  const v = D.publicView(f, settings);
  assert.equal(v.title, 'Facture');
  assert.equal(v.signature, false);
  assert.ok(!v.dates.some((d) => /Valable/.test(d.label)));
  assert.ok(!v.conditions.some((c) => /^Devis valable/.test(c)));
  assert.equal(v.remainingLabel, C.fmtXof(160000));
  assert.equal(counters['DEV-2026'], 1, 'la facture ne consomme pas de numéro de devis');
});

test('duplication : nouveau numéro, statut brouillon, lignes copiées', () => {
  const { counters, doc } = demo();
  doc.status = 'envoye';
  const c = D.duplicate(doc, counters, '2026-11-04');
  assert.equal(c.number, 'DEV-2026-002');
  assert.equal(c.status, 'brouillon');
  assert.equal(c.lines.length, doc.lines.length);
  assert.notEqual(c.lines[0].id, doc.lines[0].id);
});
