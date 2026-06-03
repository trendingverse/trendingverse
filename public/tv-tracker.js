/**
 * TrendingVerse Audience Tracker v2.0
 * First-party cookie tracking + targeted direct ad delivery
 */
(function() {
  'use strict';

  var BASE = 'https://trendingverse.vercel.app';
  var API  = BASE + '/api/audience/track';
  var SITE = window.TV_SITE_URL || window.location.hostname;
  var CAT  = window.TV_CATEGORY || '';

  // ── Fingerprint ──────────────────────────────────────────────
  function getFP() {
    var k = 'tv_fp', fp = localStorage.getItem(k);
    if (!fp) { fp = 'tvf_' + Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem(k, fp); } catch(e){} }
    return fp;
  }
  var FP = getFP();

  // ── Send tracking event ──────────────────────────────────────
  function send(type, value) {
    fetch(API, {
      method: 'POST', mode: 'cors', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: FP, site_url: SITE, page_url: location.href, page_title: document.title, category: CAT, event_type: type, value: value || '', referrer: document.referrer || '' }),
    }).catch(function(){});
  }

  // ── Tracking events ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() { send('pageview'); loadDirectAds(); });

  var maxScroll = 0, scrollTimer;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      var s = Math.round((scrollY / (document.body.scrollHeight - innerHeight)) * 100);
      if (s > maxScroll && s % 25 === 0) { maxScroll = s; send('scroll', s + '%'); }
      if (s > 30) showSubscribeBar();
    }, 500);
  }, { passive: true });

  var startTime = Date.now(), timeSent = false;
  function sendTime() { if (timeSent) return; timeSent = true; var s = Math.round((Date.now() - startTime) / 1000); if (s > 5) send('time_spent', s); }
  window.addEventListener('beforeunload', sendTime);
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') sendTime(); });

  // ── Direct Ad Delivery ───────────────────────────────────────
  function loadDirectAds() {
    var positions = ['header', 'in_content', 'footer'];
    positions.forEach(function(pos) {
      fetch(BASE + '/api/audience/serve-ad', {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: FP, site_url: SITE, position: pos }),
      })
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.ad) injectDirectAd(data.ad, pos); })
      .catch(function(){});
    });
  }

  function injectDirectAd(ad, position) {
    var html = buildAdHtml(ad);
    if (!html) return;

    var wrap = document.createElement('div');
    wrap.className = 'tv-direct-ad';
    wrap.style.cssText = 'text-align:center;margin:20px auto;clear:both;';
    wrap.innerHTML = html;

    // Click tracking
    wrap.addEventListener('click', function() {
      fetch(BASE + '/api/audience/ad-click', {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_id: ad.id, fingerprint: FP, site_url: SITE }),
      }).catch(function(){});
    });

    if (position === 'header') {
      var entry = document.querySelector('.entry-content, .post-content, article');
      if (entry) entry.insertBefore(wrap, entry.firstChild);
    } else if (position === 'footer') {
      var entry2 = document.querySelector('.entry-content, .post-content, article');
      if (entry2) entry2.appendChild(wrap);
    } else if (position === 'in_content') {
      var paras = document.querySelectorAll('.entry-content p, .post-content p');
      var target = paras[Math.min(2, paras.length - 1)];
      if (target) target.parentNode.insertBefore(wrap, target.nextSibling);
    }
  }

  function buildAdHtml(ad) {
    var styles = 'font-family:-apple-system,sans-serif;display:inline-block;max-width:' + (ad.size_width || 300) + 'px;width:100%;';
    if (ad.ad_type === 'text') {
      return '<div style="' + styles + 'padding:12px 16px;background:#f3f4f6;border-left:4px solid #ef4444;border-radius:4px;text-align:left;">' +
        '<p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111;">' + (ad.headline || '') + '</p>' +
        '<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">' + (ad.description || '') + '</p>' +
        '<a href="' + ad.destination_url + '" target="_blank" rel="noopener" style="font-size:12px;color:#ef4444;font-weight:600;text-decoration:none;">' + (ad.cta_text || 'Learn More') + ' →</a>' +
        '<span style="float:right;font-size:9px;color:#d1d5db;">Ad</span>' +
      '</div>';
    }
    if (ad.ad_type === 'native' && ad.image_url) {
      return '<div style="' + styles + 'border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;text-align:left;">' +
        '<img src="' + ad.image_url + '" style="width:100%;height:160px;object-fit:cover;" alt="">' +
        '<div style="padding:12px;">' +
          '<p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#111;">' + (ad.headline || '') + '</p>' +
          '<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">' + (ad.description || '') + '</p>' +
          '<a href="' + ad.destination_url + '" target="_blank" rel="noopener" style="font-size:12px;background:#ef4444;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-weight:600;">' + (ad.cta_text || 'Learn More') + '</a>' +
          '<span style="float:right;font-size:9px;color:#d1d5db;margin-top:4px;">Sponsored</span>' +
        '</div>' +
      '</div>';
    }
    if (ad.image_url) {
      return '<a href="' + ad.destination_url + '" target="_blank" rel="noopener" style="display:inline-block;position:relative;">' +
        '<img src="' + ad.image_url + '" width="' + (ad.size_width || 300) + '" height="' + (ad.size_height || 250) + '" style="display:block;max-width:100%;" alt="' + (ad.headline || 'Ad') + '">' +
        '<span style="position:absolute;bottom:4px;right:4px;font-size:9px;background:rgba(0,0,0,0.4);color:#fff;padding:1px 4px;border-radius:2px;">Ad</span>' +
      '</a>';
    }
    return '';
  }

  // ── Non-intrusive subscribe bar ──────────────────────────────
  function showSubscribeBar() {
    if (localStorage.getItem('tv_subscribed')) return;
    var dismissed = localStorage.getItem('tv_bar_dismissed');
    if (dismissed && Date.now() < parseInt(dismissed)) return;
    if (document.getElementById('tv-sub-bar')) return;

    var bar = document.createElement('div');
    bar.id = 'tv-sub-bar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#111827;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;font-family:-apple-system,sans-serif;font-size:13px;box-shadow:0 -2px 12px rgba(0,0,0,0.15);transform:translateY(100%);transition:transform 0.3s ease;';
    bar.innerHTML = '<span style="color:#9ca3af;font-size:12px;white-space:nowrap">📰 Get daily updates</span>' +
      '<input id="tv-bar-email" type="email" placeholder="Your email" style="flex:1;max-width:220px;padding:6px 10px;border:1px solid #374151;border-radius:6px;background:#1f2937;color:#fff;font-size:12px;outline:none;">' +
      '<button id="tv-bar-submit" style="background:#ef4444;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Subscribe →</button>' +
      '<button id="tv-bar-close" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;padding:0 4px;line-height:1;" title="Dismiss">✕</button>';

    document.body.appendChild(bar);
    setTimeout(function() { bar.style.transform = 'translateY(0)'; }, 100);

    document.getElementById('tv-bar-close').addEventListener('click', function() {
      bar.style.transform = 'translateY(100%)';
      setTimeout(function() { bar.remove(); }, 300);
      localStorage.setItem('tv_bar_dismissed', Date.now() + 7 * 86400000);
    });

    document.getElementById('tv-bar-submit').addEventListener('click', function() {
      var email = document.getElementById('tv-bar-email').value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('tv-bar-email').style.borderColor = '#ef4444'; return; }
      var btn = document.getElementById('tv-bar-submit');
      btn.textContent = '✓ Done!'; btn.style.background = '#10b981'; btn.disabled = true;
      fetch(API, { method: 'PUT', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fingerprint: FP, email: email, source_site: SITE, source_page: location.href, interests: CAT ? [CAT] : [] }) }).catch(function(){});
      localStorage.setItem('tv_subscribed', '1');
      send('lead_capture', email);
      setTimeout(function() { bar.style.transform = 'translateY(100%)'; setTimeout(function() { bar.remove(); }, 300); }, 2000);
    });
  }

  window.TV_TRACKER = { fingerprint: FP, send: send };
})();
