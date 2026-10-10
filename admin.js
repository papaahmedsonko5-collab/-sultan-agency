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
  var leadError = '';
  var lf = { status: '', q: '' };
  var channel = null;
  var BASE_TITLE = 'Administration | Sultan Agency';
  var LSTATUS = { nouveau: 'Nouveau', contacte: 'Contacté', devis_envoye: 'Devis envoyé', gagne: 'Gagné', perdu: 'Perdu' };

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
      loadCrud('pricing');
      loadCrud('projects');
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
  function loadOrders() {
    loadError = '';
    $('#list').textContent = '';
    $('#list').appendChild(el('p', 'state', 'Chargement...'));
    sb.from('orders').select('*')
      .order('ordered_on', { ascending: false })
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { loadError = 'Impossible de charger les commandes. Vérifiez votre connexion et réessayez.'; orders = []; }
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
      retry.addEventListener('click', loadOrders);
      root.appendChild(retry);
      return;
    }
    if (!list.length) {
      root.appendChild(el('p', 'state', orders.length ? 'Aucune commande ne correspond à ces filtres.' : 'Aucune commande pour le moment. Ajoutez la première.'));
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
      b.addEventListener('click', function () { selectedId = o.id; render(); });
      root.appendChild(b);
    });
  }

  function renderDetail(list) {
    var p = $('#detail-panel');
    p.textContent = '';
    var o = orders.filter(function (x) { return x.id === selectedId; })[0];
    if (!o) { p.appendChild(el('p', 'state', 'Sélectionnez une commande pour voir son détail.')); return; }
    var box = el('div', 'detail');
    box.appendChild(el('h2', null, o.client_name));
    box.appendChild(el('span', 'badge ' + o.status, STATUS[o.status] || o.status));
    box.appendChild(el('p', 'mute', o.project_title));
    var dl = el('dl');
    function row(k, v) { var d = el('div'); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', null, v)); dl.appendChild(d); }
    row('Type de site', o.service || 'Non précisé');
    row('Date', fmtDate(o.ordered_on));
    row('Montant', money(o.amount));
    row('Encaissé', money(o.paid));
    row('Reste à encaisser', money(Number(o.amount) - Number(o.paid)));
    box.appendChild(dl);
    if (o.notes) box.appendChild(el('p', 'notes', o.notes));
    var act = el('div', 'actions');
    var ed = el('button', 'btn btn-primary btn-sm', 'Modifier'); ed.type = 'button';
    ed.addEventListener('click', function () { openForm(o); });
    var del = el('button', 'btn btn-danger btn-sm', 'Supprimer'); del.type = 'button';
    del.addEventListener('click', function () { removeOrder(o); });
    act.appendChild(ed); act.appendChild(del);
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
  }

  /* ---------- Formulaire ---------- */
  var dlg = $('#dlg');
  function openForm(o, lead) {
    editingId = o ? o.id : null;
    pendingLead = lead || null;
    $('#dlg-title').textContent = o ? 'Modifier la commande' : 'Nouvelle commande';
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
      $('#dlg-title').textContent = 'Transformer en commande';
      $('#o-client').value = lead.name;
      var opts = Array.prototype.map.call($('#o-service').options, function (x) { return x.value; });
      $('#o-service').value = opts.indexOf(lead.service) !== -1 ? lead.service : 'Autre';
      $('#o-project').value = (lead.service && opts.indexOf(lead.service) !== -1 ? lead.service + ' pour ' : 'Projet pour ') + lead.name;
      $('#o-status').value = 'en_cours';
      $('#o-notes').value = lead.message || '';
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
    if (rec.paid > rec.amount) { msg.textContent = 'Le montant encaissé ne peut pas dépasser le montant de la commande.'; return; }
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
      toast(editingId ? 'Commande modifiée' : 'Commande ajoutée');
      selectedId = res.data.id;
      var from = pendingLead;
      pendingLead = null;
      if (from && !editingId) {
        sb.from('leads').update({ status: 'gagne', order_id: res.data.id }).eq('id', from.id).then(function () { loadLeads(); });
      }
      loadOrders();
    });
  });

  function removeOrder(o) {
    if (!window.confirm('Supprimer la commande « ' + o.client_name + ' » (' + money(o.amount) + ') ? Cette action est définitive.')) return;
    sb.from('orders').delete().eq('id', o.id).then(function (res) {
      if (res.error) { toast('Suppression impossible', true); return; }
      toast('Commande supprimée');
      selectedId = null;
      loadOrders();
    });
  }

  /* ---------- Filtres ---------- */
  $('#f-status').addEventListener('change', function (e) { filters.status = e.target.value; render(); });
  $('#f-period').addEventListener('change', function (e) { filters.period = e.target.value; render(); });
  $('#f-q').addEventListener('input', function (e) { filters.q = e.target.value; render(); });

  /* ---------- Demandes de devis ---------- */
  function loadLeads() {
    leadError = '';
    sb.from('leads').select('*').order('created_at', { ascending: false }).then(function (res) {
      if (res.error) { leadError = 'Impossible de charger les demandes. Vérifiez que le SQL des demandes a été exécuté.'; leads = []; }
      else leads = res.data || [];
      renderLeads();
    });
  }

  function leadsFiltered() {
    var q = lf.q.trim().toLowerCase();
    return leads.filter(function (l) {
      if (lf.status && l.status !== lf.status) return false;
      if (q && (l.name + ' ' + (l.message || '')).toLowerCase().indexOf(q) === -1) return false;
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

  function renderLeads() {
    var news = leads.filter(function (l) { return l.status === 'nouveau'; }).length;
    var c = $('#leads-count');
    c.textContent = String(news);
    c.hidden = news === 0;
    document.title = (news ? '(' + news + ') ' : '') + BASE_TITLE;

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
      root.appendChild(el('p', 'state', leads.length ? 'Aucune demande ne correspond à ces filtres.' : 'Aucune demande pour le moment. Elles apparaîtront ici dès qu\'un visiteur remplira le formulaire du site.'));
    } else {
      list.forEach(function (l) {
        var b = el('button', 'order');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(l.id === selectedLeadId));
        b.appendChild(el('b', null, l.name));
        b.appendChild(el('span', 'amt', fmtDateTime(l.created_at).slice(0, 10)));
        b.appendChild(el('small', null, l.service || 'Type non précisé'));
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
    if (!l) { p.appendChild(el('p', 'state', 'Sélectionnez une demande pour voir son détail.')); return; }
    var box = el('div', 'detail');
    box.appendChild(el('h2', null, l.name));
    box.appendChild(el('p', 'mute', 'Reçue le ' + fmtDateTime(l.created_at)));
    var dl = el('dl');
    function row(k, v) { var d = el('div'); d.appendChild(el('dt', null, k)); d.appendChild(el('dd', null, v)); dl.appendChild(d); }
    row('Téléphone', l.phone || 'Non renseigné');
    row('Type de site', l.service || 'Non précisé');
    box.appendChild(dl);
    box.appendChild(el('p', 'msgbox', l.message));

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
      var conv = el('button', 'btn btn-primary btn-sm', 'Transformer en commande'); conv.type = 'button';
      conv.addEventListener('click', function () { openForm(null, l); });
      act.appendChild(conv);
    } else {
      act.appendChild(el('span', 'badge gagne', 'Déjà transformée en commande'));
    }
    var del = el('button', 'btn btn-danger btn-sm', 'Supprimer'); del.type = 'button';
    del.addEventListener('click', function () {
      if (!window.confirm('Supprimer la demande de « ' + l.name + ' » ? Cette action est définitive.')) return;
      sb.from('leads').delete().eq('id', l.id).then(function (res) {
        if (res.error) { toast('Suppression impossible', true); return; }
        toast('Demande supprimée'); selectedLeadId = null; loadLeads();
      });
    });
    act.appendChild(del);
    box.appendChild(act);
    p.appendChild(box);
  }

  $('#lf-status').addEventListener('change', function (e) { lf.status = e.target.value; renderLeads(); });
  $('#lf-q').addEventListener('input', function (e) { lf.q = e.target.value; renderLeads(); });

  /* ---------- Tarifs et réalisations ---------- */
  var PSTATUS = { en_cours: 'Projet en cours', termine: 'Terminé' };
  var CRUD = {
    pricing: {
      label: 'tarif',
      fields: [
        { k: 'name', label: 'Nom', type: 'text', req: true, max: 80 },
        { k: 'slug', label: 'Identifiant (minuscules, chiffres et tirets)', type: 'text', req: true, pattern: /^[a-z0-9-]{2,40}$/, hint: 'Exemple : site-vitrine' },
        { k: 'price', label: 'Prix de départ (FCFA)', type: 'int', req: true },
        { k: 'price_label', label: 'Prix affiché (vide = calculé automatiquement)', type: 'text', max: 80 },
        { k: 'badge', label: 'Badge (exemple : Populaire)', type: 'text', max: 30 },
        { k: 'description', label: 'Description', type: 'textarea', max: 300 },
        { k: 'sort_order', label: 'Ordre d\'affichage (1 = premier)', type: 'int', def: 0 },
        { k: 'active', label: 'Visible sur le site', type: 'bool', def: true }
      ],
      describe: function (r) { return { title: r.name + (r.badge ? ' (' + r.badge + ')' : ''), sub: r.price_label || ('À partir de ' + money(r.price)), on: r.active }; },
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
    }
  };
  var crudRows = { pricing: [], projects: [] };
  var crudErr = { pricing: '', projects: '' };
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

  /* ---------- Onglets ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () {
      var which = t.getAttribute('data-tab');
      if (which === 'stats') loadStats();
      ['orders', 'leads', 'pricing', 'projects', 'stats'].forEach(function (n) {
        $('#tab-' + n).hidden = (n !== which);
        $('#tab-btn-' + n).setAttribute('aria-selected', String(n === which));
      });
    });
  });

  /* ---------- Alertes en direct ---------- */
  function subscribeLeads() {
    if (channel || !sb.channel) return;
    channel = sb.channel('leads-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, function (payload) {
        var l = payload.new || {};
        toast('Nouvelle demande de ' + (l.name || 'un visiteur'));
        browserAlert(l);
        loadLeads();
      })
      .subscribe();
  }

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
