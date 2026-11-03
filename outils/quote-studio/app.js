/* Quote Studio — interface (tableau de bord, éditeur, réglages).
   Stockage local au navigateur (localStorage), avec export / import d'une sauvegarde JSON.
   Aucune donnée n'est envoyée sur Internet. */
(function () {
  'use strict';
  var C = window.SACalc, D = window.SADoc, CAT = window.SACatalogue;
  var KEY = 'sultan-quote-studio-v1';
  var app = document.getElementById('app');

  /* ---------- Stockage ---------- */
  var storageOk = true;
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        s.settings = Object.assign(D.defaultSettings(), s.settings || {});
        s.settings.agency = Object.assign(D.defaultSettings().agency, (s.settings && s.settings.agency) || {});
        s.docs = Array.isArray(s.docs) ? s.docs : [];
        s.counters = s.counters || {};
        return s;
      }
    } catch (e) { storageOk = false; }
    return { version: 1, settings: D.defaultSettings(), docs: [], counters: {} };
  }
  var store = load();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); storageOk = true; }
    catch (e) { storageOk = false; }
    document.getElementById('storage-alert').hidden = storageOk;
  }
  try { localStorage.setItem(KEY + '-test', '1'); localStorage.removeItem(KEY + '-test'); } catch (e) { storageOk = false; }
  document.getElementById('storage-alert').hidden = storageOk;

  /* ---------- Utilitaires ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function find(id) { return store.docs.filter(function (d) { return d.id === id; })[0]; }
  function today() { return D.todayIso(); }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function statusLabel(doc) {
    var st = C.effectiveStatus(doc, today());
    return doc.type === 'facture' ? (C.INVOICE_STATUS[st] || st) : (C.STATUS[st] || st);
  }
  function statusKey(doc) { return C.effectiveStatus(doc, today()); }
  function totalsOf(doc) { return C.computeTotals(doc, store.settings.usdRate); }
  function get(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function set(obj, path, v) { var ks = path.split('.'), last = ks.pop(); var o = ks.reduce(function (a, k) { return a[k]; }, obj); o[last] = v; }

  /* ---------- Navigation ---------- */
  function route() {
    var h = location.hash.replace(/^#/, '') || '/';
    $$('.bar-nav a[data-nav]').forEach(function (a) { a.removeAttribute('aria-current'); });
    if (h === '/nouveau') return createDoc('devis');
    var m = h.match(/^\/doc\/([\w-]+)$/);
    if (m) { var d = find(m[1]); return d ? renderEditor(d) : renderDashboard('Document introuvable.'); }
    if (h === '/reglages') { $('[data-nav="settings"]').setAttribute('aria-current', 'page'); return renderSettings(); }
    $('[data-nav="dashboard"]').setAttribute('aria-current', 'page');
    renderDashboard();
  }
  window.addEventListener('hashchange', route);

  function createDoc(type) {
    var d = D.newDoc(type, store.settings, store.counters, today());
    store.docs.unshift(d); persist();
    location.replace('#/doc/' + d.id);
  }

  /* ---------- Tableau de bord ---------- */
  var filters = { q: '', status: '', type: '' };
  function renderDashboard(message) {
    var quotes = store.docs.filter(function (d) { return d.type === 'devis'; });
    var accepted = quotes.filter(function (d) { return d.status === 'accepte'; });
    var pending = quotes.filter(function (d) { return statusKey(d) === 'envoye'; });
    var acceptedSum = accepted.reduce(function (s, d) { return s + totalsOf(d).oneTimeXof; }, 0);
    var invoices = store.docs.filter(function (d) { return d.type === 'facture'; });
    app.innerHTML =
      '<section class="page">' +
      (message ? '<p class="notice">' + esc(message) + '</p>' : '') +
      '<div class="page-head"><div><p class="eyebrow">Quote Studio</p><h1>Tableau de bord</h1></div>' +
      '<div class="head-actions"><a class="btn btn-ink" href="#/nouveau">Nouveau devis</a></div></div>' +
      '<dl class="stats">' +
      '<div><dt>Devis</dt><dd>' + quotes.length + '</dd></div>' +
      '<div><dt>En attente de réponse</dt><dd>' + pending.length + '</dd></div>' +
      '<div><dt>Acceptés</dt><dd>' + accepted.length + '</dd></div>' +
      '<div><dt>Montant accepté</dt><dd>' + esc(C.fmtXof(acceptedSum)) + '</dd></div>' +
      '<div><dt>Factures</dt><dd>' + invoices.length + '</dd></div>' +
      '</dl>' +
      '<div class="filters">' +
      '<label class="f-search"><span class="sr">Rechercher</span><input type="search" id="q" placeholder="Rechercher un client, un numéro, un objet…" value="' + esc(filters.q) + '"></label>' +
      '<label><span class="sr">Type</span><select id="ft"><option value="">Devis et factures</option><option value="devis">Devis</option><option value="facture">Factures</option></select></label>' +
      '<label><span class="sr">Statut</span><select id="fs"><option value="">Tous les statuts</option>' +
      Object.keys(C.STATUS).map(function (k) { return '<option value="' + k + '">' + C.STATUS[k] + '</option>'; }).join('') +
      '<option value="payee">Payée</option><option value="partielle">Partiellement payée</option></select></label>' +
      '</div>' +
      '<div id="list"></div>' +
      '</section>';
    $('#ft').value = filters.type; $('#fs').value = filters.status;
    $('#q').addEventListener('input', function (e) { filters.q = e.target.value; renderList(); });
    $('#ft').addEventListener('change', function (e) { filters.type = e.target.value; renderList(); });
    $('#fs').addEventListener('change', function (e) { filters.status = e.target.value; renderList(); });
    renderList();
    app.focus();
  }

  function renderList() {
    var q = filters.q.trim().toLowerCase();
    var docs = store.docs.filter(function (d) {
      if (filters.type && d.type !== filters.type) return false;
      if (filters.status && statusKey(d) !== filters.status) return false;
      if (!q) return true;
      return [d.number, d.client.company, d.client.contact, d.client.email, d.project.subject, d.sourceNumber].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return (b.issueDate + b.createdAt).localeCompare(a.issueDate + a.createdAt); });
    var box = $('#list');
    if (!store.docs.length) {
      box.innerHTML = '<div class="empty"><p>Aucun devis pour l\'instant.</p><a class="btn btn-ink" href="#/nouveau">Créer le premier devis</a></div>';
      return;
    }
    if (!docs.length) { box.innerHTML = '<div class="empty"><p>Aucun document ne correspond à la recherche.</p></div>'; return; }
    box.innerHTML = '<table class="list"><thead><tr><th scope="col">Numéro</th><th scope="col">Client</th><th scope="col">Objet</th><th scope="col">Date</th><th scope="col" class="num">Total</th><th scope="col">Statut</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>' +
      docs.map(function (d) {
        var t = totalsOf(d);
        var canInvoice = d.type === 'devis' && d.status === 'accepte';
        return '<tr>' +
          '<td data-label="Numéro"><a class="doc-link" href="#/doc/' + d.id + '">' + esc(d.number) + '</a><small>' + (d.type === 'facture' ? 'Facture' + (d.sourceNumber ? ' · ' + esc(d.sourceNumber) : '') : 'Devis') + '</small></td>' +
          '<td data-label="Client">' + esc(d.client.company || d.client.contact || '—') + '</td>' +
          '<td data-label="Objet">' + esc(d.project.subject || '—') + '</td>' +
          '<td data-label="Date">' + esc(C.fmtDate(d.issueDate)) + '</td>' +
          '<td data-label="Total" class="num">' + esc(C.fmtXof(t.oneTimeXof)) + '</td>' +
          '<td data-label="Statut"><span class="status s-' + statusKey(d) + '">' + esc(statusLabel(d)) + '</span></td>' +
          '<td class="row-actions">' +
          '<a class="btn btn-small" href="#/doc/' + d.id + '">Ouvrir</a>' +
          '<button class="btn btn-small" type="button" data-act="dup" data-id="' + d.id + '">Dupliquer</button>' +
          (canInvoice ? '<button class="btn btn-small" type="button" data-act="inv" data-id="' + d.id + '">' + (d.invoiceId && find(d.invoiceId) ? 'Voir la facture' : 'Facturer') + '</button>' : '') +
          '<button class="btn btn-small btn-danger" type="button" data-act="del" data-id="' + d.id + '">Supprimer</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table>';
    $$('[data-act]', box).forEach(function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-act'), b.getAttribute('data-id')); }); });
  }

  function act(what, id) {
    var d = find(id);
    if (!d) return;
    if (what === 'dup') {
      var c = D.duplicate(d, store.counters, today()); store.docs.unshift(c); persist();
      toast('Copie créée : ' + c.number); location.hash = '#/doc/' + c.id;
    } else if (what === 'inv') {
      if (d.invoiceId && find(d.invoiceId)) { location.hash = '#/doc/' + d.invoiceId; return; }
      var f = D.invoiceFrom(d, store.counters, today()); d.invoiceId = f.id; store.docs.unshift(f); persist();
      toast('Facture ' + f.number + ' créée à partir du devis ' + d.number); location.hash = '#/doc/' + f.id;
    } else if (what === 'del') {
      var warn = d.type === 'facture' ? '\n\nAttention : supprimer une facture crée un trou dans la numérotation.' : '';
      if (!confirm('Supprimer définitivement ' + d.number + ' ?' + warn)) return;
      store.docs = store.docs.filter(function (x) { return x.id !== id; });
      store.docs.forEach(function (x) { if (x.invoiceId === id) x.invoiceId = null; });
      persist(); toast(d.number + ' supprimé'); if (location.hash.indexOf(id) !== -1) location.hash = '#/'; else renderList();
    }
  }

  /* ---------- Éditeur ---------- */
  var current = null, saveTimer = null;

  function field(label, path, opts) {
    opts = opts || {};
    var v = get(current, path); v = v == null ? '' : v;
    var id = 'f-' + path.replace(/\./g, '-');
    var input;
    if (opts.type === 'textarea') input = '<textarea id="' + id + '" data-path="' + path + '" rows="' + (opts.rows || 3) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>' + esc(v) + '</textarea>';
    else if (opts.type === 'select') input = '<select id="' + id + '" data-path="' + path + '">' + opts.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    else input = '<input id="' + id + '" data-path="' + path + '" type="' + (opts.type || 'text') + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + (opts.step ? ' step="' + opts.step + '"' : '') + (opts.min != null ? ' min="' + opts.min + '"' : '') + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + ' value="' + esc(v) + '"' + (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : ' autocomplete="off"') + '>';
    return '<div class="field' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + (opts.optional ? ' <span class="opt">facultatif</span>' : '') + '</label>' + input + (opts.hint ? '<small>' + esc(opts.hint) + '</small>' : '') + '</div>';
  }

  function catalogueOptions() {
    return CAT.groups.map(function (g) {
      return '<optgroup label="' + esc(g.label) + '">' + CAT.items.filter(function (i) { return i.group === g.id; }).map(function (i) {
        var price = i.onQuote ? 'sur devis' : C.fmtMoney(i.unitPrice, i.currency) + C.RECURRENCE_SUFFIX[i.recurrence];
        return '<option value="' + i.id + '">' + esc(i.label) + ' — ' + esc(price) + (i.popular ? ' (populaire)' : '') + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function renderEditor(doc) {
    current = doc;
    var isInv = doc.type === 'facture';
    var stOptions = isInv ? Object.keys(C.INVOICE_STATUS).map(function (k) { return [k, C.INVOICE_STATUS[k]]; })
      : Object.keys(C.STATUS).filter(function (k) { return k !== 'expire'; }).map(function (k) { return [k, C.STATUS[k]]; });
    app.innerHTML =
      '<section class="editor">' +
      '<div class="ed-head"><div><p class="eyebrow"><a href="#/">Tableau de bord</a> / ' + (isInv ? 'Facture' : 'Devis') + '</p>' +
      '<h1>' + esc(doc.number) + ' <span class="status s-' + statusKey(doc) + '" id="st-badge">' + esc(statusLabel(doc)) + '</span></h1>' +
      (isInv && doc.sourceNumber ? '<p class="muted">Facture établie à partir du devis ' + esc(doc.sourceNumber) + '.</p>' : '') + '</div>' +
      '<div class="ed-actions">' +
      '<button class="btn btn-ink" type="button" id="b-pdf">Télécharger le PDF</button>' +
      '<button class="btn" type="button" id="b-print">Imprimer</button>' +
      '<button class="btn" type="button" id="b-dup">Dupliquer</button>' +
      (!isInv ? '<button class="btn" type="button" id="b-inv"' + (doc.status === 'accepte' ? '' : ' disabled title="Disponible quand le devis est accepté"') + '>' + (doc.invoiceId && find(doc.invoiceId) ? 'Voir la facture' : 'Créer la facture') + '</button>' : '') +
      '</div><p class="saved" id="saved" aria-live="polite"></p></div>' +
      '<div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-tab="form">Saisie</button><button type="button" role="tab" aria-selected="false" data-tab="preview">Aperçu</button></div>' +
      '<div class="ed-grid">' +
      '<form class="ed-form" id="ed-form" novalidate autocomplete="off">' +

      '<fieldset><legend>Document</legend><div class="grid">' +
      field('Statut', 'status', { type: 'select', options: stOptions }) +
      field('Date d\'émission', 'issueDate', { type: 'date' }) +
      (isInv ? field('Date d\'échéance', 'dueDate', { type: 'date', optional: true }) + field('Montant déjà réglé (FCFA)', 'amountPaid', { type: 'number', inputmode: 'numeric', min: 0, optional: true, hint: 'Par exemple l\'acompte reçu.' })
             : field('Validité (jours)', 'validityDays', { type: 'number', inputmode: 'numeric', min: 1, hint: 'Valable jusqu\'au ' + C.fmtDate(C.validUntil(doc)) })) +
      field('Délai de réalisation', 'delay', { optional: true, ph: 'Exemple : 3 semaines après l\'acompte' }) +
      '</div></fieldset>' +

      '<fieldset><legend>Client</legend><div class="grid">' +
      field('Nom du client ou de l\'entreprise', 'client.company', { autocomplete: 'organization' }) +
      field('Nom du contact', 'client.contact', { optional: true }) +
      field('Adresse e-mail', 'client.email', { type: 'email', inputmode: 'email', optional: true }) +
      field('Téléphone', 'client.phone', { type: 'tel', inputmode: 'tel', optional: true }) +
      field('Adresse', 'client.address', { optional: true, wide: true }) +
      field('NINEA', 'client.ninea', { optional: true }) +
      '</div></fieldset>' +

      '<fieldset><legend>Projet</legend><div class="grid">' +
      field('Objet du projet', 'project.subject', { wide: true, ph: 'Exemple : Création du site professionnel' }) +
      field('Description du besoin', 'project.description', { type: 'textarea', rows: 4, wide: true, optional: true }) +
      '</div></fieldset>' +

      '<fieldset><legend>Prestations</legend>' +
      '<div class="add-line"><label for="cat-pick" class="sr">Prestation du catalogue</label><select id="cat-pick"><option value="">Choisir une prestation du catalogue…</option>' + catalogueOptions() + '</select>' +
      '<button class="btn btn-ink" type="button" id="b-add-cat">Ajouter</button></div>' +
      '<div class="add-more"><button class="btn btn-small" type="button" id="b-add-custom">+ Prestation personnalisée</button><button class="btn btn-small" type="button" id="b-add-fee">+ Frais annexe</button></div>' +
      '<div id="lines"></div>' +
      '</fieldset>' +

      '<fieldset><legend>Remise</legend><div class="grid">' +
      field('Type de remise', 'discount.type', { type: 'select', options: [['percent', 'En pourcentage (%)'], ['amount', 'En FCFA']] }) +
      field('Valeur', 'discount.value', { type: 'number', inputmode: 'decimal', min: 0, step: 'any', optional: true, hint: 'S\'applique aux prestations ponctuelles, avant les frais annexes.' }) +
      '</div></fieldset>' +

      '<fieldset><legend>Modalités de paiement</legend>' +
      '<div class="radios" role="radiogroup" aria-label="Modalités"><label><input type="radio" name="paymode" value="standard"' + (doc.payment.mode !== 'custom' ? ' checked' : '') + '> Standard : 60 % à la commande, 40 % avant livraison</label>' +
      '<label><input type="radio" name="paymode" value="custom"' + (doc.payment.mode === 'custom' ? ' checked' : '') + '> Échéancier personnalisé (projets complexes)</label></div>' +
      '<div id="steps"></div>' +
      '</fieldset>' +

      '<fieldset><legend>Textes du document</legend><div class="grid">' +
      field('Remarques visibles par le client', 'clientNotes', { type: 'textarea', rows: 3, wide: true, optional: true }) +
      field('Conditions commerciales (une par ligne)', 'conditions', { type: 'textarea', rows: 7, wide: true, hint: 'Les précisions sur l\'hébergement et la clause de révision tarifaire s\'ajoutent automatiquement quand le devis contient des services techniques ou des montants en USD.' }) +
      '</div></fieldset>' +

      '<fieldset class="private"><legend>Interne — jamais visible par le client</legend>' +
      '<div class="grid">' + field('Notes privées', 'privateNotes', { type: 'textarea', rows: 3, wide: true, optional: true }) + '</div>' +
      '<div id="internal"></div>' +
      '</fieldset>' +
      '</form>' +

      '<aside class="ed-preview" aria-label="Aperçu du document"><div class="paper" id="preview"></div></aside>' +
      '</div></section>';

    var form = $('#ed-form');
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    $('#b-add-cat').addEventListener('click', function () {
      var id = $('#cat-pick').value; if (!id) { $('#cat-pick').focus(); return; }
      var item = CAT.items.filter(function (i) { return i.id === id; })[0];
      current.lines.push(D.lineFromCatalogue(item)); $('#cat-pick').value = '';
      changed(true);
      if (item.onQuote) toast('Prestation sur devis : saisissez son prix.');
    });
    $('#b-add-custom').addEventListener('click', function () { current.lines.push(D.blankLine('service')); changed(true); focusLast(); });
    $('#b-add-fee').addEventListener('click', function () { current.lines.push(D.blankLine('fee')); changed(true); focusLast(); });
    $$('input[name="paymode"]').forEach(function (r) { r.addEventListener('change', function () {
      current.payment.mode = r.value;
      if (r.value === 'custom' && !current.payment.steps.length) current.payment.steps = [{ label: 'Acompte à la commande', percent: 60, date: '' }, { label: 'Solde avant livraison finale', percent: 40, date: '' }];
      changed(true);
    }); });
    $('#b-pdf').addEventListener('click', downloadPdf);
    $('#b-print').addEventListener('click', function () { window.print(); });
    $('#b-dup').addEventListener('click', function () { act('dup', current.id); });
    if ($('#b-inv')) $('#b-inv').addEventListener('click', function () { act('inv', current.id); });
    $$('.tabs [data-tab]').forEach(function (b) { b.addEventListener('click', function () {
      $$('.tabs [data-tab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      $('.ed-grid').setAttribute('data-view', b.getAttribute('data-tab'));
    }); });
    renderLines(); renderSteps(); refresh();
    app.focus();
  }

  function focusLast() { var ins = $$('#lines .line'); var last = ins[ins.length - 1]; if (last) $('[data-k="label"]', last).focus(); }

  function onInput(e) {
    var t = e.target;
    if (t.hasAttribute('data-path')) {
      var path = t.getAttribute('data-path'), v = t.value;
      set(current, path, path === 'validityDays' ? Math.max(1, parseInt(v, 10) || 15) : v);
      if (path === 'status' || path === 'validityDays' || path === 'issueDate') updateBadge();
      changed(false);
    } else if (t.hasAttribute('data-k')) {
      var row = t.closest('.line'), line = current.lines.filter(function (l) { return l.id === row.getAttribute('data-id'); })[0];
      if (!line) return;
      line[t.getAttribute('data-k')] = t.value;
      changed(false);
      var tot = $('.l-total', row); if (tot) tot.textContent = C.fmtMoney(C.lineTotal(line), line.currency) + C.RECURRENCE_SUFFIX[line.recurrence || 'once'];
    } else if (t.hasAttribute('data-s')) {
      var i = Number(t.closest('.step').getAttribute('data-i'));
      current.payment.steps[i][t.getAttribute('data-s')] = t.getAttribute('data-s') === 'percent' ? t.value : t.value;
      changed(false); renderStepsSummary();
    }
  }

  function updateBadge() {
    var b = $('#st-badge'); if (!b) return;
    b.className = 'status s-' + statusKey(current); b.textContent = statusLabel(current);
    var inv = $('#b-inv'); if (inv) { inv.disabled = current.status !== 'accepte'; }
    var hint = $('#f-validityDays'); if (hint && hint.nextElementSibling) hint.nextElementSibling.textContent = 'Valable jusqu\'au ' + C.fmtDate(C.validUntil(current));
  }

  function changed(rebuild) {
    current.updatedAt = new Date().toISOString();
    if (rebuild) { renderLines(); renderSteps(); }
    refresh();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      persist();
      var s = $('#saved'); if (s) s.textContent = storageOk ? 'Enregistré à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Non enregistré : stockage indisponible';
    }, 350);
  }

  function opt(list, v) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); }

  function renderLines() {
    var box = $('#lines');
    if (!current.lines.length) { box.innerHTML = '<p class="muted empty-lines">Aucune prestation. Choisissez une prestation du catalogue ou ajoutez une ligne personnalisée.</p>'; return; }
    box.innerHTML = current.lines.map(function (l, i) {
      var p = 'l' + i + '-';
      return '<div class="line' + (l.kind === 'fee' ? ' is-fee' : '') + (!(C.num(l.unitPrice) > 0) ? ' needs-price' : '') + '" data-id="' + l.id + '">' +
        '<div class="line-top"><span class="line-kind">' + (l.kind === 'fee' ? 'Frais annexe' : (l.recurrence !== 'once' ? 'Récurrent' : 'Prestation')) + '</span>' +
        '<div class="line-tools"><button type="button" class="icon" data-move="-1" aria-label="Monter la ligne"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="icon" data-move="1" aria-label="Descendre la ligne"' + (i === current.lines.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="icon danger" data-remove aria-label="Supprimer la ligne">✕</button></div></div>' +
        '<div class="grid">' +
        '<div class="field wide"><label for="' + p + 'label">Désignation</label><input id="' + p + 'label" data-k="label" value="' + esc(l.label) + '"></div>' +
        '<div class="field wide"><label for="' + p + 'desc">Description détaillée <span class="opt">facultatif</span></label><textarea id="' + p + 'desc" data-k="desc" rows="2">' + esc(l.desc) + '</textarea></div>' +
        '<div class="field"><label for="' + p + 'qty">Quantité</label><input id="' + p + 'qty" data-k="qty" type="number" inputmode="decimal" min="0" step="any" value="' + esc(l.qty) + '"></div>' +
        '<div class="field"><label for="' + p + 'pu">Prix unitaire</label><input id="' + p + 'pu" data-k="unitPrice" type="number" inputmode="decimal" min="0" step="any" value="' + esc(l.unitPrice) + '"' + (!(C.num(l.unitPrice) > 0) ? ' placeholder="À renseigner"' : '') + '></div>' +
        '<div class="field"><label for="' + p + 'cur">Devise</label><select id="' + p + 'cur" data-k="currency">' + opt([['XOF', 'FCFA'], ['USD', 'USD']], l.currency) + '</select></div>' +
        '<div class="field"><label for="' + p + 'rec">Périodicité</label><select id="' + p + 'rec" data-k="recurrence">' + opt([['once', 'Ponctuel'], ['month', 'Mensuel'], ['year', 'Annuel']], l.recurrence) + '</select></div>' +
        '<div class="field"><label for="' + p + 'kind">Catégorie</label><select id="' + p + 'kind" data-k="kind">' + opt([['service', 'Prestation'], ['fee', 'Frais annexe']], l.kind) + '</select></div>' +
        '<div class="field private-field"><label for="' + p + 'cost">Coût interne unitaire <span class="opt">privé</span></label><input id="' + p + 'cost" data-k="internalCost" type="number" inputmode="decimal" min="0" step="any" value="' + esc(l.internalCost) + '"></div>' +
        '</div><p class="line-total">Montant&nbsp;: <strong class="l-total">' + esc(C.fmtMoney(C.lineTotal(l), l.currency) + C.RECURRENCE_SUFFIX[l.recurrence || 'once']) + '</strong></p></div>';
    }).join('');
    $$('.line', box).forEach(function (row) {
      var id = row.getAttribute('data-id');
      $$('[data-move]', row).forEach(function (b) { b.addEventListener('click', function () {
        var i = current.lines.findIndex(function (l) { return l.id === id; }), j = i + Number(b.getAttribute('data-move'));
        if (j < 0 || j >= current.lines.length) return;
        var tmp = current.lines[i]; current.lines[i] = current.lines[j]; current.lines[j] = tmp; changed(true);
      }); });
      $('[data-remove]', row).addEventListener('click', function () {
        current.lines = current.lines.filter(function (l) { return l.id !== id; }); changed(true);
      });
      /* changement de périodicité, de devise ou de catégorie : la carte change d'apparence */
      $$('select[data-k]', row).forEach(function (s) { s.addEventListener('change', function () { setTimeout(function () { renderLines(); }, 0); }); });
      $('[data-k="unitPrice"]', row).addEventListener('change', function () { row.classList.toggle('needs-price', !(C.num(this.value) > 0)); });
    });
  }

  function renderSteps() {
    var box = $('#steps');
    if (current.payment.mode !== 'custom') { box.innerHTML = '<div id="steps-sum"></div>'; renderStepsSummary(); return; }
    box.innerHTML = current.payment.steps.map(function (s, i) {
      return '<div class="step" data-i="' + i + '"><div class="grid">' +
        '<div class="field wide"><label for="s' + i + 'l">Libellé de l\'échéance ' + (i + 1) + '</label><input id="s' + i + 'l" data-s="label" value="' + esc(s.label) + '"></div>' +
        '<div class="field"><label for="s' + i + 'p">Pourcentage</label><input id="s' + i + 'p" data-s="percent" type="number" inputmode="decimal" min="0" max="100" step="any" value="' + esc(s.percent) + '"></div>' +
        '<div class="field"><label for="s' + i + 'd">Date prévue <span class="opt">facultatif</span></label><input id="s' + i + 'd" data-s="date" type="date" value="' + esc(s.date) + '"></div>' +
        '</div><button type="button" class="btn btn-small btn-danger" data-rm-step>Retirer</button></div>';
    }).join('') + '<button type="button" class="btn btn-small" id="b-add-step">+ Ajouter une échéance</button><div id="steps-sum"></div>';
    $$('[data-rm-step]', box).forEach(function (b) { b.addEventListener('click', function () {
      current.payment.steps.splice(Number(b.closest('.step').getAttribute('data-i')), 1); changed(true);
    }); });
    $('#b-add-step').addEventListener('click', function () { current.payment.steps.push({ label: '', percent: '', date: '' }); changed(true); });
    renderStepsSummary();
  }

  function renderStepsSummary() {
    var t = totalsOf(current), s = C.schedule(t.oneTimeXof, current.payment);
    var box = $('#steps-sum'); if (!box) return;
    box.innerHTML = '<table class="mini"><tbody>' + s.steps.map(function (x) {
      return '<tr><td>' + esc(x.label) + '</td><td class="num">' + esc(C.fmtQty(x.percent)) + '&nbsp;%</td><td class="num">' + esc(C.fmtXof(x.amount)) + '</td><td>' + esc(x.date ? C.fmtDate(x.date) : '') + '</td></tr>';
    }).join('') + '</tbody></table>' + (s.valid ? '' : '<p class="warn">Le total des pourcentages fait ' + esc(C.fmtQty(s.percentTotal)) + ' % au lieu de 100 %. Corrigez l\'échéancier avant d\'envoyer le document.</p>');
  }

  function renderInternal() {
    var t = totalsOf(current), box = $('#internal'); if (!box) return;
    var w = t.warnings.map(function (x) { return '<li>' + esc(x.message) + '</li>'; }).join('');
    box.innerHTML = '<dl class="internal">' +
      '<div><dt>Total ponctuel</dt><dd>' + esc(C.fmtXof(t.oneTimeXof)) + '</dd></div>' +
      '<div><dt>Coûts internes</dt><dd>' + (t.internalCostXof ? esc(C.fmtXof(t.internalCostXof)) : '—') + '</dd></div>' +
      '<div><dt>Marge estimée</dt><dd>' + (t.marginXof !== null ? esc(C.fmtXof(t.marginXof)) + (t.oneTimeXof ? ' (' + Math.round(t.marginXof / t.oneTimeXof * 100) + ' %)' : '') : '—') + '</dd></div>' +
      '</dl>' + (w ? '<ul class="warn-list">' + w + '</ul>' : '');
  }

  function refresh() { $('#preview').innerHTML = renderPaper(D.publicView(current, store.settings)); renderInternal(); renderStepsSummary(); }

  /* ---------- Aperçu (même contenu que le PDF) ---------- */
  function renderPaper(v) {
    var C2 = C;
    return '<header class="p-head"><div class="p-brand"><span class="p-mark">SA</span><div><strong>SULTAN AGENCY</strong><small>' + esc(v.agency.tagline) + '</small><em>' + esc(v.agency.slogan) + '</em></div></div>' +
      '<div class="p-title"><h2>' + esc(v.title) + '</h2><p class="p-num">' + esc(v.number) + '</p>' +
      v.dates.map(function (d) { return '<p><span>' + esc(d.label) + ' :</span> ' + esc(d.value) + '</p>'; }).join('') +
      (v.reference ? '<p>' + esc(v.reference) + '</p>' : '') + '</div></header>' +
      '<div class="p-parties"><div><h3>Émetteur</h3><strong>' + esc(v.agency.name) + '</strong>' + v.agency.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>' +
      '<div><h3>' + (v.isInvoice ? 'Facturé à' : 'Client') + '</h3><strong>' + esc(v.client.name) + '</strong>' + v.client.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div></div>' +
      (v.subject || v.description ? '<div class="p-object"><h3>Objet</h3>' + (v.subject ? '<strong>' + esc(v.subject) + '</strong>' : '') + (v.description ? '<p>' + nl2br(v.description) + '</p>' : '') + '</div>' : '') +
      (v.sections.length ? '<table class="p-table"><thead><tr><th>Désignation</th><th class="c">Qté</th><th class="r">Prix unitaire</th><th class="r">Montant</th></tr></thead><tbody>' +
        v.sections.map(function (s) {
          return '<tr class="p-sec"><th colspan="4">' + esc(s.title) + '</th></tr>' + s.rows.map(function (r) {
            return '<tr><td><strong>' + esc(r.label) + '</strong>' + (r.desc ? '<span>' + nl2br(r.desc) + '</span>' : '') + '</td><td class="c">' + esc(r.qty) + '</td><td class="r">' + esc(r.unit) + '</td><td class="r"><strong>' + esc(r.total) + '</strong></td></tr>';
          }).join('');
        }).join('') + '</tbody></table>' : '<p class="p-empty">Ajoutez des prestations pour voir le détail.</p>') +
      '<div class="p-totals">' + v.totals.map(function (t) { return '<p><span>' + esc(t.label) + '</span><b>' + esc(t.value) + '</b></p>'; }).join('') +
      '<p class="p-grand"><span>' + esc(v.grand.label) + '</span><b>' + esc(v.grand.value) + '</b></p>' +
      (v.isInvoice && v.paid ? '<p><span>Déjà réglé</span><b>-' + esc(v.paidLabel) + '</b></p><p class="p-rest"><span>Reste à payer</span><b>' + esc(v.remainingLabel) + '</b></p>' : '') + '</div>' +
      (v.recurring.length ? '<div class="p-rec"><h3>Abonnements — facturés séparément selon leur périodicité</h3>' + v.recurring.map(function (r) { return '<p><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></p>'; }).join('') + '</div>' : '') +
      (v.rateNote ? '<p class="p-small">' + esc(v.rateNote) + '</p>' : '') +
      '<div class="p-block"><h3>Modalités de paiement</h3><table class="p-sched"><thead><tr><th>Échéance</th><th class="r">%</th><th class="r">Montant</th><th class="r">Date prévue</th></tr></thead><tbody>' +
      v.schedule.steps.map(function (s) { return '<tr><td>' + esc(s.label) + '</td><td class="r">' + esc(C2.fmtQty(s.percent)) + '&nbsp;%</td><td class="r"><b>' + esc(C2.fmtXof(s.amount)) + '</b></td><td class="r">' + esc(s.date ? C2.fmtDate(s.date) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      (v.paymentMethods ? '<div class="p-block"><h3>Moyens de paiement</h3><p>' + nl2br(v.paymentMethods) + '</p></div>' : '') +
      (v.clientNotes ? '<div class="p-block"><h3>Remarques</h3><p>' + nl2br(v.clientNotes) + '</p></div>' : '') +
      (v.conditions.length ? '<div class="p-block"><h3>Conditions commerciales</h3><ul class="p-cond">' + v.conditions.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' : '') +
      (v.signature ? '<div class="p-sign"><div><h3>Pour Sultan Agency</h3><p>Date et signature</p></div><div><h3>Bon pour accord — le client</h3><p>Nom, date, signature et cachet, précédés de la mention « Bon pour accord »</p></div></div>' : '') +
      '<footer class="p-foot">' + esc(v.footer) + '</footer>';
  }

  function downloadPdf() {
    var v = D.publicView(current, store.settings);
    var t = totalsOf(current), s = C.schedule(t.oneTimeXof, current.payment);
    var problems = [];
    if (!current.lines.length) problems.push('aucune prestation');
    t.warnings.filter(function (w) { return w.type === 'prix' || w.type === 'taux'; }).forEach(function (w) { problems.push(w.message.toLowerCase()); });
    if (!s.valid) problems.push('l\'échéancier ne fait pas 100 %');
    if (problems.length && !confirm('À vérifier avant l\'envoi :\n- ' + problems.join('\n- ') + '\n\nTélécharger quand même ?')) return;
    try {
      var pdf = window.SAPdf.build(v);
      pdf.save(window.SAPdf.fileName(v, current.client.company || current.client.contact));
      if (current.type === 'devis' && current.status === 'brouillon') toast('PDF téléchargé. Passez le statut à « Envoyé » une fois transmis au client.');
      else toast('PDF téléchargé');
    } catch (e) {
      alert('Le PDF n\'a pas pu être créé : ' + e.message + '\nUtilisez « Imprimer » puis « Enregistrer en PDF » en attendant.');
    }
  }
  window.SAStudio = { buildCurrentPdf: function () { return window.SAPdf.build(D.publicView(current, store.settings)); }, store: function () { return store; } };

  /* ---------- Réglages ---------- */
  function renderSettings() {
    current = null;
    var s = store.settings, a = s.agency;
    var f = function (label, key, opts) {
      opts = opts || {}; var v = key.split('.').reduce(function (o, k) { return o[k]; }, s);
      var id = 'set-' + key.replace('.', '-');
      var input = opts.type === 'textarea' ? '<textarea id="' + id + '" data-set="' + key + '" rows="' + (opts.rows || 3) + '">' + esc(v) + '</textarea>'
        : '<input id="' + id + '" data-set="' + key + '" type="' + (opts.type || 'text') + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + ' value="' + esc(v) + '">';
      return '<div class="field' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + (opts.optional ? ' <span class="opt">facultatif</span>' : '') + '</label>' + input + (opts.hint ? '<small>' + esc(opts.hint) + '</small>' : '') + '</div>';
    };
    app.innerHTML = '<section class="page narrow">' +
      '<div class="page-head"><div><p class="eyebrow">Quote Studio</p><h1>Réglages</h1></div></div>' +
      '<form class="ed-form" id="set-form" novalidate>' +
      '<fieldset><legend>Taux de change</legend><div class="grid">' +
      f('Taux USD → FCFA (1 USD = … FCFA)', 'usdRate', { type: 'number', inputmode: 'decimal', optional: true, ph: 'Non renseigné', hint: 'Aucun taux n\'est inventé : sans taux, les montants en USD restent affichés en USD. Le taux saisi est indiqué sur chaque document.' }) +
      f('Validité par défaut des devis (jours)', 'validityDays', { type: 'number', inputmode: 'numeric' }) +
      '</div></fieldset>' +
      '<fieldset><legend>Coordonnées de l\'agence (affichées sur les documents)</legend><div class="grid">' +
      f('Nom', 'agency.name') + f('Activité', 'agency.tagline') + f('Signature', 'agency.slogan') + f('Adresse', 'agency.address') +
      f('Téléphone / WhatsApp', 'agency.phone') + f('E-mail', 'agency.email', { type: 'email' }) + f('Site web', 'agency.website') +
      f('NINEA de l\'agence', 'agency.ninea', { optional: true }) + f('RCCM', 'agency.rccm', { optional: true }) +
      f('Moyens de paiement', 'agency.paymentMethods', { type: 'textarea', wide: true, optional: true, hint: 'Par exemple Wave, Orange Money, virement : renseignez uniquement les moyens réellement acceptés.' }) +
      '</div></fieldset>' +
      '<fieldset><legend>Conditions commerciales par défaut</legend><div class="grid">' +
      f('Une condition par ligne', 'conditions', { type: 'textarea', rows: 8, wide: true, hint: 'Utilisées pour les nouveaux documents. Les documents existants gardent leurs propres conditions.' }) +
      '</div><button type="button" class="btn btn-small" id="b-reset-cond">Rétablir les conditions officielles</button></fieldset>' +
      '<fieldset><legend>Sauvegarde</legend>' +
      '<p class="muted">Les devis sont enregistrés uniquement dans ce navigateur, sur cet appareil. Exportez régulièrement une sauvegarde (fichier .json) et conservez-la en lieu sûr : elle contient les coordonnées de vos clients.</p>' +
      '<div class="add-more"><button type="button" class="btn btn-ink" id="b-export">Exporter une sauvegarde</button>' +
      '<label class="btn" for="imp">Importer une sauvegarde</label><input type="file" id="imp" accept="application/json,.json" class="sr">' +
      '<button type="button" class="btn btn-danger" id="b-wipe">Tout effacer sur cet appareil</button></div>' +
      '<p class="muted">' + store.docs.length + ' document(s) enregistré(s).</p>' +
      '</fieldset></form></section>';
    $('#set-form').addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-set'); if (!k) return;
      var v = e.target.value;
      if (k === 'validityDays') v = Math.max(1, parseInt(v, 10) || 15);
      var parts = k.split('.'); if (parts.length === 2) s[parts[0]][parts[1]] = v; else s[k] = v;
      persist();
    });
    $('#b-reset-cond').addEventListener('click', function () { s.conditions = D.DEFAULT_CONDITIONS; persist(); renderSettings(); toast('Conditions officielles rétablies'); });
    $('#b-export').addEventListener('click', exportBackup);
    $('#imp').addEventListener('change', importBackup);
    $('#b-wipe').addEventListener('click', function () {
      if (!confirm('Effacer tous les devis, factures et réglages de cet appareil ? Pensez à exporter une sauvegarde avant.')) return;
      store = { version: 1, settings: D.defaultSettings(), docs: [], counters: {} }; persist(); renderSettings(); toast('Données effacées');
    });
    app.focus();
  }

  function exportBackup() {
    var blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'quote-studio-sauvegarde-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('Sauvegarde exportée');
  }
  function importBackup(e) {
    var file = e.target.files && e.target.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        if (!data || !Array.isArray(data.docs) || !data.settings) throw new Error('fichier non reconnu');
        if (!confirm('Remplacer les données de cet appareil par cette sauvegarde (' + data.docs.length + ' document(s)) ?')) return;
        data.settings = Object.assign(D.defaultSettings(), data.settings);
        data.settings.agency = Object.assign(D.defaultSettings().agency, data.settings.agency || {});
        data.counters = data.counters || {};
        store = data; persist(); renderSettings(); toast('Sauvegarde importée');
      } catch (err) { alert('Import impossible : ' + err.message + '.'); }
    };
    r.readAsText(file);
  }

  route();
})();
