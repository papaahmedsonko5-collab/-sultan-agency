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

  /* Tarifs, formules détaillées et forfaits (source unique : base de données, repli content.js) */
  var BRANCHES = [
    { id: 'media', label: 'Sultan Media (réseaux sociaux, contenus, vidéos)' },
    { id: 'artist', label: 'Sultan Artist Management' },
    { id: 'events', label: 'Sultan Events' }
  ];
  function lines(t) { return String(t || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function catOf(p) { return p.category || 'site'; }

  function infoBlock(dl, label, value, asList) {
    var items = asList ? lines(value) : (value ? [value] : []);
    if (!items.length) return;
    var d = el('div', 'plan-row');
    d.appendChild(el('dt', null, label));
    var dd = el('dd');
    if (asList) {
      var ul = el('ul', 'plan-list');
      items.forEach(function (t) { ul.appendChild(el('li', null, t)); });
      dd.appendChild(ul);
    } else { dd.textContent = items[0]; }
    d.appendChild(dd);
    dl.appendChild(d);
  }

  function renderPricing() {
    if (!D) return;
    var root = $('#pricing-list');
    var plansRoot = $('#plans');
    var select = $('#f-plan');
    var all = D.pricing.filter(function (p) { return p.active; }).sort(function (a, b) { return a.order - b.order; });
    var plans = all.filter(function (p) { return catOf(p) === 'site'; });
    var packs = all.filter(function (p) { return catOf(p) !== 'site'; });

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
    }

    if (plansRoot) {
      plansRoot.textContent = '';
      plans.forEach(function (p) {
        var art = el('article', 'plan');
        art.id = 'formule-' + p.id;
        var head = el('div', 'plan-head');
        head.appendChild(el('h2', null, p.name));
        if (p.badge) head.appendChild(el('span', 'badge', p.badge));
        art.appendChild(head);
        art.appendChild(el('p', 'plan-price', priceLabel(p)));
        if (p.description) art.appendChild(el('p', 'plan-desc', p.description));
        var dl = el('dl', 'plan-info');
        infoBlock(dl, 'Pour qui', p.audience, false);
        infoBlock(dl, 'Objectifs du site', p.goals, false);
        infoBlock(dl, 'Fonctionnalités incluses', p.features, true);
        infoBlock(dl, 'Limites de la formule', p.limits, false);
        infoBlock(dl, 'Options possibles', p.options, true);
        if (dl.children.length) art.appendChild(dl);
        var a = el('a', 'btn btn-primary', 'Demander un devis');
        a.href = 'index.html?plan=' + encodeURIComponent(p.id) + '#contact';
        a.setAttribute('data-plan', p.id);
        art.appendChild(a);
        plansRoot.appendChild(art);
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-packages]'), function (box) {
      var cat = box.getAttribute('data-packages');
      var items = packs.filter(function (p) { return catOf(p) === cat; });
      box.textContent = '';
      if (!items.length) { box.hidden = true; return; }
      box.hidden = false;
      box.appendChild(el('h4', null, cat === 'media' ? 'Forfaits mensuels' : 'Formules'));
      items.forEach(function (p) {
        var d = el('div', 'pack');
        d.appendChild(el('strong', null, p.name));
        if (p.description) d.appendChild(el('p', null, p.description));
        d.appendChild(el('span', 'pack-price', p.price > 0 || p.priceLabel ? priceLabel(p) : 'Sur devis'));
        box.appendChild(d);
      });
    });

    if (select) {
      select.textContent = '';
      plans.forEach(function (p) { var o = el('option', null, p.name); o.value = p.id; select.appendChild(o); });
      BRANCHES.forEach(function (b) { var o = el('option', null, b.label); o.value = b.id; select.appendChild(o); });
      var other = el('option', null, 'Autre besoin ou je ne sais pas encore');
      other.value = 'autre';
      select.appendChild(other);
      try {
        var q = new URLSearchParams(window.location.search);
        var want = q.get('plan') || q.get('service');
        if (want && Array.prototype.some.call(select.options, function (o) { return o.value === want; })) {
          select.value = want;
          var c = document.getElementById('contact');
          if (c && window.location.hash === '#contact') c.scrollIntoView();
        }
      } catch (e) { /* ignoré */ }
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-plan],[data-service]') : null;
    var select = $('#f-plan');
    if (!t || !select) return;
    var v = t.getAttribute('data-plan') || t.getAttribute('data-service');
    if (Array.prototype.some.call(select.options, function (o) { return o.value === v; })) select.value = v;
  });

  /* Galerie : vidéos, recaps, événements (masquée tant qu'elle est vide) */
  var KIND = { video: 'Vidéo', recap: 'Recap', event: 'Événement', photo: 'Photo' };
  function renderGallery() {
    var sec = $('#galerie');
    var root = $('#gallery-list');
    if (!sec || !root || !D) return;
    var items = (D.gallery || []).filter(function (g) { return g.published; }).sort(function (a, b) { return a.order - b.order; });
    if (!items.length) { sec.hidden = true; return; }
    sec.hidden = false;
    root.textContent = '';
    var limit = window.innerWidth < 640 ? 3 : 6;
    var more = $('#gallery-more');
    if (more) more.remove();
    items.forEach(function (g, idx) {
      var art = el('article', 'gitem');
      if (idx >= limit) { art.hidden = true; art.setAttribute('data-extra', '1'); }
      var iu = g.image ? safeUrl(g.image) : null;
      var u = g.url ? safeUrl(g.url) : null;
      var isFile = u && /\.(mp4|webm)(\?.*)?$/i.test(u);
      if (isFile) {
        var v = document.createElement('video');
        v.src = u;
        v.controls = true;
        v.preload = 'none';
        v.setAttribute('playsinline', '');
        if (iu) v.poster = iu;
        v.setAttribute('aria-label', g.title);
        v.addEventListener('play', function () { track('project_view', 'Vidéo : ' + g.title); }, { once: true });
        art.appendChild(v);
      } else if (iu) {
        var img = document.createElement('img');
        img.src = iu; img.alt = g.title; img.loading = 'lazy'; img.width = 480; img.height = 300;
        art.appendChild(img);
      }
      art.appendChild(el('span', 'badge', KIND[g.kind] || 'Contenu'));
      art.appendChild(el('h3', null, g.title));
      if (g.description) art.appendChild(el('p', null, g.description));
      if (u && !isFile) {
        var a = el('a', 'btn btn-ghost btn-small', 'Voir');
        a.href = u; a.target = '_blank'; a.rel = 'noopener';
        art.appendChild(a);
      }
      root.appendChild(art);
    });
    if (items.length > limit) {
      var btn = el('button', 'btn btn-ghost', 'Voir plus de vidéos');
      btn.type = 'button'; btn.id = 'gallery-more'; btn.style.marginTop = '28px';
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(root.querySelectorAll('[data-extra]'), function (n) { n.hidden = false; });
        btn.remove();
      });
      root.parentNode.appendChild(btn);
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
    if (!D || !D.api || !D.api.url || !window.fetch) return Promise.resolve(false);
    try {
      return fetch(D.api.url + '/rest/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': D.api.key, 'Prefer': 'return=minimal' },
        body: JSON.stringify(lead),
        keepalive: true
      }).then(function (r) {
        if (r.ok) return true;
        return r.text().then(function (t) { return /deja recue/i.test(t); });
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* Formulaire de devis : enregistre la demande puis ouvre WhatsApp */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function initForm() {
    var form = $('#quote-form');
    if (!form || !D) return;
    var wa = $('#link-whatsapp');
    if (wa) wa.href = 'https://wa.me/' + D.contact.whatsapp;
    var msg = $('#form-msg');
    function fail(text, field) { msg.style.color = ''; msg.textContent = text; if (field) field.focus(); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var name = f.name.value.trim();
      var phone = f.phone.value.trim();
      var email = f.email.value.trim();
      var plan = f.plan;
      var planLabel = plan.options[plan.selectedIndex] ? plan.options[plan.selectedIndex].text : '';
      var budget = f.budget.value.trim();
      var deadline = f.deadline.value;
      var message = f.message.value.trim();

      if (!name) return fail('Indiquez votre nom ou celui de votre entreprise.', f.name);
      if (!phone && !email) return fail('Indiquez un numéro de téléphone ou WhatsApp, ou une adresse e-mail.', f.phone);
      if (phone && phone.replace(/\D/g, '').length < 8) return fail('Ce numéro semble incomplet. Vérifiez-le.', f.phone);
      if (email && !EMAIL_RE.test(email)) return fail('Cette adresse e-mail semble invalide.', f.email);
      if (!message) return fail('Décrivez votre besoin en quelques lignes.', f.message);
      msg.style.color = '';
      msg.textContent = '';

      var hp = f.website;
      if (hp && hp.value) return;

      var text = 'Bonjour Sultan Agency, je suis ' + name + '.\n' +
        'Prestation souhaitée : ' + planLabel + '.\n' +
        'Mon besoin : ' + message +
        (budget ? '\nBudget indicatif : ' + budget : '') +
        (deadline ? '\nDélai souhaité : ' + deadline : '') +
        (phone ? '\nMon numéro : ' + phone : '') +
        (email ? '\nMon e-mail : ' + email : '');

      var saving = saveLead({ name: name, phone: phone || null, email: email || null, service: planLabel,
        budget: budget || null, deadline: deadline || null, message: message });
      track('quote_request', planLabel);

      var url = 'https://wa.me/' + D.contact.whatsapp + '?text=' + encodeURIComponent(text);
      var w = window.open(url, '_blank', 'noopener');
      if (!w) window.location.href = url;
      msg.style.color = '';
      msg.textContent = 'Envoi en cours...';
      saving.then(function (ok) {
        if (ok) {
          msg.style.color = '#7fcf9a';
          msg.textContent = 'Demande enregistrée. Finalisez-la dans WhatsApp si la fenêtre s\'est ouverte.';
          form.reset();
        } else {
          msg.style.color = '';
          msg.textContent = 'Votre demande n\'a pas pu être enregistrée. Envoyez le message WhatsApp prêt à l\'emploi pour que nous la recevions.';
        }
      });
    });
  }



  /* Page dédiée : demande client complète (lien partageable) */
  function initRequestForm() {
    var form = $('#request-form');
    if (!form || !D) return;
    var loadedAt = Date.now();
    var msg = $('#req-msg');
    var box = $('#req-done');
    var btn = $('#req-submit');
    function fail(text, field) { msg.style.color = ''; msg.textContent = text; if (field) field.focus(); }
    function waLink(text) { return 'https://wa.me/' + D.contact.whatsapp + '?text=' + encodeURIComponent(text); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var v = function (n) { return f[n].value.trim(); };
      var name = v('name'), company = v('company'), phone = v('phone'), email = v('email'), sector = v('sector');
      var plan = f.plan;
      var planLabel = plan.options[plan.selectedIndex] ? plan.options[plan.selectedIndex].text : '';
      var message = v('message'), features = v('features'), budget = v('budget'), deadline = f.deadline.value;
      var links = v('links'), comments = v('comments');

      if (!name) return fail('Indiquez votre nom.', f.name);
      if (!phone) return fail('Indiquez votre numéro de téléphone ou WhatsApp.', f.phone);
      if (phone.replace(/\D/g, '').length < 8) return fail('Ce numéro semble incomplet. Vérifiez-le.', f.phone);
      if (email && !EMAIL_RE.test(email)) return fail('Cette adresse e-mail semble invalide.', f.email);
      if (message.length < 10) return fail('Décrivez votre projet en quelques phrases (10 caractères minimum).', f.message);
      if (f.website && f.website.value) return;
      if (Date.now() - loadedAt < 3000) return fail('Merci de patienter quelques secondes avant d\'envoyer.');
      msg.style.color = '';
      msg.textContent = '';

      var lead = { name: name, company: company || null, phone: phone, email: email || null, sector: sector || null,
        service: planLabel, message: message, features: features || null, budget: budget || null,
        deadline: deadline || null, existing_links: links || null, comments: comments || null };

      var wa = waLink('Bonjour Sultan Agency, je suis ' + name + (company ? ' (' + company + ')' : '') +
        '. Je viens de vous envoyer une demande de devis : ' + planLabel + '.');

      btn.disabled = true;
      msg.textContent = 'Envoi en cours...';
      saveLead(lead).then(function (ok) {
        btn.disabled = false;
        if (!ok) {
          msg.style.color = '';
          msg.textContent = 'Votre demande n\'a pas pu être enregistrée. Réessayez dans un instant, ou écrivez-nous directement sur WhatsApp.';
          var alt = $('#req-fallback');
          alt.href = waLink('Bonjour Sultan Agency, je suis ' + name + '. ' + planLabel + ' : ' + message);
          alt.hidden = false;
          return;
        }
        track('quote_request', planLabel);
        msg.textContent = '';
        form.hidden = true;
        $('#req-wa').href = wa;
        box.hidden = false;
        box.scrollIntoView();
      });
    });

    var again = $('#req-again');
    if (again) again.addEventListener('click', function () { box.hidden = true; form.hidden = false; form.reset(); loadedAt = Date.now(); });
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
    } else if (href.slice(-8) === '#contact') {
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
      remote('projects?select=*&published=eq.true&order=sort_order.asc'),
      remote('gallery?select=*&published=eq.true&order=sort_order.asc').catch(function () { return []; })
    ]).catch(function () { return null; });
    return Promise.race([fetched, timeout]).then(function (data) {
      if (!data) return;
      D.pricing = data[0].map(function (r) {
        return { id: r.slug, name: r.name, description: r.description || '', price: Number(r.price),
          priceLabel: r.price_label || null, badge: r.badge || '', active: true, order: r.sort_order,
          category: r.category || 'site', audience: r.audience || '', goals: r.goals || '',
          features: r.features || '', limits: r.limits || '', options: r.options || '' };
      });
      D.projects = data[1].map(function (r) {
        return { id: r.id, title: r.title, category: r.category || '', description: r.description || '',
          status: PROJECT_STATUS[r.status] || r.status, url: r.url, image: r.image_url, published: true, order: r.sort_order };
      });
      D.gallery = data[2].map(function (r) {
        return { id: r.id, title: r.title, kind: r.kind, description: r.description || '', url: r.url,
          image: r.image_url, published: true, order: r.sort_order };
      });
    });
  }

  initNav();
  initForm();
  initRequestForm();
  initConsent();
  startTracking();
  loadData().then(function () { renderPricing(); renderProjects(); renderGallery(); });
})();
