/* ──────────────────────────────────────────────────────────────────────────────
 *  app.js — Lógica de Programação (logica.impacta.com.br)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  O que faz (mesma convenção das LPs irmãs — QA Next, Claude, Código Zero):
 *   1. Captura utm_* da URL (e os persiste por sessão).
 *   2. Repassa os UTMs para TODOS os links de saída (checkouts Engaged + WhatsApp),
 *      preservando os params que o anúncio mandou pra esta página.
 *   3. Empurra eventos pra IRIS (cockpit em tempo real): lp_view, click_compra,
 *      click_whats — POST /api/events. Esta LP tem DUAS turmas (presencial e
 *      online), cada uma com seu checkout — modalidade/turma vão no meta do evento.
 *   4. Pixel Meta — placeholder no-op até META_PIXEL_ID ser preenchido.
 *
 *  Sem barreira de captura de dados: WhatsApp e checkout vão direto.
 *  (Sem integração com integracao-rd — não há form de lead.)
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CFG = {
    PRODUCT_SLUG:    'logica',
    CAMPAIGN_SLUG:   'logica-setembro-2026',
    IRIS_EVENTS_URL: 'https://iris.technowhub.ai/api/events',
    TICKET_VALUE:    1197,           // preço à vista — referência p/ value
    CURRENCY:        'BRL',
    // Pixel IRIS — pixel único de todas as LPs Impacta (jul/2026):
    META_PIXEL_ID:   '1581473926936760',
    CONTENT_NAME:    'logica',
  };

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  // Outros params de clique que também devem ser repassados ao checkout:
  var PASSTHROUGH_KEYS = ['gclid', 'fbclid', 'gad_source', 'msclkid'];
  var ALL_KEYS = UTM_KEYS.concat(PASSTHROUGH_KEYS);

  // ─── 1. Captura + persiste params da URL ──────────────────────────────────
  function getTrackingParams() {
    var qs = new URLSearchParams(window.location.search);
    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('lg_tracking') || '{}'); } catch (e) {}
    ALL_KEYS.forEach(function (k) {
      var v = qs.get(k);
      if (v) saved[k] = v;
    });
    try { sessionStorage.setItem('lg_tracking', JSON.stringify(saved)); } catch (e) {}
    return saved;
  }

  // ─── 2. Anexa os params capturados a uma URL absoluta, sem sobrescrever ────
  function withTracking(rawHref, params) {
    if (!rawHref) return rawHref;
    var url;
    try { url = new URL(rawHref, window.location.href); } catch (e) { return rawHref; }
    Object.keys(params).forEach(function (k) {
      if (!url.searchParams.has(k)) url.searchParams.set(k, params[k]);
    });
    return url.toString();
  }

  // ─── 3. Evento pra IRIS (cockpit em tempo real) ───────────────────────────
  function sendIrisEvent(eventName, extra) {
    try {
      var p = getTrackingParams();
      var body = {
        product_slug:  CFG.PRODUCT_SLUG,
        event_name:    eventName,
        campaign_slug: CFG.CAMPAIGN_SLUG,
        page_url:      location.href,
        utm_source:    p.utm_source   || null,
        utm_medium:    p.utm_medium   || null,
        utm_campaign:  p.utm_campaign || null,
        utm_content:   p.utm_content  || null,
        utm_term:      p.utm_term     || null,
        referrer:      document.referrer || null
      };
      if (extra && extra.value != null) body.value = extra.value;
      if (extra && extra.currency)      body.currency = extra.currency;
      if (extra)                        body.meta = extra;
      fetch(CFG.IRIS_EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        mode: 'cors'
      }).catch(function () {});
    } catch (e) {}
  }

  // ─── 4. Aplica nos links de saída (2 checkouts + whatsapp) ────────────────
  function decorateOutboundLinks(params) {
    document.querySelectorAll('a[data-cta]').forEach(function (el) {
      if (el.dataset.utmApplied) return;
      var href = el.getAttribute('href') || '';
      // só decora URLs absolutas (checkout/WhatsApp), nunca âncoras internas
      if (href.indexOf('http') !== 0) return;
      el.setAttribute('href', withTracking(href, params));
      el.dataset.utmApplied = '1';
      var cta = el.getAttribute('data-cta');
      el.addEventListener('click', function () {
        if (cta === 'checkout') {
          var meta = {
            value:      CFG.TICKET_VALUE,
            currency:   CFG.CURRENCY,
            modalidade: el.getAttribute('data-modalidade') || null,
            turma:      el.getAttribute('data-turma') || null
          };
          sendIrisEvent('click_compra', meta);
          track('InitiateCheckout', { value: CFG.TICKET_VALUE, currency: CFG.CURRENCY, placement: cta, modalidade: meta.modalidade });
        } else if (cta === 'whatsapp') {
          sendIrisEvent('click_whats', { channel: 'whatsapp' });
          track('Contact', { placement: cta });
        }
      });
    });
  }

  // ─── 5. Pixel Meta (no-op até ter ID) ─────────────────────────────────────
  function initPixel() {
    if (!CFG.META_PIXEL_ID || window.fbq) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CFG.META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function track(eventName, params) {
    params = Object.assign({ content_name: CFG.CONTENT_NAME }, params || {});
    if (window.fbq) { try { window.fbq('track', eventName, params); } catch (e) {} }
    if (window.dataLayer) { window.dataLayer.push(Object.assign({ event: eventName }, params)); }
  }

  // ─── 6. Run + observa mudanças no DOM ─────────────────────────────────────
  function apply() {
    var params = getTrackingParams();
    decorateOutboundLinks(params);
  }

  initPixel();
  apply();
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });

  // lp_view — uma vez por carregamento
  sendIrisEvent('lp_view');
})();

/* ──────────────────────────────────────────────────────────────────────────────
 *  Interações da página (portadas do export original)
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Reveal on scroll
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  // Vídeo do campus — toca quando entra na tela, pausa quando sai
  var vio = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var v = en.target;
      if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else { v.pause(); }
    });
  }, { threshold: 0.35 });
  document.querySelectorAll('video[data-autoplay-onview]').forEach(function (v) { vio.observe(v); });

  // Sticky bar — aparece após 700px de rolagem, some perto do rodapé
  var bar = document.getElementById('stickybar');
  function onScroll() {
    if (!bar) return;
    var y = window.scrollY || 0;
    var nearBottom = (window.innerHeight + y) >= (document.body.scrollHeight - 260);
    bar.classList.toggle('show', y > 700 && !nearBottom);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ──────────────────────────────────────────────────────────────────────────────
 *  Fundo animado (grid de pontos que ondula com o scroll)
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var c = document.getElementById('bg-canvas');
  if (!c) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = c.getContext('2d');
  var w = 0, h = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.width = Math.floor(window.innerWidth * dpr);
    h = c.height = Math.floor(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);
  var scroll = window.scrollY || 0;
  var gap = 24;
  function draw() {
    var g = gap * dpr;
    ctx.clearRect(0, 0, w, h);
    var s = scroll * 0.004;
    for (var x = 0; x <= w + g; x += g) {
      for (var y = 0; y <= h + g; y += g) {
        var wave = Math.sin(x * 0.008 + s) * Math.cos(y * 0.011 - s * 0.7);
        var off = wave * 14 * dpr;
        var px = x + off;
        var py = y + off * 0.5;
        var d = (wave + 1) / 2;
        ctx.fillStyle = 'rgba(125,245,222,' + (0.05 + d * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(px, py, (0.8 + d * 1.3) * dpr, 0, 6.283);
        ctx.fill();
      }
    }
  }
  var ticking = false;
  function onDraw() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { draw(); ticking = false; });
  }
  if (!reduce) {
    window.addEventListener('scroll', function () { scroll = window.scrollY || 0; onDraw(); }, { passive: true });
    window.addEventListener('resize', onDraw);
  }
  draw();
})();
