/**
 * TrendingVerse Audience Tracker v1.2
 * Tracks: pageviews, geo, device, interests, scroll depth
 * Email capture: popup at 12s OR 60% scroll OR exit intent
 */
(function () {
  'use strict';

  const CMS  = 'https://trendingverse.vercel.app';
  const SITE = window.TV_SITE_URL || window.location.origin;
  const CAT  = window.TV_CATEGORY || '';
  const PAGE = window.location.href;

  // ── FINGERPRINT ──────────────────────────────────────────────
  function getFingerprint() {
    let fp = localStorage.getItem('_tvfp');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('_tvfp', fp);
    }
    window.tvFingerprint = fp;
    return fp;
  }

  function getDevice() {
    const w = window.innerWidth;
    if (w <= 768) return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  }

  // ── PAGEVIEW ─────────────────────────────────────────────────
  function trackPageview(fp) {
    fetch(CMS + '/api/audience/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: fp, site_url: SITE, page_url: PAGE,
        category: CAT, device_type: getDevice(),
        referrer: document.referrer || '',
        user_agent: navigator.userAgent,
        language: navigator.language || 'en',
        screen_width: screen.width, screen_height: screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      }),
    }).catch(function() {});
  }

  // ── SCROLL DEPTH ─────────────────────────────────────────────
  function initScrollTracker(fp) {
    var maxScroll = 0;
    var reported = {};
    var scrollTimer = null;
    var MILESTONES = [25, 50, 75, 90, 100];

    function getDepth() {
      var doc = document.documentElement;
      var scrollH = doc.scrollHeight - doc.clientHeight;
      if (scrollH <= 0) return 100;
      return Math.min(100, Math.round((window.scrollY / scrollH) * 100));
    }

    function sendDepth(depth) {
      fetch(CMS + '/api/audience/track/scroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: fp, site_url: SITE, page_url: PAGE, scroll_depth: depth }),
        keepalive: true,
      }).catch(function() {});
    }

    function onScroll() {
      var depth = getDepth();
      if (depth <= maxScroll) return;
      maxScroll = depth;
      for (var i = 0; i < MILESTONES.length; i++) {
        if (depth >= MILESTONES[i] && !reported[MILESTONES[i]]) {
          reported[MILESTONES[i]] = true;
          sendDepth(depth);
        }
      }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function() { sendDepth(maxScroll); }, 2000);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('beforeunload', function() { if (maxScroll > 0) sendDepth(maxScroll); });
    setTimeout(function() { if (maxScroll === 0) sendDepth(0); }, 3000);

    // Return getter for lead capture
    return function() { return maxScroll; };
  }

  // ── LEAD CAPTURE POPUP ────────────────────────────────────────
  function initLeadCapture(fp, getScrollDepth) {
    if (sessionStorage.getItem('_tvlc')) return;

    var shown = false;

    function showPopup() {
      if (shown || sessionStorage.getItem('_tvlc')) return;
      if (document.getElementById('tv-lead-popup')) return;
      shown = true;

      var overlay = document.createElement('div');
      overlay.id = 'tv-lead-popup';
      overlay.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'z-index:99999',
        'background:#fff', 'border-radius:16px', 'padding:20px 24px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.18)', 'max-width:300px',
        'font-family:Arial,sans-serif', 'border:1px solid #e5e7eb',
        'animation:tvSlideIn 0.3s ease',
      ].join(';');

      // Add animation
      if (!document.getElementById('tv-popup-style')) {
        var style = document.createElement('style');
        style.id = 'tv-popup-style';
        style.textContent = '@keyframes tvSlideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
        document.head.appendChild(style);
      }

      overlay.innerHTML = '<button onclick="document.getElementById(\'tv-lead-popup\').remove();sessionStorage.setItem(\'_tvlc\',\'1\')" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:#999;line-height:1">×</button>' +
        '<p style="font-weight:700;font-size:14px;margin:0 0 4px;color:#111">Stay updated 📬</p>' +
        '<p style="font-size:12px;color:#666;margin:0 0 12px">Get the latest news in your inbox</p>' +
        '<input id="tv-lead-email" type="email" placeholder="your@email.com" style="width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:8px" />' +
        '<button onclick="tvSubmitLead(\'' + fp + '\')" style="width:100%;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Subscribe →</button>';

      document.body.appendChild(overlay);
    }

    // Trigger 1: Time — 12 seconds
    setTimeout(showPopup, 12000);

    // Trigger 2: Scroll — 60% depth
    window.addEventListener('scroll', function() {
      if (getScrollDepth && getScrollDepth() >= 60) showPopup();
    }, { passive: true });

    // Trigger 3: Exit intent — mouse leaves top of page
    document.addEventListener('mouseleave', function(e) {
      if (e.clientY < 10) showPopup();
    });
  }

  window.tvSubmitLead = function(fp) {
    var email = document.getElementById('tv-lead-email') ? document.getElementById('tv-lead-email').value : '';
    if (!email || !email.includes('@')) return;

    fetch(CMS + '/api/audience/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: fp, site_url: SITE, email: email, event: 'lead_capture' }),
    }).catch(function() {});

    var popup = document.getElementById('tv-lead-popup');
    if (popup) {
      popup.innerHTML = '<p style="text-align:center;padding:8px;font-size:13px;color:#16a34a;font-weight:600">✓ Subscribed!</p>';
      sessionStorage.setItem('_tvlc', '1');
      setTimeout(function() {
        var p = document.getElementById('tv-lead-popup');
        if (p) p.remove();
      }, 2000);
    }
  };

  // ── INIT ─────────────────────────────────────────────────────
  function init() {
    var fp = getFingerprint();
    trackPageview(fp);
    var getScrollDepth = initScrollTracker(fp);
    initLeadCapture(fp, getScrollDepth);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
