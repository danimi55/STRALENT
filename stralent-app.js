/* Stralent — script di sito. Nessuna animazione: solo comportamenti. */

/* ---------- Glossario: filtro alfabetico, ricerca, accordion ---------- */
(function () {
  if (window.__stralentGlossWired) return;
  window.__stralentGlossWired = true;
  function applyGlossFilter() {
    var cards = document.querySelectorAll('.gloss-term');
    if (!cards.length) return;
    var activeLetter = document.querySelector('.alpha-letter.active');
    var letter = activeLetter ? activeLetter.getAttribute('data-letter') : null;
    var input = document.getElementById('gloss-input');
    var q = input ? input.value.trim().toLowerCase() : '';
    var shown = 0;
    cards.forEach(function (c) {
      var okL = !letter || c.getAttribute('data-letter') === letter;
      var okQ = !q || (c.getAttribute('data-term') || '').toLowerCase().indexOf(q) !== -1;
      var vis = okL && okQ;
      c.style.display = vis ? '' : 'none';
      if (vis) shown++;
    });
    var empty = document.querySelector('.gloss-empty');
    if (empty) empty.style.display = shown ? 'none' : 'block';
  }
  window.__applyGlossFilter = applyGlossFilter;
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.alpha-letter') : null;
    if (btn) {
      var row = btn.parentNode;
      var was = btn.classList.contains('active');
      row.querySelectorAll('.alpha-letter.active').forEach(function (b) { b.classList.remove('active'); });
      if (!was) btn.classList.add('active');
      applyGlossFilter();
      return;
    }
    var head = e.target.closest ? e.target.closest('.gloss-head') : null;
    if (head) {
      var term = head.parentNode;
      var willOpen = !term.classList.contains('open');
      document.querySelectorAll('.gloss-term.open').forEach(function (t) { if (t !== term) t.classList.remove('open'); });
      term.classList.toggle('open', willOpen);
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'gloss-input') applyGlossFilter();
  });
})();

/* ---------- Newsletter: allinea la larghezza del campo al sottotitolo ---------- */
(function () {
  function syncField() {
    var span = document.getElementById('nl-sub-text');
    var wrap = document.getElementById('nl-field-wrap');
    if (!span || !wrap) return;
    function apply() {
      var w = Math.round(span.getBoundingClientRect().width);
      if (w > 0) wrap.style.width = w + 'px';
    }
    apply();
    window.addEventListener('resize', apply, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
  }
  function boot(tries) {
    if (document.getElementById('nl-field-wrap')) { syncField(); return; }
    if (tries > 0) setTimeout(function () { boot(tries - 1); }, 150);
  }
  boot(40);
})();

/* ---------- Menu principale ----------
   Stato tenuto fuori dal DOM e handler delegato: sopravvive ai re-render del DC,
   che altrimenti azzererebbero listener e attributi sul nodo. */
(function () {
  if (window.__stralentMenuWired) return;
  window.__stralentMenuWired = true;
  var open = false;
  function apply() {
    var panel = document.getElementById('menu-panel');
    var icon = document.getElementById('menu-icon');
    if (panel && panel.getAttribute('data-open') !== (open ? '1' : '0')) panel.setAttribute('data-open', open ? '1' : '0');
    if (icon) { var want = open ? '\u00D7' : '+'; if (icon.textContent !== want) icon.textContent = want; }
  }
  var autoClose = null;
  function armAutoClose() {
    if (autoClose) clearTimeout(autoClose);
    if (!open) return;
    if (window.innerWidth <= 768) return; // su mobile il menu resta aperto finche' non lo chiudi
    autoClose = setTimeout(function () { open = false; apply(); }, 7000);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('#menu-toggle') : null;
    if (!t) return;
    open = !open;
    apply();
    armAutoClose();
  });
  // ogni interazione col menu aperto rimanda la chiusura
  ['mousemove', 'pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (!open) return;
      var bar = document.getElementById('menu-bar');
      if (ev !== 'keydown' && (!bar || !e.target.closest || !e.target.closest('#menu-bar'))) return;
      armAutoClose();
    }, true);
  });
  function markCurrent() {
    var here = decodeURIComponent((location.pathname.split('/').pop() || '')).toLowerCase();
    if (!here) return;
    var links = document.querySelectorAll('#menu-panel a');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var file = decodeURIComponent(href.split('#')[0].split('/').pop()).toLowerCase();
      if (file && file === here && href.indexOf('#') === -1) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }
  apply();
  markCurrent();
  try {
    new MutationObserver(function () { apply(); markCurrent(); }).observe(document.body, { childList: true, subtree: true });
  } catch (err) {}
})();

/* ---------- Blog: titoli e immagini dal sito WordPress ---------- */
(function () {
  var API = 'https://www.stralent.it/wp-json/wp/v2/posts?per_page=30&_embed';
  function decode(s) { var t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function featured(post) {
    try {
      var m = post._embedded['wp:featuredmedia'][0];
      var sizes = m.media_details && m.media_details.sizes;
      if (sizes && sizes.medium_large) return sizes.medium_large.source_url;
      if (sizes && sizes.large) return sizes.large.source_url;
      return m.source_url;
    } catch (e) { return null; }
  }
  function load(tries) {
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-blog-card]'));
    if (!cards.length) { if (tries > 0) setTimeout(function () { load(tries - 1); }, 150); return; }
    fetch(API, { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (posts) {
        if (!Array.isArray(posts) || !posts.length) return;
        shuffle(posts).slice(0, cards.length).forEach(function (post, i) {
          var card = cards[i];
          var title = card.querySelector('[data-blog-title]');
          var img = card.querySelector('[data-blog-img]');
          if (title) title.textContent = decode(post.title && post.title.rendered);
          if (post.link) card.setAttribute('href', post.link);
          var src = featured(post);
          if (img && src) { img.style.opacity = '1'; img.src = src; }
        });
      })
      .catch(function () {});
  }
  load(40);
})();

/* ---------- Scroll all'ancora #hash dopo il render ---------- */
(function () {
  function scrollToHash(tries) {
    var id = (location.hash || '').replace('#', '');
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) { if (tries > 0) setTimeout(function () { scrollToHash(tries - 1); }, 150); return; }
    window.scrollTo(0, el.getBoundingClientRect().top + window.pageYOffset - 30);
  }
  scrollToHash(40);
  window.addEventListener('hashchange', function () { scrollToHash(20); });
})();

/* ---------- Comparsa in assolvenza allo scroll ---------- */
(function () {
  if (window.__stralentReveal) return;
  window.__stralentReveal = true;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SELECTORS = [
    'section > *',
    'footer > *',
    '.service-card',
    '.uniamo-grid > div',
    '.eb-card',
    '.blog-card',
    '.vline',
    '.choose-grid > div'
  ];

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      show(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

  function show(el) {
    el.style.opacity = '1';
    el.style.transform = el.__revBase || '';
    setTimeout(function () {
      el.style.transition = '';
      el.style.willChange = '';
    }, 900);
  }

  function prep(el, delay) {
    if (el.__revDone) return;
    el.__revDone = true;
    el.__revBase = el.style.transform || '';
    el.style.opacity = '0';
    el.style.transform = (el.__revBase ? el.__revBase + ' ' : '') + 'translate3d(0,22px,0)';
    el.style.willChange = 'opacity, transform';
    el.style.transition = 'opacity .7s cubic-bezier(.22,.61,.36,1) ' + delay + 'ms, transform .7s cubic-bezier(.22,.61,.36,1) ' + delay + 'ms';
    io.observe(el);
  }

  function collect() {
    for (var i = 0; i < SELECTORS.length; i++) {
      var nodes = document.querySelectorAll(SELECTORS[i]);
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (el.closest('.hero-topbar') || el.id === 'menu-panel') continue;
        // niente doppia animazione su elementi gia' figli di un elemento preparato
        var p = el.parentElement;
        var nested = false;
        while (p) { if (p.__revDone) { nested = true; break; } p = p.parentElement; }
        if (nested) continue;
        prep(el, Math.min(j, 4) * 80);
      }
    }
  }

  function boot() { collect(); setTimeout(collect, 600); setTimeout(collect, 1600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 200);
})();

/* ---------- Pop-up "Contattaci" ---------- */
(function () {
  if (window.__stralentContactWired) return;
  window.__stralentContactWired = true;
  var overlay = null;
  function build() {
    if (overlay) return overlay;
    var st = document.createElement('style');
    st.textContent = '[data-contact-card] textarea::placeholder{color:#14405b !important;opacity:1;}[data-contact-card] input:focus::placeholder,[data-contact-card] textarea:focus::placeholder{color:transparent !important;}[data-contact-card] button[type=submit]:hover{background:#f5a01e !important;color:#ffffff !important;}[data-contact-card] select:invalid{color:#14405b;opacity:.85;}[data-contact-card] select option{color:#14405b;}';
    document.head.appendChild(st);
    overlay = document.createElement('div');
    overlay.setAttribute('data-contact-overlay', '');
    overlay.style.cssText = 'position:fixed; inset:0; z-index:2000; background:rgba(0,0,0,.7); display:none; align-items:center; justify-content:center; padding:24px;';
    overlay.innerHTML =
      '<div data-contact-card style="position:relative; width:min(760px,94vw); background:#eef1f4; border-radius:36px; padding:48px 56px 52px; box-sizing:border-box;">' +
        '<button data-contact-close aria-label="Chiudi" style="position:absolute; top:26px; right:30px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; background:transparent; border:none; cursor:pointer; color:#14405b; font-family:\'Barlow\',sans-serif; font-size:44px; line-height:1;">&times;</button>' +
        '<h1 style="text-align:center; margin:0 0 26px; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:48px; line-height:48px; color:#14405b;">Contattaci</h1>' +
        '<form data-contact-form style="display:flex; flex-direction:column; gap:22px;">' +
          '<input type="email" required placeholder="Inserisci qui la tua e-mail" style="width:100%; box-sizing:border-box; border:none; outline:none; background:#ffffff; border-radius:16px; text-align:center; font-family:\'Barlow\',sans-serif; font-weight:500; font-size:18px; color:#14405b; padding:22px 18px;">' +
          '<select required data-contact-topic style="width:100%; box-sizing:border-box; border:none; outline:none; background:#ffffff; border-radius:16px; text-align:center; text-align-last:center; font-family:\'Barlow\',sans-serif; font-weight:500; font-size:18px; color:#14405b; padding:22px 46px; cursor:pointer; -webkit-appearance:none; appearance:none; background-image:url(&quot;data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'12\' viewBox=\'0 0 18 12\' fill=\'none\'><path d=\'M2 2l7 7 7-7\' stroke=\'%2314405b\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>&quot;); background-repeat:no-repeat; background-position:right 22px center;">' +
            '<option value="" selected disabled>Di cosa vuoi parlare?</option>' +
            '<option value="Employer Branding">Employer Branding</option>' +
            '<option value="Internal Branding">Internal Branding</option>' +
            '<option value="Comunicazione interna">Comunicazione interna</option>' +
            '<option value="Formazione">Formazione</option>' +
          '</select>' +
          '<div aria-hidden="true" style="position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden;"><label>Codice Richiesta<input type="text" name="codice-richiesta" tabindex="-1" autocomplete="off"></label></div>' +
          '<textarea required placeholder="Il tuo messaggio" rows="4" style="width:100%; box-sizing:border-box; border:none; outline:none; background:#ffffff; border-radius:16px; text-align:center; font-family:\'Barlow\',sans-serif; font-weight:500; font-size:18px; color:#14405b; padding:22px 18px; min-height:150px; resize:vertical;"></textarea>' +
          '<label style="display:flex; align-items:center; justify-content:center; gap:10px; font-family:\'Barlow\',sans-serif; font-weight:300; font-size:14px; color:#14405b; text-align:center;"><input type="checkbox" required style="width:18px; height:18px; flex:none;"><span>Acconsento al trattamento dei miei dati personali ai sensi della <a href="https://www.stralent.it/privacy-policy" target="_blank" rel="noopener" style="color:#14405b;">Privacy Policy</a></span></label>' +
          '<div style="display:flex; justify-content:center;">' +
            '<button type="submit" style="margin-top:12px; display:inline-flex; align-items:center; gap:14px; background:#163e57; color:#ffffff; border:none; border-radius:999px; padding:22px 48px; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:30px; line-height:30px; cursor:pointer; white-space:nowrap;"><span style="width:14px; height:14px; border-radius:50%; background:#ffffff;"></span>Invia il messaggio</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(overlay);
    var card = overlay.querySelector('[data-contact-card]');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('[data-contact-close]').addEventListener('click', close);
    overlay.querySelector('[data-contact-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var hp = overlay.querySelector('input[name="codice-richiesta"]');
      if (hp && hp.value) { close(); return; }
      var email = (overlay.querySelector('input[type="email"]') || {}).value || '';
      var msg = (overlay.querySelector('textarea') || {}).value || '';
      var topic = (overlay.querySelector('[data-contact-topic]') || {}).value || '';
      window.location.href = 'mailto:info@stralent.it?subject=' + encodeURIComponent('Richiesta di contatto dal sito Stralent' + (topic ? ' \u2013 ' + topic : '')) + '&body=' + encodeURIComponent('Email: ' + email + '\nServizio di interesse: ' + topic + '\n\nMessaggio:\n' + msg);
      card.innerHTML = '<button data-contact-close aria-label="Chiudi" style="position:absolute; top:26px; right:30px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; background:transparent; border:none; cursor:pointer; color:#14405b; font-family:\'Barlow\',sans-serif; font-size:44px; line-height:1;">&times;</button>' +
        '<div style="text-align:center; padding:40px 10px;"><h1 style="margin:0 0 16px; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:44px; line-height:46px; color:#14405b;">Grazie!</h1><p style="margin:0; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:20px; line-height:28px; color:#14405b;">Abbiamo ricevuto il tuo messaggio, ti risponderemo al pi\u00f9 presto.</p></div>';
      card.querySelector('[data-contact-close]').addEventListener('click', close);
    });
    return overlay;
  }
  function open() { build(); overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  function close() { if (overlay) overlay.style.display = 'none'; document.body.style.overflow = ''; }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    if ((a.textContent || '').trim().toLowerCase() === 'contattaci') { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();

/* ---------- Pop-up newsletter ---------- */
(function () {
  if (window.__stralentNlWired) return;
  window.__stralentNlWired = true;
  var overlay = null;
  function build() {
    if (overlay) return overlay;
    var st = document.createElement('style');
    st.textContent = '[data-nl-card] input::placeholder{color:#14405b !important;opacity:1;}[data-nl-card] input:focus::placeholder{color:transparent !important;}[data-nl-card] button[type=submit]:hover{background:#f5a01e !important;color:#ffffff !important;}' +
      '@media (max-width:768px){' +
      '[data-nl-card]{padding:30px 20px !important;border-radius:28px !important;}' +
      '[data-nl-card] h1{font-size:32px !important;line-height:36px !important;max-width:14ch !important;margin-left:auto !important;margin-right:auto !important;text-wrap:balance !important;}' +
      '[data-nl-card] h3{font-size:17px !important;line-height:24px !important;margin-bottom:24px !important;}' +
      '[data-nl-card] input[type=email]{font-size:16px !important;padding:16px 14px !important;}' +
      '[data-nl-card] button[type=submit]{width:min(80vw,100%) !important;justify-content:center !important;white-space:nowrap !important;font-size:17px !important;line-height:17px !important;padding:16px 14px !important;gap:10px !important;}' +
      '[data-nl-card] button[type=submit] span{width:10px !important;height:10px !important;flex:none !important;}' +
      '[data-nl-close]{top:14px !important;right:16px !important;font-size:34px !important;width:40px !important;height:40px !important;}' +
      '}';
    document.head.appendChild(st);
    overlay = document.createElement('div');
    overlay.setAttribute('data-nl-overlay', '');
    overlay.style.cssText = 'position:fixed; inset:0; z-index:2000; background:rgba(0,0,0,.7); display:none; align-items:center; justify-content:center; padding:24px;';
    overlay.innerHTML =
      '<div data-nl-card style="position:relative; width:min(860px,94vw); background:#eef1f4; border-radius:40px; padding:64px 56px 56px; box-sizing:border-box; text-align:center;">' +
        '<button data-nl-close aria-label="Chiudi" style="position:absolute; top:26px; right:30px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; background:transparent; border:none; cursor:pointer; color:#14405b; font-family:\'Barlow\',sans-serif; font-size:44px; line-height:1;">&times;</button>' +
        '<h1 style="margin:0; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:54px; line-height:54px; color:#14405b;">Iscriviti alla newsletter di Stralent</h1>' +
        '<h3 style="margin:5px 0 38px; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:22px; line-height:30px; color:#14405b;">Rimani aggiornato su neuroscienze e strategie HR: iscriviti ora.</h3>' +
        '<form data-nl-form style="display:flex; flex-direction:column; align-items:center; gap:14px;">' +
          '<input type="email" required placeholder="Inserisci qui la tua e-mail" style="width:min(600px,100%); box-sizing:border-box; border:none; outline:none; background:#ffffff; border-radius:10px; text-align:center; font-family:\'Barlow\',sans-serif; font-weight:500; font-size:18px; color:#14405b; padding:22px 18px;">' +
          '<label style="display:flex; align-items:center; justify-content:center; gap:8px; font-family:\'Barlow\',sans-serif; font-weight:300; font-size:12px; color:#14405b;"><input type="checkbox" required style="flex:none;"><span>Acconsento al trattamento dei miei dati personali ai sensi della <a href="https://www.stralent.it/privacy-policy" target="_blank" rel="noopener" style="color:#14405b;">Privacy Policy</a></span></label>' +
          '<button type="submit" style="margin-top:12px; display:inline-flex; align-items:center; gap:14px; background:#163e57; color:#ffffff; border:none; border-radius:999px; padding:22px 48px; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:30px; line-height:30px; cursor:pointer; white-space:nowrap;"><span style="width:14px; height:14px; border-radius:50%; background:#ffffff;"></span>Iscriviti alla newsletter</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(overlay);
    var card = overlay.querySelector('[data-nl-card]');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('[data-nl-close]').addEventListener('click', close);
    overlay.querySelector('[data-nl-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (overlay.querySelector('input[type="email"]') || {}).value || '';
      window.location.href = 'mailto:info@stralent.it?subject=' + encodeURIComponent('Iscrizione newsletter Stralent') + '&body=' + encodeURIComponent('Email: ' + email);
      card.innerHTML = '<button data-nl-close aria-label="Chiudi" style="position:absolute; top:26px; right:30px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; background:transparent; border:none; cursor:pointer; color:#14405b; font-family:\'Barlow\',sans-serif; font-size:44px; line-height:1;">&times;</button>' +
        '<div style="padding:40px 10px;"><h1 style="margin:0 0 16px; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:44px; line-height:46px; color:#14405b;">Grazie!</h1><p style="margin:0; font-family:\'Barlow\',sans-serif; font-weight:400; font-size:20px; line-height:28px; color:#14405b;">Iscrizione registrata, a presto con i nostri contenuti.</p></div>';
      card.querySelector('[data-nl-close]').addEventListener('click', close);
    });
    return overlay;
  }
  function open() { build(); overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  function close() { if (overlay) overlay.style.display = 'none'; document.body.style.overflow = ''; }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    if ((a.textContent || '').trim().toLowerCase() === 'newsletter') { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();

/* ---------- Rollover colore CTA (senza transizioni) ---------- */
(function () {
  if (window.__stralentCtaSwap) return;
  window.__stralentCtaSwap = true;
  var st = document.createElement('style');
  st.textContent =
    '[data-cta="blue"]:hover{background:#f5a01e !important;color:#ffffff !important;}' +
    '[data-cta="orange"]:hover{background:#163e57 !important;color:#ffffff !important;}' +
    '[data-cta="white"]{color:#163e57 !important;}' +
    '[data-cta="white"] > span:empty{background:#163e57 !important;}' +
    '[data-cta="white"]:hover{background:#f5a01e !important;color:#ffffff !important;}' +
    '[data-cta="white"]:hover > span:empty{background:#ffffff !important;}' +
    '[data-cta]:hover > span:empty{background:#ffffff !important;}' +
    '[data-cta-hover="white"]:hover{background:#ffffff !important;color:#163e57 !important;}' +
    '[data-cta-hover="white"]:hover > span:empty{background:#163e57 !important;}';
  document.head.appendChild(st);
  function tag(el) {
    if (el.hasAttribute('data-cta') || el.matches(':hover')) return;
    var bg = getComputedStyle(el).backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return;
    el.setAttribute('data-cta', /rgba?\(\s*245,\s*160,\s*30/.test(bg) ? 'orange'
      : /rgba?\(\s*255,\s*255,\s*255/.test(bg) ? 'white' : 'blue');
  }
  function tagAll() {
    document.querySelectorAll('.pill, .page button').forEach(tag);
  }
  function boot(tries) {
    tagAll();
    if (tries > 0) setTimeout(function () { boot(tries - 1); }, 400);
  }
  boot(6);
})();

/* ---- Sticky header mobile: compare scrollando verso l'alto ---- */
(function () {
  if (window.__stralentStickyWired) return;
  window.__stralentStickyWired = true;
  var BAR = null, lastY = 0, shown = false;

  function build() {
    if (BAR) return BAR;
    var bar = document.createElement('div');
    bar.id = 'sticky-bar';
    bar.setAttribute('style', 'position:fixed; top:0; left:0; right:0; height:70px; z-index:55;' +
      'display:none; align-items:center; justify-content:space-between; padding:0 20px;' +
      'background:rgba(12,50,74,.72); -webkit-backdrop-filter:blur(14px) saturate(1.2);' +
      'backdrop-filter:blur(14px) saturate(1.2); box-shadow:0 6px 24px rgba(12,44,64,.18);' +
      'transform:translateY(-100%); transition:transform .32s cubic-bezier(.22,.61,.36,1);');

    var a = document.createElement('a');
    a.href = 'Homepage.dc.html';
    a.setAttribute('style', 'display:inline-flex; align-items:center;');
    var img = document.createElement('img');
    img.src = './stralent-logo-bianco.png';
    img.alt = 'Stralent';
    img.setAttribute('style', 'height:20px; width:auto; display:block;');
    a.appendChild(img);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Apri il menu');
    btn.setAttribute('style', 'width:44px; height:44px; padding:0; border:none; cursor:pointer;' +
      'border-radius:999px; background:#f5a01e; display:flex; align-items:center; justify-content:center;');
    var wrap = document.createElement('span');
    wrap.setAttribute('style', 'position:relative; display:block; width:22px; height:16px;');
    [0, 7, 14].forEach(function (top) {
      var l = document.createElement('span');
      l.setAttribute('style', 'position:absolute; left:0; top:' + top + 'px; width:22px; height:2px; border-radius:2px; background:#ffffff;');
      wrap.appendChild(l);
    });
    btn.appendChild(wrap);
    btn.addEventListener('click', function () {
      var t = document.getElementById('menu-toggle');
      if (t) t.click();
    });

    bar.appendChild(a);
    bar.appendChild(btn);
    document.body.appendChild(bar);
    BAR = bar;
    return bar;
  }

  function menuOpen() {
    var p = document.getElementById('menu-panel');
    return !!(p && p.getAttribute('data-open') === '1');
  }

  function onScroll() {
    var mobile = window.innerWidth <= 768;
    var bar = build();
    if (!mobile) { bar.style.display = 'none'; shown = false; return; }
    bar.style.display = 'flex';

    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var topbar = document.querySelector('.hero-topbar');
    var threshold = topbar ? topbar.getBoundingClientRect().height + 120 : 200;
    var up = y < lastY - 2;
    var down = y > lastY + 2;

    if (menuOpen() || y < threshold) shown = false;
    else if (up) shown = true;
    else if (down) shown = false;

    bar.style.transform = shown ? 'translateY(0)' : 'translateY(-100%)';
    lastY = y;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  document.addEventListener('click', function () { setTimeout(onScroll, 30); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onScroll);
  else onScroll();
})();


/* ---------- Messaggi di errore: consenso privacy ---------- */
(function () {
  if (window.__stralentConsentWired) return;
  window.__stralentConsentWired = true;
  var MSG = 'Per procedere devi accettare il trattamento dei dati personali.';
  function labelOf(cb) { return (cb.closest && cb.closest('label')) || cb.parentElement; }
  function isConsent(cb) {
    var lab = labelOf(cb);
    return !!lab && /trattamento dei|privacy policy/i.test(lab.textContent || '');
  }
  function errEl(cb, create) {
    var lab = labelOf(cb);
    if (!lab || !lab.parentElement) return null;
    var e = lab.parentElement.querySelector('[data-consent-error]');
    if (!e && create) {
      e = document.createElement('div');
      e.setAttribute('data-consent-error', '');
      e.setAttribute('role', 'alert');
      e.style.cssText = "margin-top:6px; font-family:'Barlow',sans-serif; font-weight:500; font-size:14px; line-height:20px; color:#b3261e; text-align:center;";
      e.textContent = MSG;
      lab.insertAdjacentElement('afterend', e);
    }
    return e;
  }
  function boxes(scope) {
    var out = [], all = scope.querySelectorAll('input[type="checkbox"]');
    for (var i = 0; i < all.length; i++) if (isConsent(all[i])) out.push(all[i]);
    return out;
  }
  function validate(scope) {
    var ok = true;
    boxes(scope).forEach(function (cb) {
      var e = errEl(cb, !cb.checked);
      if (!cb.checked) {
        ok = false;
        if (e) e.style.display = 'block';
        cb.setAttribute('aria-invalid', 'true');
      } else if (e) { e.style.display = 'none'; cb.removeAttribute('aria-invalid'); }
    });
    return ok;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[type="submit"], button:not([type])') : null;
    if (!b) return;
    var scope = (b.closest && (b.closest('form') || b.closest('[data-contact-card]') || b.closest('[data-nl-card]') || b.closest('section'))) || document;
    if (!validate(scope)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('change', function (e) {
    var cb = e.target;
    if (!cb || cb.type !== 'checkbox' || !isConsent(cb)) return;
    var el = errEl(cb, false);
    if (el && cb.checked) { el.style.display = 'none'; cb.removeAttribute('aria-invalid'); }
  });
})();

/* ---------- Chiusura pop-up (fallback globale) ---------- */
(function () {
  if (window.__stralentPopupCloseWired) return;
  window.__stralentPopupCloseWired = true;
  var SEL = '[data-contact-overlay],[data-nl-overlay]';
  function hideAll() {
    document.querySelectorAll(SEL).forEach(function (o) { o.style.display = 'none'; });
    document.body.style.overflow = '';
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('[data-contact-close],[data-nl-close]')) { e.preventDefault(); e.stopPropagation(); hideAll(); return; }
    var ov = e.target.closest(SEL);
    if (ov && e.target === ov) hideAll();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideAll(); });
})();

/* ---------- Sticky header: compare allo scroll verso l'alto ---------- */
(function () {
  if (window.__stralentStickyNav) return;
  window.__stralentStickyNav = true;
  var bar = null, lastY = 0, shown = false;
  function build() {
    if (bar) return bar;
    var src = document.getElementById('menu-panel');
    if (!src) return null;
    var st = document.createElement('style');
    st.textContent =
      '#stralent-sticky{position:fixed;top:0;left:0;right:0;z-index:1500;display:flex;align-items:center;justify-content:space-between;gap:32px;' +
      'padding:14px 48px;box-sizing:border-box;' +
      'background:linear-gradient(45deg, rgba(13,45,77,.72) 0%, rgba(74,100,137,.72) 55%, rgba(195,110,198,.72) 100%);' +
      '-webkit-backdrop-filter:blur(18px) saturate(1.2);backdrop-filter:blur(18px) saturate(1.2);' +
      'transform:translateY(-100%);transition:transform .32s cubic-bezier(.4,0,.2,1);will-change:transform;}' +
      '#stralent-sticky[data-show="1"]{transform:translateY(0);}' +
      '#stralent-sticky img{height:38px;width:auto;display:block;}' +
      '#stralent-sticky nav{display:flex;align-items:center;gap:28px;flex-wrap:wrap;justify-content:flex-end;}' +
      '#stralent-sticky nav a{display:inline-flex;align-items:center;gap:10px;font-family:\'Barlow\',sans-serif;font-weight:400;font-size:18px;line-height:18px;color:#ffffff;text-decoration:none;white-space:nowrap;}' +
      '#stralent-sticky nav a::before{content:"";width:8px;height:8px;border-radius:50%;background:#f5a01e;flex:none;}' +
      '#stralent-sticky nav a:hover{color:#f5a01e;}' +
      '#stralent-sticky nav a.social-link::before{display:none;}' +
      '#stralent-sticky nav a.social-link svg{width:24px;height:24px;display:block;}' +
      '@media (max-width:1024px){#stralent-sticky{padding:10px 24px;}#stralent-sticky nav{gap:18px;}#stralent-sticky nav a{font-size:16px;}}' +
      '@media (max-width:768px){#stralent-sticky{display:none;}}';
    document.head.appendChild(st);
    bar = document.createElement('div');
    bar.id = 'stralent-sticky';
    var logo = document.createElement('a');
    logo.href = 'Homepage.dc.html';
    logo.style.cssText = 'display:inline-flex;flex:none;';
    var src_img = document.querySelector('.hero-topbar img[alt="Stralent"]') || document.querySelector('img[alt="Stralent"]');
    var img = document.createElement('img');
    img.src = src_img ? src_img.getAttribute('src') : './stralent-logo-bianco.png';
    img.alt = 'Stralent';
    logo.appendChild(img);
    var nav = document.createElement('nav');
    [].forEach.call(src.querySelectorAll('a[href]'), function (a) {
      var c = a.cloneNode(true);
      c.removeAttribute('style');
      c.removeAttribute('id');
      [].forEach.call(c.querySelectorAll('[style]'), function (n) { if (n.tagName !== 'svg' && n.tagName !== 'path') n.removeAttribute('style'); });
      nav.appendChild(c);
    });
    bar.appendChild(logo);
    bar.appendChild(nav);
    document.body.appendChild(bar);
    return bar;
  }
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var up = y < lastY - 2;
    var down = y > lastY + 2;
    if (y > 260 && up) {
      if (!shown && build()) { shown = true; bar.setAttribute('data-show', '1'); }
    } else if (down || y <= 260) {
      if (shown && bar) { shown = false; bar.removeAttribute('data-show'); }
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();
