/**
 * TrendingVerse Audience Tracker v1.1
 * Tracks: pageviews, geo, device, interests, scroll depth
 */
(function () {
  'use strict';

  const CMS = 'https://trendingverse.vercel.app';
  const SITE = window.TV_SITE_URL || window.location.origin;
  const CAT  = window.TV_CATEGORY || '';
  const PAGE = window.location.href;

  // ── FINGERPRINT ──────────────────────────────────────────────────
  function getFingerprint() {
    let fp = localStorage.getItem('_tvfp');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('_tvfp', fp);
    }
    window.tvFingerprint = fp;
    return fp;
  }

  // ── DEVICE ───────────────────────────────────────────────────────
  function getDevice() {
    const w = window.innerWidth;
    if (w <= 768) return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  }

  // ── PAGEVIEW TRACK ───────────────────────────────────────────────
  function trackPageview(fp) {
    fetch(CMS + '/api/audience/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: fp,
        site_url: SITE,
        page_url: PAGE,
        category: CAT,
        device_type: getDevice(),
        referrer: document.referrer || '',
        user_agent: navigator.userAgent,
        language: navigator.language || 'en',
        screen_width: screen.width,
        screen_height: screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      }),
    }).catch(() => {});
  }

  // ── SCROLL DEPTH ─────────────────────────────────────────────────
  function initScrollTracker(fp) {
    let maxScroll = 0;
    const reported = new Set();
    let scrollTimer = null;
    const MILESTONES = [25, 50, 75, 90, 100];

    function getDepth() {
      const doc = document.documentElement;
      const scrollH = doc.scrollHeight - doc.clientHeight;
      if (scrollH <= 0) return 100;
      return Math.min(100, Math.round((window.scrollY / scrollH) * 100));
    }

    function sendDepth(depth) {
      fetch(CMS + '/api/audience/track/scroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: fp,
          site_url: SITE,
          page_url: PAGE,
          scroll_depth: depth,
        }),
        keepalive: true,
      }).catch(() => {});
    }

    function onScroll() {
      const depth = getDepth();
      if (depth <= maxScroll) return;
      maxScroll = depth;

      // Fire at milestones
      for (const m of MILESTONES) {
        if (depth >= m && !reported.has(m)) {
          reported.add(m);
          sendDepth(depth);
        }
      }

      // Debounced send
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => sendDepth(maxScroll), 2000);
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // Send on exit
    window.addEventListener('beforeunload', () => {
      if (maxScroll > 0) sendDepth(maxScroll);
    });

    // If no scroll after 3s, record 0%
    setTimeout(() => {
      if (maxScroll === 0) sendDepth(0);
    }, 3000);
  }

  // ── LEAD CAPTURE POPUP ────────────────────────────────────────────
  function initLeadCapture(fp) {
    if (sessionStorage.getItem('_tvlc')) return; // already shown this session

    setTimeout(function () {
      if (document.getElementById('tv-lead-popup')) return;

      const overlay = document.createElement('div');
      overlay.id = 'tv-lead-popup';
      overlay.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'z-index:99999',
        'background:#fff', 'border-radius:16px', 'padding:20px 24px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.15)', 'max-width:300px',
        'font-family:Arial,sans-serif', 'border:1px solid #e5e7eb',
      ].join(';');

      overlay.innerHTML = `
        <button onclick="document.getElementById('tv-lead-popup').remove();sessionStorage.setItem('_tvlc','1')"
          style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:#999">×</button>
        <p style="font-weight:700;font-size:14px;margin:0 0 4px;color:#111">Stay updated 📬</p>
        <p style="font-size:12px;color:#666;margin:0 0 12px">Get the latest news in your inbox</p>
        <input id="tv-lead-email" type="email" placeholder="your@email.com"
          style="width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:8px" />
        <button onclick="tvSubmitLead('${fp}')"
          style="width:100%;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
          Subscribe →
        </button>`;

      document.body.appendChild(overlay);
    }, 30000); // 30 seconds
  }

  window.tvSubmitLead = function (fp) {
    const email = document.getElementById('tv-lead-email')?.value;
    if (!email || !email.includes('@')) return;

    fetch(CMS + '/api/audience/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: fp,
        site_url: SITE,
        email: email,
        event: 'lead_capture',
      }),
    }).catch(() => {});

    document.getElementById('tv-lead-popup').innerHTML =
      '<p style="text-align:center;padding:8px;font-size:13px;color:#16a34a;font-weight:600">✓ Subscribed!</p>';
    sessionStorage.setItem('_tvlc', '1');
    setTimeout(() => document.getElementById('tv-lead-popup')?.remove(), 2000);
  };

  // ── INIT ─────────────────────────────────────────────────────────
  function init() {
    const fp = getFingerprint();
    trackPageview(fp);
    initScrollTracker(fp);
    initLeadCapture(fp);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
