(function () {
  'use strict';

  var CFG = window.SULTAN_CONFIG || {};
  var STATUS = { nouveau: 'Nouveau', en_cours: 'En cours', termine: 'Terminé', annule: 'Annulé' };
  var MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  var sb = null;
  var orders = [];
  var selectedId = null;
  var editingId = null;
  var userId = null;
  var filters = { status: '', period: 'all', q: '' };
  var loadError = '';
  var leads = [];
  var selectedLeadId = null;
  var pendingLead = null;
  var lastOwnOrderId = null;
  var leadError = '';
  var lf = { status: '', service: '', period: 'all', q: '' };
  var channel = null;
  var BASE_TITLE = 'Administration | Sultan Agency';
  var LSTATUS = { nouveau: 'Nouveau', a_contacter: 'À contacter', devis_envoye: 'Devis envoyé', en_negociation: 'En négociation', accepte: 'Accepté', refuse: 'Refusé', termine: 'Terminé' };

  function $(s) { return document.querySelector(s); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function money(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0FCFA'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDate(s) { var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  var toastTimer;
  function toast(text, isErr) {
    var t = $('#toast');
    t.textContent = text;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }

  function show(view) {
    ['login', 'reset', 'app'].forEach(function (v) { $('#view-' + v).hidden = (v !== view); });
  }

  /* ---------- Authentification ---------- */
  function showLogin(message) {
    if (channel && sb) { sb.removeChannel(channel); channel = null; }
    userId = null;
    orders = [];
    show('login');
    $('#login-msg').textContent = message || '';
  }

  function enter(session) {
    if (userId === session.user.id) return;
    userId = session.user.id;
    sb.from('profiles').select('role').eq('id', session.user.id).single().then(function (res) {
      if (res.error || !res.data || res.data.role !== 'super_admin') {
        sb.auth.signOut();
        showLogin('Accès refusé. Ce compte n\'est pas autorisé.');
        return;
      }
      $('#who').textContent = session.user.email || '';
      show('app');
      loadOrders();
      loadLeads();
      loadExpenses();
      loadCrud('pricing');
      loadCrud('projects');
      loadCrud('gallery');
      subscribeLeads();
      initNotifButton();
    });
  }

  function initAuth() {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase) {
      show('login');
      $('#login-msg').textContent = 'Configuration manquante : renseignez admin-config.js.';
      $('#login-btn').disabled = true;
      return false;
    }
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    sb.auth.onAuthStateChange(function (event, session) {
      setTimeout(function () {
        if (event === 'PASSWORD_RECOVERY') { show('reset'); return; }
        if (session) enter(session);
        else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') showLogin($('#login-msg').textContent);
      }, 0);
    });
    return true;
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#l-email').value.trim();
    var pass = $('#l-pass').value;
    var msg = $('#login-msg');
    if (!email || !pass) { msg.textContent = 'Renseignez l\'email et le mot de passe.'; return; }
    msg.textContent = '';
    var btn = $('#login-btn');
    btn.disabled = true;
    sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
      btn.disabled = false;
      if (res.error) msg.textContent = 'Email ou mot de passe incorrect.';
      $('#l-pass').value = '';
    });
  });

  $('#eye').addEventListener('click', function () {
    var inp = $('#l-pass');
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    this.setAttribute('aria-pressed', String(show));
    this.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  $('#forgot').addEventListener('click', function () {
    var email = $('#l-email').value.trim();
    var msg = $('#login-msg');
    if (!email) { msg.textContent = 'Saisissez votre email, puis cliquez sur « Mot de passe oublié ».'; return; }
    sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] }).then(function (res) {
      if (res.error) { msg.textContent = 'Envoi impossible. Réessayez dans quelques minutes.'; return; }
      msg.style.color = '#7fcf9a';
      msg.textContent = 'Si ce compte existe, un email de réinitialisation vient d\'être envoyé.';
    });
  });

  $('#reset-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = $('#r-pass').value;
    var msg = $('#reset-msg');
    if (p.length < 10) { msg.textContent = 'Au moins 10 caractères.'; return; }
    sb.auth.updateUser({ password: p }).then(function (res) {
      if (res.error) { msg.textContent = 'Mot de passe refusé : ' + res.error.message; return; }
      toast('Mot de passe modifié');
      sb.auth.getSession().then(function (r) { userId = null; if (r.data && r.data.session) enter(r.data.session); else showLogin(); });
    });
  });

  $('#logout').addEventListener('click', function () {
    sb.auth.signOut().then(function () { showLogin(''); });
  });

  /* ---------- Données ---------- */
  function loadOrders(silent) {
    loadError = '';
    if (silent !== true) {
      $('#list').textContent = '';
      $('#list').appendChild(el('p', 'state', 'Chargement...'));
    }
    sb.from('orders').select('*')
      .order('ordered_on', { ascending: false })
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { loadError = 'Impossible de charger les projets. Vérifiez votre connexion et réessayez.'; orders = []; }
        else orders = res.data || [];
        render();
      });
  }

  function filtered() {
    var cut = null;
    if (filters.period !== 'all') {
      var d = new Date();
      if (filters.period === 'year') cut = d.getFullYear() + '-01-01';
      else { d.setDate(d.getDate() - Number(filters.period)); cut = isoDate(d); }
    }
    var q = filters.q.trim().toLowerCase();
    return orders.filter(function (o) {
      if (filters.status && o.status !== filters.status) return false;
      if (cut && o.ordered_on < cut) return false;
      if (q && (o.client_name + ' ' + o.project_title).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  /* ---------- Rendu ---------- */
  function renderKpis(list) {
    var active = list.filter(function (o) { return o.status !== 'annule'; });
    var total = 0, paid = 0;
    active.forEach(function (o) { total += Number(o.amount); paid += Number(o.paid); });
    $('#k-total').textContent = money(total);
    $('#k-paid').textContent = money(paid);
    $('#k-rest').textContent = money(total - paid);
    $('#k-count').textContent = String(active.length);
  }

  function renderChart(list) {
    var box = $('#chart');
    box.textContent = '';
    var byMonth = {};
    list.forEach(function (o) {
      if (o.status === 'annule') return;
      var k = o.ordered_on.slice(0, 7);
      byMonth[k] = (byMonth[k] || 0) + Number(o.amount);
    });
    var keys = Object.keys(byMonth).sort().slice(-12);
    if (!keys.length) { box.appendChild(el('p', 'mute', 'Aucune donnée pour cette sélection.')); return; }
    var max = Math.max.apply(null, keys.map(function (k) { return byMonth[k]; }));
    var W = 640, H = 200, padB = 30, padT = 24;
    var slot = W / keys.length, bw = Math.min(70, slot * 0.55);
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Total généré par mois');
    keys.forEach(function (k, i) {
      var v = byMonth[k];
      var h = max ? Math.max(3, (v / max) * (H - padB - padT)) : 3;
      var x = i * slot + (slot - bw) / 2;
      var y = H - padB - h;
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', bw); r.setAttribute('height', h);
      r.setAttribute('fill', '#c9a84c');
      var t = document.createElementNS(NS, 'title'); t.textContent = money(v); r.appendChild(t);
      svg.appendChild(r);
      var val = document.createElementNS(NS, 'text');
      val.setAttribute('x', x + bw / 2); val.setAttribute('y', y - 6);
      val.setAttribute('text-anchor', 'middle'); val.setAttribute('fill', '#faf9f5'); val.setAttribute('font-size', '13');
      val.textContent = v >= 1000000 ? (v / 1000000).toFixed(1).replace('.0', '') + ' M' : Math.round(v / 1000) + ' k';
      svg.appendChild(val);
      var lab = document.createElementNS(NS, 'text');
      lab.setAttribute('x', x + bw / 2); lab.setAttribute('y', H - 8);
      lab.setAttribute('text-anchor', 'middle'); lab.setAttribute('fill', '#a6a69e'); lab.setAttribute('font-size', '13');
      lab.textContent = MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4);
      svg.appendChild(lab);
    });
    box.appendChild(svg);
  }

  function renderList(list) {
    var root = $('#list');
    root.textContent = '';
    if (loadError) {
      root.appendChild(el('p', 'state', loadError));
      var retry = el('button', 'btn btn-ghost btn-sm', 'Réessayer');
      retry.type = 'button'; retry.style.margin = '0 18px 18px';
      retry.addEventListener('click', function () { loadOrders(); });
      root.appendChild(retry);
      return;
    }
    if (!list.length) {
      root.appendChild(el('p', 'state', orders.length ? 'Aucun projet ne correspond à ces filtres.' : 'Aucun projet pour le moment. Ajoutez le premier.'));
      return;
    }
    list.forEach(function (o) {
      var b = el('button', 'order');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(o.id === selectedId));
      b.appendChild(el('b', null, o.client_name));
      b.appendChild(el('span', 'amt', money(o.amount)));
      var sub = el('small', null, o.project_title);
      b.appendChild(sub);
      var badge = el('span', 'badge ' + o.status, STATUS[o.status] || o.status);
      badge.style.justifySelf = 'end';
      b.appendChild(badge);
      if (o.status !== 'annule') b.appendChild(progress(o, 'bar'));
      b.addEventListener('click', function () { selectedId = o.id; render(); });
      root.appendChild(b);
    });
  }

  function renderDetail(list) {
    var p = $('#detail-panel');
    p.textContent = '';
    var o = orders.filter(function (x) { return x.id === selectedId; })[0];
    if (!o) { p.appendChild(el('p', 'state', 'Sélectionnez un projet pour voir son détail.')); return; }
    var box = el('div', 'detail');
    box.appendChild(el('h2', null, o.client_name));
    box.appendChild(el('span', 'badge ' + o.status, STATUS[o.status] || o.status));
    box.appendChild(el('p', 'mute', o.project_title));
    var dl = el('dl');
    function row(k, v) { var d = el('div'); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', null, v)); dl.appendChild(d); }
    row('Type de site', o.service || 'Non précisé');
    row('Date', fmtDate(o.ordered_on));
    row('Budget', money(o.amount));
    row('Encaissé', money(o.paid));
    row('Reste à encaisser', money(Number(o.amount) - Number(o.paid)));
    box.appendChild(dl);
    if (o.status !== 'annule') { box.appendChild(el('small', 'mute', 'Payé à ' + pctOf(o) + ' %')); box.appendChild(progress(o)); }
    if (o.notes) box.appendChild(el('p', 'notes', o.notes));
    var act = el('div', 'actions');
    var ed = el('button', 'btn btn-primary btn-sm', 'Modifier'); ed.type = 'button';
    ed.addEventListener('click', function () { openForm(o); });
    var del = el('button', 'btn btn-danger btn-sm', 'Supprimer'); del.type = 'button';
    del.addEventListener('click', function () { removeOrder(o); });
    var inv = el('button', 'btn btn-ghost btn-sm', 'Voir la facture'); inv.type = 'button';
    inv.addEventListener('click', function () { openInvoice(o); });
    act.appendChild(ed); if (o.status !== 'annule') act.appendChild(inv); act.appendChild(del);
    box.appendChild(act);
    p.appendChild(box);
  }

  function render() {
    var list = filtered();
    if (!list.some(function (o) { return o.id === selectedId; })) selectedId = list.length ? list[0].id : null;
    renderKpis(list);
    renderChart(list);
    renderList(list);
    renderDetail(list);
    renderHome();
    renderInvoices();
    renderBudget();
    renderExpenses();
  }

  /* ---------- Formulaire ---------- */
  var dlg = $('#dlg');
  function openForm(o, lead) {
    editingId = o ? o.id : null;
    pendingLead = lead || null;
    $('#dlg-title').textContent = o ? 'Modifier le projet' : 'Nouveau projet';
    $('#o-client').value = o ? o.client_name : '';
    $('#o-project').value = o ? o.project_title : '';
    var svc = $('#o-service');
    svc.value = o && o.service ? o.service : 'Site professionnel';
    if (svc.value === '' ) svc.value = 'Autre';
    $('#o-status').value = o ? o.status : 'nouveau';
    $('#o-amount').value = o ? o.amount : '';
    $('#o-paid').value = o ? o.paid : 0;
    $('#o-date').value = o ? o.ordered_on : isoDate(new Date());
    $('#o-notes').value = o && o.notes ? o.notes : '';
    if (lead) {
      $('#dlg-title').textContent = 'Transformer en projet';
      $('#o-client').value = lead.name;
      var opts = Array.prototype.map.call($('#o-service').options, function (x) { return x.value; });
      $('#o-service').value = opts.indexOf(lead.service) !== -1 ? lead.service : 'Autre';
      $('#o-project').value = (lead.service && opts.indexOf(lead.service) !== -1 ? lead.service + ' pour ' : 'Projet pour ') + lead.name;
      $('#o-status').value = 'en_cours';
      $('#o-notes').value = (lead.message || '') + (lead.budget ? '\nBudget indicatif : ' + lead.budget : '') + (lead.deadline ? '\nDélai souhaité : ' + lead.deadline : '');
    }
    $('#order-msg').textContent = '';
    dlg.showModal();
    $('#o-client').focus();
  }
  $('#add').addEventListener('click', function () { openForm(null); });
  $('#dlg-cancel').addEventListener('click', function () { dlg.close(); });

  $('#order-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('#order-msg');
    var rec = {
      client_name: $('#o-client').value.trim(),
      project_title: $('#o-project').value.trim(),
      service: $('#o-service').value,
      status: $('#o-status').value,
      amount: parseInt($('#o-amount').value, 10),
      paid: parseInt($('#o-paid').value || '0', 10),
      ordered_on: $('#o-date').value,
      notes: $('#o-notes').value.trim() || null
    };
    if (!rec.client_name) { msg.textContent = 'Indiquez le client.'; return; }
    if (!rec.project_title) { msg.textContent = 'Indiquez le projet.'; return; }
    if (isNaN(rec.amount) || rec.amount < 0) { msg.textContent = 'Le montant doit être un nombre positif.'; return; }
    if (isNaN(rec.paid) || rec.paid < 0) { msg.textContent = 'Le montant encaissé doit être un nombre positif.'; return; }
    if (rec.paid > rec.amount) { msg.textContent = 'Le montant encaissé ne peut pas dépasser le budget du projet.'; return; }
    if (!rec.ordered_on) { msg.textContent = 'Indiquez la date.'; return; }
    msg.textContent = '';
    var save = $('#dlg-save');
    save.disabled = true;
    var q = editingId
      ? sb.from('orders').update(rec).eq('id', editingId).select().single()
      : sb.from('orders').insert(rec).select().single();
    q.then(function (res) {
      save.disabled = false;
      if (res.error) { msg.textContent = 'Enregistrement impossible : ' + res.error.message; return; }
      dlg.close();
      toast(editingId ? 'Projet modifié' : 'Projet ajouté');
      selectedId = res.data.id;
      lastOwnOrderId = res.data.id;
      var from = pendingLead;
      pendingLead = null;
      if (from && !editingId) {
        sb.from('leads').update({ status: 'accepte', order_id: res.data.id }).eq('id', from.id).then(function () { loadLeads(); });
      }
      loadOrders();
    });
  });

  function removeOrder(o) {
    if (!window.confirm('Supprimer le projet « ' + o.client_name + ' » (' + money(o.amount) + ') ? Cette action est définitive.')) return;
    sb.from('orders').delete().eq('id', o.id).then(function (res) {
      if (res.error) { toast('Suppression impossible', true); return; }
      toast('Projet supprimé');
      selectedId = null;
      loadOrders();
    });
  }

  /* ---------- Filtres ---------- */
  $('#f-status').addEventListener('change', function (e) { filters.status = e.target.value; render(); });
  $('#f-period').addEventListener('change', function (e) { filters.period = e.target.value; render(); });
  $('#f-q').addEventListener('input', function (e) { filters.q = e.target.value; render(); });

  /* ---------- Demandes clients ---------- */
  var leadNotes = [];
  var notesFor = null;

  function loadLeads() {
    leadError = '';
    sb.from('leads').select('*').order('created_at', { ascending: false }).then(function (res) {
      if (res.error) { leadError = 'Impossible de charger les demandes. Vérifiez que le SQL « demandes clients » a été exécuté.'; leads = []; }
      else leads = res.data || [];
      renderLeads();
    });
  }

  function leadsFiltered() {
    var q = lf.q.trim().toLowerCase();
    var cut = null;
    if (lf.period !== 'all') {
      var d = new Date();
      d.setDate(d.getDate() - Number(lf.period));
      cut = d.toISOString();
    }
    return leads.filter(function (l) {
      if (lf.status && l.status !== lf.status) return false;
      if (lf.service && l.service !== lf.service) return false;
      if (cut && l.created_at < cut) return false;
      if (q) {
        var hay = [l.name, l.company, l.phone, l.email, l.sector, l.message, l.service].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function phoneToWa(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.length === 9 && d.charAt(0) === '7') d = '221' + d;
    return d.length >= 10 ? d : null;
  }

  function fmtDateTime(iso) {
    var d = new Date(iso);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* Texte libre : liens http(s) cliquables, tout le reste en texte brut (aucun HTML interprété) */
  function richText(parent, text) {
    String(text || '').split(/(\s+)/).forEach(function (tok) {
      if (/^https?:\/\/\S+$/i.test(tok)) {
        var a = el('a', null, tok);
        a.href = tok; a.target = '_blank'; a.rel = 'noopener';
        a.style.color = 'var(--gold-2)';
        parent.appendChild(a);
      } else if (tok) { parent.appendChild(document.createTextNode(tok)); }
    });
  }

  function fillServiceFilter() {
    var sel = $('#lf-service');
    var keep = lf.service;
    var names = [];
    leads.forEach(function (l) { if (l.service && names.indexOf(l.service) === -1) names.push(l.service); });
    names.sort();
    sel.textContent = '';
    var all = el('option', null, 'Tous les services'); all.value = ''; sel.appendChild(all);
    names.forEach(function (n) { var o = el('option', null, n); o.value = n; sel.appendChild(o); });
    sel.value = names.indexOf(keep) !== -1 ? keep : '';
    lf.service = sel.value;
  }

  function loadNotes(leadId) {
    notesFor = leadId;
    sb.from('lead_notes').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).then(function (res) {
      if (notesFor !== leadId) return;
      leadNotes = res.error ? [] : (res.data || []);
      renderNotes(res.error ? 'Notes indisponibles : le SQL « demandes clients » n\'a pas été exécuté.' : '');
    });
  }

  function renderNotes(err) {
    var root = $('#lead-notes');
    if (!root) return;
    root.textContent = '';
    if (err) { root.appendChild(el('p', 'mute', err)); return; }
    if (!leadNotes.length) { root.appendChild(el('p', 'mute', 'Aucune note pour le moment.')); return; }
    leadNotes.forEach(function (n) {
      var row = el('div', 'note');
      row.appendChild(el('small', null, fmtDateTime(n.created_at)));
      row.appendChild(el('p', null, n.body));
      var del = el('button', 'link', 'Supprimer'); del.type = 'button';
      del.addEventListener('click', function () {
        if (!window.confirm('Supprimer cette note ?')) return;
        sb.from('lead_notes').delete().eq('id', n.id).then(function (res) {
          if (res.error) { toast('Suppression impossible', true); return; }
          loadNotes(notesFor);
        });
      });
      row.appendChild(del);
      root.appendChild(row);
    });
  }

  function renderLeads() {
    var news = leads.filter(function (l) { return l.status === 'nouveau'; }).length;
    var c = $('#leads-count');
    c.textContent = String(news);
    c.hidden = news === 0;
    document.title = (news ? '(' + news + ') ' : '') + BASE_TITLE;
    renderHomeLeads();
    fillServiceFilter();

    var list = leadsFiltered();
    if (!list.some(function (l) { return l.id === selectedLeadId; })) selectedLeadId = list.length ? list[0].id : null;

    var root = $('#llist');
    root.textContent = '';
    if (leadError) {
      root.appendChild(el('p', 'state', leadError));
      var retry = el('button', 'btn btn-ghost btn-sm', 'Réessayer');
      retry.type = 'button'; retry.style.margin = '0 18px 18px';
      retry.addEventListener('click', loadLeads);
      root.appendChild(retry);
    } else if (!list.length) {
      root.appendChild(el('p', 'state', leads.length ? 'Aucune demande ne correspond à ces filtres.' : 'Aucune demande pour le moment. Elles apparaîtront ici dès qu\'un visiteur remplira un formulaire.'));
    } else {
      list.forEach(function (l) {
        var b = el('button', 'order');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(l.id === selectedLeadId));
        b.appendChild(el('b', null, l.name));
        b.appendChild(el('span', 'amt', fmtDateTime(l.created_at).slice(0, 10)));
        b.appendChild(el('small', null, [l.company, l.service].filter(Boolean).join(', ') || 'Service non précisé'));
        var badge = el('span', 'badge ' + l.status, LSTATUS[l.status] || l.status);
        badge.style.justifySelf = 'end';
        b.appendChild(badge);
        b.addEventListener('click', function () { selectedLeadId = l.id; renderLeads(); });
        root.appendChild(b);
      });
    }

    var p = $('#ldetail');
    p.textContent = '';
    var l = leads.filter(function (x) { return x.id === selectedLeadId; })[0];
    if (!l) { notesFor = null; p.appendChild(el('p', 'state', 'Sélectionnez une demande pour voir son détail.')); return; }
    var box = el('div', 'detail');
    box.appendChild(el('h2', null, l.name));
    box.appendChild(el('p', 'mute', 'Reçue le ' + fmtDateTime(l.created_at)));
    var dl = el('dl');
    function row(k, v) { var d = el('div'); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', null, v)); dl.appendChild(d); }
    row('Téléphone', l.phone || 'Non renseigné');
    row('E-mail', l.email || 'Non renseigné');
    row('Entreprise', l.company || 'Non renseignée');
    row('Secteur d\'activité', l.sector || 'Non renseigné');
    row('Service demandé', l.service || 'Non précisé');
    row('Budget indicatif', l.budget || 'Non précisé');
    row('Délai souhaité', l.deadline || 'Non précisé');
    box.appendChild(dl);

    function block(label, text) {
      if (!text) return;
      var d = el('div', 'msgbox');
      d.appendChild(el('small', 'mute', label));
      var pEl = el('p'); pEl.style.marginTop = '4px';
      richText(pEl, text);
      d.appendChild(pEl);
      box.appendChild(d);
    }
    block('Description du projet', l.message);
    block('Fonctionnalités souhaitées', l.features);
    block('Liens existants', l.existing_links);
    block('Commentaires du client', l.comments);

    var sr = el('div', 'statusrow');
    var lab = el('label', null, 'Statut');
    lab.setAttribute('for', 'lead-status');
    var sel = el('select'); sel.id = 'lead-status';
    Object.keys(LSTATUS).forEach(function (k) { var o = el('option', null, LSTATUS[k]); o.value = k; sel.appendChild(o); });
    sel.value = l.status;
    sel.addEventListener('change', function () {
      sb.from('leads').update({ status: sel.value }).eq('id', l.id).then(function (res) {
        if (res.error) { toast('Changement impossible', true); sel.value = l.status; return; }
        toast('Statut mis à jour');
        loadLeads();
      });
    });
    sr.appendChild(lab); sr.appendChild(sel);
    box.appendChild(sr);

    var act = el('div', 'actions');
    var wa = phoneToWa(l.phone);
    if (wa) {
      var a = el('a', 'btn btn-ghost btn-sm', 'Écrire sur WhatsApp');
      a.href = 'https://wa.me/' + wa; a.target = '_blank'; a.rel = 'noopener';
      act.appendChild(a);
    }
    if (!l.order_id) {
      var conv = el('button', 'btn btn-primary btn-sm', 'Transformer en projet'); conv.type = 'button';
      conv.addEventListener('click', function () { openForm(null, l); });
      act.appendChild(conv);
    } else {
      act.appendChild(el('span', 'badge accepte', 'Déjà transformée en projet'));
    }
    var del = el('button', 'btn btn-danger btn-sm', 'Supprimer'); del.type = 'button';
    del.addEventListener('click', function () {
      if (!window.confirm('Supprimer la demande de « ' + l.name + ' » et ses notes ? Cette action est définitive.')) return;
      sb.from('leads').delete().eq('id', l.id).then(function (res) {
        if (res.error) { toast('Suppression impossible', true); return; }
        toast('Demande supprimée'); selectedLeadId = null; loadLeads();
      });
    });
    act.appendChild(del);
    box.appendChild(act);

    var nb = el('div', 'notes-box');
    nb.appendChild(el('h3', null, 'Notes internes'));
    var ta = el('textarea'); ta.id = 'note-input'; ta.maxLength = 2000; ta.placeholder = 'Exemple : rappeler jeudi, budget serré';
    ta.setAttribute('aria-label', 'Nouvelle note');
    var add = el('button', 'btn btn-ghost btn-sm', 'Ajouter la note'); add.type = 'button'; add.id = 'note-add';
    add.addEventListener('click', function () {
      var body = ta.value.trim();
      if (!body) { toast('Écrivez une note avant de l\'ajouter', true); return; }
      add.disabled = true;
      sb.from('lead_notes').insert({ lead_id: l.id, body: body }).then(function (res) {
        add.disabled = false;
        if (res.error) { toast('Note non enregistrée', true); return; }
        ta.value = '';
        toast('Note ajoutée');
        loadNotes(l.id);
      });
    });
    nb.appendChild(ta); nb.appendChild(add);
    var nl = el('div'); nl.id = 'lead-notes'; nb.appendChild(nl);
    box.appendChild(nb);
    p.appendChild(box);
    if (notesFor !== l.id) { leadNotes = []; renderNotes(''); loadNotes(l.id); } else { renderNotes(''); }
  }

  /* Export CSV (accents lisibles dans Excel, cellules neutralisées contre l'injection de formules) */
  function csvCell(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportLeadsCsv() {
    var list = leadsFiltered();
    if (!list.length) { toast('Aucune demande à exporter', true); return; }
    var cols = [
      ['Date', function (l) { return fmtDateTime(l.created_at); }],
      ['Nom', function (l) { return l.name; }],
      ['Entreprise', function (l) { return l.company; }],
      ['Téléphone', function (l) { return l.phone; }],
      ['E-mail', function (l) { return l.email; }],
      ['Secteur', function (l) { return l.sector; }],
      ['Service', function (l) { return l.service; }],
      ['Description', function (l) { return l.message; }],
      ['Fonctionnalités', function (l) { return l.features; }],
      ['Budget', function (l) { return l.budget; }],
      ['Délai', function (l) { return l.deadline; }],
      ['Liens existants', function (l) { return l.existing_links; }],
      ['Commentaires', function (l) { return l.comments; }],
      ['Statut', function (l) { return LSTATUS[l.status] || l.status; }]
    ];
    var out = [cols.map(function (c) { return csvCell(c[0]); }).join(';')];
    list.forEach(function (l) { out.push(cols.map(function (c) { return csvCell(c[1](l)); }).join(';')); });
    var blob = new Blob(['\uFEFF' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'demandes-clients-' + isoDate(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast(list.length + ' demande(s) exportée(s)');
  }

  /* Lien du formulaire public à partager */
  function formUrl() { return window.location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '') + 'demande.html'; }
  function copyFormLink() {
    var url = formUrl();
    function done() { toast('Lien copié : ' + url); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copiez ce lien :', url); });
    } else { window.prompt('Copiez ce lien :', url); }
  }
  function shareFormLink() {
    var text = 'Bonjour, voici le formulaire pour décrire votre projet à Sultan Agency : ' + formUrl();
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  $('#lf-status').addEventListener('change', function (e) { lf.status = e.target.value; renderLeads(); });
  $('#lf-service').addEventListener('change', function (e) { lf.service = e.target.value; renderLeads(); });
  $('#lf-period').addEventListener('change', function (e) { lf.period = e.target.value; renderLeads(); });
  $('#lf-q').addEventListener('input', function (e) { lf.q = e.target.value; renderLeads(); });
  $('#lead-export').addEventListener('click', exportLeadsCsv);
  $('#lead-copy').addEventListener('click', copyFormLink);
  $('#lead-share').addEventListener('click', shareFormLink);

  /* ---------- Tarifs et réalisations ---------- */
  var PSTATUS = { en_cours: 'Projet en cours', termine: 'Terminé' };
  var CRUD = {
    pricing: {
      label: 'tarif',
      fields: [
        { k: 'category', label: 'Catégorie', type: 'select', options: { site: 'Site web', media: 'Sultan Media (forfait)', artist: 'Sultan Artist Management', events: 'Sultan Events' }, def: 'site' },
        { k: 'name', label: 'Nom', type: 'text', req: true, max: 80 },
        { k: 'slug', label: 'Identifiant (minuscules, chiffres et tirets)', type: 'text', req: true, pattern: /^[a-z0-9-]{2,40}$/, hint: 'Exemple : site-vitrine' },
        { k: 'price', label: 'Prix de départ (FCFA)', type: 'int', req: true },
        { k: 'price_label', label: 'Prix affiché (vide = calculé automatiquement)', type: 'text', max: 80 },
        { k: 'badge', label: 'Badge (exemple : Populaire)', type: 'text', max: 30 },
        { k: 'description', label: 'Description courte', type: 'textarea', max: 300 },
        { k: 'audience', label: 'Pour qui (vide = rien n\'est affiché)', type: 'textarea', max: 300 },
        { k: 'goals', label: 'Objectifs du site (facultatif)', type: 'textarea', max: 600 },
        { k: 'features', label: 'Fonctionnalités incluses (une par ligne)', type: 'textarea', max: 1000 },
        { k: 'limits', label: 'Limites de la formule (facultatif)', type: 'textarea', max: 600 },
        { k: 'options', label: 'Options possibles (une par ligne)', type: 'textarea', max: 600 },
        { k: 'sort_order', label: 'Ordre d\'affichage (1 = premier)', type: 'int', def: 0 },
        { k: 'active', label: 'Visible sur le site', type: 'bool', def: true }
      ],
      describe: function (r) { var cat = { media: 'Sultan Media', artist: 'Artist Management', events: 'Events' }[r.category]; return { title: r.name + (r.badge ? ' (' + r.badge + ')' : ''), sub: (cat ? cat + ', ' : '') + (r.price_label || ('À partir de ' + money(r.price))), on: r.active }; },
      onLabel: ['Visible', 'Masqué']
    },
    projects: {
      label: 'réalisation',
      fields: [
        { k: 'title', label: 'Titre', type: 'text', req: true, max: 120 },
        { k: 'category', label: 'Catégorie (exemple : E-commerce)', type: 'text', max: 60 },
        { k: 'description', label: 'Description', type: 'textarea', max: 400 },
        { k: 'status', label: 'Statut', type: 'select', options: PSTATUS, def: 'termine' },
        { k: 'url', label: 'Adresse du site (https://...)', type: 'url' },
        { k: 'image_url', label: 'Adresse d\'une image (https://...)', type: 'url' },
        { k: 'sort_order', label: 'Ordre d\'affichage (1 = premier)', type: 'int', def: 0 },
        { k: 'published', label: 'Publiée sur le site', type: 'bool', def: true }
      ],
      describe: function (r) { return { title: r.title, sub: [r.category, PSTATUS[r.status]].filter(Boolean).join(', '), on: r.published }; },
      onLabel: ['Publiée', 'Masquée']
    },
    gallery: {
      label: 'élément de la galerie',
      fields: [
        { k: 'title', label: 'Titre', type: 'text', req: true, max: 120 },
        { k: 'kind', label: 'Type', type: 'select', options: { video: 'Vidéo', recap: 'Recap', event: 'Événement', photo: 'Photo' }, def: 'video' },
        { k: 'description', label: 'Description (facultatif)', type: 'textarea', max: 300 },
        { k: 'url', label: 'Lien vers la vidéo ou la publication (https://...)', type: 'url' },
        { k: 'image_url', label: 'Adresse d\'une image de couverture (https://...)', type: 'url' },
        { k: 'sort_order', label: 'Ordre d\'affichage (1 = premier)', type: 'int', def: 0 },
        { k: 'published', label: 'Publié sur le site', type: 'bool', def: true }
      ],
      describe: function (r) { return { title: r.title, sub: { video: 'Vidéo', recap: 'Recap', event: 'Événement', photo: 'Photo' }[r.kind] || r.kind, on: r.published }; },
      onLabel: ['Publié', 'Masqué']
    }
  };
  var crudRows = { pricing: [], projects: [], gallery: [] };
  var crudErr = { pricing: '', projects: '', gallery: '' };
  var crudEditing = { table: null, id: null };

  function loadCrud(name) {
    crudErr[name] = '';
    sb.from(name).select('*').order('sort_order', { ascending: true }).then(function (res) {
      if (res.error) { crudErr[name] = 'Impossible de charger cette liste. Vérifiez que le SQL des contenus a été exécuté.'; crudRows[name] = []; }
      else crudRows[name] = res.data || [];
      renderCrud(name);
    });
  }

  function renderCrud(name) {
    var root = $('#list-' + name);
    root.textContent = '';
    var cfg = CRUD[name];
    if (crudErr[name]) {
      root.appendChild(el('p', 'state', crudErr[name]));
      var retry = el('button', 'btn btn-ghost btn-sm', 'Réessayer'); retry.type = 'button'; retry.style.margin = '0 18px 18px';
      retry.addEventListener('click', function () { loadCrud(name); });
      root.appendChild(retry);
      return;
    }
    if (!crudRows[name].length) { root.appendChild(el('p', 'state', 'Rien pour le moment. Ajoutez le premier.')); return; }
    crudRows[name].forEach(function (r) {
      var d = cfg.describe(r);
      var row = el('div', 'crow');
      var info = el('div', 'info');
      info.appendChild(el('b', null, d.title));
      info.appendChild(el('small', null, d.sub));
      row.appendChild(info);
      var acts = el('div', 'acts');
      acts.appendChild(el('span', 'badge ' + (d.on ? 'termine' : 'off'), d.on ? cfg.onLabel[0] : cfg.onLabel[1]));
      var ed = el('button', 'btn btn-primary btn-sm', 'Modifier'); ed.type = 'button';
      ed.addEventListener('click', function () { openCrud(name, r); });
      var del = el('button', 'btn btn-danger btn-sm', 'Supprimer'); del.type = 'button';
      del.addEventListener('click', function () {
        if (!window.confirm('Supprimer « ' + d.title + ' » ? Cette action est définitive.')) return;
        sb.from(name).delete().eq('id', r.id).then(function (res) {
          if (res.error) { toast('Suppression impossible', true); return; }
          toast('Supprimé'); loadCrud(name);
        });
      });
      acts.appendChild(ed); acts.appendChild(del);
      row.appendChild(acts);
      root.appendChild(row);
    });
  }

  var dlgItem = $('#dlg-item');
  function fid(k) { return 'cf-' + k; }

  function openCrud(name, row) {
    var cfg = CRUD[name];
    crudEditing = { table: name, id: row ? row.id : null };
    $('#ci-title').textContent = row ? 'Modifier : ' + cfg.label : 'Ajouter : ' + cfg.label;
    var box = $('#ci-fields');
    box.textContent = '';
    cfg.fields.forEach(function (f) {
      var val = row ? row[f.k] : f.def;
      if (!row && f.k === 'sort_order') val = crudRows[name].reduce(function (m, r) { return Math.max(m, r.sort_order || 0); }, 0) + 1;
      var wrap;
      if (f.type === 'bool') {
        wrap = el('div', 'chk');
        var cb = el('input'); cb.type = 'checkbox'; cb.id = fid(f.k); cb.checked = !!val;
        var lb = el('label', null, f.label); lb.setAttribute('for', cb.id);
        wrap.appendChild(cb); wrap.appendChild(lb);
      } else {
        wrap = el('div', 'field');
        var lab = el('label', null, f.label); lab.setAttribute('for', fid(f.k));
        var inp;
        if (f.type === 'textarea') { inp = el('textarea'); }
        else if (f.type === 'select') {
          inp = el('select');
          Object.keys(f.options).forEach(function (k) { var o = el('option', null, f.options[k]); o.value = k; inp.appendChild(o); });
        } else {
          inp = el('input');
          inp.type = f.type === 'int' ? 'number' : (f.type === 'url' ? 'url' : 'text');
          if (f.type === 'int') { inp.min = '0'; inp.step = '1'; inp.inputMode = 'numeric'; }
        }
        inp.id = fid(f.k);
        if (f.max) inp.maxLength = f.max;
        inp.value = (val === null || val === undefined) ? '' : val;
        wrap.appendChild(lab); wrap.appendChild(inp);
        if (f.hint) { var hi = el('small', 'mute', f.hint); wrap.appendChild(hi); }
      }
      box.appendChild(wrap);
    });
    $('#ci-msg').textContent = '';
    dlgItem.showModal();
  }

  $('#ci-cancel').addEventListener('click', function () { dlgItem.close(); });

  $('#ci-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = crudEditing.table;
    var cfg = CRUD[name];
    var msg = $('#ci-msg');
    var rec = {};
    for (var i = 0; i < cfg.fields.length; i++) {
      var f = cfg.fields[i];
      var node = $('#' + fid(f.k));
      var v;
      if (f.type === 'bool') { rec[f.k] = node.checked; continue; }
      v = node.value.trim();
      if (!v) {
        if (f.req) { msg.textContent = 'Renseignez : ' + f.label; node.focus(); return; }
        rec[f.k] = (f.type === 'textarea' || f.type === 'select') ? (f.type === 'select' ? f.def : '') : null;
        if (f.type === 'int') rec[f.k] = f.def !== undefined ? f.def : 0;
        continue;
      }
      if (f.type === 'int') {
        var n = parseInt(v, 10);
        if (isNaN(n) || n < 0) { msg.textContent = 'Nombre positif attendu : ' + f.label; node.focus(); return; }
        rec[f.k] = n;
      } else if (f.type === 'url') {
        if (!/^https?:\/\//i.test(v)) { msg.textContent = 'L\'adresse doit commencer par https://'; node.focus(); return; }
        rec[f.k] = v;
      } else {
        if (f.pattern && !f.pattern.test(v)) { msg.textContent = 'Format invalide : ' + f.label; node.focus(); return; }
        rec[f.k] = v;
      }
    }
    if (name === 'pricing' && rec.description === null) rec.description = '';
    msg.textContent = '';
    var btn = $('#ci-save');
    btn.disabled = true;
    var q = crudEditing.id ? sb.from(name).update(rec).eq('id', crudEditing.id) : sb.from(name).insert(rec);
    q.then(function (res) {
      btn.disabled = false;
      if (res.error) {
        msg.textContent = /duplicate|unique/i.test(res.error.message || '') ? 'Cet identifiant existe déjà. Choisissez-en un autre.' : 'Enregistrement impossible : ' + res.error.message;
        return;
      }
      dlgItem.close();
      toast(crudEditing.id ? 'Modifié' : 'Ajouté');
      loadCrud(name);
    });
  });

  $('#add-pricing').addEventListener('click', function () { openCrud('pricing', null); });
  $('#add-projects').addEventListener('click', function () { openCrud('projects', null); });
  $('#add-gallery').addEventListener('click', function () { openCrud('gallery', null); });

  /* ---------- Statistiques ---------- */
  var EVLABEL = { page_view: 'Page vue', session_start: 'Nouvelle visite', cta_click: 'Clic « Demander un devis »', whatsapp_click: 'Clic WhatsApp',
    social_click: 'Clic réseau ou email', quote_request: 'Demande de devis', project_view: 'Réalisation consultée', pricing_view: 'Tarifs consultés', outbound_click: 'Lien externe' };
  var DEVLABEL = { mobile: 'Mobile', tablet: 'Tablette', desktop: 'Ordinateur' };

  function rankList(id, rows, map) {
    var root = $('#' + id);
    root.textContent = '';
    if (!rows || !rows.length) { root.appendChild(el('p', 'state', 'Pas encore de données.')); return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r.n; })) || 1;
    rows.forEach(function (r) {
      var d = el('div', 'rank');
      var r1 = el('div', 'r1');
      r1.appendChild(el('span', null, (map && map[r.label]) || r.label));
      r1.appendChild(el('b', null, String(r.n)));
      d.appendChild(r1);
      var bar = el('div', 'bar');
      bar.style.width = Math.max(3, Math.round(r.n / max * 100)) + '%';
      d.appendChild(bar);
      root.appendChild(d);
    });
  }

  function statsChart(points) {
    var box = $('#st-chart');
    box.textContent = '';
    if (!points.length) { box.appendChild(el('p', 'mute', 'Aucune donnée pour cette période.')); return; }
    points = points.slice(-60);
    var max = Math.max.apply(null, points.map(function (p) { return p.views; })) || 1;
    var W = 640, H = 190, padB = 28, padT = 20;
    var slot = W / points.length, bw = Math.max(3, Math.min(40, slot * 0.6));
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Pages vues par jour');
    points.forEach(function (p, i) {
      var h = Math.max(2, (p.views / max) * (H - padB - padT));
      var x = i * slot + (slot - bw) / 2, y = H - padB - h;
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', bw); r.setAttribute('height', h); r.setAttribute('fill', '#c9a84c');
      var t = document.createElementNS(NS, 'title'); t.textContent = fmtDate(p.day) + ' : ' + p.views + ' pages vues, ' + p.visits + ' visites';
      r.appendChild(t); svg.appendChild(r);
      if (points.length <= 14 || i % Math.ceil(points.length / 8) === 0) {
        var l = document.createElementNS(NS, 'text');
        l.setAttribute('x', x + bw / 2); l.setAttribute('y', H - 8); l.setAttribute('text-anchor', 'middle');
        l.setAttribute('fill', '#a6a69e'); l.setAttribute('font-size', '12');
        l.textContent = p.day.slice(8, 10) + '/' + p.day.slice(5, 7);
        svg.appendChild(l);
      }
      if (points.length <= 14) {
        var v = document.createElementNS(NS, 'text');
        v.setAttribute('x', x + bw / 2); v.setAttribute('y', y - 5); v.setAttribute('text-anchor', 'middle');
        v.setAttribute('fill', '#faf9f5'); v.setAttribute('font-size', '12'); v.textContent = String(p.views);
        svg.appendChild(v);
      }
    });
    box.appendChild(svg);
  }

  function loadStats() {
    var state = $('#st-state');
    state.hidden = true;
    sb.rpc('analytics_summary', { p_days: parseInt($('#st-period').value, 10) }).then(function (res) {
      if (res.error || !res.data) {
        state.hidden = false;
        state.textContent = 'Impossible de charger les statistiques. Vérifiez que le SQL des statistiques a été exécuté.';
        return;
      }
      var d = res.data;
      $('#st-visits').textContent = String(d.visits);
      $('#st-views').textContent = String(d.page_views);
      $('#st-quotes').textContent = String(d.quotes);
      $('#st-wa').textContent = String(d.whatsapp);
      $('#st-cta').textContent = String(d.cta);
      $('#st-social').textContent = String(d.social);
      statsChart(d.by_day || []);
      rankList('st-pages', d.pages);
      rankList('st-projects', d.projects);
      rankList('st-sources', d.sources);
      rankList('st-devices', d.devices, DEVLABEL);
      rankList('st-browsers', d.browsers);
      var rec = $('#st-recent');
      rec.textContent = '';
      if (!d.recent || !d.recent.length) rec.appendChild(el('p', 'state', 'Aucune activité pour cette période.'));
      (d.recent || []).forEach(function (e) {
        var row = el('div', 'ev');
        row.appendChild(el('b', null, (EVLABEL[e.event] || e.event) + (e.target ? ' : ' + e.target : '')));
        row.appendChild(el('small', null, fmtDateTime(e.created_at) + ', page ' + (e.page || '?') + ', ' + (DEVLABEL[e.device] || '?') + ', ' + (e.browser || '?') + ', source : ' + (e.referrer_host || 'direct')));
        rec.appendChild(row);
      });
    });
  }
  $('#st-period').addEventListener('change', loadStats);

  /* ---------- Tableau de bord, factures, budget ---------- */
  var AGENCY = { name: 'Sultan Agency', place: 'Dakar, Sénégal', phone: '+221 78 148 20 35', email: 'papaahmedsonko5@gmail.com' };
  var PAY = { payee: 'Payée', acompte: 'Acompte reçu', impayee: 'Impayée' };
  var homeRange = 12;
  var invFilter = '';
  var payingId = null;
  var invoiceId = null;

  function activeOrders() { return orders.filter(function (o) { return o.status !== 'annule'; }); }
  function restOf(o) { return Math.max(0, Number(o.amount) - Number(o.paid)); }
  function pctOf(o) { return Number(o.amount) > 0 ? Math.min(100, Math.round(Number(o.paid) / Number(o.amount) * 100)) : 100; }
  function payState(o) { return restOf(o) === 0 ? 'payee' : (Number(o.paid) > 0 ? 'acompte' : 'impayee'); }
  function invNo(o) { return 'FA-' + o.ordered_on.slice(2, 4) + o.ordered_on.slice(5, 7) + '-' + String(o.id).replace(/-/g, '').slice(0, 4).toUpperCase(); }
  function short(v) { return v >= 1000000 ? (v / 1000000).toFixed(1).replace('.0', '') + ' M' : Math.round(v / 1000) + ' k'; }
  function progress(o, cls) {
    var bar = el('span', cls || 'prog');
    var i = el('i', pctOf(o) === 100 ? 'full' : null);
    i.style.width = pctOf(o) + '%';
    bar.appendChild(i);
    return bar;
  }
  function sums(list) {
    var t = 0, p = 0;
    list.forEach(function (o) { t += Number(o.amount); p += Number(o.paid); });
    return { total: t, paid: p, rest: t - p };
  }
  function goTab(which) {
    if (which === 'stats') loadStats();
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      var n = t.getAttribute('data-tab');
      $('#tab-' + n).hidden = (n !== which);
      t.setAttribute('aria-selected', String(n === which));
    });
    window.scrollTo(0, 0);
  }
  function setChips(root, value, attr) {
    Array.prototype.forEach.call(root.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value));
    });
  }

  function areaChart(box, keys, values) {
    box.textContent = '';
    var NS = 'http://www.w3.org/2000/svg';
    var W = Math.max(300, Math.min(760, box.clientWidth || 760)), H = W < 500 ? 200 : 240, pl = 8, pr = 48, pt = 16, pb = 30;
    var max = Math.max.apply(null, values.concat([1]));
    var step = Math.pow(10, Math.floor(Math.log(max) / Math.LN10));
    var top = Math.ceil(max / step) * step;
    if (top / step > 5) { step *= 2; top = Math.ceil(max / step) * step; }
    function n(tag, attrs, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (text !== undefined) e.textContent = text;
      return e;
    }
    var svg = n('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Montant signé par mois' });
    var defs = n('defs', {});
    var g = n('linearGradient', { id: 'ag', x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(n('stop', { offset: '0', 'stop-color': '#d9963f', 'stop-opacity': '.75' }));
    g.appendChild(n('stop', { offset: '1', 'stop-color': '#d9963f', 'stop-opacity': '.04' }));
    defs.appendChild(g); svg.appendChild(defs);
    var iw = W - pl - pr, ih = H - pt - pb;
    function X(i) { return pl + (keys.length === 1 ? iw / 2 : i * iw / (keys.length - 1)); }
    function Y(v) { return pt + ih - (v / top) * ih; }
    for (var s = 0; s <= top; s += step) {
      svg.appendChild(n('line', { x1: pl, x2: W - pr, y1: Y(s), y2: Y(s), stroke: '#2e2820', 'stroke-dasharray': s ? '3 5' : '0' }));
      svg.appendChild(n('text', { x: W - pr + 8, y: Y(s) + 4, fill: '#a59c8d', 'font-size': 12 }, s ? short(s) : '0'));
    }
    var line = values.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
    svg.appendChild(n('path', { d: line + ' L' + X(values.length - 1).toFixed(1) + ' ' + Y(0) + ' L' + X(0).toFixed(1) + ' ' + Y(0) + ' Z', fill: 'url(#ag)' }));
    svg.appendChild(n('path', { d: line, fill: 'none', stroke: '#e2a851', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    var every = Math.ceil(keys.length / (W < 500 ? 3 : 6));
    keys.forEach(function (k, i) {
      var c = n('circle', { cx: X(i), cy: Y(values[i]), r: values[i] ? 4.5 : 0, fill: '#faf9f5', stroke: '#e2a851', 'stroke-width': 2 });
      c.appendChild(n('title', {}, MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4) + ' : ' + money(values[i])));
      svg.appendChild(c);
      if (i % every === 0 || i === keys.length - 1) {
        svg.appendChild(n('text', { x: X(i), y: H - 8, fill: '#a59c8d', 'font-size': 12, 'text-anchor': i === 0 ? 'start' : (i === keys.length - 1 ? 'end' : 'middle') },
          MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4)));
      }
    });
    box.appendChild(svg);
  }

  function renderHome() {
    var act = activeOrders();
    var s = sums(act);
    $('#h-total').textContent = money(s.total);
    $('#h-rest').textContent = money(s.rest);
    $('#h-paid').textContent = money(s.paid);
    var rate = s.total ? Math.round(s.paid / s.total * 100) : 0;
    $('#h-meter').style.width = rate + '%';
    $('#h-rate').textContent = act.length ? rate + ' % déjà encaissé' : '';

    var byMonth = {};
    act.forEach(function (o) { var k = o.ordered_on.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + Number(o.amount); });
    var keys = [], d = new Date();
    d.setDate(1);
    for (var i = 0; i < homeRange; i++) { keys.unshift(d.getFullYear() + '-' + pad(d.getMonth() + 1)); d.setMonth(d.getMonth() - 1); }
    var values = keys.map(function (k) { return byMonth[k] || 0; });
    areaChart($('#h-area'), keys, values);
    var sum = values.reduce(function (a, b) { return a + b; }, 0);
    $('#h-avg').textContent = 'Moyenne sur ' + homeRange + ' mois : ' + money(sum / homeRange);

    var rec = $('#h-recent');
    rec.textContent = '';
    if (!act.length) rec.appendChild(el('p', 'empty', 'Aucune facture pour le moment.'));
    act.slice(0, 4).forEach(function (o) {
      var b = el('button', 'tx'); b.type = 'button';
      b.appendChild(el('b', null, o.client_name));
      b.appendChild(el('small', null, invNo(o) + ' · ' + fmtDate(o.ordered_on)));
      var r = restOf(o);
      b.appendChild(el('span', 'a ' + (r ? 'due' : 'ok'), r ? 'Reste ' + money(r) : 'Payée'));
      b.addEventListener('click', function () { openInvoice(o); });
      rec.appendChild(b);
    });

    var pj = $('#h-projects');
    pj.textContent = '';
    var running = act.filter(function (o) { return o.status === 'en_cours' || o.status === 'nouveau'; });
    if (!running.length) pj.appendChild(el('p', 'empty', 'Aucun projet en cours.'));
    running.slice(0, 5).forEach(function (o) {
      var b = el('button', 'pj'); b.type = 'button';
      var r1 = el('span', 'r1');
      r1.appendChild(el('b', null, o.project_title));
      r1.appendChild(el('span', null, money(o.amount)));
      b.appendChild(r1);
      b.appendChild(el('small', null, o.client_name + ' · payé à ' + pctOf(o) + ' %'));
      b.appendChild(progress(o));
      b.addEventListener('click', function () { selectedId = o.id; filters.status = ''; $('#f-status').value = ''; setChips($('#f-chips'), '', 'data-s'); render(); goTab('orders'); });
      pj.appendChild(b);
    });
    $('#h-exp').textContent = money(expTotal());
    renderHomeLeads();
  }

  function renderHomeLeads() {
    var news = leads.filter(function (l) { return l.status === 'nouveau'; }).length;
    $('#h-leads').textContent = String(news);
    $('#h-leads-txt').textContent = news ? (news > 1 ? 'nouvelles demandes attendent votre réponse.' : 'nouvelle demande attend votre réponse.')
      : 'Aucune nouvelle demande. ' + leads.length + ' reçue' + (leads.length > 1 ? 's' : '') + ' au total.';
  }

  /* Factures */
  function renderInvoices() {
    var act = activeOrders();
    var s = sums(act);
    $('#i-total').textContent = money(s.total);
    $('#i-paid').textContent = money(s.paid);
    $('#i-rest').textContent = money(s.rest);
    $('#i-open').textContent = String(act.filter(function (o) { return restOf(o) > 0; }).length);
    var root = $('#i-list');
    root.textContent = '';
    var list = act.filter(function (o) { return !invFilter || payState(o) === invFilter; });
    if (!list.length) { root.appendChild(el('p', 'state', act.length ? 'Aucune facture dans cette catégorie.' : 'Aucune facture pour le moment. Elles apparaissent dès que vous ajoutez un projet.')); return; }
    var h = el('div', 'irow h');
    ['N°', 'Client et projet', 'Date', 'Montant', 'Payé', 'Reste dû', ''].forEach(function (t, i) { h.appendChild(el('span', i > 2 && i < 6 ? 'n' : null, t)); });
    root.appendChild(h);
    list.forEach(function (o) {
      var r = el('div', 'irow');
      r.appendChild(el('span', 'no', invNo(o)));
      var c = el('span', 'c');
      c.appendChild(el('b', null, o.client_name));
      c.appendChild(el('small', null, o.project_title));
      r.appendChild(c);
      function cell(label, text, cls) { var x = el('span', cls || null, text); x.setAttribute('data-l', label); r.appendChild(x); }
      cell('Date', fmtDate(o.ordered_on));
      cell('Montant', money(o.amount), 'n');
      cell('Payé', money(o.paid), 'n');
      cell('Reste dû', money(restOf(o)), 'n');
      var a = el('span', 'acts');
      a.appendChild(el('span', 'badge ' + payState(o), PAY[payState(o)]));
      var v = el('button', 'btn btn-ghost btn-sm', 'Voir'); v.type = 'button';
      v.addEventListener('click', function () { openInvoice(o); });
      a.appendChild(v);
      if (restOf(o) > 0) {
        var p = el('button', 'btn btn-primary btn-sm', 'Paiement reçu'); p.type = 'button';
        p.addEventListener('click', function () { openPay(o); });
        a.appendChild(p);
      }
      r.appendChild(a);
      root.appendChild(r);
    });
  }

  function buildInvoice(o) {
    var d = el('div', 'inv');
    var ih = el('div', 'ih');
    var left = el('div');
    var img = el('img'); img.src = 'images/logo-sultan-agency.png'; img.alt = '';
    left.appendChild(img);
    left.appendChild(el('strong', null, AGENCY.name));
    left.appendChild(el('div', 'mu', AGENCY.place));
    left.appendChild(el('div', 'mu', AGENCY.phone + ' · ' + AGENCY.email));
    var right = el('div');
    right.appendChild(el('h3', null, 'FACTURE'));
    right.appendChild(el('div', null, 'N° ' + invNo(o)));
    right.appendChild(el('div', 'mu', 'Date : ' + fmtDate(o.ordered_on)));
    right.appendChild(el('div', 'mu', 'Statut : ' + PAY[payState(o)]));
    ih.appendChild(left); ih.appendChild(right);
    d.appendChild(ih);
    var to = el('div', 'to');
    to.appendChild(el('div', 'mu', 'Facturé à'));
    to.appendChild(el('strong', null, o.client_name));
    d.appendChild(to);
    var t = el('table'), th = el('tr'), tr = el('tr');
    th.appendChild(el('th', null, 'Désignation')); th.appendChild(el('th', null, 'Montant'));
    var td = el('td');
    td.appendChild(el('div', null, o.project_title));
    if (o.service) td.appendChild(el('div', 'mu', o.service));
    tr.appendChild(td); tr.appendChild(el('td', null, money(o.amount)));
    t.appendChild(th); t.appendChild(tr);
    d.appendChild(t);
    var sum = el('div', 'sum');
    function line(k, v, cls) { var x = el('div', cls || null); x.appendChild(el('span', null, k)); x.appendChild(el('span', null, v)); sum.appendChild(x); }
    line('Total', money(o.amount));
    line('Déjà réglé', money(o.paid));
    line('Reste à payer', money(restOf(o)), 't');
    d.appendChild(sum);
    var ft = el('div', 'ft mu', 'Conditions de règlement : acompte de 60 % à la commande, solde de 40 % avant la livraison. Montants en francs CFA.');
    d.appendChild(ft);
    return d;
  }
  var dlgInv = $('#dlg-inv');
  function openInvoice(o) {
    invoiceId = o.id;
    var box = $('#inv-doc');
    box.textContent = '';
    box.appendChild(buildInvoice(o));
    dlgInv.showModal();
  }
  $('#inv-close').addEventListener('click', function () { dlgInv.close(); });
  $('#inv-print').addEventListener('click', function () {
    var o = orders.filter(function (x) { return x.id === invoiceId; })[0];
    if (!o) return;
    var area = $('#print-area');
    area.textContent = '';
    area.appendChild(buildInvoice(o));
    var old = document.title;
    document.title = 'Facture ' + invNo(o) + ' ' + o.client_name;
    dlgInv.close();
    window.print();
    document.title = old;
  });

  var dlgPay = $('#dlg-pay');
  function openPay(o) {
    payingId = o.id;
    $('#pay-info').textContent = o.client_name + ' · ' + invNo(o) + '. Reste dû : ' + money(restOf(o)) + '.';
    $('#pay-amount').value = restOf(o);
    $('#pay-amount').max = restOf(o);
    $('#pay-msg').textContent = '';
    dlgPay.showModal();
    $('#pay-amount').select();
  }
  $('#pay-cancel').addEventListener('click', function () { dlgPay.close(); });
  $('#pay-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var o = orders.filter(function (x) { return x.id === payingId; })[0];
    var msg = $('#pay-msg');
    if (!o) { dlgPay.close(); return; }
    var amt = parseInt($('#pay-amount').value, 10);
    if (isNaN(amt) || amt <= 0) { msg.textContent = 'Indiquez un montant supérieur à zéro.'; return; }
    if (amt > restOf(o)) { msg.textContent = 'Le montant dépasse le reste dû (' + money(restOf(o)) + ').'; return; }
    var save = $('#pay-save');
    save.disabled = true;
    sb.from('orders').update({ paid: Number(o.paid) + amt }).eq('id', o.id).select().single().then(function (res) {
      save.disabled = false;
      if (res.error) { msg.textContent = 'Enregistrement impossible : ' + res.error.message; return; }
      dlgPay.close();
      toast('Paiement de ' + money(amt) + ' enregistré');
      loadOrders(true);
    });
  });

  /* Budget */
  function renderBudget() {
    var act = activeOrders();
    var s = sums(act);
    $('#b-total').textContent = money(s.total);
    $('#b-paid').textContent = money(s.paid);
    $('#b-rate').textContent = (s.total ? Math.round(s.paid / s.total * 100) : 0) + ' %';
    $('#b-avg').textContent = money(act.length ? s.total / act.length : 0);
    var ex = expTotal(), net = s.paid - ex, nowK = isoDate(new Date()).slice(0, 7);
    $('#b-exp').textContent = money(ex);
    $('#b-exp-m').textContent = money(expTotal(nowK));
    $('#b-net').textContent = signed(net);
    $('#b-net').className = net < 0 ? 'neg' : '';
    $('#b-margin').textContent = (s.paid ? Math.round(net / s.paid * 100) : 0) + '\u00a0%';
    function ranks(id, groups, labels) {
      var root = $(id);
      root.textContent = '';
      var keys = Object.keys(groups).sort(function (a, b) { return groups[b].total - groups[a].total; });
      if (!keys.length) { root.appendChild(el('p', 'state', 'Aucune donnée pour le moment.')); return; }
      var max = groups[keys[0]].total || 1;
      keys.forEach(function (k) {
        var g = groups[k], r = el('div', 'rank'), r1 = el('div', 'r1');
        r1.appendChild(el('span', null, ((labels && labels[k]) || k) + ' (' + g.n + ')'));
        r1.appendChild(el('b', null, money(g.total)));
        r.appendChild(r1);
        r.appendChild(el('small', 'mute', 'Encaissé ' + money(g.paid) + ' · reste ' + money(g.total - g.paid)));
        var bar = el('div', 'bar'); bar.style.width = Math.max(2, g.total / max * 100) + '%';
        r.appendChild(bar);
        root.appendChild(r);
      });
    }
    function group(list, fn) {
      var g = {};
      list.forEach(function (o) { var k = fn(o); g[k] = g[k] || { total: 0, paid: 0, n: 0 }; g[k].total += Number(o.amount); g[k].paid += Number(o.paid); g[k].n++; });
      return g;
    }
    ranks('#b-services', group(act, function (o) { return o.service || 'Non précisé'; }));
    ranks('#b-status', group(orders, function (o) { return o.status; }), STATUS);
    var root = $('#b-months');
    root.textContent = '';
    var gm = group(act, function (o) { return o.ordered_on.slice(0, 7); });
    var em = {};
    expenses.forEach(function (x) { var k = x.spent_on.slice(0, 7); em[k] = (em[k] || 0) + Number(x.amount); if (!gm[k]) gm[k] = { total: 0, paid: 0, n: 0 }; });
    var keys = Object.keys(gm).sort().reverse();
    if (!keys.length) { root.appendChild(el('p', 'state', 'Aucune donnée pour le moment.')); return; }
    var wrap = el('div', 'scroll'), t = el('table', 'mtable'), hr = el('tr');
    ['Mois', 'Projets', 'Budget signé', 'Encaissé', 'Reste', 'Dépenses'].forEach(function (x) { hr.appendChild(el('th', null, x)); });
    t.appendChild(hr);
    keys.forEach(function (k) {
      var g = gm[k], tr = el('tr');
      [MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4), String(g.n), money(g.total), money(g.paid), money(g.total - g.paid), money(em[k] || 0)].forEach(function (x) { tr.appendChild(el('td', null, x)); });
      t.appendChild(tr);
    });
    wrap.appendChild(t);
    root.appendChild(wrap);
  }

  /* Dépenses */
  var CATS = { materiel: 'Matériel', logiciel: 'Logiciels et abonnements', sous_traitance: 'Sous-traitance', transport: 'Transport', publicite: 'Publicité', hebergement: 'Hébergement et domaines', remuneration: 'Rémunération', autre: 'Autre' };
  var expenses = [];
  var expError = '';
  var expFilter = '';
  var expEditing = null;
  function signed(n) { return (n < 0 ? '− ' : '') + money(Math.abs(n)); }
  function expTotal(month) {
    var t = 0;
    expenses.forEach(function (x) { if (!month || x.spent_on.slice(0, 7) === month) t += Number(x.amount); });
    return t;
  }
  function loadExpenses() {
    sb.from('expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false }).then(function (res) {
      if (res.error) { expenses = []; expError = 'Le suivi des dépenses n\'est pas encore activé ou n\'a pas pu être chargé.'; }
      else { expenses = res.data || []; expError = ''; }
      renderExpenses();
      renderHome();
      renderBudget();
    });
  }
  function renderExpenses() {
    var paid = sums(activeOrders()).paid, total = expTotal(), net = paid - total;
    $('#e-total').textContent = money(total);
    $('#e-month').textContent = money(expTotal(isoDate(new Date()).slice(0, 7)));
    $('#e-net').textContent = signed(net);
    $('#e-net').className = net < 0 ? 'neg' : '';
    $('#e-count').textContent = String(expenses.length);
    $('#add-exp').disabled = !!expError;

    var chips = $('#e-chips');
    chips.textContent = '';
    var used = {};
    expenses.forEach(function (x) { used[x.category] = true; });
    [''].concat(Object.keys(CATS).filter(function (k) { return used[k]; })).forEach(function (k) {
      var b = el('button', null, k ? CATS[k] : 'Toutes'); b.type = 'button';
      b.setAttribute('data-s', k);
      b.setAttribute('aria-pressed', String(k === expFilter));
      chips.appendChild(b);
    });

    var root = $('#e-list');
    root.textContent = '';
    if (expError) { root.appendChild(el('p', 'state', expError)); }
    else {
      var list = expenses.filter(function (x) { return !expFilter || x.category === expFilter; });
      if (!list.length) root.appendChild(el('p', 'state', expenses.length ? 'Aucune dépense dans cette catégorie.' : 'Aucune dépense enregistrée. Ajoutez la première.'));
      list.forEach(function (x) {
        var r = el('div', 'crow'), info = el('div', 'info');
        info.appendChild(el('b', null, x.label));
        var o = x.order_id ? orders.filter(function (y) { return y.id === x.order_id; })[0] : null;
        info.appendChild(el('small', null, fmtDate(x.spent_on) + ' · ' + (CATS[x.category] || x.category) + (o ? ' · ' + o.client_name : '')));
        if (x.notes) info.appendChild(el('small', null, x.notes));
        r.appendChild(info);
        var a = el('div', 'acts');
        a.appendChild(el('span', 'amt', money(x.amount)));
        var ed = el('button', 'btn btn-ghost btn-sm', 'Modifier'); ed.type = 'button';
        ed.addEventListener('click', function () { openExp(x); });
        var del = el('button', 'btn btn-danger btn-sm', 'Supprimer'); del.type = 'button';
        del.addEventListener('click', function () {
          if (!window.confirm('Supprimer la dépense « ' + x.label + ' » (' + money(x.amount) + ') ? Cette action est définitive.')) return;
          sb.from('expenses').delete().eq('id', x.id).then(function (res) {
            if (res.error) { toast('Suppression impossible', true); return; }
            toast('Dépense supprimée');
            loadExpenses();
          });
        });
        a.appendChild(ed); a.appendChild(del);
        r.appendChild(a);
        root.appendChild(r);
      });
    }

    var cats = $('#e-cats');
    cats.textContent = '';
    var g = {};
    expenses.forEach(function (x) { g[x.category] = (g[x.category] || 0) + Number(x.amount); });
    var keys = Object.keys(g).sort(function (a, b) { return g[b] - g[a]; });
    if (!keys.length) cats.appendChild(el('p', 'state', 'Aucune donnée pour le moment.'));
    keys.forEach(function (k) {
      var r = el('div', 'rank'), r1 = el('div', 'r1');
      r1.appendChild(el('span', null, CATS[k] || k));
      r1.appendChild(el('b', null, money(g[k])));
      r.appendChild(r1);
      var bar = el('div', 'bar'); bar.style.width = Math.max(2, g[k] / g[keys[0]] * 100) + '%';
      r.appendChild(bar);
      cats.appendChild(r);
    });
  }
  var dlgExp = $('#dlg-exp');
  function openExp(x) {
    expEditing = x ? x.id : null;
    $('#exp-title').textContent = x ? 'Modifier la dépense' : 'Nouvelle dépense';
    var cat = $('#x-cat');
    cat.textContent = '';
    Object.keys(CATS).forEach(function (k) { var o = el('option', null, CATS[k]); o.value = k; cat.appendChild(o); });
    var sel = $('#x-order');
    sel.textContent = '';
    var none = el('option', null, 'Aucun (dépense générale)'); none.value = ''; sel.appendChild(none);
    orders.forEach(function (o) { var op = el('option', null, o.client_name + ' · ' + o.project_title); op.value = o.id; sel.appendChild(op); });
    $('#x-label').value = x ? x.label : '';
    cat.value = x ? x.category : 'autre';
    $('#x-amount').value = x ? x.amount : '';
    $('#x-date').value = x ? x.spent_on : isoDate(new Date());
    sel.value = x && x.order_id ? x.order_id : '';
    $('#x-notes').value = x && x.notes ? x.notes : '';
    $('#exp-msg').textContent = '';
    dlgExp.showModal();
    $('#x-label').focus();
  }
  $('#add-exp').addEventListener('click', function () { openExp(null); });
  $('#exp-cancel').addEventListener('click', function () { dlgExp.close(); });
  $('#exp-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('#exp-msg');
    var rec = {
      label: $('#x-label').value.trim(),
      category: $('#x-cat').value,
      amount: parseInt($('#x-amount').value, 10),
      spent_on: $('#x-date').value,
      order_id: $('#x-order').value || null,
      notes: $('#x-notes').value.trim() || null
    };
    if (!rec.label) { msg.textContent = 'Indiquez le libellé.'; return; }
    if (isNaN(rec.amount) || rec.amount < 0) { msg.textContent = 'Le montant doit être un nombre positif.'; return; }
    if (!rec.spent_on) { msg.textContent = 'Indiquez la date.'; return; }
    msg.textContent = '';
    var save = $('#exp-save');
    save.disabled = true;
    var q = expEditing ? sb.from('expenses').update(rec).eq('id', expEditing).select().single() : sb.from('expenses').insert(rec).select().single();
    q.then(function (res) {
      save.disabled = false;
      if (res.error) { msg.textContent = 'Enregistrement impossible : ' + res.error.message; return; }
      dlgExp.close();
      toast(expEditing ? 'Dépense modifiée' : 'Dépense ajoutée');
      loadExpenses();
    });
  });
  $('#e-chips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    expFilter = b.getAttribute('data-s');
    renderExpenses();
  });

  $('#h-range').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    homeRange = Number(b.getAttribute('data-r'));
    setChips(this, String(homeRange), 'data-r');
    renderHome();
  });
  $('#i-chips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    invFilter = b.getAttribute('data-s');
    setChips(this, invFilter, 'data-s');
    renderInvoices();
  });
  $('#f-chips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    filters.status = b.getAttribute('data-s');
    $('#f-status').value = filters.status;
    setChips(this, filters.status, 'data-s');
    render();
  });
  $('#h-new').addEventListener('click', function () { openForm(null); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) {
    b.addEventListener('click', function () { goTab(b.getAttribute('data-go')); });
  });
  (function () {
    var d = new Date(), days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    var full = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    $('#today').textContent = days[d.getDay()] + ' ' + d.getDate() + ' ' + full[d.getMonth()] + ' ' + d.getFullYear();
  })();

  /* ---------- Onglets ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () { goTab(t.getAttribute('data-tab')); });
  });

  /* ---------- Alertes en direct ---------- */
  function subscribeLeads() {
    if (channel || !sb.channel) return;
    channel = sb.channel('live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, function (payload) {
        var l = payload.new || {};
        toast('Nouvelle demande de ' + (l.name || 'un visiteur'));
        browserAlert(l);
        loadLeads();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, function () { loadLeads(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, function () { loadLeads(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, function (payload) {
        if (payload.eventType === 'INSERT') {
          var o = payload.new || {};
          if (o.id !== lastOwnOrderId) toast('Nouveau projet : ' + (o.client_name || '') + ' (' + money(o.amount || 0) + ')');
        }
        loadOrders(true);
      })
      .subscribe();
  }

  /* Filet de sécurité : rafraîchit aussi quand on revient sur la page et toutes les 30 secondes */
  function refreshAll() {
    if (!userId || document.hidden) return;
    loadOrders(true);
    loadLeads();
    loadExpenses();
  }
  document.addEventListener('visibilitychange', refreshAll);
  setInterval(refreshAll, 30000);

  function browserAlert(l) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nouvelle demande de devis', { body: (l.name || '') + (l.service ? ' : ' + l.service : '') });
      }
    } catch (e) { /* non supporté */ }
  }

  function initNotifButton() {
    var b = $('#notif');
    if (!('Notification' in window) || Notification.permission !== 'default') { b.hidden = true; return; }
    b.hidden = false;
    b.onclick = function () {
      Notification.requestPermission().then(function (r) {
        b.hidden = true;
        toast(r === 'granted' ? 'Alertes activées sur cet appareil' : 'Alertes refusées', r !== 'granted');
      });
    };
  }

  initAuth();
})();
