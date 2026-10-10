(function () {
  'use strict';

  var D = window.SULTAN || null;
  var CONSENT_KEY = 'sa_consent';

  function $(s) { return document.querySelector(s); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function priceLabel(p) { return p.priceLabel || ('À partir de ' + fmt(p.price) + '\u00a0FCFA'); }
  function initials(t) {
    return t.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  function safeUrl(u) {
    try { var x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : null; }
    catch (e) { return null; }
  }

  /* Tarifs (source unique : content.js) */
  function renderPricing() {
    var root = $('#pricing-list');
    var select = $('#f-plan');
    if (!D) return;
    var plans = D.pricing.filter(function (p) { return p.active; })
      .sort(function (a, b) { return a.order - b.order; });

    if (root) {
      root.textContent = '';
      plans.forEach(function (p) {
        var li = el('li', 'price-row');
        var name = el('div', 'p-name');
        name.appendChild(el('h3', null, p.name));
        if (p.badge) name.appendChild(el('span', 'badge', p.badge));
        li.appendChild(name);
        li.appendChild(el('p', 'p-desc', p.description));
        li.appendChild(el('p', 'price-val', priceLabel(p)));
        var a = el('a', 'btn btn-ghost btn-small p-cta', 'Demander ce devis');
        a.href = '#contact';
        a.setAttribute('data-plan', p.id);
        li.appendChild(a);
        root.appendChild(li);
      });
      root.addEventListener('click', function (e) {
        var t = e.target.closest('[data-plan]');
        if (t && select) select.value = t.getAttribute('data-plan');
      });
    }

    if (select) {
      select.textContent = '';
      plans.forEach(function (p) {
        var o = el('option', null, p.name);
        o.value = p.id;
        select.appendChild(o);
      });
      var other = el('option', null, 'Autre besoin ou je ne sais pas encore');
      other.value = 'autre';
      select.appendChild(other);
    }
  }

  /* Réalisations */
  function renderProjects() {
    var root = $('#projects-list');
    if (!root || !D) return;
    root.textContent = '';
    var items = D.projects.filter(function (p) { return p.published; })
      .sort(function (a, b) { return a.order - b.order; });
    if (!items.length) {
      root.appendChild(el('p', 'empty', 'Les réalisations arrivent bientôt.'));
      return;
    }
    items.forEach(function (p) {
      var art = el('article', 'project');
      var mark;
      if (p.image && safeUrl(p.image)) {
        mark = el('div', 'project-mark');
        var img = document.createElement('img');
        img.src = safeUrl(p.image);
        img.alt = 'Aperçu du site ' + p.title;
        img.loading = 'lazy';
        img.width = 96; img.height = 96;
        mark.appendChild(img);
      } else {
        mark = el('div', 'project-mark', initials(p.title));
        mark.setAttribute('aria-hidden', 'true');
      }
      art.appendChild(mark);

      var body = el('div');
      body.appendChild(el('h3', null, p.title));
      body.appendChild(el('p', null, p.description));
      var meta = el('div', 'project-meta');
      meta.appendChild(el('span', null, p.category));
      meta.appendChild(el('span', 'status', p.status));
      body.appendChild(meta);
      art.appendChild(body);

      var u = p.url ? safeUrl(p.url) : null;
      if (u) {
        var a = el('a', 'btn btn-ghost btn-small', 'Voir le site');
        a.href = u; a.target = '_blank'; a.rel = 'noopener';
        art.appendChild(a);
      }
      root.appendChild(art);
    });
  }

  /* Menu mobile */
  function initNav() {
    var btn = $('.nav-toggle');
    var nav = $('#nav');
    if (!btn || !nav) return;
    function close() { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* Enregistre la demande dans la base (en plus de WhatsApp) */
  function saveLead(lead) {
    if (!D || !D.api || !D.api.url) return;
    try {
      fetch(D.api.url + '/rest/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': D.api.key, 'Prefer': 'return=minimal' },
        body: JSON.stringify(lead),
        keepalive: true
      }).catch(function () { /* WhatsApp reste le canal de secours */ });
    } catch (e) { /* ignoré */ }
  }

  /* Formulaire : enregistre la demande puis ouvre WhatsApp */
  function initForm() {
    var form = $('#quote-form');
    if (!form || !D) return;
    var wa = $('#link-whatsapp');
    if (wa) wa.href = 'https://wa.me/' + D.contact.whatsapp;
    var msg = $('#form-msg');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var phone = form.elements.phone.value.trim();
      var plan = form.elements.plan;
      var planLabel = plan.options[plan.selectedIndex] ? plan.options[plan.selectedIndex].text : '';
      var message = form.elements.message.value.trim();

      if (!name) { msg.textContent = 'Indiquez votre nom.'; form.elements.name.focus(); return; }
      if (!message) { msg.textContent = 'Décrivez votre projet en quelques lignes.'; form.elements.message.focus(); return; }
      msg.style.color = '';
      msg.textContent = '';

      var text = 'Bonjour Sultan Agency, je suis ' + name + '.\n' +
        'Type de site : ' + planLabel + '.\n' +
        'Mon projet : ' + message +
        (phone ? '\nMon numéro : ' + phone : '');
      var hp = form.elements.website;
      if (hp && hp.value) return;

      saveLead({ name: name, phone: phone || null, service: planLabel, message: message });
      track('quote_request', planLabel);

      var url = 'https://wa.me/' + D.contact.whatsapp + '?text=' + encodeURIComponent(text);
      var w = window.open(url, '_blank', 'noopener');
      if (!w) window.location.href = url;
      msg.style.color = '#7fcf9a';
      msg.textContent = 'Demande envoyée. Finalisez-la dans WhatsApp.';
      form.reset();
    });
  }


  /* ---------- Mesure d'audience (uniquement avec l'accord du visiteur) ---------- */
  var SID_KEY = 'sa_sid';
  var tracking = false;

  function consentOK() { return getConsent() === 'granted'; }

  function sessionId() {
    try {
      var s = sessionStorage.getItem(SID_KEY);
      if (!s) {
        var bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        s = Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        sessionStorage.setItem(SID_KEY, s);
      }
      return s;
    } catch (e) { return null; }
  }
  function deviceType() { var w = window.innerWidth; return w < 768 ? 'mobile' : (w < 1100 ? 'tablet' : 'desktop'); }
  function browserName() {
    var u = navigator.userAgent;
    if (/Edg\//.test(u)) return 'Edge';
    if (/OPR\/|Opera/.test(u)) return 'Opera';
    if (/Firefox\//.test(u)) return 'Firefox';
    if (/Chrome\/|CriOS/.test(u)) return 'Chrome';
    if (/Safari\//.test(u)) return 'Safari';
    return 'Autre';
  }
  function referrerHost() {
    try {
      if (!document.referrer) return null;
      var h = new URL(document.referrer).hostname;
      return h === location.hostname ? null : h.slice(0, 80);
    } catch (e) { return null; }
  }
  function pageName() {
    var p = location.pathname.split('/').pop();
    return (!p || p === 'index.html') ? 'accueil' : p.slice(0, 80);
  }

  function track(event, target) {
    if (!consentOK() || !D || !D.api || !D.api.url) return;
    var id = sessionId();
    if (!id) return;
    var rec = { session_id: id, event: event, page: pageName(), device: deviceType(), browser: browserName(),
      referrer_host: referrerHost(), target: target ? String(target).trim().slice(0, 120) : null };
    try {
      fetch(D.api.url + '/rest/v1/analytics_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': D.api.key, 'Prefer': 'return=minimal' },
        body: JSON.stringify(rec),
        keepalive: true
      }).catch(function () { /* ignoré */ });
    } catch (e) { /* ignoré */ }
  }

  function startTracking() {
    if (tracking || !consentOK()) return;
    tracking = true;
    var known = null;
    try { known = sessionStorage.getItem(SID_KEY); } catch (e) { /* ignoré */ }
    sessionId();
    if (!known) track('session_start');
    track('page_view');
    var pricing = document.getElementById('tarifs');
    if (pricing && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { track('pricing_view'); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(pricing);
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var proj = a.closest('.project');
    if (proj) {
      var h = proj.querySelector('h3');
      track('project_view', h ? h.textContent : '');
    } else if (href.indexOf('wa.me') !== -1) {
      track('whatsapp_click', 'lien direct');
    } else if (/instagram\.com|snapchat\.com/.test(href)) {
      track('social_click', /instagram/.test(href) ? 'Instagram' : 'Snapchat');
    } else if (href.indexOf('mailto:') === 0) {
      track('social_click', 'Email');
    } else if (href === '#contact') {
      track('cta_click', a.textContent);
    }
  });

  /* Consentement cookies */
  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function setConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) { /* stockage indisponible */ }
  }
  window.SULTAN_CONSENT = getConsent;

  function initConsent() {
    var box = el('div', 'consent');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Cookies et mesure d\'audience');
    var p = el('p');
    p.appendChild(document.createTextNode('Ce site peut mesurer sa fréquentation de façon anonyme, uniquement si vous l\'acceptez. Refuser n\'empêche pas d\'utiliser le site. '));
    var more = el('a', null, 'En savoir plus');
    more.href = 'cookies.html';
    p.appendChild(more);
    box.appendChild(p);
    var actions = el('div', 'consent-actions');
    var no = el('button', 'btn btn-ghost', 'Refuser');
    var yes = el('button', 'btn btn-primary', 'Accepter');
    no.type = 'button'; yes.type = 'button';
    actions.appendChild(no); actions.appendChild(yes);
    box.appendChild(actions);
    document.body.appendChild(box);

    function choose(v) { setConsent(v); box.classList.remove('open'); if (v === 'granted') startTracking(); }
    no.addEventListener('click', function () { choose('denied'); });
    yes.addEventListener('click', function () { choose('granted'); });

    if (!getConsent()) box.classList.add('open');
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-consent-open]')) { box.classList.add('open'); yes.focus(); }
    });
  }

  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* Données : lues dans la base, avec repli sur content.js si elle ne répond pas */
  var PROJECT_STATUS = { termine: 'Terminé', en_cours: 'Projet en cours' };

  function remote(path) {
    return fetch(D.api.url + '/rest/v1/' + path, { headers: { apikey: D.api.key } })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }

  function loadData() {
    if (!D || !D.api || !D.api.url || !window.fetch) return Promise.resolve();
    var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 3000); });
    var fetched = Promise.all([
      remote('pricing?select=*&active=eq.true&order=sort_order.asc'),
      remote('projects?select=*&published=eq.true&order=sort_order.asc')
    ]).catch(function () { return null; });
    return Promise.race([fetched, timeout]).then(function (data) {
      if (!data) return;
      D.pricing = data[0].map(function (r) {
        return { id: r.slug, name: r.name, description: r.description || '', price: Number(r.price),
          priceLabel: r.price_label || null, badge: r.badge || '', active: true, order: r.sort_order };
      });
      D.projects = data[1].map(function (r) {
        return { id: r.id, title: r.title, category: r.category || '', description: r.description || '',
          status: PROJECT_STATUS[r.status] || r.status, url: r.url, image: r.image_url, published: true, order: r.sort_order };
      });
    });
  }

  initNav();
  initForm();
  initConsent();
  startTracking();
  loadData().then(function () { renderPricing(); renderProjects(); });
})();
