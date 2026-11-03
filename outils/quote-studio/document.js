/* Quote Studio — modèle de document et « vue client ».
   publicView() est la seule source de l'aperçu et du PDF : elle ne transmet jamais les coûts internes,
   la marge ni les notes privées. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calc.js'));
  else root.SADoc = factory(root.SACalc);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var REVISION = 'Les tarifs des fournisseurs tiers et des services techniques peuvent évoluer. En cas d\'augmentation des coûts de Vercel, Supabase, des registrars de domaines ou d\'autres prestataires, le client sera informé préalablement de toute répercussion éventuelle sur ses tarifs. Toute modification sera communiquée avant son entrée en vigueur, avec indication du nouveau montant et de sa date d\'application.';

  var DEFAULT_CONDITIONS = [
    'Devis valable 15 jours à compter de sa date d\'émission.',
    'Acompte de 60 % à la commande ; solde de 40 % avant la livraison finale pour les sites classiques.',
    'Applications et projets complexes : paiement par étapes selon le calendrier convenu.',
    'Deux séries de corrections incluses. Toute fonctionnalité supplémentaire fait l\'objet d\'un devis complémentaire.',
    'Hébergement, nom de domaine, licences et API sont facturés selon les besoins du projet.',
    'Les délais de réalisation sont précisés dans chaque devis et courent à compter de la réception de l\'acompte et des contenus nécessaires.'
  ].join('\n');

  var INFRA_NOTES = [
    'Les forfaits d\'hébergement et de services techniques sont facturés uniquement lorsque les services correspondants sont nécessaires au projet. Ils ne sont pas inclus dans le prix de création.',
    'Supabase : le forfait comprend l\'abonnement Pro et la gestion technique par Sultan Agency. Le client reste propriétaire de son compte, de son projet et de ses données.',
    'Vercel : l\'hébergement est géré par Sultan Agency dans le cadre de son contrat.',
    'Nom de domaine : enregistré au nom du client, qui peut en demander le transfert.',
    'Les éventuels dépassements de consommation et services tiers supplémentaires sont signalés et chiffrés séparément.'
  ];

  function defaultSettings() {
    return {
      agency: {
        name: 'Sultan Agency',
        tagline: 'Agence de solutions digitales et créatives',
        slogan: 'Vivre, partager, vibrer.',
        address: 'Dakar, Sénégal',
        phone: '+221 78 148 20 35',
        whatsapp: '+221 78 148 20 35',
        email: 'papaahmedsonko5@gmail.com',
        website: 'papaahmedsonko5-collab.github.io/-sultan-agency',
        instagram: '@sultan.experiences',
        ninea: '',
        rccm: '',
        paymentMethods: ''
      },
      usdRate: '',
      validityDays: 15,
      conditions: DEFAULT_CONDITIONS
    };
  }

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function todayIso(d) { d = d || new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

  function newDoc(type, settings, counters, today) {
    var issue = today || todayIso();
    return {
      id: uid(), type: type || 'devis', number: C.nextNumber(counters, type || 'devis', Number(issue.slice(0, 4))),
      status: 'brouillon', issueDate: issue, validityDays: settings.validityDays || 15, dueDate: '', delay: '',
      client: { company: '', contact: '', email: '', phone: '', address: '', ninea: '' },
      project: { subject: '', description: '' },
      lines: [], discount: { type: 'percent', value: '' },
      payment: { mode: 'standard', steps: [] },
      clientNotes: '', privateNotes: '', conditions: settings.conditions, amountPaid: '',
      sourceId: null, sourceNumber: '', invoiceId: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
  }

  function lineFromCatalogue(item) {
    return { id: uid(), catalogueId: item.id, kind: item.kind, label: item.label, desc: item.desc || '', qty: 1,
      unitPrice: item.unitPrice, currency: item.currency, recurrence: item.recurrence, internalCost: '' };
  }
  function blankLine(kind) {
    return { id: uid(), catalogueId: null, kind: kind || 'service', label: '', desc: '', qty: 1, unitPrice: '', currency: 'XOF', recurrence: 'once', internalCost: '' };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function copyAs(doc, type, counters, today) {
    var d = clone(doc), issue = today || todayIso();
    d.id = uid(); d.type = type; d.number = C.nextNumber(counters, type, Number(issue.slice(0, 4)));
    d.status = 'brouillon'; d.issueDate = issue; d.invoiceId = null; d.amountPaid = '';
    d.sourceId = null; d.sourceNumber = ''; d.dueDate = '';
    d.lines.forEach(function (l) { l.id = uid(); });
    d.createdAt = d.updatedAt = new Date().toISOString();
    return d;
  }
  function duplicate(doc, counters, today) { return copyAs(doc, doc.type, counters, today); }

  /* Facture créée à partir d'un devis accepté : document distinct, numérotation FAC propre */
  function invoiceFrom(quote, counters, today) {
    var f = copyAs(quote, 'facture', counters, today);
    f.sourceId = quote.id; f.sourceNumber = quote.number; f.dueDate = f.issueDate;
    return f;
  }

  function lines(text) { return String(text || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }

  /* ---------- Vue client ---------- */
  function publicView(doc, settings) {
    var a = settings.agency, rate = C.rateOf(settings.usdRate);
    var t = C.computeTotals(doc, rate);
    var isInvoice = doc.type === 'facture';
    var row = function (l) {
      var total = t.lineTotals[l.id];
      return { label: l.label || 'Prestation', desc: l.desc || '', qty: C.fmtQty(l.qty), unit: C.fmtMoney(C.num(l.unitPrice), l.currency) + C.RECURRENCE_SUFFIX[l.recurrence || 'once'],
        recurrence: C.RECURRENCE[l.recurrence || 'once'], total: C.fmtMoney(total, l.currency) + C.RECURRENCE_SUFFIX[l.recurrence || 'once'] };
    };
    var once = doc.lines.filter(function (l) { return (l.recurrence || 'once') === 'once' && l.kind !== 'fee'; });
    var fees = doc.lines.filter(function (l) { return (l.recurrence || 'once') === 'once' && l.kind === 'fee'; });
    var monthly = doc.lines.filter(function (l) { return l.recurrence === 'month'; });
    var yearly = doc.lines.filter(function (l) { return l.recurrence === 'year'; });
    var sections = [];
    if (once.length) sections.push({ title: 'Prestations', rows: once.map(row) });
    if (fees.length) sections.push({ title: 'Frais annexes', rows: fees.map(row) });
    if (monthly.length) sections.push({ title: 'Services récurrents — mensuels', rows: monthly.map(row) });
    if (yearly.length) sections.push({ title: 'Services récurrents — annuels', rows: yearly.map(row) });

    var totals = [];
    if (t.servicesXof || t.discountXof) totals.push({ label: 'Sous-total prestations', value: C.fmtXof(t.servicesXof) });
    if (t.discountXof) totals.push({ label: 'Remise' + (doc.discount.type === 'percent' ? ' (' + C.fmtQty(doc.discount.value) + ' %)' : ''), value: '-' + C.fmtXof(t.discountXof) });
    if (t.feesXof) totals.push({ label: 'Frais annexes', value: C.fmtXof(t.feesXof) });
    var grand = { label: isInvoice ? 'Total facturé' : 'Total des prestations ponctuelles', value: C.fmtXof(t.oneTimeXof) };
    if (t.unconvertedOneTimeUsd) totals.push({ label: 'Montants en USD (non convertis)', value: C.fmtUsd(t.unconvertedOneTimeUsd) });

    var recurring = [];
    [['month', 'mois', 'Abonnements mensuels'], ['year', 'an', 'Abonnements annuels']].forEach(function (k) {
      var b = t.recurring[k[0]];
      if (!b.xof && !b.usd) return;
      var parts = [];
      if (b.xof) parts.push(C.fmtXof(b.xof));
      if (b.usd) parts.push(C.fmtUsd(b.usd));
      var v = parts.join(' + ') + ' / ' + k[1];
      if (b.usd && b.xofEquivalent !== null) v += ', soit environ ' + C.fmtXof(b.xofEquivalent) + ' / ' + k[1];
      recurring.push({ label: k[2], value: v });
    });
    var usesUsd = doc.lines.some(function (l) { return l.currency === 'USD'; });
    var rateNote = usesUsd ? (rate ? 'Conversion indicative au taux de 1 USD = ' + C.fmtQty(rate) + ' FCFA ; le montant en FCFA suit le taux du jour de facturation.' : 'Montants en dollars américains (USD), payables au taux du jour de facturation.') : '';

    var sch = C.schedule(t.oneTimeXof, doc.payment);
    var paid = isInvoice ? C.roundXof(doc.amountPaid) : 0;
    var hasInfra = doc.lines.some(function (l) { return /^infra-/.test(l.catalogueId || '') || l.recurrence !== 'once'; });

    var conditions = lines(doc.conditions);
    if (isInvoice) conditions = conditions.filter(function (c) { return !/^devis valable/i.test(c); });
    if (hasInfra) conditions = conditions.concat(INFRA_NOTES);
    if (hasInfra || usesUsd) conditions.push(REVISION);

    return {
      isInvoice: isInvoice,
      title: isInvoice ? 'Facture' : 'Devis',
      number: doc.number,
      reference: isInvoice && doc.sourceNumber ? 'Réf. devis ' + doc.sourceNumber : '',
      dates: [
        { label: 'Date d\'émission', value: C.fmtDate(doc.issueDate) },
        isInvoice ? (doc.dueDate ? { label: 'Date d\'échéance', value: C.fmtDate(doc.dueDate) } : null)
                  : { label: 'Valable jusqu\'au', value: C.fmtDate(C.validUntil(doc)) },
        doc.delay ? { label: 'Délai de réalisation', value: doc.delay } : null
      ].filter(Boolean),
      agency: {
        name: a.name, tagline: a.tagline, slogan: a.slogan,
        lines: [a.address, a.phone ? 'Tél. / WhatsApp : ' + a.phone : '', a.email, a.website, a.ninea ? 'NINEA : ' + a.ninea : '', a.rccm ? 'RCCM : ' + a.rccm : ''].filter(Boolean)
      },
      client: {
        name: doc.client.company || doc.client.contact || 'Client',
        lines: [doc.client.company && doc.client.contact ? 'À l\'attention de ' + doc.client.contact : '', doc.client.address, doc.client.phone, doc.client.email, doc.client.ninea ? 'NINEA : ' + doc.client.ninea : ''].filter(Boolean)
      },
      subject: doc.project.subject, description: doc.project.description,
      sections: sections, totals: totals, grand: grand, recurring: recurring, rateNote: rateNote,
      schedule: sch, paid: paid, remaining: isInvoice ? t.oneTimeXof - paid : null,
      paidLabel: C.fmtXof(paid), remainingLabel: C.fmtXof(t.oneTimeXof - paid),
      paymentMethods: a.paymentMethods || '',
      clientNotes: doc.clientNotes || '',
      conditions: conditions,
      signature: !isInvoice,
      footer: [a.name, a.address, a.phone, a.email].filter(Boolean).join(' · ')
    };
  }

  return { defaultSettings: defaultSettings, newDoc: newDoc, lineFromCatalogue: lineFromCatalogue, blankLine: blankLine,
    duplicate: duplicate, invoiceFrom: invoiceFrom, publicView: publicView, todayIso: todayIso, uid: uid,
    REVISION: REVISION, DEFAULT_CONDITIONS: DEFAULT_CONDITIONS, INFRA_NOTES: INFRA_NOTES };
});
