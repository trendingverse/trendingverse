/* ══════════════════════════════════════════════════════════════════
 * TrendingVerse Universal Ad Tag  —  tv-universal-ads.js
 *
 * ONE script, ANY website (WordPress or not). Publishers add:
 *
 *   <script src="https://trendingverse.vercel.app/tv-universal-ads.js"
 *           data-tv-key="PUBLISHER_KEY"></script>
 *
 * and mark ad slots anywhere in their HTML:
 *
 *   <div class="tv-ad" data-position="in_content" data-w="300" data-h="250"></div>
 *
 * The tag asks YOUR server for an ordered list of demand sources and
 * tries each until one fills — direct campaign, then partner A, B, …
 * All intelligence is server-side; the tag just executes the order.
 * ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var API = 'https://trendingverse.vercel.app/api/mediation';
  var SERVE = API + '/serve-slot';
  var EVENT = API + '/event';

  // Publisher key + site from the script tag
  var self = document.currentScript;
  var PUB_KEY = self ? self.getAttribute('data-tv-key') : '';
  var SITE = window.location.origin;

  // Fingerprint (reuse tv-tracker's if present; else a lightweight local id)
  function fp() {
    if (window.tvFingerprint) return window.tvFingerprint;
    try {
      var k = localStorage.getItem('_tvfp');
      if (k) return k;
      var n = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('_tvfp', n);
      return n;
    } catch (e) { return ''; }
  }

  function beacon(slot, partner, type) {
    try {
      fetch(EVENT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: fp(), site_url: SITE,
          position: slot.dataset.position || 'in_content',
          partner_slug: partner, event_type: type,
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  // Did something actually render into the slot? (fill detection)
  function filled(el) {
    if (el.querySelector('iframe, ins, img, embed')) {
      return el.getBoundingClientRect().height > 20;
    }
    return el.getBoundingClientRect().height > 20;
  }

  // Render a DIRECT ad (your own creative)
  function renderDirect(slot, ad) {
    var w = parseInt(ad.size_width, 10) || 300;
    var wrap = document.createElement('div');
    wrap.className = 'tv-direct-ad';
    wrap.setAttribute('data-ad-id', ad.ad_id);
    wrap.style.cssText = 'max-width:' + w + 'px;margin:16px auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;font-family:inherit;';
    var html = '';
    if (ad.image_url) html += '<img src="' + ad.image_url + '" alt="" style="width:100%;display:block;">';
    html += '<div style="padding:10px 12px;">';
    if (ad.headline) html += '<p style="font-weight:700;font-size:14px;color:#111;margin:0 0 4px;">' + ad.headline + '</p>';
    if (ad.description) html += '<p style="font-size:12px;color:#666;margin:0 0 8px;">' + ad.description + '</p>';
    if (ad.cta_text) html += '<span style="display:inline-block;background:#d1382c;color:#fff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:5px;">' + ad.cta_text + '</span>';
    html += '</div>';
    wrap.innerHTML = html;
    wrap.addEventListener('click', function () {
      beacon(slot, 'direct', 'click');
      if (ad.destination_url) window.open(ad.destination_url, '_blank', 'noopener');
    });
    slot.innerHTML = '';
    slot.appendChild(wrap);
    beacon(slot, 'direct', 'fill');
  }

  // Render a NETWORK partner's ad code (executes inline <script>s)
  function renderNetwork(slot, item) {
    try {
      var range = document.createRange();
      range.selectNode(slot);
      slot.appendChild(range.createContextualFragment(item.ad_code));
    } catch (e) {}
  }

  // Try the demand list in order; stop at the first that fills.
  function runWaterfall(slot, demand, i) {
    if (i >= demand.length) { beacon(slot, 'nofill', 'nofill'); return; }
    var item = demand[i];

    if (item.type === 'direct') {
      renderDirect(slot, item);
      return; // direct always "fills" (it's our own creative)
    }

    // Network partner: inject its code, then check fill after a moment.
    renderNetwork(slot, item);
    setTimeout(function () {
      if (filled(slot)) {
        beacon(slot, item.source, 'fill');
      } else {
        // No fill — clear and try the next partner down the waterfall.
        slot.innerHTML = '';
        beacon(slot, item.source, 'nofill');
        runWaterfall(slot, demand, i + 1);
      }
    }, 2200);
  }

  function fillSlot(slot) {
    if (slot.dataset.tvFilled === '1') return;
    slot.dataset.tvFilled = '1';
    fetch(SERVE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publisher_key: PUB_KEY, site_url: SITE,
        position: slot.dataset.position || 'in_content',
        width: slot.dataset.w || 300, height: slot.dataset.h || 250,
        fingerprint: fp(),
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.demand && data.demand.length) {
          runWaterfall(slot, data.demand, 0);
        }
      })
      .catch(function () {});
  }

  // Lazy-load: fill each slot as it nears the viewport.
  function init() {
    var slots = document.querySelectorAll('.tv-ad');
    if (!slots.length) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { fillSlot(e.target); io.unobserve(e.target); }
        });
      }, { rootMargin: '600px 0px' });
      slots.forEach(function (s) { io.observe(s); });
    } else {
      slots.forEach(fillSlot);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
