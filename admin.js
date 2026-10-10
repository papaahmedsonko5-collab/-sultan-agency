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
  function openForm(o) {
    editingId = o ? o.id : null;
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

  initAuth();
})();
